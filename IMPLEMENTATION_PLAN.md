# FOUNDATION-001 implementation plan

## Authority and scope

AGENTS.md, BUILD_PLAN.md FOUNDATION-001, ARCHITECTURE.md, MASTER_SPEC.md §2, ADR-001/002/003/004/029, API_ARCHITECTURE.md, MODULE_BOUNDARIES.md and THREAT_MODEL.md govern this plan. The tagged `architecture-baseline-v1` commit is present and the initial working tree is clean. This ticket creates only a pnpm/strict TypeScript repository skeleton. FOUNDATION-002 owns the full security and end-to-end verification pipeline.

## Steps

1. **Repository tooling.** Add `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.npmrc`, `.gitignore`, `.node-version`, `tsconfig.base.json`, formatter/linter configuration and a minimal CI job. Pin verified Node, pnpm and direct development tool versions. All packages use the single workspace lockfile. No database, API, authorization, tenant, audit or runtime configuration is introduced. Check install, formatting, lint, typecheck and build. Acceptance: install/lint/typecheck succeed with pinned supported versions.
2. **Application workspace shells.** Add `apps/web`, `apps/api`, `apps/privacy-centre`, `apps/worker` as private, strict TypeScript packages with package metadata and compile-only entry points where needed. Preserve separate web/privacy-centre and API/worker boundaries; avoid endpoints, screens, DB access, business behavior, auth bypasses and real data. Check workspace resolution and package builds. Acceptance: four named application paths exist with no application behavior.
3. **Contracts and target directories.** Add a private `packages/contracts` package containing only package/tooling metadata and a non-runtime contract README. Represent all MASTER_SPEC §2 target directories with tracked README placeholders, plus architecture-approved `packages/domain` and `packages/contracts`. Do not add regulatory source assertions, schemas, migrations, cloud configuration or domain modules. Check directory manifest. Acceptance: all target paths represented; baseline documents preserved.
4. **Focused checks and review.** Add a small repository-structure check in `tests/unit` that confirms required paths, branch-independent architecture document hashes against baseline, and absence of product entry points. Run T0 local checks and CI equivalent; inspect the diff for scope/security. T1–T5 are inapplicable because this ticket has no DB schema, public API/domain behavior, worker effects, UI or security-critical runtime change. Acceptance: required paths, unchanged architecture, no screens/business behavior, and `agent/foundation` branch verified.

## Impact and assumptions

Dependencies are limited to pinned TypeScript, lint/format and unit-test tooling; framework packages are deferred until runtime work is ticketed. No configuration beyond local tooling is created. Database, API, authorization, tenant security and audit impacts are none. Contract package contains no invented operation, event or legal mapping. Supply-chain risk is addressed by exact direct versions, lockfile and the ticket-scoped CI checks; full SAST/SCA/secret/SBOM jobs belong to FOUNDATION-002. No OPEN decision is self-approved.
