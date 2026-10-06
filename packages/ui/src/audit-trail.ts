import type { Locale } from "./index.js";

const designTokens = {
  color: { canvas: "#f5f7f8", accent: "#0b6e69" },
} as const;

export type AuditTrailState = "loading" | "ready" | "empty" | "error";
export type AuditTrailItem = Readonly<{
  eventId: string;
  sequence: string;
  actorLabel: string;
  actionLabel: string;
  resourceLabel: string;
  result: "SUCCESS" | "FAILURE" | "DENIED";
  occurredAtLabel: string;
  integrityLabel?: string;
}>;

export type AuditTrailModel = Readonly<{
  locale: Locale;
  state: AuditTrailState;
  scopeLabel: string;
  items: readonly AuditTrailItem[];
  nextCursor?: string;
  errorCode?: string;
}>;

const copy = {
  "en-IN": {
    title: "Audit trail",
    subtitle: "A scoped record of security and compliance activity.",
    filters: "Audit filters",
    action: "Action",
    result: "Result",
    all: "All events",
    apply: "Apply filters",
    scope: "Viewing scope",
    loading: "Loading audit activity",
    empty: "No audit events match these filters.",
    emptyHelp: "Try a wider time range or clear one of the filters.",
    error: "Audit activity is temporarily unavailable.",
    errorHelp:
      "Use the correlation ID from the request error when contacting support.",
    previous: "Previous page",
    next: "Next page",
    sequence: "Sequence",
    integrity: "Integrity",
    actor: "Actor",
    resource: "Resource",
  },
  "hi-IN": {
    title: "ऑडिट ट्रेल",
    subtitle: "सुरक्षा और अनुपालन गतिविधि का सीमित रिकॉर्ड।",
    filters: "ऑडिट फ़िल्टर",
    action: "कार्रवाई",
    result: "परिणाम",
    all: "सभी घटनाएँ",
    apply: "फ़िल्टर लागू करें",
    scope: "देखने का दायरा",
    loading: "ऑडिट गतिविधि लोड हो रही है",
    empty: "इन फ़िल्टर से कोई ऑडिट घटना नहीं मिली।",
    emptyHelp: "समय सीमा बढ़ाएँ या कोई फ़िल्टर हटाएँ।",
    error: "ऑडिट गतिविधि अभी उपलब्ध नहीं है।",
    errorHelp: "सहायता से संपर्क करते समय अनुरोध की correlation ID दें।",
    previous: "पिछला पृष्ठ",
    next: "अगला पृष्ठ",
    sequence: "क्रम",
    integrity: "अखंडता",
    actor: "अभिनेता",
    resource: "संसाधन",
  },
} as const;

type CopyKey = keyof (typeof copy)["en-IN"];

export function createAuditTrailModel(input: {
  locale?: string;
  state: AuditTrailState;
  scopeLabel: string;
  items: readonly AuditTrailItem[];
  nextCursor?: string;
  errorCode?: string;
}): AuditTrailModel {
  const locale: Locale = input.locale === "hi-IN" ? "hi-IN" : "en-IN";
  return {
    locale,
    state: input.state,
    scopeLabel: input.scopeLabel,
    items: input.items,
    ...(input.nextCursor ? { nextCursor: input.nextCursor } : {}),
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
  };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

function stateMarkup(
  model: AuditTrailModel,
  text: (key: CopyKey) => string,
): string {
  if (model.state === "loading")
    return `<section class="audit-status" aria-live="polite"><p role="status">${text("loading")}…</p></section>`;
  if (model.state === "error")
    return `<section class="audit-status audit-status--error" aria-live="polite"><h2>${text("error")}</h2><p>${text("errorHelp")}</p></section>`;
  if (model.state === "empty" || model.items.length === 0)
    return `<section class="audit-status" aria-live="polite"><h2>${text("empty")}</h2><p>${text("emptyHelp")}</p></section>`;
  return `<ol class="audit-timeline" aria-label="${text("title")}">${model.items.map((item) => `<li class="audit-event"><span class="audit-event__spine" aria-hidden="true"></span><article tabindex="0"><header><span class="audit-sequence">${text("sequence")} ${escapeHtml(item.sequence)}</span><time>${escapeHtml(item.occurredAtLabel)}</time></header><h2>${escapeHtml(item.actionLabel)}</h2><dl><div><dt>${text("actor")}</dt><dd>${escapeHtml(item.actorLabel)}</dd></div><div><dt>${text("resource")}</dt><dd>${escapeHtml(item.resourceLabel)}</dd></div></dl><p class="audit-result audit-result--${item.result.toLowerCase()}">${escapeHtml(item.result)}</p>${item.integrityLabel ? `<p class="audit-integrity">${text("integrity")}: ${escapeHtml(item.integrityLabel)}</p>` : ""}</article></li>`).join("")}</ol>`;
}

export function renderAuditTrail(model: AuditTrailModel): string {
  const text = (key: CopyKey): string => copy[model.locale][key];
  return `<main id="main-content" class="audit-page" tabindex="-1" style="--audit-accent:${designTokens.color.accent};--audit-canvas:${designTokens.color.canvas}"><header class="audit-page__header"><p class="audit-kicker">${text("scope")}: ${escapeHtml(model.scopeLabel)}</p><h1>${text("title")}</h1><p>${text("subtitle")}</p></header><form class="audit-filters" aria-label="${text("filters")}" method="get"><label for="audit-action">${text("action")}<select id="audit-action" name="action"><option>${text("all")}</option></select></label><label for="audit-result">${text("result")}<select id="audit-result" name="result"><option>${text("all")}</option></select></label><button type="submit">${text("apply")}</button></form>${stateMarkup(model, text)}<nav class="audit-pagination" aria-label="${text("title")} pagination"><button type="button" disabled>${text("previous")}</button><button type="button"${model.nextCursor ? "" : " disabled"}>${text("next")}</button></nav></main>`;
}
