import hashlib
import httpx
import logging
from fastapi import HTTPException
from .config import settings

logger = logging.getLogger("tera.captcha")


async def verify_captcha_token(token: str | None, client_ip: str | None = None) -> bool:
    """
    Verifies public submission integrity using provider-configurable bot prevention:
    - none: Disabled (default in local/dev/testing)
    - turnstile: Cloudflare Turnstile
    - hcaptcha: hCaptcha
    - pow: Cryptographic Proof-of-Work challenge
    """
    s = settings()
    provider = (s.captcha_provider or "none").lower().strip()
    if provider == "none" or s.testing:
        return True

    if not token or not token.strip():
        raise HTTPException(400, "Bot verification challenge token is required")

    if provider == "turnstile":
        if not s.captcha_secret_key:
            logger.warning("Turnstile selected but CAPTCHA_SECRET_KEY is empty; allowing in degraded mode")
            return True
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(
                    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                    data={
                        "secret": s.captcha_secret_key,
                        "response": token.strip(),
                        "remoteip": client_ip or "",
                    },
                )
                data = res.json()
                if not data.get("success"):
                    logger.warning("Turnstile verification failed: %s", data.get("error-codes"))
                    raise HTTPException(400, "Turnstile verification failed. Please try again.")
                return True
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Turnstile provider error: %s", exc)
            raise HTTPException(503, "CAPTCHA verification service temporarily unavailable")

    elif provider == "hcaptcha":
        if not s.captcha_secret_key:
            logger.warning("hCaptcha selected but CAPTCHA_SECRET_KEY is empty; allowing in degraded mode")
            return True
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(
                    "https://api.hcaptcha.com/siteverify",
                    data={
                        "secret": s.captcha_secret_key,
                        "response": token.strip(),
                        "remoteip": client_ip or "",
                    },
                )
                data = res.json()
                if not data.get("success"):
                    logger.warning("hCaptcha verification failed: %s", data.get("error-codes"))
                    raise HTTPException(400, "hCaptcha verification failed. Please try again.")
                return True
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("hCaptcha provider error: %s", exc)
            raise HTTPException(503, "CAPTCHA verification service temporarily unavailable")

    elif provider == "pow":
        # Format: <challenge>:<nonce>
        # Verification: SHA256(challenge + ":" + nonce) must have 4 leading hex zeros
        try:
            parts = token.strip().split(":")
            if len(parts) != 2:
                raise ValueError("Invalid PoW token format")
            challenge, nonce = parts
            digest_val = hashlib.sha256(f"{challenge}:{nonce}".encode("utf-8")).hexdigest()
            if not digest_val.startswith("0000"):
                raise HTTPException(400, "Proof-of-work solution invalid")
            return True
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(400, "Proof-of-work verification failed")

    return True
