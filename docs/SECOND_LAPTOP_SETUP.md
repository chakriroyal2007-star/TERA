# Run TERA on another laptop

The repository contains the application, migrations, tests and documentation. Git does not carry your credentials, database records or recordings. A fresh setup starts empty; importing the current laptop's data is a separate operation.

## 1. Install and clone

Install Git and Docker Desktop (Windows/macOS) or Docker Engine with Compose v2 (Linux). Start Docker. Podman also works when a Compose provider is installed; use `podman compose` in place of `docker compose`.

```sh
git clone https://github.com/chakriroyal2007-star/TERA.git
cd TERA
```

If already cloned, use `git pull --ff-only` after saving any local changes. Ports 8080 and 8025 must be available. Local Python/Node installations are not required for the containerized application.

## 2. Create private configuration

If Python 3 is installed:

```sh
python3 infrastructure/configure_local.py
```

On Windows, use `py infrastructure/configure_local.py`. Alternatively, run the helper through Docker.

macOS/Linux:

```sh
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/workspace" -w /workspace python:3.12-slim python infrastructure/configure_local.py
```

Windows PowerShell:

```powershell
docker run --rm -v "${PWD}:/workspace" -w /workspace python:3.12-slim python infrastructure/configure_local.py
```

The helper generates `.env` with random application/database secrets and refuses to overwrite an existing file. The database URL and password are generated together. Edit this **root `.env`** for Compose (the existing host-run development backend instead uses `backend/.env`). Add your provider credentials locally:

```dotenv
GOOGLE_CLIENT_ID=your-google-web-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
SARVAM_API_KEY=your-sarvam-key
OPENAI_API_KEY=your-openrouter-key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=openai/gpt-4.1-mini
SPEECH_PROVIDER=sarvam
PUBLIC_URL=http://localhost:8080
```

Never commit `.env`. Rotate credentials that have been shared in chat before shared deployment. Voice recognition/extraction and Google login need valid provider configuration; manual reporting and local email login can run without those providers.

For Google, register **`http://localhost:8080/api/v1/auth/google/callback`** on the OAuth web client. The existing port-5173 callback is for the development server. You may register both. Keep using `localhost` consistently rather than switching to `127.0.0.1` midway through authentication.

## 3. Build and start

```sh
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 backend
```

Open **http://localhost:8080**. Local email codes/invitations arrive at **http://localhost:8025**; this inbox does not deliver to external email addresses.

Startup applies database migrations automatically. The default five services are PostgreSQL, Redis, Mailpit, backend and frontend. Recordings and evidence use the persistent `recordings_data` volume. MinIO is optional, so its historical image is not required for normal startup.

Create the first administrator:

```sh
docker compose exec backend python -m app.bootstrap
```

Enter your administrator email, name, organization and a new password. A fresh database has no test accounts or sample incidents. Create organizations/resources and invite staff through the admin portal. Public Google signup grants citizen access; privileged role requests need administrator approval and an organization.

Check these endpoints:

- http://localhost:8080/api/health — database connected and Redis active.
- http://localhost:8080/api/v1/auth/providers — Google enabled only when both credentials are present.
- http://localhost:8080/api/v1/speech/health — real speech-provider readiness.

To use another port, add `APP_PORT=5173` and `PUBLIC_URL=http://localhost:5173` to `.env`, update the Google callback accordingly, then recreate the containers. `MAILPIT_PORT` controls the local inbox port independently.

## 4. Updates and persistent data

```sh
git pull --ff-only
docker compose up -d --build
docker compose restart frontend
```

Recreating containers retains named volumes. `docker compose down` stops the app without deleting them. **Do not use `docker compose down -v` unless you intend to delete the local database and uploads.** Provider environment changes require recreating the backend, not just restarting it:

```sh
docker compose up -d --force-recreate backend
docker compose restart frontend
```

## Optional: transfer existing records

Copy database backups, recordings/evidence and the required environment secrets privately, outside Git. The original `SECRET_KEY` is needed to preserve encrypted MFA secrets and existing tracking capabilities. Do not copy the original laptop's container-specific database/Redis host addresses into the new Compose setup.

The repository provides `infrastructure/backup.sh` and `infrastructure/restore.sh` for a Compose PostgreSQL database. The current audited laptop uses separately named Podman containers, so do not assume those scripts automatically target its database. A transfer must identify the source database and storage path first.

For a new empty destination, start only PostgreSQL, restore the database before starting the backend migrations, and restore the recordings/evidence into the destination `recordings_data` volume. Keep the app stopped during a coordinated backup/restore to avoid database/file mismatches. This task pushed code; it did not upload personal records or perform a cross-laptop data migration.

## Optional: S3 / MinIO

For an existing S3-compatible service, set `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` and `S3_BUCKET`, and provision a private bucket with appropriate permissions. Compose retains an optional `object-storage` profile for MinIO. Its historical pinned images were unavailable during the earlier audit; verify image availability before relying on that optional profile. The default persistent filesystem setup does not require it.

## Verification and limits

See [the voice/workflow verification record](VOICE_AGENT_IMPLEMENTATION.md) for the 96-test backend suite, six-language live synthetic speech checks and browser lifecycle evidence. The local source-based medical guidance still needs clinical review and reviewed translations; real Google consent requires account interaction. Fresh-laptop setup does not establish integration with actual emergency dispatch or hospitals.

Pre-push verification on 10 November 2026: all 96 backend tests and 8 frontend component tests passed; the production frontend build passed with a bundle-size advisory. The setup helper generated fresh private secrets and refused to overwrite existing configuration. The separate local Compose stack returned healthy database and Redis status on port 18080. This verifies local portability; setup on the second physical laptop remains to be performed.

Fresh isolated Podman Compose verification (2026-11-10): both images built; all five default services started; database/Redis health, frontend serving, evidence upload, manual report creation, tracking/PDF after backend restart and initial administrator bootstrap passed. The configuration helper passed secret generation, database-password consistency, private file permissions and overwrite protection checks. The final backend suite passed 96 tests; Ruff passed. Provider credentials were deliberately absent from this isolated setup; live provider results are recorded in the linked voice verification report. Restart the frontend proxy after replacing the backend container so it resolves the current backend address.
