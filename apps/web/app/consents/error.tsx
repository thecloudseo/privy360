"use client";

import { Button } from "@privy360/ui/components";
import { consentMessages } from "../../src/consents/messages.ts";

// Deliberately ignores the thrown error: its message may contain internal detail.
export default function ConsentsError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div role="alert" className="p360-banner p360-banner--error">
      <div>
        <p>
          <strong>{consentMessages.boundaryTitle}</strong>
        </p>
        <p>{consentMessages.boundaryBody}</p>
      </div>
      <Button variant="secondary" onClick={reset}>
        {consentMessages.boundaryRetry}
      </Button>
    </div>
  );
}
