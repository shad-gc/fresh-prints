# One-time GCP + GitHub setup for Fresh Prints
#
# Run these in Cloud Shell (or a machine with gcloud authenticated).
# Replace bracketed placeholders — never commit real project IDs, emails, or URLs.

```bash
export PROJECT_ID=[PROJECT_ID]
export REGION=[REGION]
export REPO=fresh-prints
export SERVICE=fresh-prints
export BUCKET="${PROJECT_ID}-fresh-prints-db"
export SA_NAME=github-deployer
```

## 1. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  --project="${PROJECT_ID}"
```

## 2. Artifact Registry repository

```bash
gcloud artifacts repositories create "${REPO}" \
  --repository-format=docker \
  --location="${REGION}" \
  --project="${PROJECT_ID}"
```

## 3. Deployer service account + IAM

```bash
gcloud iam service-accounts create "${SA_NAME}" \
  --display-name="GitHub Actions deployer for Fresh Prints" \
  --project="${PROJECT_ID}"

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

for ROLE in \
  roles/artifactregistry.writer \
  roles/run.admin \
  roles/storage.objectAdmin \
  roles/secretmanager.secretAccessor \
  roles/iam.serviceAccountUser
do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE}"
done
```

After the **first** successful Cloud Run deploy, also grant the deployer
`roles/run.invoker` on the service (required for identity-token calls from
Actions ingest/publish workflows):

```bash
gcloud run services add-iam-policy-binding "${SERVICE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker"
```

## 4. Secrets (ALWAYS `printf`, NEVER `echo`)

Trailing newlines from `echo` corrupt secret values. Use `printf` / `openssl`.

```bash
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Paste each secret when prompted, or pipe from a password manager.
# ANTHROPIC_API_KEY
printf '%s' '[PASTE_ANTHROPIC_API_KEY]' | \
  gcloud secrets create ANTHROPIC_API_KEY --data-file=- --project="${PROJECT_ID}"

# SESSION_SECRET
printf '%s' "$(openssl rand -hex 32)" | \
  gcloud secrets create SESSION_SECRET --data-file=- --project="${PROJECT_ID}"

# GH_CLIENT_SECRET (prod OAuth app — create after first deploy; see step 7)
printf '%s' '[PASTE_GH_CLIENT_SECRET]' | \
  gcloud secrets create GH_CLIENT_SECRET --data-file=- --project="${PROJECT_ID}"

# RESEND_API_KEY
printf '%s' '[PASTE_RESEND_API_KEY]' | \
  gcloud secrets create RESEND_API_KEY --data-file=- --project="${PROJECT_ID}"

for SECRET in ANTHROPIC_API_KEY SESSION_SECRET GH_CLIENT_SECRET RESEND_API_KEY; do
  gcloud secrets add-iam-policy-binding "${SECRET}" \
    --project="${PROJECT_ID}" \
    --member="serviceAccount:${COMPUTE_SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

To update a secret later:

```bash
printf '%s' '[NEW_VALUE]' | \
  gcloud secrets versions add SECRET_NAME --data-file=- --project="${PROJECT_ID}"
```

## 5. GCS bucket for SQLite volume

```bash
gcloud storage buckets create "gs://${BUCKET}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}"

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/storage.objectAdmin"
```

## 6. SA key → GitHub secret → delete local key

```bash
gcloud iam service-accounts keys create ./sa-key.json \
  --iam-account="${SA_EMAIL}" \
  --project="${PROJECT_ID}"

# GitHub → Settings → Secrets and variables → Actions → New repository secret
# Name: GCP_SA_KEY
# Value: entire contents of sa-key.json

rm -f ./sa-key.json
```

Also create these **repository Variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Example / notes |
|---|---|
| `PROJECT_ID` | your GCP project id |
| `REGION` | e.g. `us-west1` |
| `GH_CLIENT_ID` | prod OAuth app client id |
| `ALLOWED_GITHUB_USERNAMES` | comma-separated GitHub usernames |
| `DIGEST_EMAIL_TO` | your inbox |
| `DIGEST_EMAIL_FROM` | verified Resend sender, e.g. `Fresh Prints <digest@yourdomain.com>` |
| `APP_URL` | Cloud Run service URL (no trailing slash) |
| `CLOUD_RUN_SERVICE_URL` | same as `APP_URL` (identity-token audience) |

## 7. GitHub OAuth apps (two apps — one callback URL each)

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.

1. **fresh-prints-dev**
   - Homepage: `http://localhost:8080`
   - Callback: `http://localhost:8080/auth/callback`
   - Use these credentials in your local `.env` as `GH_CLIENT_ID` / `GH_CLIENT_SECRET`

2. **fresh-prints** (production)
   - Homepage: `https://[SERVICE_URL]`
   - Callback: `https://[SERVICE_URL]/auth/callback`
   - Store the client id in Actions variable `GH_CLIENT_ID`
   - Store the client secret in Secret Manager as `GH_CLIENT_SECRET` (step 4)

> **Note:** The prod OAuth app can only be created after the first deploy reveals
> the Cloud Run service URL. The first deploy will have a broken login until you
> create the app, set `GH_CLIENT_ID` / `GH_CLIENT_SECRET` / `APP_URL` /
> `CLOUD_RUN_SERVICE_URL`, and redeploy. That is expected.

## Resend

1. Create a Resend account and verify your sending domain.
2. Create an API key → Secret Manager `RESEND_API_KEY`.
3. Set `DIGEST_EMAIL_FROM` to an address on that domain.
4. Set `DIGEST_EMAIL_TO` to your morning inbox.

## Smoke test after deploy

```bash
# Health (public)
curl -sS "${APP_URL}/health"

# Ingest / publish via Actions → workflow_dispatch, or mint a token locally:
TOKEN="$(gcloud auth print-identity-token --audiences="${APP_URL}")"
curl -sS -X POST "${APP_URL}/api/ingest" -H "Authorization: Bearer ${TOKEN}"
```
