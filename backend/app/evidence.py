import io, uuid
import boto3
from PIL import Image, UnidentifiedImageError
from fastapi import Query, APIRouter, Depends, UploadFile, File, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from .config import settings
from .db import get_db
from .models import Evidence
from .security import roles, limited, audit
from .workflow import tracked, get_incident, record

router = APIRouter(tags=["Private evidence"])


def storage():
    s = settings()
    return boto3.client(
        "s3",
        endpoint_url=s.s3_endpoint,
        aws_access_key_id=s.s3_access_key,
        aws_secret_access_key=s.s3_secret_key,
        region_name="us-east-1",
    )


@router.post("/public/track/{code}/evidence", status_code=201)
async def upload(code: str, request: Request, file: UploadFile = File(...), db=Depends(get_db)):
    limited("evidence:" + request.client.host, 10, 3600)
    i = tracked(db, code)
    if i.status in ("closed", "duplicate"):
        raise HTTPException(409, "Incident no longer accepts evidence")
    data = await file.read(10 * 1024 * 1024 + 1)
    if not data or len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "Files must be between 1 byte and 10 MB")
    mime = file.content_type
    if mime in ("image/jpeg", "image/png", "image/webp"):
        try:
            Image.MAX_IMAGE_PIXELS = 20000000
            im = Image.open(io.BytesIO(data))
            im.verify()
            im = Image.open(io.BytesIO(data))
            im = im.convert("RGB")
            out = io.BytesIO()
            im.save(out, format="JPEG", quality=90)
            data = out.getvalue()
            mime = "image/jpeg"
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
            raise HTTPException(422, "Invalid or oversized image")
    elif mime in ("audio/wav", "audio/x-wav") and data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        mime = "audio/wav"
    elif mime in ("audio/webm", "video/webm") and data[:4] == b"\x1a\x45\xdf\xa3":
        mime = "audio/webm"
    else:
        raise HTTPException(415, "Upload a JPEG, PNG, WebP image or WAV/WebM audio file")
    key = f"{i.id}/{uuid.uuid4()}"
    storage().put_object(Bucket=settings().s3_bucket, Key=key, Body=data, ContentType=mime)
    e = Evidence(incident_id=i.id, object_key=key, content_type=mime, size=len(data))
    db.add(e)
    db.flush()
    record(db, "evidence.received", i, evidence_id=e.id)
    db.commit()
    return {"id": e.id, "content_type": mime}


@router.get("/incidents/{id}/evidence")
def evidence(
    id: str,
    user=Depends(roles("admin", "operator", "responder", "hospital")),
    db=Depends(get_db),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    get_incident(db, id, user)
    return [
        {"id": e.id, "content_type": e.content_type, "size": e.size, "created_at": e.created_at}
        for e in db.scalars(select(Evidence).where(Evidence.incident_id == id).offset(offset).limit(limit))
    ]


@router.get("/evidence/{id}")
def download(id: str, user=Depends(roles("admin", "operator", "responder", "hospital")), db=Depends(get_db)):
    e = db.get(Evidence, id)
    if not e:
        raise HTTPException(404, "Evidence not found")
    get_incident(db, e.incident_id, user)
    audit(db, "evidence.viewed", e.id, user)
    db.commit()
    obj = storage().get_object(Bucket=settings().s3_bucket, Key=e.object_key)
    return StreamingResponse(
        obj["Body"].iter_chunks(),
        media_type=e.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="evidence-{e.id}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )
