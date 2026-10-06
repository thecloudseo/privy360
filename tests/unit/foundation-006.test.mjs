import assert from "node:assert/strict";
import test from "node:test";

import {
  createLocaleCatalog,
  createShellModel,
  designTokens,
  renderShell,
} from "../../packages/ui/src/index.ts";

test("provides accessible staff and Privacy Centre shell models without business data", () => {
  const staff = createShellModel("staff", "en-IN");
  const portal = createShellModel("privacy-centre", "hi-IN");

  assert.equal(staff.origin, "staff");
  assert.equal(portal.origin, "privacy-centre");
  assert.equal(staff.navigation.length, 0);
  assert.equal(portal.navigation.length, 0);
  assert.equal(staff.content.kind, "empty-shell");
  assert.equal(portal.content.kind, "empty-shell");
  assert.deepEqual(staff.content, portal.content);
});

test("renders keyboard and screen-reader landmarks with visible focus support", () => {
  const html = renderShell(createShellModel("staff", "en-IN"));

  assert.match(html, /skip-link/);
  assert.match(html, /aria-label="Primary navigation"/);
  assert.match(html, /<main id="main-content"/);
  assert.match(html, /tabindex="-1"/);
  assert.match(html, /data-focus-ring/);
  assert.match(html, /No workspace selected/);
});

test("switches locale using the first locale catalog and does not echo unknown locale values", () => {
  const catalog = createLocaleCatalog("hi-IN");
  assert.equal(catalog.locale, "hi-IN");
  assert.equal(catalog.messages.skipToContent, "मुख्य सामग्री पर जाएँ");
  assert.equal(createLocaleCatalog("fr-FR").locale, "en-IN");
});

test("exposes intentional, contrast-safe foundation tokens", () => {
  assert.equal(designTokens.color.canvas, "#f5f7f8");
  assert.equal(designTokens.color.ink, "#12212b");
  assert.equal(designTokens.color.accent, "#0b6e69");
  assert.equal(designTokens.focus.outline, "#f2a900");
  assert.equal(designTokens.motion.reducedDuration, "0ms");
});
