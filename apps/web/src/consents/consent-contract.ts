/**
 * Browser-side mirror of the consent API contract (API_ARCHITECTURE.md §1).
 *
 * The browser never supplies tenant identity; the BFF and API derive it from the
 * authenticated session. Validation here only prevents avoidable round-trips and
 * must stay in step with the server schema.
 */

export const CONSENT_PURPOSES = [
  "marketing",
  "analytics",
  "operations",
  "research",
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export type CreateConsentInput = Readonly<{
  dataPrincipalId: string;
  purpose: ConsentPurpose;
  grantConsent: boolean;
}>;

export type Consent = Readonly<{
  id: string;
  principalId: string;
  purpose: string;
  status: string;
  grantedDate: string | null;
  createdAt: string;
}>;

export type ConsentListResponse = Readonly<{
  items: readonly Consent[];
  total: number;
  limit: number;
  offset: number;
}>;

export type ConsentField = keyof CreateConsentInput;

export type ConsentFieldErrorCode = "required" | "invalidPurpose";

export type ConsentFieldErrors = Partial<
  Record<ConsentField, ConsentFieldErrorCode>
>;

export type CreateConsentDraft = Readonly<{
  dataPrincipalId: string;
  purpose: string;
  grantConsent: boolean;
}>;

export type ValidationResult =
  | Readonly<{ ok: true; value: CreateConsentInput }>
  | Readonly<{ ok: false; errors: ConsentFieldErrors }>;

export function isConsentPurpose(value: string): value is ConsentPurpose {
  return (CONSENT_PURPOSES as readonly string[]).includes(value);
}

export function validateCreateConsent(
  draft: CreateConsentDraft,
): ValidationResult {
  const errors: ConsentFieldErrors = {};
  const principalId = draft.dataPrincipalId.trim();

  if (principalId.length === 0) {
    errors.dataPrincipalId = "required";
  }
  if (draft.purpose.length === 0) {
    errors.purpose = "required";
  } else if (!isConsentPurpose(draft.purpose)) {
    errors.purpose = "invalidPurpose";
  }

  if (Object.keys(errors).length > 0 || !isConsentPurpose(draft.purpose)) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      dataPrincipalId: principalId,
      purpose: draft.purpose,
      grantConsent: draft.grantConsent,
    },
  };
}
