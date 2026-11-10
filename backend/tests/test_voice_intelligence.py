from unittest.mock import AsyncMock, patch
from app.speech.extraction import ExtractedIncident
from app.speech.intelligence import reconcile


def extracted(**kwargs):
    return ExtractedIncident(title="Test", description="Reported accident", category="road_collision",
        location_text="Station", source_transcript="Test conversation", **kwargs)


def test_seven_involved_two_safe_means_five_need_help():
    result = reconcile(extracted(total_people=7, safe_people=2))
    assert result.assistance_needed == result.affected_people == 5
    assert result.severity == "high"


def test_injured_is_not_added_to_total():
    result = reconcile(extracted(total_people=7, safe_people=2, injured_people=3, assistance_needed=5))
    assert result.affected_people == 5


def test_conflicting_counts_require_clarification():
    result = reconcile(extracted(total_people=7, safe_people=8))
    assert result.affected_people is None
    assert result.counts_unclear and result.follow_up_questions


def test_unknown_conditions_do_not_become_medical_casualties():
    result = reconcile(extracted(total_people=7, safe_people=2, unknown_condition_people=5))
    assert result.assistance_needed is None


def test_all_safe_preserves_zero():
    assert reconcile(extracted(total_people=2, safe_people=2)).affected_people == 0


def test_explicit_life_threat_is_critical():
    assert reconcile(extracted(life_threatening=True)).severity == "critical"


def test_followup_persists_context_and_counts(client):
    from app.db import SessionLocal
    from app.models import VoiceRecording, Transcript, IncidentExtraction
    with SessionLocal() as db:
        rec = VoiceRecording(storage_reference="test", original_filename="test.wav", mime_type="audio/wav", file_size=1000, duration=1, checksum="test")
        db.add(rec); db.flush()
        db.add(Transcript(recording_id=rec.id, original_transcript="Seven people involved.", detected_language="en", provider="test"))
        db.add(IncidentExtraction(recording_id=rec.id, extracted_json=extracted(total_people=7).model_dump()))
        db.commit(); rec_id = rec.id
    result = reconcile(extracted(total_people=7, safe_people=2))
    with patch("app.speech.router.extract_context", new=AsyncMock(return_value=result)) as model:
        response = client.post(f"/api/v1/voice/recordings/{rec_id}/follow-up", json={"message":"Two are safe."})
    assert response.status_code == 200
    assert "Seven people involved." in model.call_args.args[0]
    assert "Two are safe." in model.call_args.args[0]
    restored = client.get(f"/api/v1/speech/transcripts/{rec_id}").json()["extraction"]
    assert restored["affected_people"] == 5
    assert restored["conversation"][0]["content"] == "Two are safe."


def test_role_request_cannot_self_grant_admin(authenticated):
    citizen=authenticated('citizen')
    response=citizen.post('/api/v1/auth/onboarding',json={'name':'Citizen Updated','intended_role':'admin'})
    assert response.status_code==200
    assert response.json()['role']=='citizen'
    assert response.json()['request_status']=='pending'
    assert citizen.get('/api/v1/auth/role-requests').status_code==403
    admin=authenticated('admin')
    requests=admin.get('/api/v1/auth/role-requests').json()
    assert len(requests)==1
    request_id=requests[0]['id']
    assert citizen.post('/api/v1/auth/role-requests/'+request_id,json={'approve':True}).status_code==403
    from app.db import SessionLocal
    from app.models import Organization
    from sqlalchemy import select
    with SessionLocal() as db:
        org=db.scalar(select(Organization.id))
    approved=admin.post('/api/v1/auth/role-requests/'+request_id,json={'approve':True,'organization_id':org})
    assert approved.status_code==200
    assert citizen.get('/api/v1/auth/me').json()['role']=='admin'


def test_existing_role_is_retained_on_profile_confirmation(authenticated):
    operator=authenticated('operator')
    response=operator.post('/api/v1/auth/onboarding',json={'name':'Confirmed Name','intended_role':'citizen'})
    assert response.status_code==200
    assert response.json()['role']=='operator'


def test_companion_requires_case_capability_and_restores_messages(client):
    from conftest import report
    incident_id,code=report(client)
    assert client.post('/api/v1/companion/assist',json={'incident_id':incident_id}).status_code==401
    result=extracted(total_people=7,safe_people=2,guidance_topic='road_collision')
    with patch('app.speech.intelligence.extract_context',new=AsyncMock(return_value=result)):
        response=client.post('/api/v1/companion/assist',json={'incident_id':incident_id,'tracking_code':code,'message':'Two are safe.'})
        assert response.status_code==200
        restored=client.post('/api/v1/companion/assist',json={'incident_id':incident_id,'tracking_code':code})
    assert restored.json()['session_id']==response.json()['session_id']
    assert any(m['content']=='Two are safe.' for m in restored.json()['messages'])
    assert restored.json()['guidance']['topic']=='road_collision'
    assert client.post('/api/v1/companion/assist',json={'incident_id':incident_id,'tracking_code':'wrong'}).status_code==404


def test_unknown_age_does_not_get_adult_cpr_video(client):
    unknown=client.get('/api/v1/companion/guidance/cpr').json()
    assert unknown['video_url'] is None
    assert '112' in unknown['steps'][0]
    adult=client.get('/api/v1/companion/guidance/cpr?patient_group=adult').json()
    assert adult['video_url'].startswith('https://www.youtube-nocookie.com/embed/')


def test_concurrent_companion_update_returns_retry_without_blocking(client):
    from conftest import report
    from app.db import SessionLocal
    from sqlalchemy import text
    incident_id,code=report(client)
    with SessionLocal() as holder:
        holder.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:key,0))'),{'key':'companion:'+incident_id})
        response=client.post('/api/v1/companion/assist',json={'tracking_code':code,'message':'An update'})
        assert response.status_code==409
        assert client.get('/api/health').status_code==200
