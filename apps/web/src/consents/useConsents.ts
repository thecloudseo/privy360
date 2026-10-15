"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConsentApiError,
  type ConsentApi,
  type ConsentApiErrorKind,
} from "./consent-api.ts";
import type { Consent, CreateConsentInput } from "./consent-contract.ts";

export type ConsentListState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "ready"; items: readonly Consent[]; total: number }>
  | Readonly<{ status: "error"; kind: ConsentApiErrorKind }>;

function kindOf(error: unknown): ConsentApiErrorKind {
  return error instanceof ConsentApiError ? error.kind : "unavailable";
}

export function useConsents(api: ConsentApi) {
  const [state, setState] = useState<ConsentListState>({ status: "loading" });
  // Only the most recent list request may update state, so a slow earlier
  // response cannot overwrite a newer one.
  const latestRequest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++latestRequest.current;
    setState({ status: "loading" });
    try {
      const response = await api.list();
      if (request !== latestRequest.current) return;
      setState({
        status: "ready",
        items: response.items,
        total: response.total,
      });
    } catch (error) {
      if (request !== latestRequest.current) return;
      setState({ status: "error", kind: kindOf(error) });
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (input: CreateConsentInput) => {
      // Errors propagate to the form so it can show field-level feedback.
      const created = await api.create(input);
      await reload();
      return created;
    },
    [api, reload],
  );

  return { state, reload, create };
}
