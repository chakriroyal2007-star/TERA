"""Explicit live audit: prepare, restart the API, then verify. Does not truncate data."""
import io
import json
import re
import sys
import time
import uuid
from pathlib import Path
import httpx
from PIL import Image
from app.db import SessionLocal
from app.models import Incident, Evidence

state = Path('.audit-persistence.json')
http = httpx.Client(base_url='http://127.0.0.1:8000/api/v1', timeout=30)
for attempt in range(30):
    try:
        if http.get('/health').status_code == 200:
            break
    except httpx.ConnectError:
        pass
    time.sleep(0.5)
else:
    raise RuntimeError('Live API did not become ready')

def checked(response, expected=200):
    assert response.status_code == expected, (response.status_code, response.text[:300])
    return response.json()

def admin():
    checked(http.post('/auth/login', json={'email': 'admin@example.com', 'password': 'test-passphrase-123'}))
    http.headers['X-CSRF-Token'] = http.cookies['tera_csrf']

if sys.argv[1] == 'prepare':
    unique = uuid.uuid4().hex[:10]
    image = io.BytesIO()
    Image.new('RGB', (25,25), 'green').save(image, format='PNG')
    evidence = checked(http.post('/public/evidence', files={'file': ('audit.png', image.getvalue(), 'image/png')}), 201)
    incident = checked(http.post('/incidents', json={
        'category': 'medical', 'description': 'Live restart persistence verification ' + unique,
        'address': 'Local evaluation location', 'evidence_ids': [evidence['id']],
    }), 201)
    admin()
    org = checked(http.post('/organizations', json={'name': 'Audit resource ' + unique}), 201)
    assert http.post('/organizations', json={'name': 'Audit resource ' + unique}).status_code == 409
    fleet = checked(http.post('/ambulances', json={'organization_id': org['id'], 'registration': 'AUDIT-' + unique}), 201)
    assert http.post('/ambulances', json={'organization_id': org['id'], 'registration': 'AUDIT-' + unique}).status_code == 409
    retired = checked(http.patch('/ambulances/' + fleet['id'], json={'active': False}))
    assert retired['active'] is False
    # Real SMTP delivery to Mailpit and actual OTP verification.
    email = 'audit-' + unique + '@example.com'
    checked(http.post('/auth/register', json={'email': email, 'name': 'Audit Citizen', 'password': 'test-passphrase-123'}), 201)
    checked(http.post('/auth/otp/request', json={'email': email, 'purpose': 'verify'}))
    mail = httpx.Client(base_url='http://mailpit:8025', timeout=10)
    messages = checked(mail.get('/api/v1/messages'))['messages']
    message = next(m for m in messages if any(t['Address'] == email for t in m['To']))
    body = checked(mail.get('/api/v1/message/' + message['ID']))
    code = re.search(r'Your code is (\d{6})', body['Text']).group(1)
    verified = checked(http.post('/auth/otp/verify', json={'email': email, 'purpose': 'verify', 'code': code}))
    state.write_text(json.dumps({'incident': incident, 'evidence_id': evidence['id'], 'ambulance_id': fleet['id']}))
    print('PASS: live report/evidence, resource create/update/retire, duplicate rejection, SMTP delivery and OTP verification')
else:
    saved = json.loads(state.read_text())
    incident = saved['incident']
    assert checked(http.get('/public/track/' + incident['tracking_code']))['status'] == 'reported'
    with SessionLocal() as db:
        assert db.get(Incident, incident['id']) is not None
        assert db.get(Evidence, saved['evidence_id']).incident_id == incident['id']
    admin()
    assert http.get('/evidence/' + saved['evidence_id']).status_code == 200
    assert http.get('/incidents/' + incident['id'] + '/report').content.startswith(b'%PDF')
    print('PASS: application restart retained PostgreSQL record, evidence association, downloadable evidence and PDF')
