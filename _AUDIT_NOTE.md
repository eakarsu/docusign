# Audit Apply Notes — docusign

Source: `_AUDIT/reports/batch_09.md` § docusign

## Original audit recommendations

### Existing AI features
`/analyze/:documentId`, `/generate-contract`, `/generate-overlay/:documentId/:pageNumber`, `/detect-fields/:documentId`.

### Missing non-AI features
- Audit trail
- Template library
- Bulk sending
- Integration webhooks

### Custom feature ideas
- Predictive signing bottlenecks
- Smart routing to correct signatories
- Compliance checking (signatures match required witnesses)
- Integration with contract lifecycle management
- Template suggestion based on document type
- Automated document comparison (what's different between versions?)

## Implemented this pass

All implemented in `backend/src/routes/ai.ts` + `backend/src/services/aiService.ts`:

- `POST /api/ai/compare-versions` — accepts `{ textA, textB, labelA?, labelB? }` and returns a structured JSON diff (added/removed/modified clauses, summary, risk_level, risk_reasons). Uses new `AIService.compareDocumentVersions`. Mechanical implementation of "Automated document comparison".
- `POST /api/ai/suggest-template` — accepts `{ description }`, fetches up to 50 templates from Prisma, asks the model for the best-matching template id with ranked alternatives. Uses new `AIService.suggestTemplate`. Mechanical implementation of "Template suggestion based on document type".

Both reuse the existing `openai` client (already pointed at OpenRouter), the `authenticate` middleware, the `createError` helper, and follow the existing JSON-extraction-with-fallback pattern from `analyzeDocument`. `tsc -p tsconfig.json --noEmit` runs clean (no new errors).

## Backlog (not implemented)

### Needs schema/data model work
- Audit trail (signing event timeline + tamper-evident hash chain).
- Bulk sending (recipient batches, per-recipient state).
- Integration webhooks (events table + signed payload delivery).

### Needs product decision
- Predictive signing bottlenecks — needs SLA definition.
- Smart routing to correct signatories — depends on org-chart / role table not yet present.
- Compliance checking (signatures match required witnesses) — needs ruleset taxonomy.
- CLM integration — vendor selection.

## Categorisation

- MECHANICAL: compare-versions, suggest-template (done).
- NEEDS-SCHEMA: audit trail, bulk sending, webhooks.
- NEEDS-PRODUCT-DECISION: predictive bottlenecks, smart routing, witness-rule engine, CLM integration target.

## Apply pass 3 (frontend)

LEFT-AS-IS — frontend already wires every backend AI endpoint (JWT Bearer from localStorage, matching existing styling, 503-no-key handled by backend). No changes needed. See `_AUDIT/apply3_logs/ab3_52.md` for details.

## Apply pass 4 (mechanical backlog)

NOTHING-TO-DO. The two mechanical items (`compare-versions`, `suggest-template`) were already implemented in apply pass 2 with both BE (`backend/src/routes/ai.ts` + `backend/src/services/aiService.ts`) and FE (`frontend/src/pages/AITools.tsx`) wiring. All remaining backlog is NEEDS-SCHEMA (audit trail, bulk sending, integration webhooks — require new tables + tamper-evident hash chain / batch state / signed-payload delivery infra) or NEEDS-PRODUCT-DECISION (predictive bottlenecks, smart routing, witness-rule engine, CLM vendor selection). `tsc -p tsconfig.json --noEmit` confirmed clean. See `_AUDIT/apply4_logs/ab3_52.md`.
