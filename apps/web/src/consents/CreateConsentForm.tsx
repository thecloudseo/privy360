"use client";

import { useState, type FormEvent } from "react";
import { Button, Form, SelectField, TextField } from "@privy360/ui/components";
import { ConsentApiError, type ConsentApiErrorKind } from "./consent-api.ts";
import {
  CONSENT_PURPOSES,
  validateCreateConsent,
  type ConsentField,
  type ConsentFieldErrors,
  type CreateConsentInput,
} from "./consent-contract.ts";
import { consentMessages, purposeLabel } from "./messages.ts";

export type CreateConsentFormProps = Readonly<{
  onCreate: (input: CreateConsentInput) => Promise<unknown>;
  onCreated: () => void;
  onFailure?: (kind: ConsentApiErrorKind) => void;
}>;

const fieldErrorText = {
  required: consentMessages.requiredField,
  invalidPurpose: consentMessages.invalidPurpose,
} as const;

export function CreateConsentForm({
  onCreate,
  onCreated,
  onFailure,
}: CreateConsentFormProps) {
  const [dataPrincipalId, setDataPrincipalId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [grantConsent, setGrantConsent] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<ConsentFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Server-reported field problems are shown with generic copy, never the raw server text.
  function markServerFields(fields: readonly ConsentField[]) {
    const next: ConsentFieldErrors = {};
    for (const field of fields) next[field] = "required";
    setFieldErrors(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const result = validateCreateConsent({
      dataPrincipalId,
      purpose,
      grantConsent,
    });
    if (!result.ok) {
      setFieldErrors(result.errors);
      setFormError(consentMessages.checkFields);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      await onCreate(result.value);
      setDataPrincipalId("");
      setPurpose("");
      setGrantConsent(true);
      onCreated();
    } catch (error) {
      const kind: ConsentApiErrorKind =
        error instanceof ConsentApiError ? error.kind : "unavailable";
      if (kind === "validation" && error instanceof ConsentApiError) {
        markServerFields(error.fields);
      }
      setFormError(consentMessages.errors[kind]);
      onFailure?.(kind);
    } finally {
      setSubmitting(false);
    }
  }

  const principalError = fieldErrors.dataPrincipalId
    ? fieldErrorText[fieldErrors.dataPrincipalId]
    : undefined;
  const purposeError = fieldErrors.purpose
    ? fieldErrorText[fieldErrors.purpose]
    : undefined;

  return (
    <Form
      aria-label={consentMessages.createTitle}
      busy={submitting}
      onSubmit={handleSubmit}
    >
      {formError ? (
        <p role="alert" className="p360-banner p360-banner--error">
          {formError}
        </p>
      ) : null}
      <TextField
        label={consentMessages.fieldPrincipal}
        hint={consentMessages.fieldPrincipalHint}
        name="dataPrincipalId"
        autoComplete="off"
        value={dataPrincipalId}
        onChange={(event) => setDataPrincipalId(event.target.value)}
        error={principalError}
        required
        disabled={submitting}
      />
      <SelectField
        label={consentMessages.fieldPurpose}
        name="purpose"
        value={purpose}
        onChange={(event) => setPurpose(event.target.value)}
        error={purposeError}
        required
        disabled={submitting}
      >
        <option value="">{consentMessages.fieldPurposePlaceholder}</option>
        {CONSENT_PURPOSES.map((value) => (
          <option key={value} value={value}>
            {purposeLabel(value)}
          </option>
        ))}
      </SelectField>
      <label className="p360-checkbox">
        <input
          type="checkbox"
          name="grantConsent"
          checked={grantConsent}
          onChange={(event) => setGrantConsent(event.target.checked)}
          disabled={submitting}
        />
        {consentMessages.fieldGrant}
      </label>
      <div>
        <Button type="submit" loading={submitting}>
          {submitting ? consentMessages.submitting : consentMessages.submit}
        </Button>
      </div>
    </Form>
  );
}
