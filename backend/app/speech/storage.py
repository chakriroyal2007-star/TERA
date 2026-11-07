import hashlib
import os
import io
import uuid
import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from app.config import settings

# Max audio size: 50 MB (supports extended emergency statements)
MAX_AUDIO_BYTES = 50 * 1024 * 1024
MIN_AUDIO_BYTES = 100

VALID_AUDIO_MIMES = {
    "audio/webm": ".webm",
    "audio/webm;codecs=opus": ".webm",
    "video/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/ogg;codecs=opus": ".ogg",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mp4": ".mp4",
    "audio/m4a": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
}


def get_s3():
    s = settings()
    try:
        return boto3.client(
            "s3",
            endpoint_url=s.s3_endpoint,
            aws_access_key_id=s.s3_access_key,
            aws_secret_access_key=s.s3_secret_key,
            region_name="us-east-1",
        )
    except Exception:
        return None


def calculate_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def ensure_local_storage_dir() -> str:
    path = settings().recordings_dir or "/tmp/tera_recordings"
    os.makedirs(path, exist_ok=True)
    return path


def save_audio(data: bytes, mime_type: str, recording_id: str | None = None) -> tuple[str, str, int, str]:
    """
    Saves audio to persistent storage (S3 if available, or persistent local directory).
    Returns (storage_reference, filename, size, checksum).
    """
    if len(data) < MIN_AUDIO_BYTES:
        raise HTTPException(400, "Audio recording is empty or too short.")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, f"Audio recording exceeds maximum allowed size ({MAX_AUDIO_BYTES // (1024*1024)} MB).")

    clean_mime = mime_type.split(";")[0].strip().lower()
    ext = VALID_AUDIO_MIMES.get(mime_type) or VALID_AUDIO_MIMES.get(clean_mime)
    if not ext:
        # Check standard headers
        if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
            ext = ".wav"
            clean_mime = "audio/wav"
        elif data[:4] == b"\x1a\x45\xdf\xa3":
            ext = ".webm"
            clean_mime = "audio/webm"
        elif data[:4] == b"OggS":
            ext = ".ogg"
            clean_mime = "audio/ogg"
        elif len(data) > 8 and data[4:8] in (b"ftyp", b"moov"):
            ext = ".mp4"
            clean_mime = "audio/mp4"
        else:
            raise HTTPException(415, f"Unsupported audio format: {mime_type}. Supported formats: WebM, OGG, WAV, MP4.")

    rec_id = recording_id or str(uuid.uuid4())
    filename = f"{rec_id}{ext}"
    checksum = calculate_sha256(data)

    # Attempt S3 upload first
    s3 = get_s3()
    storage_ref = None
    if s3:
        try:
            key = f"recordings/{filename}"
            s3.put_object(
                Bucket=settings().s3_bucket,
                Key=key,
                Body=data,
                ContentType=clean_mime,
                Metadata={"sha256": checksum},
            )
            storage_ref = f"s3://{settings().s3_bucket}/{key}"
        except Exception:
            storage_ref = None

    # Persistent local storage fallback
    if not storage_ref:
        local_dir = ensure_local_storage_dir()
        file_path = os.path.join(local_dir, filename)
        with open(file_path, "wb") as f:
            f.write(data)
        storage_ref = f"file://{file_path}"

    return storage_ref, filename, len(data), checksum


def load_audio(storage_ref: str) -> tuple[bytes, str]:
    """Loads audio bytes from storage reference."""
    if storage_ref.startswith("s3://"):
        parts = storage_ref[5:].split("/", 1)
        bucket, key = parts[0], parts[1]
        s3 = get_s3()
        if not s3:
            raise HTTPException(500, "S3 storage service unavailable.")
        try:
            res = s3.get_object(Bucket=bucket, Key=key)
            data = res["Body"].read()
            mime = res.get("ContentType", "audio/webm")
            return data, mime
        except ClientError as e:
            raise HTTPException(404, "Recording file not found in storage.")
    elif storage_ref.startswith("file://"):
        file_path = storage_ref[7:]
        if not os.path.exists(file_path):
            raise HTTPException(404, "Recording file not found on disk.")
        with open(file_path, "rb") as f:
            data = f.read()
        ext = os.path.splitext(file_path)[1].lower()
        mime = "audio/webm"
        if ext == ".wav":
            mime = "audio/wav"
        elif ext == ".ogg":
            mime = "audio/ogg"
        elif ext == ".mp4":
            mime = "audio/mp4"
        return data, mime
    else:
        raise HTTPException(500, f"Unknown storage reference format: {storage_ref}")


def stream_audio(storage_ref: str, mime_type: str, range_header: str | None = None) -> StreamingResponse:
    """Streams audio supporting HTTP Range requests for HTML5 audio player."""
    data, detected_mime = load_audio(storage_ref)
    mime = mime_type or detected_mime
    file_size = len(data)

    if not range_header:
        headers = {
            "Content-Length": str(file_size),
            "Accept-Ranges": "bytes",
            "Content-Type": mime,
        }
        return StreamingResponse(io.BytesIO(data), media_type=mime, headers=headers)

    # Parse range header: e.g. "bytes=0-1023" or "bytes=1024-"
    try:
        range_val = range_header.strip().replace("bytes=", "")
        parts = range_val.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Type": mime,
        }
        chunk = data[start : end + 1]
        return StreamingResponse(io.BytesIO(chunk), status_code=206, media_type=mime, headers=headers)
    except Exception:
        # Fallback to full content if range parsing fails
        return StreamingResponse(io.BytesIO(data), media_type=mime, headers={"Content-Length": str(file_size)})

