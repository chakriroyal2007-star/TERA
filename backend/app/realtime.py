import asyncio
import redis.asyncio as aioredis
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

    # Initial catch-up from database
    try:
        with SessionLocal() as db:
            user, _ = identity(ws.cookies.get("tera_access"), db)
            events = [
                serial(e)
                for e in db.scalars(visible_events(user).where(Event.id > after).order_by(Event.id).limit(100))
            ]
        for e in events:
            if hasattr(e.get("created_at"), "isoformat"):
                e["created_at"] = e["created_at"].isoformat()
            await ws.send_json(e)
            after = e["id"]
        if not events:
            await ws.send_json({"kind": "heartbeat", "cursor": after})
    except (WebSocketDisconnect, RuntimeError):
        return
    except Exception:
        pass

    # Setup Redis Pub/Sub Fan-out subscription with graceful fallback
    redis_client = None
    pubsub = None
    try:
        redis_client = aioredis.from_url(
            settings().redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("channel:events")
    except Exception:
        pubsub = None

    heartbeat_interval = 15  # seconds
    last_heartbeat = asyncio.get_event_loop().time()

    try:
        while True:
            received_signal = False
            if pubsub:
                try:
                    msg = await asyncio.wait_for(
                        pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                        timeout=2.0,
                    )
                    if msg and msg.get("type") == "message":
                        received_signal = True
                except asyncio.TimeoutError:
                    pass
                except Exception:
                    # Redis issue: fallback to interval
                    await asyncio.sleep(2)
                    received_signal = True
            else:
                await asyncio.sleep(2)
                received_signal = True

            now_time = asyncio.get_event_loop().time()

            # If signal arrived or periodic interval elapsed, check for new events
            if received_signal or (now_time - last_heartbeat >= heartbeat_interval):
                with SessionLocal() as db:
                    # Re-check user session and revocation
                    user, _ = identity(ws.cookies.get("tera_access"), db)
                    events = [
                        serial(e)
                        for e in db.scalars(visible_events(user).where(Event.id > after).order_by(Event.id).limit(100))
                    ]
                for e in events:
                    if hasattr(e.get("created_at"), "isoformat"):
                        e["created_at"] = e["created_at"].isoformat()
                    await ws.send_json(e)
                    after = e["id"]

                if not events and (now_time - last_heartbeat >= heartbeat_interval):
                    await ws.send_json({"kind": "heartbeat", "cursor": after})
                    last_heartbeat = now_time
    except (WebSocketDisconnect, RuntimeError):
        pass
    except HTTPException:
        await ws.close(code=4401)
    finally:
        if pubsub:
            try:
                await pubsub.unsubscribe("channel:events")
            except Exception:
                pass
        if redis_client:
            try:
                await redis_client.aclose()
            except Exception:
                pass
