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
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  --project="${PROJECT_ID}"
```

`iamcredentials.googleapis.com` (IAM Service Account Credentials API) is
required for Workload Identity Federation impersonation — without it, WIF
token exchange fails with an unauthenticated error at Artifact Registry push.
`sts.googleapis.com` performs the OIDC token exchange itself (step 6).

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

## 6. Workload Identity Federation (keyless — no SA keys anywhere)

GitHub Actions authenticates by exchanging its OIDC token for GCP credentials.
Nothing long-lived is stored in GitHub.

```bash
GITHUB_REPO='[GITHUB_OWNER]/[REPO_NAME]'   # e.g. yourname/fresh-prints
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"

gcloud iam workload-identity-pools create github \
  --project="${PROJECT_ID}" \
  --location=global \
  --display-name="GitHub Actions"

# The attribute condition restricts token exchange to THIS repo — do not skip it.
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project="${PROJECT_ID}" \
  --location=global \
  --workload-identity-pool=github \
  --display-name="GitHub OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == '${GITHUB_REPO}'"

# Let this repo's workflows impersonate the deployer SA.
# workloadIdentityUser = act as the SA; serviceAccountTokenCreator = mint the
# ID tokens that ingest.yml / publish.yml send to the app.
PRINCIPAL="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${GITHUB_REPO}"

for ROLE in roles/iam.workloadIdentityUser roles/iam.serviceAccountTokenCreator; do
  gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
    --project="${PROJECT_ID}" \
    --member="${PRINCIPAL}" \
    --role="${ROLE}"
done

# Value for the WIF_PROVIDER Actions variable:
echo "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github-provider"
```

Create these **repository Variables** in the **Variables tab**
(Settings → Secrets and variables → Actions → **Variables** — not the Secrets
tab). All non-sensitive config lives here. The **Secrets tab should be empty**
for this project: workflows authenticate keylessly via WIF, and runtime
secrets live in GCP Secret Manager (step 4).

| Variable | Example / notes |
|---|---|
| `PROJECT_ID` | your GCP project id |
| `REGION` | e.g. `us-west1` |
| `WIF_PROVIDER` | `projects/[PROJECT_NUMBER]/locations/global/workloadIdentityPools/github/providers/github-provider` (echoed above) |
| `WIF_SERVICE_ACCOUNT` | `github-deployer@[PROJECT_ID].iam.gserviceaccount.com` |
| `GH_CLIENT_ID` | prod OAuth app client id |
| `ALLOWED_GITHUB_USERNAMES` | comma-separated GitHub usernames |
| `ALLOWED_INVOKER_EMAILS` | `github-deployer@[PROJECT_ID].iam.gserviceaccount.com` — SA emails allowed to call ingest/publish |
| `DIGEST_EMAIL_TO` | your inbox |
| `DIGEST_EMAIL_FROM` | verified Resend sender, e.g. `Fresh Prints <digest@yourdomain.com>` |
| `APP_URL` | Cloud Run service URL (no trailing slash) |
| `CLOUD_RUN_SERVICE_URL` | same as `APP_URL` (identity-token audience — no trailing slash, must match exactly) |

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

# Ingest / publish via Actions → workflow_dispatch, or mint a token locally.
# The app pins callers to ALLOWED_INVOKER_EMAILS, so the token must come from
# the deployer SA — impersonate it (--include-email is required; without it
# the token has no email claim and the app rejects it). Your user needs
# roles/iam.serviceAccountTokenCreator on the SA for impersonation.
TOKEN="$(gcloud auth print-identity-token \
  --impersonate-service-account="${SA_EMAIL}" \
  --audiences="${APP_URL}" \
  --include-email)"
curl -sS -X POST "${APP_URL}/api/ingest" -H "Authorization: Bearer ${TOKEN}"
```
