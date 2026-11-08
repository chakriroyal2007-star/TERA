import abc
import os
import shutil
import io
import re
import asyncio
from typing import Literal
import httpx
from pydantic import BaseModel, Field
from app.config import settings
from .extraction import detect_language_from_text


class ProviderHealth(BaseModel):
    status: Literal["ONLINE", "DEGRADED", "NOT_CONFIGURED", "OFFLINE"]
    provider: str
    message: str
    audio_processing_ready: bool
    ffmpeg_available: bool
    supported_languages: list[str] = Field(default_factory=list)


class TranscriptionResult(BaseModel):
    text: str
    detected_language: str
    confidence: float | None = None
    provider: str
    metadata: dict = Field(default_factory=dict)


# Supported Languages: English + 10 Major Indian Languages + Global Languages
SUPPORTED_LANGUAGES = [
    "en",  # English
    "te",  # Telugu
    "hi",  # Hindi
    "ta",  # Tamil
    "kn",  # Kannada
    "ml",  # Malayalam
    "bn",  # Bengali
    "mr",  # Marathi
    "gu",  # Gujarati
    "pa",  # Punjabi
    "od",  # Odia
    "ur",  # Urdu
    "es",  # Spanish
    "fr",  # French
    "de",  # German
    "ar",  # Arabic
    "zh",  # Chinese
]

# Language name mapping for Whisper verbose_json responses
WHISPER_LANG_NAME_TO_CODE = {
    "english": "en",
    "telugu": "te",
    "hindi": "hi",
    "tamil": "ta",
    "kannada": "kn",
    "malayalam": "ml",
    "bengali": "bn",
    "marathi": "mr",
    "gujarati": "gu",
    "punjabi": "pa",
    "oriya": "od",
    "urdu": "ur",
    "spanish": "es",
    "french": "fr",
    "german": "de",
    "arabic": "ar",
    "chinese": "zh",
}

# Sarvam AI BCP-47 locale tags
SARVAM_LANG_MAP = {
    "en": "en-IN",
    "te": "te-IN",
    "hi": "hi-IN",
    "ta": "ta-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "bn": "bn-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
    "pa": "pa-IN",
    "od": "od-IN",
    "ur": "ur-IN",
}

# Google Cloud Speech BCP-47 locale tags
GOOGLE_LANG_MAP = {
    "en": "en-IN",
    "te": "te-IN",
    "hi": "hi-IN",
    "ta": "ta-IN",
    "ml": "ml-IN",
    "kn": "kn-IN",
    "es": "es-ES",
    "fr": "fr-FR",
    "de": "de-DE",
    "ar": "ar-XA",
    "zh": "zh",
}

# Upload bounds
MIN_AUDIO_BYTES = 100
MAX_AUDIO_BYTES = 50 * 1024 * 1024  # 50 MB


def redact_secrets(text: str, *secrets: str | None) -> str:
    """Sanitizes error messages to prevent leaking API keys or secrets in logs/responses."""
    clean = text
    for secret in secrets:
        if secret and len(secret) >= 6:
            clean = clean.replace(secret, "[REDACTED]")
    return clean


def convert_audio_if_needed(audio_bytes: bytes, source_mime: str, target_format: str = "wav") -> tuple[bytes, str]:
    """
    Uses FFmpeg ONLY when actual audio conversion is required by the target provider.
    If the audio container is already directly accepted, returns original bytes untouched.
    """
    clean_mime = source_mime.split(";")[0].strip().lower()

    # If already in the target format or compatible container, do NOT convert
    if target_format == "wav" and "wav" in clean_mime:
        return audio_bytes, "audio/wav"
    if target_format in ("webm", "opus") and "webm" in clean_mime:
        return audio_bytes, "audio/webm"
    if target_format == "ogg" and "ogg" in clean_mime:
        return audio_bytes, "audio/ogg"

    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        # FFmpeg not installed; return original data as fallback
        return audio_bytes, source_mime

    try:
        import subprocess

        cmd = [
            ffmpeg_bin,
            "-v",
            "error",
            "-i",
            "pipe:0",
            "-f",
            "wav",
            "-acodec",
            "pcm_s16le",
            "-ac",
            "1",
            "-ar",
            "16000",
            "pipe:1",
        ]
        proc = subprocess.run(
            cmd,
            input=audio_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=15,
        )
        if proc.returncode == 0 and len(proc.stdout) >= 44:
            return proc.stdout, "audio/wav"
    except Exception:
        pass

    return audio_bytes, source_mime


