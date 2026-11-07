import io
import uuid
from pathlib import Path
import boto3
from PIL import Image, UnidentifiedImageError
from fastapi import Query, APIRouter, Depends, UploadFile, File, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from .config import settings
from .db import get_db
from .models import Evidence, Incident
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


def save_evidence_data(key: str, data: bytes, mime: str):
    try:
        storage().put_object(Bucket=settings().s3_bucket, Key=key, Body=data, ContentType=mime)
    except Exception:
        local_path = Path(settings().recordings_dir) / "evidence" / key
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(data)


def get_evidence_stream(key: str):
    try:
        obj = storage().get_object(Bucket=settings().s3_bucket, Key=key)
        return obj["Body"].iter_chunks()
    except Exception:
        local_path = Path(settings().recordings_dir) / "evidence" / key
        if local_path.exists():
            def iter_file():
                with open(local_path, "rb") as f:
                    while chunk := f.read(65536):
                        yield chunk
            return iter_file()
        raise HTTPException(404, "Evidence file not found")


def validate_evidence_payload(file_name: str, content_type: str, data: bytes) -> tuple[bytes, str]:
    if not data or len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "Files must be between 1 byte and 10 MB")
    mime = content_type or "application/octet-stream"
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
    return data, mime


@router.post("/public/track/{code}/evidence", status_code=201)
async def upload(code: str, request: Request, file: UploadFile = File(...), db=Depends(get_db)):
    limited("evidence:" + request.client.host, 20, 3600)
    i = tracked(db, code)
    if i.status in ("closed", "duplicate"):
        raise HTTPException(409, "Incident no longer accepts evidence")
    raw = await file.read(10 * 1024 * 1024 + 1)
    data, mime = validate_evidence_payload(file.filename or "evidence", file.content_type or "", raw)
    key = f"{i.id}/{uuid.uuid4()}"
    save_evidence_data(key, data, mime)
    e = Evidence(incident_id=i.id, object_key=key, content_type=mime, size=len(data))
    db.add(e)
    db.flush()
    record(db, "evidence.received", i, evidence_id=e.id)
    db.commit()
    return {"id": e.id, "content_type": mime}


@router.post("/public/evidence", status_code=201)
async def upload_standalone_evidence(request: Request, file: UploadFile = File(...), db=Depends(get_db)):
    """Upload photo/audio evidence prior to or alongside incident submission."""
    limited("evidence-pre:" + request.client.host, 20, 3600)
    raw = await file.read(10 * 1024 * 1024 + 1)
    data, mime = validate_evidence_payload(file.filename or "evidence", file.content_type or "", raw)
    temp_id = str(uuid.uuid4())
    key = f"pending/{temp_id}"
    save_evidence_data(key, data, mime)
    return {
        "id": temp_id,
        "object_key": key,
        "content_type": mime,
        "size": len(data),
        "filename": file.filename or "evidence",
    }


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
    chunks = get_evidence_stream(e.object_key)
    return StreamingResponse(
        chunks,
        media_type=e.content_type,
        headers={
            "Content-Disposition": f'inline; filename="evidence-{e.id}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )
