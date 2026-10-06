import test from "node:test";
import assert from "node:assert/strict";
import {
  ATOMIC_CONTROL_FAMILIES,
  validateAtomicControl,
} from "../../packages/domain/compliance/src/atomic-control.ts";
import { createControlValidationFailedEvent } from "../../packages/contracts/src/events/control-validation.ts";

const ids = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  controlId: "22222222-2222-4222-8222-222222222222",
  templateId: "33333333-3333-4333-8333-333333333333",
  requirementVersionId: "44444444-4444-4444-8444-444444444444",
  sourceCitationId: "55555555-5555-4555-8555-555555555555",
  applicabilityRuleId: "66666666-6666-4666-8666-666666666666",
  evidenceRequirementId: "77777777-7777-4777-8777-777777777777",
};

function control(overrides = {}) {
  return {
    ...ids,
    code: "ATOMIC-SEC-001",
    revision: 1,
    title: "Synthetic access review control",
    classification: "IMPLEMENTATION_CONTROL",
    family: ATOMIC_CONTROL_FAMILIES.SEC,
    state: "DRAFT",
    effectiveFrom: "2026-01-01",
    requirement: {
      requirementVersionId: ids.requirementVersionId,
      reviewState: "PUBLISHED",
      effectiveFrom: "2025-01-01",
      sourceCitationId: ids.sourceCitationId,
      applicabilityRuleId: ids.applicabilityRuleId,
    },
    evidenceRequirements: [
      {
        id: ids.evidenceRequirementId,
        code: "ACCESS-REVIEW-RECORD",
        requiredType: "RECORD",
        sufficiencyCriteria: "Signed synthetic record",
        revision: 1,
      },
    ],
    ...overrides,
  };
}

test("accepts a complete synthetic atomic control across the taxonomy", () => {
  assert.deepEqual(validateAtomicControl(control()), {
    valid: true,
    errors: [],
  });
});

test("rejects incomplete legal traceability and reports every missing prerequisite", () => {
  const result = validateAtomicControl(
    control({
      classification: "LEGAL_REQUIREMENT",
      requirement: {
        requirementVersionId: ids.requirementVersionId,
        reviewState: "DRAFT",
        effectiveFrom: "2026-02-01",
      },
      evidenceRequirements: [],
    }),
  );
  assert.equal(result.valid, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    [
      "REQUIREMENT_NOT_PUBLISHED",
      "SOURCE_CITATION_REQUIRED",
      "APPLICABILITY_RULE_REQUIRED",
      "CONTROL_BEFORE_REQUIREMENT",
      "EVIDENCE_REQUIREMENT_REQUIRED",
    ],
  );
});

test("rejects guidance that is presented as statutory authority", () => {
  const result = validateAtomicControl(
    control({
      classification: "LEGAL_REQUIREMENT",
      requirement: { ...control().requirement, sourceCitationId: undefined },
    }),
  );
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => error.code === "SOURCE_CITATION_REQUIRED"),
  );
});

test("rejects a control whose regulatory reference belongs to another tenant", () => {
  const result = validateAtomicControl(
    control({
      requirementTenantId: "88888888-8888-4888-8888-888888888888",
    }),
  );
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some(
      (error) => error.code === "GLOBAL_REFERENCE_TENANT_BOUNDARY",
    ),
  );
});

test("emits a minimal versioned validation-failure event", () => {
  const event = createControlValidationFailedEvent({
    eventId: "99999999-9999-4999-8999-999999999999",
    controlId: ids.controlId,
    controlRevision: 1,
    failureCodes: ["SOURCE_CITATION_REQUIRED"],
    traceabilityDigest: "a".repeat(64),
  });
  assert.equal(event.type, "ControlValidationFailed");
  assert.equal(event.schemaVersion, 1);
  assert.deepEqual(Object.keys(event.payload).sort(), [
    "controlId",
    "controlRevision",
    "failureCodes",
    "traceabilityDigest",
  ]);
});
