import type { ConsentApiErrorKind } from "./consent-api.ts";
import type { ConsentPurpose } from "./consent-contract.ts";

// Presentation strings for the consent surface. Business logic uses codes, never copy.
export const consentMessages = {
  pageTitle: "Consents",
  pageDescription:
    "Record and review the consents held for data principals in this workspace.",
  createTitle: "Record a consent",
  listTitle: "Recorded consents",
  fieldPrincipal: "Data principal ID",
  fieldPrincipalHint: "The identifier your organisation uses for this person.",
  fieldPurpose: "Purpose",
  fieldPurposePlaceholder: "Choose a purpose",
  fieldGrant: "Consent granted",
  submit: "Record consent",
  submitting: "Recording…",
  created: "Consent recorded.",
  requiredField: "Enter a value for this field.",
  invalidPurpose: "Choose a purpose from the list.",
  checkFields: "Check the highlighted fields and try again.",
  retry: "Try again",
  loading: "Loading consents…",
  empty: "No consents have been recorded yet.",
  columns: {
    principal: "Data principal",
    purpose: "Purpose",
    status: "Status",
    granted: "Granted",
    recorded: "Recorded",
  },
  purposes: {
    marketing: "Marketing",
    analytics: "Analytics",
    operations: "Operations",
    research: "Research",
  } satisfies Record<ConsentPurpose, string>,
  errors: {
    unauthenticated: "Your session has ended. Sign in again to continue.",
    forbidden: "You don't have access to this in the current workspace.",
    duplicate: "A consent for this data principal and purpose already exists.",
    unavailable: "Something went wrong. Please try again in a moment.",
    validation: "Check the highlighted fields and try again.",
    listFailed: "Consents couldn't be loaded.",
  } satisfies Record<ConsentApiErrorKind | "listFailed", string>,
  statusLabels: {
    granted: "Granted",
    withdrawn: "Withdrawn",
  } as Record<string, string>,
  skipToContent: "Skip to main content",
  workspaceTitle: "Privy360 workspace",
  boundaryTitle: "This section couldn't be displayed",
  boundaryBody: "Reload the page to try again.",
  boundaryRetry: "Reload",
} as const;

export function purposeLabel(purpose: string): string {
  const labels = consentMessages.purposes as Record<string, string>;
  return labels[purpose] ?? purpose;
}

export function statusLabel(status: string): string {
  return consentMessages.statusLabels[status] ?? status;
}

export function formatConsentDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}
