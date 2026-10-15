import { describe, expect, it } from "vitest";
import { validateCreateConsent } from "./consent-contract.ts";

describe("validateCreateConsent", () => {
  it("trims the principal and returns the server-shaped payload", () => {
    const result = validateCreateConsent({
      dataPrincipalId: "  principal-123  ",
      purpose: "marketing",
      grantConsent: true,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        dataPrincipalId: "principal-123",
        purpose: "marketing",
        grantConsent: true,
      },
    });
  });

  it("rejects a blank principal, mirroring the server's non-empty rule", () => {
    const result = validateCreateConsent({
      dataPrincipalId: "   ",
      purpose: "analytics",
      grantConsent: false,
    });
    expect(result).toEqual({
      ok: false,
      errors: { dataPrincipalId: "required" },
    });
  });

  it("requires a purpose", () => {
    const result = validateCreateConsent({
      dataPrincipalId: "p-1",
      purpose: "",
      grantConsent: true,
    });
    expect(result).toEqual({ ok: false, errors: { purpose: "required" } });
  });

  it("rejects purposes outside the contract enum", () => {
    const result = validateCreateConsent({
      dataPrincipalId: "p-1",
      purpose: "advertising",
      grantConsent: true,
    });
    expect(result).toEqual({
      ok: false,
      errors: { purpose: "invalidPurpose" },
    });
  });

  it("reports every invalid field at once", () => {
    const result = validateCreateConsent({
      dataPrincipalId: "",
      purpose: "nope",
      grantConsent: true,
    });
    expect(result).toEqual({
      ok: false,
      errors: { dataPrincipalId: "required", purpose: "invalidPurpose" },
    });
  });
});