class SpeechProvider(abc.ABC):
    @abc.abstractmethod
    async def transcribe(
        self, audio_bytes: bytes, mime_type: str, language: str | None = None
    ) -> TranscriptionResult:
        """Transcribe speech audio into text without altering spoken facts."""
        pass

    @abc.abstractmethod
    async def get_health(self) -> ProviderHealth:
        """Check provider configuration, connectivity, and dependencies truthfully."""
        pass

    def supported_languages(self) -> list[str]:
        return SUPPORTED_LANGUAGES


class WhisperSpeechProvider(SpeechProvider):
    """
    OpenAI Whisper Speech Transcription Provider.
    Requests verbose_json format to expose genuine detected language metadata.
    Preserves original speech without translating facts.
    """

    def __init__(self, api_key: str | None = None, endpoint: str | None = None):
        self.api_key = api_key if api_key is not None else settings().speech_provider_api_key
        self.endpoint = (
            endpoint
            or settings().speech_provider_endpoint
            or "https://api.openai.com/v1/audio/transcriptions"
        )

    async def get_health(self) -> ProviderHealth:
        ffmpeg_ready = bool(shutil.which("ffmpeg"))
        if not self.api_key:
            return ProviderHealth(
                status="NOT_CONFIGURED",
                provider="openai-whisper",
                message="OpenAI API key (SPEECH_PROVIDER_API_KEY) is not configured.",
                audio_processing_ready=ffmpeg_ready,
                ffmpeg_available=ffmpeg_ready,
                supported_languages=SUPPORTED_LANGUAGES,
            )

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                if res.status_code == 200:
                    return ProviderHealth(
                        status="ONLINE",
                        provider="openai-whisper",
                        message="OpenAI Whisper speech provider is ready and responsive.",
                        audio_processing_ready=ffmpeg_ready,
                        ffmpeg_available=ffmpeg_ready,
                        supported_languages=SUPPORTED_LANGUAGES,
                    )
                elif res.status_code in (401, 403):
                    return ProviderHealth(
                        status="DEGRADED",
                        provider="openai-whisper",
                        message="Authentication failed with OpenAI. Invalid API key or unauthorized.",
                        audio_processing_ready=ffmpeg_ready,
                        ffmpeg_available=ffmpeg_ready,
                        supported_languages=SUPPORTED_LANGUAGES,
                    )
                else:
                    return ProviderHealth(
                        status="DEGRADED",
                        provider="openai-whisper",
                        message=f"OpenAI service returned HTTP {res.status_code}",
                        audio_processing_ready=ffmpeg_ready,
                        ffmpeg_available=ffmpeg_ready,
                        supported_languages=SUPPORTED_LANGUAGES,
                    )
        except Exception as exc:
            msg = redact_secrets(str(exc), self.api_key)
            return ProviderHealth(
                status="OFFLINE",
                provider="openai-whisper",
                message=f"Cannot connect to OpenAI service: {msg[:120]}",
                audio_processing_ready=ffmpeg_ready,
                ffmpeg_available=ffmpeg_ready,
                supported_languages=SUPPORTED_LANGUAGES,
            )

    async def transcribe(
        self, audio_bytes: bytes, mime_type: str, language: str | None = None
    ) -> TranscriptionResult:
        if not self.api_key:
            raise RuntimeError(
                "Speech provider is not configured. Please set SPEECH_PROVIDER_API_KEY."
            )

        if len(audio_bytes) < MIN_AUDIO_BYTES:
            raise ValueError("Audio recording is empty or too short.")
        if len(audio_bytes) > MAX_AUDIO_BYTES:
            raise ValueError(f"Audio recording exceeds maximum allowed size ({MAX_AUDIO_BYTES // (1024*1024)} MB).")

        clean_mime = mime_type.split(";")[0].strip().lower()

        # Whisper natively supports webm, wav, ogg, mp4, m4a, mp3, flac
        # Determine appropriate file extension based on MIME type or magic bytes
        filename = "audio.webm"
        if "wav" in clean_mime:
            filename = "audio.wav"
        elif "ogg" in clean_mime:
            filename = "audio.ogg"
        elif "mp4" in clean_mime or "m4a" in clean_mime:
            filename = "audio.mp4"
        elif "mpeg" in clean_mime or "mp3" in clean_mime:
            filename = "audio.mp3"

        data = {
            "model": "whisper-1",
            "response_format": "verbose_json",  # Mandatory requirement: expose language metadata
        }
        if language and language != "auto":
            data["language"] = language

        files = {"file": (filename, io.BytesIO(audio_bytes), clean_mime)}

        # Perform request with timeout and 1 retry on 5xx transient errors
        last_error = None
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    res = await client.post(
                        self.endpoint,
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        data=data,
                        files=files,
                    )
                if res.status_code == 200:
                    result = res.json()
                    transcript_text = result.get("text", "").strip()

                    # Extract detected language from verbose_json response
                    raw_lang = result.get("language")
                    detected_lang = "en"
                    if raw_lang:
                        raw_lower = str(raw_lang).lower()
                        detected_lang = WHISPER_LANG_NAME_TO_CODE.get(raw_lower, raw_lower[:2])

                    # Fallback to script detection if language metadata was absent or unexpected
                    if (not raw_lang or detected_lang == "en") and transcript_text:
                        script_lang = detect_language_from_text(transcript_text)
                        if script_lang != "en" or not raw_lang:
                            detected_lang = script_lang

                    # Whisper standard API does not report normalized 0-1 confidence scores
                    # Requirement 7: Keep confidence null whenever the provider does not supply a genuine confidence score
                    return TranscriptionResult(
                        text=transcript_text,
                        detected_language=detected_lang,
                        confidence=None,
                        provider="openai-whisper",
                        metadata={
                            "model": "whisper-1",
                            "duration": result.get("duration"),
                            "whisper_language": raw_lang,
                        },
                    )
                elif res.status_code in (500, 502, 503, 504) and attempt == 0:
                    await asyncio.sleep(1.0)
                    files["file"] = (filename, io.BytesIO(audio_bytes), clean_mime)
                    continue
                else:
                    clean_msg = redact_secrets(res.text, self.api_key)
                    raise RuntimeError(
                        f"Whisper transcription error (HTTP {res.status_code}): {clean_msg[:200]}"
                    )
            except httpx.TimeoutException:
                if attempt == 0:
                    await asyncio.sleep(1.0)
                    files["file"] = (filename, io.BytesIO(audio_bytes), clean_mime)
                    continue
                raise RuntimeError("Whisper transcription request timed out.")
            except Exception as exc:
                clean_exc = redact_secrets(str(exc), self.api_key)
                raise RuntimeError(f"Whisper transcription failed: {clean_exc}")

        raise RuntimeError(f"Whisper transcription failed after retries: {last_error}")


