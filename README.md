# Governed signing workflow

This application manages matter-scoped, versioned legal documents through upload, irreversible redaction, independent legal review, ordered electronic signature, OCR, filing, retention, legal hold, and controlled deletion. AI output is advisory, provenance-bound, and unavailable for operational use until an independent counsel review approves it.

## Local development

Use Node.js 24 or newer. `./setup.sh` installs locked dependencies and creates a permission-restricted `backend/.env` from the fail-closed example. Replace every placeholder, create the PostgreSQL database, and run migrations explicitly:

```sh
DATABASE_URL=postgresql://... npm run prisma:migrate:deploy --prefix backend
./start-dev.sh
```

Starting the application never installs dependencies, changes the schema, seeds data, or starts a shared database. The API defaults to port 3001 and the Vite UI to port 3000.

## Container operation

Create a root `.env` containing every value required by `docker-compose.yml`, build images, run the one-shot migration, and then start services:

```sh
docker compose build
./migrate.sh
./start-prod.sh
```

`./stop.sh` stops application services without deleting volumes. Backup and restore are explicit PostgreSQL operations; restore additionally requires `ALLOW_DATABASE_RESTORE=YES` after the operator confirms the target.

## Required integrations

Production requires versioned S3-compatible object storage, a fail-closed malware scanner, SMTP, approved OCR and irreversible-redaction providers, a filing provider, an authoritative template registry, and an approved OpenRouter model/version. Provider calls use idempotency keys and record response checksums and versions. This software does not replace legal advice or counsel review.

## Verification

```sh
npm run typecheck
npm run build
npm test
```

CI deploys migrations to disposable PostgreSQL, checks schema drift, runs unit/integration/HTTP tests, audits both dependency trees, scans for secrets, and builds both container images.
