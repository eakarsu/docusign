-- CreateEnum
CREATE TYPE "MatterRole" AS ENUM ('OWNER', 'COUNSEL', 'PARALEGAL', 'CLIENT', 'WITNESS', 'AUDITOR');

-- CreateEnum
CREATE TYPE "MatterStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LegalReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED', 'STALE');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AIArtifactStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'STALE');

-- CreateEnum
CREATE TYPE "IntegrationKind" AS ENUM ('OCR', 'REDACTION', 'ESIGN_DELIVERY', 'FILING', 'TEMPLATE_SYNC', 'OBJECT_DELETION');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BLOCKED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentStatus" ADD VALUE 'DELETION_PENDING';
ALTER TYPE "DocumentStatus" ADD VALUE 'DELETED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SignatureStatus" ADD VALUE 'DELIVERY_FAILED';
ALTER TYPE "SignatureStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "ai_analysis" ADD COLUMN     "documentVersion" INTEGER,
ADD COLUMN     "inputChecksum" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "modelVersion" TEXT,
ADD COLUMN     "outputChecksum" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewerId" TEXT,
ADD COLUMN     "reviewerRationale" TEXT,
ADD COLUMN     "status" "AIArtifactStatus" NOT NULL DEFAULT 'PENDING_REVIEW';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "eventHash" TEXT,
ADD COLUMN     "matterId" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "previousHash" TEXT,
ADD COLUMN     "signature" TEXT,
ADD COLUMN     "signingKeyId" TEXT;

-- AlterTable
ALTER TABLE "document_fields" ADD COLUMN     "documentVersion" INTEGER;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "currentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "effectiveDate" TIMESTAMP(3),
ADD COLUMN     "jurisdiction" TEXT,
ADD COLUMN     "legalHoldActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legalReviewStatus" "LegalReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "matterId" TEXT,
ADD COLUMN     "provenance" JSONB,
ADD COLUMN     "retentionUntil" TIMESTAMP(3),
ADD COLUMN     "rowVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "storageVersionId" TEXT;

-- AlterTable
ALTER TABLE "signatures" ADD COLUMN     "consent" JSONB,
ADD COLUMN     "declinedAt" TIMESTAMP(3),
ADD COLUMN     "documentVersion" INTEGER,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "routingOrder" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "authority" TEXT,
ADD COLUMN     "authorityUrl" TEXT,
ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "effectiveFrom" TIMESTAMP(3),
ADD COLUMN     "effectiveTo" TIMESTAMP(3),
ADD COLUMN     "isAuthoritative" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jurisdiction" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "sourceVersion" TEXT,
ADD COLUMN     "storageKey" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "emailVerifyToken",
DROP COLUMN "resetPasswordToken",
ADD COLUMN     "emailVerifyTokenHash" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaSecret" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "resetPasswordTokenHash" TEXT,
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "privilegedAt" TIMESTAMP(3),
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matters" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "status" "MatterStatus" NOT NULL DEFAULT 'ACTIVE',
    "retentionUntil" TIMESTAMP(3) NOT NULL,
    "legalHoldActive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matter_members" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MatterRole" NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matter_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matter_invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MatterRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matter_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageVersionId" TEXT,
    "checksum" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "provenance" JSONB NOT NULL,
    "ocrText" TEXT,
    "ocrProvider" TEXT,
    "ocrVersion" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_artifacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "documentId" TEXT,
    "documentVersion" INTEGER,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "inputChecksum" TEXT NOT NULL,
    "outputChecksum" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "promptDefense" JSONB NOT NULL,
    "status" "AIArtifactStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewerRationale" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_reviews" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersion" INTEGER NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_holds" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "placedById" TEXT NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedById" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,

    CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matterId" TEXT,
    "documentId" TEXT,
    "kind" "IntegrationKind" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "requestId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerVersion" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "inputChecksum" TEXT,
    "outputChecksum" TEXT,
    "response" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filing_receipts" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersion" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "externalReference" TEXT NOT NULL,
    "filedAt" TIMESTAMP(3) NOT NULL,
    "receiptChecksum" TEXT NOT NULL,
    "receipt" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filing_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_jobs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "objectKeys" TEXT[],
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deletion_jobs_pkey" PRIMARY KEY ("id")
);

-- Legacy rows predate tenant, provenance, and signed-audit controls. Preserve them
-- in an inactive quarantine scope; an administrator must verify provenance,
-- import object bytes, assign matter access, and reactivate accounts explicitly.
INSERT INTO "organizations" ("id", "name", "domain", "createdAt", "updatedAt")
SELECT '00000000-0000-4000-8000-000000000001', 'Legacy Quarantine', 'legacy-quarantine.invalid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "users" UNION ALL SELECT 1 FROM "documents" UNION ALL SELECT 1 FROM "templates" UNION ALL SELECT 1 FROM "audit_logs");

