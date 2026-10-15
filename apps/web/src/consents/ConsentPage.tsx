"use client";

import { useState } from "react";
import { Card } from "@privy360/ui/components";
import { createConsentApi, type ConsentApi } from "./consent-api.ts";
import { ConsentList } from "./ConsentList.tsx";
import { CreateConsentForm } from "./CreateConsentForm.tsx";
import { consentMessages } from "./messages.ts";
import { useConsents } from "./useConsents.ts";

export type ConsentPageProps = Readonly<{
  api?: ConsentApi;
}>;

const defaultApi = createConsentApi();

export function ConsentPage({ api = defaultApi }: ConsentPageProps) {
  const { state, reload, create } = useConsents(api);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="consent-page">
      <header>
        <h1>{consentMessages.pageTitle}</h1>
        <p className="p360-muted">{consentMessages.pageDescription}</p>
      </header>

      <p role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>

      <Card title={consentMessages.createTitle}>
        <CreateConsentForm
          onCreate={create}
          onCreated={() => setNotice(consentMessages.created)}
          onFailure={() => setNotice(null)}
        />
      </Card>

      <Card title={consentMessages.listTitle}>
        {state.status === "loading" ? (
          <ConsentList state="loading" />
        ) : state.status === "error" ? (
          <ConsentList
            state="error"
            kind={state.kind}
            onRetry={() => void reload()}
          />
        ) : (
          <ConsentList state="ready" items={state.items} />
        )}
      </Card>
    </div>
  );
}
