# Implementation and verification report

Verification date: 6 November 2026. Source repository: a fresh local Git repository named `tera2`; no original application source was copied into the replacement. The reference repository was inspected for its six roles, workflow, API structure and deployment assumptions. The supplied Vercel URL could not be fetched reliably from this environment. Its live deployment has not been changed.

## Executed checks

| Check | Result |
|---|---|
| Frontend TypeScript + Vite production build | Passed; main bundle 400.13 KB / 122.77 KB gzip, maps loaded separately |
| React Testing Library / Vitest | 4 passed |
| Pytest against PostgreSQL 16.15 and Redis 6.2.14 | 26 passed |
| Backend statement coverage | 87%; not 100% and not a security certification |
| Playwright with installed Chrome | 9 passed; all six role portals plus complete lifecycle and public persistence |
| Actual backend process restart test | Passed; two separate Uvicorn processes read the same saved tracking record |
| Concurrent dispatch test | Passed; one allocation succeeds, competing allocation receives 409 |
| Concurrent bed reservation test | Passed; one reservation succeeds, competing referral receives 409 |
| Database migrations | Revisions 0001–0004 applied; `alembic check`: no new upgrade operations |
| Database audit protection | UPDATE/DELETE rejected by append-only event/audit triggers |
| Real SMTP transport test | Passed using a local SMTP server; delivered six-digit code was used to authenticate |
| S3 evidence integration test | Passed against Moto's S3 protocol emulator, including re-encoded image retrieval and denied unauthorized access |
| Google adapter unit test | Verified claims create citizen accounts; invalid/unconfigured paths fail; external Google consent flow not run |
| Dependency audit | npm reported zero known vulnerabilities after package updates |
| Python undefined/unused-name checks | Ruff `--select F`: passed |
| Compose configuration | YAML parsed successfully; seven application services and two isolated test services |
| Visual inspection | Desktop landing/login screenshots inspected; mobile layout and overflow checks passed |

The browser lifecycle verifies actual API/SQL persistence through reporting, verification, dispatch, mission acknowledgement/en-route/on-scene, hospital acceptance, transport, responder handover, hospital confirmation, mission completion, incident closure and portal reloads. Test fixtures are isolated from application data. The application itself has no demo-data or fake-authentication branch.

Tests cover password hashing, citizen-only public registration, email expiry/cooldown/attempt limits/one-time use, CSRF, refresh rotation/reuse, logout and suspension, password reset revocation, TOTP replay prevention, email-bound invitations, resource creation/capacity updates, organization isolation, permission restrictions, access changes, duplicate suggestions, public tracking privacy and authenticated event replay.

Two installed libraries issue deprecation notices about their HTTP client adapter; these do not fail tests. The standalone CI browser job skips backend-dependent scenarios unless an E2E deployment is supplied. The nine-test integrated browser run was executed locally against real PostgreSQL and a dedicated E2E database.

## External verification still required

1. **Docker Compose launch:** Docker is not installed on the host. The available Podman VM failed to stay reachable, so the full image build/start sequence could not be verified. Python, PostgreSQL and Redis were installed in isolated local test locations instead. The Compose YAML, Dockerfiles and deployment commands are supplied; a complete `docker compose up --build` run remains a deployment acceptance step.
2. **Google:** supply a real client ID/secret and registered redirect URI, then perform live consent, callback and failure-path checks. Unit tests do not substitute for provider verification.
3. **External email:** local SMTP delivery is verified. External inbox delivery, sender-domain verification and provider credentials remain deployment configuration.
4. **MinIO/S3 deployment:** application S3 behavior is tested with an emulator. The supplied MinIO containers and an external production bucket were not launched or verified here.
5. **Production operations:** TLS, ingress, managed credentials, secret rotation, mail delivery monitoring, object scanning/retention, backup scheduling, restore drills, least-privilege database roles, capacity planning and organizational acceptance are not provisioned automatically.
6. **Cloud publishing:** no new GitHub remote or cloud deployment was created. The original GitHub/Vercel project is untouched. The new repository is local and includes CI configuration.

## Deliberate implementation limits

- One active membership per account, with dedicated role, permission, membership and role-permission tables. The six built-in roles are fixed; there is no custom-role designer or multiple simultaneous memberships.
- Notifications are persisted-event projections with replay; there is no individual notification read/unread inbox.
- Realtime sockets poll the persistent event log every two seconds. Redis provides rate limiting; there is no Redis pub/sub fan-out layer. High-load behavior has not been benchmarked.
- Registry and mission APIs use offset/limit pagination with batches capped at 100. UI resource selectors traverse these pages; large-scale selector performance and bulk exports have not been benchmarked.
- The implemented operational path is one mission and one nonrejected referral per incident. Mission cancellation, reassignment, multi-patient incidents and expiring/releasing accepted referrals are not implemented.
- Evidence validation includes size, content checks and image re-encoding. It is not antivirus scanning. File-storage and database writes are separate systems; operations should monitor and remove orphaned objects if a database commit fails after upload.
- Analytics cover recorded aggregates and incident reconstruction; there is no scheduled report delivery, custom report builder or export UI.
- Location sharing is explicit, one reading at a time. Maps use actual coordinates and hospital-distance suggestions; there is no continuous vehicle tracking, route ETA or autonomous medical decision.

These boundaries are documented rather than represented by inactive buttons or simulated responses. The result is a tested, functional end-to-end implementation with substantial coverage of the rebuild brief, not a claim that every production requirement has been completed or externally certified.

## Artifacts

- `docs/landing-desktop.png`, `docs/landing-mobile.png`, `docs/login-desktop.png`
- `docs/openapi.json` and live `/api/docs`
- `database/README.md` (ER diagram, normalization choices and integrity rules)
- `backend/tests/` and `frontend/e2e/` (reproducible acceptance checks)
- `infrastructure/backup.sh`, `infrastructure/restore.sh` and isolated test Compose definition