UPDATE "users"
SET "organizationId" = '00000000-0000-4000-8000-000000000001', "isActive" = false;

INSERT INTO "matters" ("id", "organizationId", "name", "reference", "jurisdiction", "status", "retentionUntil", "legalHoldActive", "createdById", "createdAt", "updatedAt")
SELECT '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Legacy Quarantine', 'LEGACY-QUARANTINE', 'UNSPECIFIED', 'ARCHIVED', CURRENT_TIMESTAMP + INTERVAL '7 years', true, "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users" ORDER BY "createdAt", "id" LIMIT 1;

INSERT INTO "matter_members" ("id", "matterId", "userId", "role", "revokedAt", "createdAt")
SELECT 'legacy-member-' || "id", '00000000-0000-4000-8000-000000000002', "id", 'AUDITOR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "users";

UPDATE "documents"
SET "matterId" = '00000000-0000-4000-8000-000000000002',
    "storageKey" = 'organizations/00000000-0000-4000-8000-000000000001/matters/00000000-0000-4000-8000-000000000002/documents/' || "id" || '/v1' || CASE WHEN "mimeType" = 'application/pdf' THEN '.pdf' ELSE '.docx' END,
    "checksum" = md5("id") || md5("id" || '-legacy'),
    "provenance" = jsonb_build_object('source', 'legacy-quarantine', 'verified', false, 'legacyFileUrl', "fileUrl", 'actionRequired', 'verify and import original bytes'),
    "jurisdiction" = 'UNSPECIFIED',
    "effectiveDate" = "createdAt",
    "retentionUntil" = "createdAt" + INTERVAL '7 years',
    "legalReviewStatus" = 'STALE',
    "legalHoldActive" = true;

INSERT INTO "document_versions" ("id", "documentId", "version", "storageKey", "storageVersionId", "checksum", "fileSize", "mimeType", "provenance", "createdById", "createdAt")
SELECT 'legacy-version-' || "id", "id", 1, "storageKey", NULL, "checksum", "fileSize", "mimeType", "provenance", "senderId", "createdAt" FROM "documents";

UPDATE "document_fields" SET "documentVersion" = 1;
UPDATE "signatures" SET "documentVersion" = 1, "updatedAt" = "createdAt";

UPDATE "templates"
SET "organizationId" = '00000000-0000-4000-8000-000000000001',
    "storageKey" = 'legacy-template/' || "id",
    "checksum" = md5("id") || md5("id" || '-template'),
    "jurisdiction" = 'UNSPECIFIED',
    "authority" = 'legacy-user-draft',
    "authorityUrl" = '',
    "sourceVersion" = 'legacy-' || "id",
    "effectiveFrom" = "createdAt",
    "isAuthoritative" = false,
    "isPublic" = false;

UPDATE "ai_analysis"
SET "documentVersion" = 1,
    "provider" = 'legacy-unverified',
    "model" = 'unknown',
    "modelVersion" = 'unknown',
    "inputChecksum" = md5("id") || md5("id" || '-input'),
    "outputChecksum" = md5("id") || md5("id" || '-output'),
    "status" = 'STALE';

UPDATE "audit_logs"
SET "organizationId" = '00000000-0000-4000-8000-000000000001',
    "details" = COALESCE("details", '{}'::jsonb) || jsonb_build_object('legacySignatureVerified', false),
    "eventHash" = md5("id") || md5('legacy-' || "id"),
    "signature" = repeat('0', 64),
    "signingKeyId" = 'legacy-unverified';

ALTER TABLE "users" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "documents" ALTER COLUMN "matterId" SET NOT NULL, ALTER COLUMN "storageKey" SET NOT NULL, ALTER COLUMN "checksum" SET NOT NULL, ALTER COLUMN "provenance" SET NOT NULL, ALTER COLUMN "jurisdiction" SET NOT NULL, ALTER COLUMN "effectiveDate" SET NOT NULL, ALTER COLUMN "retentionUntil" SET NOT NULL;
ALTER TABLE "document_fields" ALTER COLUMN "documentVersion" SET NOT NULL;
ALTER TABLE "signatures" ALTER COLUMN "documentVersion" SET NOT NULL, ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "templates" ALTER COLUMN "organizationId" SET NOT NULL, ALTER COLUMN "storageKey" SET NOT NULL, ALTER COLUMN "checksum" SET NOT NULL, ALTER COLUMN "jurisdiction" SET NOT NULL, ALTER COLUMN "authority" SET NOT NULL, ALTER COLUMN "authorityUrl" SET NOT NULL, ALTER COLUMN "sourceVersion" SET NOT NULL, ALTER COLUMN "effectiveFrom" SET NOT NULL;
ALTER TABLE "ai_analysis" ALTER COLUMN "documentVersion" SET NOT NULL, ALTER COLUMN "provider" SET NOT NULL, ALTER COLUMN "model" SET NOT NULL, ALTER COLUMN "modelVersion" SET NOT NULL, ALTER COLUMN "inputChecksum" SET NOT NULL, ALTER COLUMN "outputChecksum" SET NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "organizationId" SET NOT NULL, ALTER COLUMN "details" SET NOT NULL, ALTER COLUMN "eventHash" SET NOT NULL, ALTER COLUMN "signature" SET NOT NULL, ALTER COLUMN "signingKeyId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_domain_key" ON "organizations"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_sessionId_key" ON "user_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "user_sessions_userId_revokedAt_expiresAt_idx" ON "user_sessions"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "matters_organizationId_status_idx" ON "matters"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "matters_organizationId_reference_key" ON "matters"("organizationId", "reference");

