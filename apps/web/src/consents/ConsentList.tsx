"use client";

import { Button } from "@privy360/ui/components";
import type { ConsentApiErrorKind } from "./consent-api.ts";
import type { Consent } from "./consent-contract.ts";
import {
  consentMessages,
  formatConsentDate,
  purposeLabel,
  statusLabel,
} from "./messages.ts";

export type ConsentListViewProps = Readonly<
  | { state: "loading" }
  | { state: "error"; kind: ConsentApiErrorKind; onRetry: () => void }
  | { state: "ready"; items: readonly Consent[] }
>;

export function ConsentList(props: ConsentListViewProps) {
  if (props.state === "loading") {
    return (
      <p role="status" aria-busy="true" className="p360-muted">
        {consentMessages.loading}
      </p>
    );
  }

  if (props.state === "error") {
    return (
      <div role="alert" className="p360-banner p360-banner--error">
        <span>
          {consentMessages.errors.listFailed}{" "}
          {consentMessages.errors[props.kind]}
        </span>
        {props.kind === "unavailable" ? (
          <Button variant="secondary" onClick={props.onRetry}>
            {consentMessages.retry}
          </Button>
        ) : null}
      </div>
    );
  }

  if (props.items.length === 0) {
    return <p className="p360-muted">{consentMessages.empty}</p>;
  }

  return (
    <div className="p360-table-wrap">
      <table className="p360-table">
        <thead>
          <tr>
            <th scope="col">{consentMessages.columns.principal}</th>
            <th scope="col">{consentMessages.columns.purpose}</th>
            <th scope="col">{consentMessages.columns.status}</th>
            <th scope="col">{consentMessages.columns.granted}</th>
            <th scope="col">{consentMessages.columns.recorded}</th>
          </tr>
        </thead>
        <tbody>
          {props.items.map((consent) => (
            <tr key={consent.id}>
              <td>{consent.principalId}</td>
              <td>{purposeLabel(consent.purpose)}</td>
              <td>{statusLabel(consent.status)}</td>
              <td>
                <time dateTime={consent.grantedDate ?? undefined}>
                  {formatConsentDate(consent.grantedDate)}
                </time>
              </td>
              <td>
                <time dateTime={consent.createdAt}>
                  {formatConsentDate(consent.createdAt)}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