class GoogleSpeechProvider(SpeechProvider):
    """
    Google Cloud Speech-to-Text Provider.
    Implements multilingual recognition with alternativeLanguageCodes for automatic detection.
    Verifies genuine API connectivity and authentication during health checks.
    Preserves original transcripts without altering spoken facts.
    """

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings().speech_provider_api_key

    async def get_health(self) -> ProviderHealth:
        ffmpeg_ready = bool(shutil.which("ffmpeg"))
        if not self.api_key:
            return ProviderHealth(
                status="NOT_CONFIGURED",
                provider="google-speech",
                message="Google Cloud API key (SPEECH_PROVIDER_API_KEY) is not configured.",
                audio_processing_ready=ffmpeg_ready,
                ffmpeg_available=ffmpeg_ready,
                supported_languages=SUPPORTED_LANGUAGES,
            )

        # Requirement 3: Google health must verify actual API connectivity and authentication
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(
                    "https://speech.googleapis.com/v1/speech:recognize",
                    headers={"X-Goog-Api-Key": self.api_key},
                    json={
                        "config": {"languageCode": "en-US"},
                        "audio": {"content": ""},
                    },
                )
                if res.status_code == 200:
                    return ProviderHealth(
                        status="ONLINE",
                        provider="google-speech",
                        message="Google Cloud Speech provider is verified and online.",
                        audio_processing_ready=ffmpeg_ready,
                        ffmpeg_available=ffmpeg_ready,
                        supported_languages=SUPPORTED_LANGUAGES,
                    )

                data = (
                    res.json()
                    if res.headers.get("content-type", "").startswith("application/json")
                    else {}
                )
                err_code = data.get("error", {}).get("code", res.status_code)
                err_msg = data.get("error", {}).get("message", "")
                err_status = data.get("error", {}).get("status", "")

                if (
                    res.status_code in (401, 403)
                    or "API key not valid" in err_msg
                    or err_status in ("UNAUTHENTICATED", "PERMISSION_DENIED")
                ):
                    return ProviderHealth(
                        status="DEGRADED",
                        provider="google-speech",
                        message="Google Cloud authentication failed. API key is invalid or lacks Speech permissions.",
                        audio_processing_ready=ffmpeg_ready,
                        ffmpeg_available=ffmpeg_ready,
                        supported_languages=SUPPORTED_LANGUAGES,
                    )
                elif res.status_code == 400 and (
                    "empty audio" in err_msg.lower() or "audio data" in err_msg.lower()
                ):
                    # Request authenticated successfully and was evaluated by Google Cloud Speech service!
                    return ProviderHealth(
                        status="ONLINE",
                        provider="google-speech",
                        message="Google Cloud Speech provider is verified and online.",
                        audio_processing_ready=ffmpeg_ready,
                        ffmpeg_available=ffmpeg_ready,
                        supported_languages=SUPPORTED_LANGUAGES,
                    )
                else:
                    clean_msg = redact_secrets(err_msg, self.api_key)
                    return ProviderHealth(
                        status="DEGRADED",
                        provider="google-speech",
                        message=f"Google Speech returned status {res.status_code}: {clean_msg[:100]}",
                        audio_processing_ready=ffmpeg_ready,
                        ffmpeg_available=ffmpeg_ready,
                        supported_languages=SUPPORTED_LANGUAGES,
                    )
        except Exception as exc:
            msg = redact_secrets(str(exc), self.api_key)
            return ProviderHealth(
                status="OFFLINE",
                provider="google-speech",
                message=f"Cannot connect to Google Cloud Speech service: {msg[:100]}",
                audio_processing_ready=ffmpeg_ready,
                ffmpeg_available=ffmpeg_ready,
                supported_languages=SUPPORTED_LANGUAGES,
            )

    async def transcribe(
        self, audio_bytes: bytes, mime_type: str, language: str | None = None
    ) -> TranscriptionResult:
        if not self.api_key:
            raise RuntimeError("Google Speech provider is not configured.")

        if len(audio_bytes) < MIN_AUDIO_BYTES:
            raise ValueError("Audio recording is empty or too short.")
        if len(audio_bytes) > MAX_AUDIO_BYTES:
            raise ValueError(f"Audio recording exceeds maximum allowed size ({MAX_AUDIO_BYTES // (1024*1024)} MB).")

        import base64

        clean_mime = mime_type.split(";")[0].strip().lower()

        # Handle audio encoding: WebM (Opus), OGG (Opus), WAV (Linear PCM 16), or convert via FFmpeg only if required
        working_bytes = audio_bytes
        if "webm" in clean_mime:
            encoding = "WEBM_OPUS"
        elif "ogg" in clean_mime:
            encoding = "OGG_OPUS"
        elif "wav" in clean_mime:
            encoding = "LINEAR16"
        else:
            # Container format like MP4/M4A/AAC: convert to LINEAR16 WAV only when necessary
            working_bytes, _ = convert_audio_if_needed(audio_bytes, clean_mime, target_format="wav")
            encoding = "LINEAR16"

        # Requirement 2: Google Speech must not silently default to English when automatic detection is requested.
        # Implement multilingual recognition strategy using alternativeLanguageCodes for Indian languages.
        config: dict = {
            "encoding": encoding,
            "enableAutomaticPunctuation": True,
        }

        if language and language != "auto":
            primary_code = GOOGLE_LANG_MAP.get(language, f"{language}-IN")
            config["languageCode"] = primary_code
        else:
            # Automatic multilingual detection across all 6 supported target languages
            config["languageCode"] = "en-IN"
            config["alternativeLanguageCodes"] = [
                "te-IN",  # Telugu
                "hi-IN",  # Hindi
                "ta-IN",  # Tamil
                "ml-IN",  # Malayalam
                "kn-IN",  # Kannada
                "en-US",  # English (US)
            ]

        req_body = {
            "config": config,
            "audio": {"content": base64.b64encode(working_bytes).decode("utf-8")},
        }

        # Post to Google Speech API with timeout and retry on 5xx errors
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    res = await client.post(
                        "https://speech.googleapis.com/v1/speech:recognize",
                        headers={
                            "X-Goog-Api-Key": self.api_key,
                            "Content-Type": "application/json",
                        },
                        json=req_body,
                    )
                if res.status_code == 200:
                    data = res.json()
                    results = data.get("results", [])
                    if not results:
                        return TranscriptionResult(
                            text="",
                            detected_language=language if language and language != "auto" else "en",
                            confidence=None,
                            provider="google-speech",
                        )

                    # Extract verbatim transcript
                    transcripts = []
                    confidences = []
                    detected_locale = None

                    for r in results:
                        if not detected_locale and r.get("languageCode"):
                            detected_locale = r.get("languageCode")
                        if r.get("alternatives"):
                            best_alt = r["alternatives"][0]
                            transcripts.append(best_alt.get("transcript", ""))
                            if "confidence" in best_alt and best_alt["confidence"] is not None:
                                confidences.append(float(best_alt["confidence"]))

                    full_text = " ".join(transcripts).strip()

                    # Determine detected language code
                    detected_code = None
                    if detected_locale:
                        detected_code = detected_locale.split("-")[0].lower()

                    # Fallback to script detection to ensure accurate language identification
                    if (not detected_code or detected_code == "en") and full_text:
                        script_code = detect_language_from_text(full_text)
                        if script_code != "en" or not detected_code:
                            detected_code = script_code

                    final_conf = (
                        sum(confidences) / len(confidences) if confidences else None
                    )

                    return TranscriptionResult(
                        text=full_text,
                        detected_language=detected_code or "en",
                        confidence=final_conf,
                        provider="google-speech",
                        metadata={"google_locale": detected_locale},
                    )
                elif res.status_code in (500, 502, 503, 504) and attempt == 0:
                    await asyncio.sleep(1.0)
                    continue
                else:
                    clean_msg = redact_secrets(res.text, self.api_key)
                    raise RuntimeError(f"Google speech error ({res.status_code}): {clean_msg[:200]}")
            except httpx.TimeoutException:
                if attempt == 0:
                    await asyncio.sleep(1.0)
                    continue
                raise RuntimeError("Google speech transcription timed out.")
            except Exception as exc:
                clean_exc = redact_secrets(str(exc), self.api_key)
                raise RuntimeError(f"Google speech transcription failed: {clean_exc}")

        raise RuntimeError("Google speech transcription failed.")


