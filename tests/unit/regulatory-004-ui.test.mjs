import test from "node:test";
import assert from "node:assert/strict";
import {
  createRegulatoryLibraryModel,
  renderRegulatoryLibrary,
} from "../../apps/web/src/regulatory.ts";

const regulation = {
  regulation: {
    regulationId: "reg.synthetic",
    jurisdiction: "IN",
    authority: "Synthetic Authority",
    code: "SYN-REG",
    title: "Synthetic privacy regulation",
  },
  versions: [
    {
      regulationVersionId: "regver.synthetic",
      regulationId: "reg.synthetic",
      revision: 1,
      effectiveFrom: "2026-01-01",
      state: "PUBLISHED",
      sourceIds: ["src.synthetic"],
      sources: [
        {
          sourceId: "src.synthetic",
          issuer: "Synthetic Authority",
          canonicalUri: "https://example.invalid/source",
          language: "en",
          retrievedAt: "2026-01-01T00:00:00Z",
          checksum: { algorithm: "sha256", value: "a".repeat(64) },
          verificationState: "UNVERIFIED",
          authoritative: false,
        },
      ],
    },
  ],
};

test("renders a readable published regulatory reading room with provenance and status", () => {
  const html = renderRegulatoryLibrary(
    createRegulatoryLibraryModel({
      locale: "en-IN",
      state: "ready",
      items: [regulation],
    }),
  );
  assert.match(html, /Regulatory library/);
  assert.match(html, /SYN-REG/);
  assert.match(html, /Published/);
  assert.match(html, /Synthetic Authority/);
  assert.match(html, /aria-label/);
  assert.match(html, /tabindex="-1"/);
  assert.doesNotMatch(html, /\b(Publish|Approve)\b/);
});

test("supports loading, empty, error and Hindi labels without exposing internal errors", () => {
  assert.match(
    renderRegulatoryLibrary(
      createRegulatoryLibraryModel({ locale: "hi-IN", state: "loading" }),
    ),
    /नियामक पुस्तकालय|aria-busy="true"/,
  );
  assert.match(
    renderRegulatoryLibrary(
      createRegulatoryLibraryModel({ locale: "en-IN", state: "empty" }),
    ),
    /No published regulations/,
  );
  assert.match(
    renderRegulatoryLibrary(
      createRegulatoryLibraryModel({
        locale: "en-IN",
        state: "error",
        message: "database password leaked",
      }),
    ),
    /could not be loaded/,
  );
  assert.doesNotMatch(
    renderRegulatoryLibrary(
      createRegulatoryLibraryModel({
        locale: "en-IN",
        state: "error",
        message: "database password leaked",
      }),
    ),
    /password leaked/,
  );
});
