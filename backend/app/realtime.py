import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy import select, or_, and_
from .db import SessionLocal, get_db
from .models import Event, Incident, Mission, Referral, Capacity, Department, Hospital
from .security import identity, roles
from .config import settings
from .workflow import serial
from fastapi import Depends, Query

router = APIRouter(tags=["Realtime"])


def visible_events(user):
    q = select(Event)
    if user.role == "admin":
        return q
    if user.role == "operator":
        return q.where(
            or_(
                Event.organization_id == user.organization_id,
                and_(
                    Event.organization_id.is_(None),
                    Event.kind == "incident.reported",
                    Event.incident_id.in_(
                        select(Incident.id).where(
                            or_(Incident.organization_id.is_(None), Incident.organization_id == user.organization_id)
                        )
                    ),
                ),
            )
        )
    if user.role == "analyst":
        return q.where(Event.organization_id == user.organization_id)
    if user.role == "responder":
        return q.where(Event.incident_id.in_(select(Mission.incident_id).where(Mission.responder_id == user.id)))
    if user.role == "hospital":
        incident_ids = (
            select(Referral.incident_id)
            .join(Capacity)
            .join(Department)
            .join(Hospital)
            .where(Hospital.organization_id == user.organization_id)
        )
        return q.where(
            or_(
                Event.incident_id.in_(incident_ids),
                and_(Event.incident_id.is_(None), Event.organization_id == user.organization_id),
            )
        )
    return q.where(Event.id < 0)


@router.get("/notifications")
def notifications(
    after: int = Query(0, ge=0),
    user=Depends(roles("operator", "admin", "responder", "hospital", "analyst")),
    db=Depends(get_db),
):
    return [serial(e) for e in db.scalars(visible_events(user).where(Event.id > after).order_by(Event.id).limit(100))]


@router.websocket("/ws")
async def stream(ws: WebSocket):
    # Browser cookies alone are insufficient: validate Origin against cross-site socket hijacking.
    if ws.headers.get("origin") != settings().public_url:
        await ws.close(code=4403)
        return
    try:
        with SessionLocal() as db:
            user, _ = identity(ws.cookies.get("tera_access"), db)
            if user.role == "citizen":
                raise HTTPException(403)
        after = max(0, int(ws.query_params.get("after", "0")))
    except (HTTPException, ValueError):
        await ws.close(code=4401)
        return
    await ws.accept()
    try:
        while True:
            with SessionLocal() as db:
                # Re-check expiration, suspension and revocation every cycle.
                user, _ = identity(ws.cookies.get("tera_access"), db)
                events = [
                    serial(e)
                    for e in db.scalars(visible_events(user).where(Event.id > after).order_by(Event.id).limit(100))
                ]
            for e in events:
                e["created_at"] = e["created_at"].isoformat()
                await ws.send_json(e)
                after = e["id"]
            if not events:
                await ws.send_json({"kind": "heartbeat", "cursor": after})
            await asyncio.sleep(2)
    except (WebSocketDisconnect, RuntimeError):
        pass
    except HTTPException:
        await ws.close(code=4401)