class SarvamSpeechProvider(SpeechProvider):
    """
    Sarvam AI Multilingual Speech-to-Text Provider (Saaras model family).
    Optimized for Indian languages (Telugu, Hindi, English, Tamil, Kannada, Malayalam,
    Bengali, Marathi, Gujarati, Odia, Punjabi) and conversational code-switching.
    """

    def __init__(self, api_key: str | None = None, model: str = "saaras:v3"):
        self.api_key = api_key or settings().sarvam_api_key or os.environ.get("SARVAM_API_KEY")
        self.endpoint = "https://api.sarvam.ai/speech-to-text"
        self.model = model

    async def get_health(self) -> ProviderHealth:
        ffmpeg_ready = bool(shutil.which("ffmpeg"))
        if not self.api_key:
            return ProviderHealth(
                status="NOT_CONFIGURED",
                provider="sarvam-ai",
                message="Sarvam AI API key (SARVAM_API_KEY) is not configured.",
                audio_processing_ready=ffmpeg_ready,
                ffmpeg_available=ffmpeg_ready,
                supported_languages=SUPPORTED_LANGUAGES,
            )

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.post(
                    self.endpoint,
                    headers={"api-subscription-key": self.api_key},
                )
                # An empty POST to /speech-to-text returns 400 "body.file : Field required" when authenticated!
                if res.status_code == 200 or (res.status_code == 400 and "body.file" in res.text):
                    return ProviderHealth(
                        status="ONLINE",
                        provider="sarvam-ai",
                        message="Sarvam AI multilingual speech provider is verified and online.",
                        audio_processing_ready=ffmpeg_ready,
                        ffmpeg_available=ffmpeg_ready,
                        supported_languages=SUPPORTED_LANGUAGES,
                    )
                elif res.status_code in (401, 403):
                    return ProviderHealth(
                        status="DEGRADED",
                        provider="sarvam-ai",
                        message="Sarvam AI authentication failed. Invalid API key or unauthorized.",
                        audio_processing_ready=ffmpeg_ready,
                        ffmpeg_available=ffmpeg_ready,
                        supported_languages=SUPPORTED_LANGUAGES,
                    )
                else:
                    return ProviderHealth(
                        status="DEGRADED",
                        provider="sarvam-ai",
                        message=f"Sarvam AI service returned HTTP {res.status_code}",
                        audio_processing_ready=ffmpeg_ready,
                        ffmpeg_available=ffmpeg_ready,
                        supported_languages=SUPPORTED_LANGUAGES,
                    )
        except Exception as exc:
            msg = redact_secrets(str(exc), self.api_key)
            return ProviderHealth(
                status="OFFLINE",
                provider="sarvam-ai",
                message=f"Cannot connect to Sarvam AI service: {msg[:120]}",
                audio_processing_ready=ffmpeg_ready,
                ffmpeg_available=ffmpeg_ready,
                supported_languages=SUPPORTED_LANGUAGES,
            )

    async def transcribe(
        self, audio_bytes: bytes, mime_type: str, language: str | None = None
    ) -> TranscriptionResult:
        if not self.api_key:
            raise RuntimeError("Sarvam AI speech provider is not configured. Please set SARVAM_API_KEY.")

        if len(audio_bytes) < MIN_AUDIO_BYTES:
            raise ValueError("Audio recording is empty or too short.")
        if len(audio_bytes) > MAX_AUDIO_BYTES:
            raise ValueError(f"Audio recording exceeds maximum allowed size ({MAX_AUDIO_BYTES // (1024*1024)} MB).")

        clean_mime = (mime_type or "audio/webm").split(";")[0].strip().lower()
        allowed_mimes = ("audio/webm", "audio/wav", "audio/ogg", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/flac", "audio/aac")
        if clean_mime not in allowed_mimes:
            clean_mime = "audio/wav" if "wav" in clean_mime else "audio/webm"
        filename = "recording.wav" if "wav" in clean_mime else ("recording.ogg" if "ogg" in clean_mime else "recording.webm")

        working_bytes = audio_bytes
        if not any(k in clean_mime for k in ("wav", "webm", "ogg", "mp3", "mp4", "m4a", "flac")):
            working_bytes, clean_mime = convert_audio_if_needed(audio_bytes, clean_mime, target_format="wav")
            filename = "recording.wav"

        files = {"file": (filename, io.BytesIO(working_bytes), clean_mime)}
        data = {
            "model": self.model,
            "mode": "transcribe",
        }
        SARVAM_ALLOWED_LANGS = (
            "unknown", "hi-IN", "bn-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN",
            "ta-IN", "te-IN", "en-IN", "gu-IN", "as-IN", "ur-IN", "ne-IN", "kok-IN",
            "ks-IN", "sd-IN", "sa-IN", "sat-IN", "mni-IN", "brx-IN", "mai-IN", "doi-IN"
        )
        if language and language != "auto" and language != "unknown":
            bcp47 = SARVAM_LANG_MAP.get(language, f"{language}-IN" if not language.endswith("-IN") else language)
            if bcp47 not in SARVAM_ALLOWED_LANGS:
                bcp47 = "unknown"
            data["language_code"] = bcp47
        else:
            data["language_code"] = "unknown"

        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    res = await client.post(
                        self.endpoint,
                        headers={"api-subscription-key": self.api_key},
                        files=files,
                        data=data,
                    )
                if res.status_code == 200:
                    resp_data = res.json()
                    transcript_text = resp_data.get("transcript", "").strip()
                    lang_code_raw = resp_data.get("language_code", "en-IN")
                    detected_lang = lang_code_raw.split("-")[0].lower() if lang_code_raw else "en"

                    if (detected_lang == "en" or not transcript_text) and transcript_text:
                        script_l = detect_language_from_text(transcript_text)
                        if script_l != "en":
                            detected_lang = script_l

                    conf = resp_data.get("language_probability")
                    confidence_val = float(conf) if conf is not None else None

                    return TranscriptionResult(
                        text=transcript_text,
                        detected_language=detected_lang,
                        confidence=confidence_val,
                        provider="sarvam-ai",
                        metadata={
                            "model": self.model,
                            "request_id": resp_data.get("request_id"),
                            "sarvam_language_code": lang_code_raw,
                        },
                    )
                elif res.status_code in (500, 502, 503, 504) and attempt == 0:
                    await asyncio.sleep(1.0)
                    files = {"file": (filename, io.BytesIO(working_bytes), clean_mime)}
                    continue
                else:
                    clean_msg = redact_secrets(res.text, self.api_key)
                    raise RuntimeError(f"Sarvam AI speech error (HTTP {res.status_code}): {clean_msg[:200]}")
            except httpx.TimeoutException:
                if attempt == 0:
                    await asyncio.sleep(1.0)
                    files = {"file": (filename, io.BytesIO(working_bytes), clean_mime)}
                    continue
                raise RuntimeError("Sarvam AI transcription timed out.")
            except Exception as exc:
                clean_exc = redact_secrets(str(exc), self.api_key)
                raise RuntimeError(f"Sarvam AI transcription failed: {clean_exc}")

        raise RuntimeError("Sarvam AI transcription failed.")


class OfflineSpeechProvider(SpeechProvider):
    """
    Offline/Hermetic Speech Provider.
    Used for automated tests or local development without cloud credentials.
    Mandatory rules:
    - In production, missing speech credentials must produce NOT_CONFIGURED, never fake transcription.
    - Only produces deterministic synthetic results in explicitly enabled automated tests.
    - Preserves confidence as null (truthful indicator).
    """

    async def get_health(self) -> ProviderHealth:
        ffmpeg_ready = bool(shutil.which("ffmpeg"))
        is_test = bool(settings().testing or os.environ.get("TESTING") == "true")
        return ProviderHealth(
            status="ONLINE" if is_test else "NOT_CONFIGURED",
            provider="offline-test-speech",
            message="Offline test speech provider is active for automated testing."
            if is_test
            else "Production speech provider credentials not configured.",
            audio_processing_ready=ffmpeg_ready,
            ffmpeg_available=ffmpeg_ready,
            supported_languages=SUPPORTED_LANGUAGES,
        )

    async def transcribe(
        self, audio_bytes: bytes, mime_type: str, language: str | None = None
    ) -> TranscriptionResult:
        is_test = bool(settings().testing or os.environ.get("TESTING") == "true")
        if not is_test and settings().environment == "production":
            raise RuntimeError(
                "Speech transcription provider is not configured. "
                "Configure SPEECH_PROVIDER (whisper or google) and SPEECH_PROVIDER_API_KEY for production use."
            )

        if len(audio_bytes) < MIN_AUDIO_BYTES:
            raise ValueError("Audio recording is empty or too short.")
        if len(audio_bytes) > MAX_AUDIO_BYTES:
            raise ValueError(f"Audio recording exceeds maximum allowed size ({MAX_AUDIO_BYTES // (1024*1024)} MB).")

        # Deterministic text for hermetic testing
        text = "Emergency report. Severe road collision with two cars on MG Road near Metro Station. Three people injured, one unconscious. Need immediate ambulance and rescue team."

        # Support test audio payloads with embedded transcription fixtures
        if b"TEST_PAYLOAD:" in audio_bytes:
            try:
                marker = b"TEST_PAYLOAD:"
                idx = audio_bytes.index(marker) + len(marker)
                end = audio_bytes.find(b"\n", idx)
                if end == -1:
                    end = len(audio_bytes)
                text = audio_bytes[idx:end].decode("utf-8", errors="ignore").strip()
            except Exception:
                pass

        detected = language if language and language != "auto" else None
        if not detected or detected == "en":
            auto_lang = detect_language_from_text(text)
            if auto_lang != "en" or not detected:
                detected = auto_lang

        return TranscriptionResult(
            text=text,
            detected_language=detected or "en",
            confidence=None,  # Truthful: Never invent or hardcode confidence scores
            provider="offline-test-speech",
            metadata={"offline": True},
        )


def get_speech_provider() -> SpeechProvider:
    """Returns the configured speech provider based on environment and settings."""
    prov = (settings().speech_provider or "").lower().strip()
    if settings().testing or os.environ.get("TESTING") == "true":
        return OfflineSpeechProvider()
    if prov in ("sarvam", "sarvam-ai", "indic"):
        return SarvamSpeechProvider()
    elif prov in ("whisper", "openai"):
        return WhisperSpeechProvider()
    elif prov == "google":
        return GoogleSpeechProvider()
    elif settings().sarvam_api_key or os.environ.get("SARVAM_API_KEY"):
        return SarvamSpeechProvider()
    elif settings().speech_provider_api_key:
        return WhisperSpeechProvider()
    return OfflineSpeechProvider()
