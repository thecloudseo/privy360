import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuditTrailModel,
  renderAuditTrail,
} from "../../packages/ui/src/audit-trail.ts";

test("renders a ready audit trail with semantic controls and redacted event details", () => {
  const html = renderAuditTrail(
    createAuditTrailModel({
      locale: "en-IN",
      state: "ready",
      scopeLabel: "Acme India",
      items: [
        {
          eventId: "e1",
          sequence: "1",
          actorLabel: "Asha",
          actionLabel: "Submitted request",
          resourceLabel: "Rights request e1",
          result: "SUCCESS",
          occurredAtLabel: "07 Oct 2026, 10:00",
          integrityLabel: "Chain verified",
        },
      ],
      nextCursor: undefined,
    }),
  );
  assert.match(html, /main/);
  assert.match(html, /aria-label="Audit filters"/);
  assert.match(html, /Submitted request/);
  assert.match(html, /Chain verified/);
  assert.match(html, /button/);
  assert.doesNotMatch(html, /password|secret|payload/i);
});

test("renders accessible empty, loading and error states in Hindi", () => {
  for (const state of ["loading", "empty", "error"]) {
    const html = renderAuditTrail(
      createAuditTrailModel({
        locale: "hi-IN",
        state,
        scopeLabel: "Acme",
        items: [],
        errorCode: state === "error" ? "INTERNAL_ERROR" : undefined,
      }),
    );
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /tabindex="-1"/);
    assert.match(html, /[ऀ-ॿ]/);
  }
});
