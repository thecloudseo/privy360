# FOUNDATION-006 Implementation Plan

**Goal:** Create the permanent, framework-neutral UI foundation for the staff
console and Privacy Centre origins: accessible tokens, Hindi/English locale
infrastructure, and empty shells with no business data.

**Architecture:** `packages/ui` owns shared presentation primitives only.
`apps/web` and `apps/privacy-centre` expose thin origin-specific shell adapters;
neither app performs authentication, authorization, tenant resolution, API
access, or business navigation. This preserves the separate-origin boundary
and leaves feature surfaces to their owning tickets.

**Authority:** `AGENTS.md`, FOUNDATION-006 in `BUILD_PLAN.md`, the FOUNDATION-006
roadmap row in `EXECUTION_ROADMAP.md` (checkpoint `CU`), `ARCHITECTURE.md`, and
the existing FOUNDATION-005 common contracts.

## Acceptance mapping

- Semantic shell landmarks include a keyboard skip link, labelled navigation,
  focusable main content, live empty-state messaging, and visible focus tokens.
- Locale selection supports `en-IN` and `hi-IN`, with unknown requests failing
  closed to English and all user-facing strings coming from locale keys.
- Staff and Privacy Centre shells are separate origin models and contain no
  business navigation, fake metrics, tenant data, or authorization decisions.
- Tokens define intentional palette, typography, focus, radius, and reduced
  motion values and are consumable without a UI framework.
- No database, API, event, audit, identity, tenant, or downstream feature work
  is included.

## Owned files/modules

- `packages/ui/src/index.ts`: tokens, locale catalog, shell model, safe shell
  renderer.
- `apps/web/src/shell.ts`: staff-origin adapter.
- `apps/privacy-centre/src/shell.ts`: Privacy Centre-origin adapter.
- `tests/unit/foundation-006.test.mjs`: focused acceptance tests.
- `specs/implementation/FOUNDATION-006.md`: this ticket plan.
- app/package READMEs and structure validation: ownership/documentation only.

## Test-first and verification plan

1. Add focused failing tests for shell accessibility, locale switching, empty
   content, and token invariants.
2. Implement the minimum shared primitives and two origin adapters.
3. Run the focused test, then frozen install, format, lint, strict typecheck,
   full unit/security tests, build, structure and production-boundary checks,
   relevant static/security checks, and `git diff --check`.
4. Review changed paths for secrets, personal data, frontend-only security,
   fake product data, and cross-lane contract changes before the `CU`
   checkpoint handoff.
