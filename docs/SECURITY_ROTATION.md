# TERA 2.0 Security Incident Response & Secret Rotation Runbook

## 1. Overview and Incident Scope
This document specifies the exact, mandatory operational procedures required to handle compromised credentials, perform complete secret rotation across environments, and sanitize version control history.

When any API key, database credential, or cryptographic secret has been committed to a Git repository—even temporarily or on a feature branch—it must be treated as **immediately compromised**.

---

## 2. Immediate Provider Credential Revocation

### Step 2.1: Sarvam AI Telephony & STT/TTS Keys
1. Sign in to the **Sarvam AI Dashboard** at `https://dashboard.sarvam.ai/`.
2. Navigate to **API Keys** / **Settings**.
3. Identify the active key (e.g. `sk_caf...`) and click **Revoke** / **Delete Key**.
4. Generate a new key and update the secret store (AWS Secrets Manager, GCP Secret Manager, or production `.env`).
5. Verify outbound calling and transcription functionality in a staging environment.

### Step 2.2: OpenRouter & LLM Provider Keys
1. Sign in to **OpenRouter** at `https://openrouter.ai/keys`.
2. Locate the exposed key (`sk-or-v1-...`) and immediately click **Delete**.
3. Generate a new restricted key with appropriate credit limits and model allowances.
4. Update `OPENROUTER_API_KEY` across all active production deployments.

### Step 2.3: SMS & Telephony Gateways (MSG91 / Twilio)
1. Sign in to the provider console (e.g., MSG91 AuthKey manager).
2. Deactivate the exposed auth key and generate a new IP-restricted API token.

### Step 2.4: Google Cloud OAuth Client Secrets
1. Navigate to **Google Cloud Console** > **APIs & Services** > **Credentials**.
2. Select the OAuth 2.0 Client ID used for TERA.
3. Click **Reset Secret** to invalidate the exposed client secret.
4. Update `GOOGLE_CLIENT_SECRET` in production configuration.

---

## 3. Application Secret Rotation

### Step 3.1: Application Cryptographic Key (`SECRET_KEY`)
1. Generate a new high-entropy 64-character secret key:
   ```bash
   openssl rand -hex 32
   ```
2. Deploy the new `SECRET_KEY`.
   *(Note: Rotating `SECRET_KEY` immediately invalidates all existing JWT access tokens and sessions, forcing all users to sign in again. For a zero-downtime key rotation, configure dual-key verification during the 15-minute token TTL transition window).*

### Step 3.2: PostgreSQL Database Password
1. Connect to PostgreSQL via administrative console:
   ```sql
   ALTER USER tera WITH PASSWORD 'new-random-secure-password-here';
   ```
2. Update `POSTGRES_PASSWORD` and `DATABASE_URL` in the deployment environment and restart backend containers.

### Step 3.3: S3 / MinIO Object Storage Credentials
1. Generate a new S3 secret key.
2. In MinIO:
   ```bash
   mc admin user add local tera-access-key "new-s3-secret-key-here"
   mc admin user remove local old-compromised-access-key
   ```
3. Update `S3_ACCESS_KEY` and `S3_SECRET_KEY` in environment variables.

---

## 4. Git History Sanitization (Purging Leaked Secrets)

Removing secrets in a new commit does **NOT** secure them because historical commits remain in Git history. Use one of the two verified tools below to rewrite history:

### Method A: Using `git-filter-repo` (Official & Recommended)
1. Install `git-filter-repo`:
   ```bash
   pip install git-filter-repo
   ```
2. Create a fresh clone of the repository in a temporary directory:
   ```bash
   git clone --mirror git@github.com:organization/tera2.git tera2-clean
   cd tera2-clean
   ```
3. Create an expressions file `replace-secrets.txt` with the exact keys/patterns to purge:
   ```text
   sk_caf==>REDACTED_SARVAM_KEY
   sk-or-v1-==>REDACTED_OPENROUTER_KEY
   qcid pzda fsxt yxio==>REDACTED_APP_PASSWORD
   ```
4. Execute `git-filter-repo`:
   ```bash
   git-filter-repo --replace-text replace-secrets.txt
   ```
5. Expire reflogs and run aggressive garbage collection:
   ```bash
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```
6. Verify no matching secrets remain:
   ```bash
   git log -p -S "sk_"
   ```
7. Force-push the sanitized history to all remote branches:
   ```bash
   git push origin --force --all
   git push origin --force --tags
   ```

### Method B: Using BFG Repo-Cleaner
```bash
# 1. Place strings to replace in passwords.txt
bfg --replace-text passwords.txt my-repo.git
cd my-repo.git
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```

---

## 5. Automated CI Secret Detection & Prevention

### 5.1 Pre-commit Hook (`.pre-commit-config.yaml`)
Install pre-commit locally:
```bash
pip install pre-commit
pre-commit install
```
This blocks developers from committing any secret matching entropy or API key regex patterns.

### 5.2 GitHub Actions Gitleaks Scan
The `.github/workflows/ci.yml` pipeline runs `gitleaks` on every push and pull request. If any pattern resembling an API token, private key, or password is detected, the workflow fails automatically.
