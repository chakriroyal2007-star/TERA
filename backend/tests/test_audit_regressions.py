"""Regressions found by the local database-backed audit."""
import io
from PIL import Image
from sqlalchemy import select, func
from app.db import SessionLocal
from app.models import Incident, Evidence, User
from conftest import report


def test_public_cannot_provision_privileged_user_or_sync_state(client):
    assert client.post('/api/v1/auth/login', json={
        'email': 'admin@tera.org', 'password': 'Emergency@2025!'
    }).status_code == 401
    assert client.post('/api/v1/incidents/sync', json={'id': 'invented', 'status': 'closed'}).status_code in (404, 405)
    with SessionLocal() as db:
        assert db.scalar(select(User).where(User.email == 'admin@tera.org')) is None
        assert db.get(Incident, 'invented') is None


def test_dbms_data_is_not_public_or_available_to_operational_roles(client, authenticated):
    assert client.get('/api/v1/dbms/overview').status_code == 401
    for role in ('operator', 'analyst', 'responder', 'hospital', 'citizen'):
        c = authenticated(role)
        assert c.post('/api/v1/dbms/sql/execute', json={'query': 'SELECT * FROM users'}).status_code == 403
        assert c.get('/api/v1/dbms/tables/users').status_code == 403
    assert authenticated('operator').get('/api/v1/dbms/overview').status_code == 200
    admin = authenticated('admin')
    assert admin.post('/api/v1/dbms/sql/execute', json={'query': "SELECT 1; SELECT 2"}).status_code == 400
    result = admin.post('/api/v1/dbms/sql/execute', json={'query': 'SELECT generate_series(1,1000)', 'limit': 5})
    assert result.status_code == 200
    assert len(result.json()['rows']) == 5


def test_evidence_is_persisted_and_attachment_failure_rolls_back(client):
    image = io.BytesIO()
    Image.new('RGB', (20, 20), 'blue').save(image, format='PNG')
    upload = client.post('/api/v1/public/evidence', files={'file': ('evidence.png', image.getvalue(), 'image/png')})
    assert upload.status_code == 201
    eid = upload.json()['id']
    with SessionLocal() as db:
        assert db.get(Evidence, eid).incident_id is None
    iid, code = report(client, evidence_ids=[eid])
    with SessionLocal() as db:
        assert db.get(Evidence, eid).incident_id == iid
        count = db.scalar(select(func.count()).select_from(Incident))
    failed = client.post('/api/v1/incidents', json={
        'category': 'medical', 'description': 'Must roll back this second report',
        'address': 'Audit location', 'evidence_ids': [eid],
    })
    assert failed.status_code == 409
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Incident)) == count
        assert db.get(Evidence, eid).incident_id == iid
    assert client.get('/api/v1/public/track/' + code).status_code == 200
    assert client.get('/api/v1/public/track/' + iid).status_code == 404
    assert client.get('/api/v1/incidents/' + iid + '/report').status_code == 401


def test_duplicate_replay_returns_working_tracking_and_invalid_input_is_rejected(client):
    payload = {'category': 'medical', 'description': 'Audit persistent duplicate report',
               'address': 'Audit location', 'idempotency_key': 'audit-idempotency-key-12345'}
    first = client.post('/api/v1/incidents', json=payload)
    second = client.post('/api/v1/incidents', json=payload)
    assert first.status_code == second.status_code == 201
    assert first.json()['tracking_code'] == second.json()['tracking_code']
    assert client.get('/api/v1/public/track/' + second.json()['tracking_code']).status_code == 200
    for change in ({'casualties_count': -1}, {'description': ' ' * 20}, {'latitude': 200}):
        invalid = client.post('/api/v1/incidents', json={**payload, **change})
        assert invalid.status_code == 422
