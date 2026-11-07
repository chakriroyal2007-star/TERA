# TERA 2.0

A new PostgreSQL-backed emergency coordination application with six role-specific portals. This repository is independent of the original `dbms_project`. It contains a working citizen → operator → responder → hospital → closure workflow, real persistence, authentication, private evidence storage integration and automated tests.

![TERA desktop interface](docs/landing-desktop.png)

## Run locally

Prerequisites: Docker Engine/Desktop with Compose v2, Git, and available ports 8080 and 8025.

```sh
cp .env.example .env
# Replace SECRET_KEY with the output of: openssl rand -hex 32
# Keep DATABASE_URL and POSTGRES_PASSWORD consistent if changing database credentials.
docker compose up --build
```

For a disposable local evaluation, `docker compose up --build` also works without `.env` using the explicitly development-only defaults. Production mode rejects the shipped secrets.

Open:

- Application: http://localhost:8080
- API documentation: http://localhost:8080/api/docs
- Local SMTP inbox: http://localhost:8025

Create the first administrator interactively in another terminal:

```sh
docker compose exec backend python -m app.bootstrap
```

There are no default users, demo incidents or seeded operational records. Bootstrap asks for your administrator email, name, control organization and password. It refuses to run if an administrator already exists. Sign in, use **People & access** to invite staff, and use **Resources** to register actual hospitals and ambulances.

### Set up the first complete response

1. Bootstrap an administrator and a control organization.
2. In **Resources**, create a hospital organization and hospital, and register an ambulance under the control organization.
3. Invite an operator and responder into the control organization; invite a hospital coordinator into the hospital organization. Invitations arrive in Mailpit locally. Each invited user registers using the emailed link and verifies their email with a real SMTP code.
4. In **Hospital network**, create a department and its verified bed capacity.
5. Submit an emergency through the public report form and save its tracking code.
6. The operator verifies, assigns the available ambulance/responder, and requests a hospital referral.
7. The responder acknowledges and progresses through en route and on scene. The hospital accepts the referral, reserving a bed.
8. The responder records transport and handover. The hospital confirms receipt; the responder completes the mission; the operator closes the incident.
9. Refresh the portals or restart the backend: the records remain in PostgreSQL.

The platform requires a configured, staffed response organization. Starting the software does not connect reports to a public emergency service.

## Implemented functionality

- Citizen reporting without registration; actual GPS or manual coordinates; private tracking codes; status history, additional reports and image/audio uploads.
- Operator intake, organization claiming, verification, priority reassessment, duplicate review, resource dispatch, hospital referrals and closure.
- Hospital/department registration, ICU/emergency/general capacity, reservations, referral decisions, handover confirmation and capacity history.
- Responder assignment acknowledgement and validated mission transitions, with explicit one-time GPS sharing and update timestamps.
- Analyst statistics, response acknowledgement times, capacity/fleet utilization, category/geographic trends and incident history.
- Administrator invitations, organizations, resources, account approval/access changes, suspension/recovery, permission restrictions, immutable audit history and health/configuration views.
- Password and email-code sign-in, verified registration, password reset, genuine Google OIDC integration, optional TOTP, session management and rotating/revocable refresh credentials.
- Authenticated WebSocket event replay with reconnection, backed by persisted events and scoped to the user.

The exact boundaries and deliberate simplifications are in [architecture.md](docs/architecture.md) and the [verification report](docs/verification.md). This is not a claim of certification or readiness for unsupervised emergency-service deployment.

## External providers

### Email

The default SMTP service is Mailpit: messages are actually sent and captured locally at port 8025. They do not arrive in external inboxes. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_TLS` and a verified `MAIL_FROM` for external delivery. There is no code-printing or fake verification path in the application.

### Google Sign-In

Create a Google OAuth web client and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Register this exact redirect URI for local Compose:

```text
http://localhost:8080/api/v1/auth/google/callback
```

For production, use `${PUBLIC_URL}/api/v1/auth/google/callback` with HTTPS. Google sign-in is visibly unavailable until configured. Public Google sign-in creates citizen accounts; it cannot choose a privileged role. Live Google authorization requires your external client configuration and was not performed during local verification.

### Object storage and maps

Compose provisions a private MinIO bucket. For another S3-compatible service, set `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` and `S3_BUCKET`; the deployment operator must create the private bucket and least-privilege credentials. Evidence downloads go through the authorized API rather than public URLs.

Leaflet uses OpenStreetMap tiles with attribution. Map pins use recorded coordinates only. Select an appropriate tile provider and comply with its usage policy for production traffic. Maps are not a route-time or medical suitability service.

## Development and tests

Backend: Python 3.12+, PostgreSQL 16+, Redis. Frontend: Node 22.14+ (the verified runtime was Node 22.23.2).

Start isolated test services:

```sh
docker compose -f infrastructure/docker-compose.test.yml up -d --wait
cd backend
uv sync --frozen --extra test
uv run pytest -q
```

The backend suite refuses to clean any database whose name does not end in `_test`. It truncates the isolated test tables between tests. Never point its environment at an operational database. PostgreSQL/Redis defaults for tests are localhost ports 55432 and 56379 respectively.

Frontend:

```sh
cd frontend
npm ci
npm run build
npm test
npx playwright install chromium
npm run e2e
```

The standalone browser run executes the public UI check and explicitly skips backend-dependent tests. To run the full browser lifecycle, create a separate PostgreSQL database named `tera_e2e_test`, set the backend environment as shown below, migrate and load the guarded test fixture:

```sh
cd backend
export DATABASE_URL=postgresql+psycopg://postgres:tera-test@127.0.0.1:55432/tera_e2e_test
export REDIS_URL=redis://127.0.0.1:56379/14
export SECRET_KEY=isolated-test-secret-minimum-32-characters
export PUBLIC_URL=http://localhost:5173
export TESTING=true
uv run alembic upgrade head
PYTHONPATH=. uv run python tests/seed_e2e.py
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

In separate terminals:

```sh
cd frontend
npm run dev -- --port 5173
# Then, from another terminal in frontend/:
TERA_E2E_URL=http://localhost:5173 npm run e2e
```

Use a fresh E2E database when repeating the complete acceptance run; the fixture intentionally does not erase historical records. The E2E staff credentials appear only in guarded test code. `PLAYWRIGHT_CHANNEL=chrome` can use an installed Chrome browser instead of Playwright Chromium.

Backend changes can be served with `uv run uvicorn app.main:app --reload`; set `PUBLIC_URL` to match the browser origin. Production Compose uses Nginx to proxy both REST and WebSockets. Vercel static hosting alone does not provide this backend, PostgreSQL, Redis or persistent file storage.

## Repository

```text
frontend/       React/TypeScript/Vite UI, component and Playwright tests
backend/        FastAPI, SQLAlchemy, security, workflows, Alembic and Pytest
database/      ER diagram and integrity rules
infrastructure/ isolated test services and backup/restore scripts
docs/           architecture, API schema, verification results and screenshots
```

- [Architecture and security](docs/architecture.md)
- [Database design and ER diagram](database/README.md)
- [API guide](docs/api.md)
- [Verification and remaining deployment work](docs/verification.md)
