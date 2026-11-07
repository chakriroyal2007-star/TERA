import hashlib, hmac, secrets, smtplib, time, base64
from threading import Lock
from datetime import timedelta
from email.message import EmailMessage
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from cryptography.fernet import Fernet
import jwt, pyotp
from fastapi import Depends, HTTPException, Request
from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy import select
from .config import settings
from .db import get_db
from .models import User, Session, Audit, PermissionOverride, RolePermission, now

passwords = PasswordHasher()
redis = Redis.from_url(settings().redis_url, decode_responses=True)
_local_rate_limits: dict[str, tuple[int, float]] = {}
_local_rate_limits_lock = Lock()


def digest(value):
    return hmac.new(settings().secret_key.encode(), value.encode(), hashlib.sha256).hexdigest()


def cipher():
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(settings().secret_key.encode()).digest()))


def audit(db, action, target, user=None, **details):
    db.add(
        Audit(
            action=action,
            target=str(target),
            actor_id=user.id if user else None,
            organization_id=user.organization_id if user else None,
            details=details,
        )
    )


def limited(key, limit=10, seconds=60):
    # Atomic fixed window shared by all workers. Production requires Redis so
    # rate limits are preserved across instances. The Vercel demonstration
    # deployment runs in development mode without Redis, where a bounded
    # process-local limiter lets public reporting remain usable.
    script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n"
    try:
        count = redis.eval(script, 1, "rate:" + key, seconds)
    except RedisError as exc:
        if settings().environment == "production":
            raise HTTPException(503, "Rate-limiting service is unavailable. Please try again shortly.") from exc
        now_ts = time.monotonic()
        with _local_rate_limits_lock:
            current_count, expires_at = _local_rate_limits.get(key, (0, now_ts + seconds))
            if now_ts >= expires_at:
                current_count, expires_at = 0, now_ts + seconds
            count = current_count + 1
            _local_rate_limits[key] = (count, expires_at)
    if count > limit:
        raise HTTPException(429, "Too many requests; please try again later", headers={"Retry-After": str(seconds)})


def send_email(email, subject, body):
    s = settings()
    msg = EmailMessage()
    msg["From"] = s.mail_from
    msg["To"] = email
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as client:
        if s.smtp_tls:
            client.starttls()
        if s.smtp_user:
            client.login(s.smtp_user, s.smtp_password)
        client.send_message(msg)


def verify_password(encoded, password):
    try:
        return passwords.verify(encoded or passwords.hash(secrets.token_urlsafe(24)), password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def check_mfa(user, code):
    if not user.mfa_enabled:
        return
    totp = pyotp.TOTP(cipher().decrypt(user.mfa_secret.encode()).decode())
    step = int(time.time()) // 30
    if not code or not totp.verify(code) or step <= user.mfa_last_step:
        raise HTTPException(401, "A current, unused authenticator code is required")
    user.mfa_last_step = step


def issue(db, user, request, response, family_id=None):
    refresh, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    sess = Session(
        user_id=user.id,
        refresh_hash=digest(refresh),
        csrf_hash=digest(csrf),
        expires_at=now() + timedelta(days=14),
        user_agent=request.headers.get("user-agent", "")[:256],
    )
    if family_id:
        sess.family_id = family_id
    db.add(sess)
    db.flush()
    token = jwt.encode(
        {
            "sub": user.id,
            "sid": sess.id,
            "exp": now() + timedelta(minutes=15),
            "iat": now(),
            "iss": "tera",
            "aud": "tera",
        },
        settings().secret_key,
        algorithm="HS256",
    )
    opts = dict(secure=settings().cookie_secure, samesite="lax", path="/")
    response.set_cookie("tera_access", token, httponly=True, max_age=900, **opts)
    response.set_cookie("tera_refresh", refresh, httponly=True, max_age=14 * 86400, **opts)
    response.set_cookie("tera_csrf", csrf, httponly=False, max_age=14 * 86400, **opts)
    audit(db, "session.created", sess.id, user)


def identity(token, db):
    try:
        claims = jwt.decode(token or "", settings().secret_key, algorithms=["HS256"], issuer="tera", audience="tera")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Please sign in")
    sess = db.get(Session, claims["sid"])
    user = db.get(User, claims["sub"])
    if (
        not sess
        or sess.user_id != claims["sub"]
        or sess.revoked
        or sess.expires_at <= now()
        or not user
        or user.suspended
    ):
        raise HTTPException(401, "Session expired or account unavailable")
    return user, sess


def current(request: Request, db=Depends(get_db)):
    user, sess = identity(request.cookies.get("tera_access"), db)
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        csrf = request.headers.get("x-csrf-token", "")
        if not csrf or not hmac.compare_digest(digest(csrf), sess.csrf_hash):
            raise HTTPException(403, "Invalid CSRF token")
    return user


def roles(*allowed):
    def dependency(request: Request, user=Depends(current), db=Depends(get_db)):
        if user.role not in allowed:
            raise HTTPException(403, "Your role cannot perform this action")
        if settings().mfa_required_privileged and user.role != "citizen" and not user.mfa_enabled:
            raise HTTPException(403, "Enroll an authenticator in account security before accessing operations")
        route_path = request.scope["route"].path
        if not route_path.startswith("/api/v1/"):
            route_path = "/api/v1" + route_path
        action = request.method + " " + route_path
        if not db.scalar(
            select(RolePermission.role_id).where(RolePermission.role_id == user.role, RolePermission.action == action)
        ):
            raise HTTPException(403, "This role does not have the required permission")
        if db.scalar(
            select(PermissionOverride.id).where(
                PermissionOverride.user_id == user.id,
                PermissionOverride.action == action,
                PermissionOverride.denied.is_(True),
            )
        ):
            raise HTTPException(403, "This permission has been restricted by an administrator")
        return user

    dependency.allowed_roles = allowed
    return dependency


def scope(user, organization_id):
    if user.role != "admin" and (not organization_id or user.organization_id != organization_id):
        raise HTTPException(404, "Record not found")


def public_user(user):
    return {k: getattr(user, k) for k in ("id", "email", "name", "role", "organization_id", "verified", "mfa_enabled")}