-- CreateIndex
CREATE INDEX "matter_members_userId_revokedAt_idx" ON "matter_members"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "matter_members_matterId_userId_key" ON "matter_members"("matterId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "matter_invitations_tokenHash_key" ON "matter_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "matter_invitations_organizationId_email_acceptedAt_expiresA_idx" ON "matter_invitations"("organizationId", "email", "acceptedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "document_versions_checksum_idx" ON "document_versions"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_documentId_version_key" ON "document_versions"("documentId", "version");

-- CreateIndex
CREATE INDEX "ai_artifacts_matterId_status_createdAt_idx" ON "ai_artifacts"("matterId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "legal_reviews_reviewerId_createdAt_idx" ON "legal_reviews"("reviewerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "legal_reviews_documentId_documentVersion_key" ON "legal_reviews"("documentId", "documentVersion");

-- CreateIndex
CREATE INDEX "legal_holds_matterId_releasedAt_idx" ON "legal_holds"("matterId", "releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "integration_jobs_requestId_key" ON "integration_jobs"("requestId");

-- CreateIndex
CREATE INDEX "integration_jobs_organizationId_kind_status_idx" ON "integration_jobs"("organizationId", "kind", "status");

-- CreateIndex
CREATE INDEX "filing_receipts_documentId_documentVersion_idx" ON "filing_receipts"("documentId", "documentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "filing_receipts_provider_externalReference_key" ON "filing_receipts"("provider", "externalReference");

-- CreateIndex
CREATE INDEX "deletion_jobs_status_createdAt_idx" ON "deletion_jobs"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_eventHash_key" ON "audit_logs"("eventHash");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_matterId_createdAt_idx" ON "audit_logs"("matterId", "createdAt");

-- CreateIndex
CREATE INDEX "document_fields_documentId_documentVersion_idx" ON "document_fields"("documentId", "documentVersion");

-- CreateIndex
CREATE INDEX "documents_matterId_status_idx" ON "documents"("matterId", "status");

-- CreateIndex
CREATE INDEX "documents_senderId_createdAt_idx" ON "documents"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "signatures_signerId_status_idx" ON "signatures"("signerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "signatures_documentId_documentVersion_signerEmail_key" ON "signatures"("documentId", "documentVersion", "signerEmail");

-- CreateIndex
CREATE INDEX "templates_organizationId_jurisdiction_isAuthoritative_effec_idx" ON "templates"("organizationId", "jurisdiction", "isAuthoritative", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "templates_organizationId_authority_sourceVersion_key" ON "templates"("organizationId", "authority", "sourceVersion");

-- CreateIndex
CREATE INDEX "users_organizationId_role_isActive_idx" ON "users"("organizationId", "role", "isActive");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_members" ADD CONSTRAINT "matter_members_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_members" ADD CONSTRAINT "matter_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_invitations" ADD CONSTRAINT "matter_invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_invitations" ADD CONSTRAINT "matter_invitations_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_invitations" ADD CONSTRAINT "matter_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "matters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_artifacts" ADD CONSTRAINT "ai_artifacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_artifacts" ADD CONSTRAINT "ai_artifacts_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "matters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_artifacts" ADD CONSTRAINT "ai_artifacts_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_artifacts" ADD CONSTRAINT "ai_artifacts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_artifacts" ADD CONSTRAINT "ai_artifacts_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_reviews" ADD CONSTRAINT "legal_reviews_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_reviews" ADD CONSTRAINT "legal_reviews_documentId_documentVersion_fkey" FOREIGN KEY ("documentId", "documentVersion") REFERENCES "document_versions"("documentId", "version") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_reviews" ADD CONSTRAINT "legal_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_placedById_fkey" FOREIGN KEY ("placedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "matters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "matters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filing_receipts" ADD CONSTRAINT "filing_receipts_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_jobs" ADD CONSTRAINT "deletion_jobs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
