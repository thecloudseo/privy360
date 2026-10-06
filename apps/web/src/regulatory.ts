import { createLocaleCatalog, designTokens, type Locale } from "@privy360/ui";
import type { PublishedRegulationSummary } from "@privy360/regulatory";

export type RegulatoryLibraryModel = Readonly<{
  locale: Locale;
  state: "loading" | "empty" | "error" | "ready";
  items: readonly PublishedRegulationSummary[];
  message?: string;
}>;

export function createRegulatoryLibraryModel(
  input: Readonly<{
    locale: string;
    state: RegulatoryLibraryModel["state"];
    items?: readonly PublishedRegulationSummary[];
    message?: string;
  }>,
): RegulatoryLibraryModel {
  const catalog = createLocaleCatalog(input.locale);
  return {
    locale: catalog.locale,
    state: input.state,
    items: input.items ?? [],
    ...(input.message ? { message: input.message } : {}),
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stateContent(
  model: RegulatoryLibraryModel,
  labels: Record<string, string>,
): string {
  if (model.state === "loading")
    return `<section aria-live="polite" aria-busy="true" class="library-state"><p>${labels.loading}</p></section>`;
  if (model.state === "error")
    return `<section aria-live="assertive" class="library-state error"><h2>${labels.errorTitle}</h2><p>${labels.error}</p></section>`;
  if (model.state === "empty")
    return `<section aria-live="polite" class="library-state"><h2>${labels.emptyTitle}</h2><p>${labels.empty}</p></section>`;
  return `<div class="library-layout"><nav class="library-rail" aria-label="${labels.regulations}"><h2>${labels.regulations}</h2><ul>${model.items.map((item) => `<li><a href="#${escapeHtml(item.regulation.regulationId)}">${escapeHtml(item.regulation.code)}<span>${escapeHtml(item.regulation.title)}</span></a></li>`).join("")}</ul></nav><div class="library-detail"><p class="eyebrow">${labels.publishedCorpus}</p>${model.items
    .map(
      (item) =>
        `<article id="${escapeHtml(item.regulation.regulationId)}" class="regulation-entry"><header><div><p class="code">${escapeHtml(item.regulation.code)}</p><h2>${escapeHtml(item.regulation.title)}</h2></div><span class="status">${labels.published}</span></header><dl class="metadata"><div><dt>${labels.jurisdiction}</dt><dd>${escapeHtml(item.regulation.jurisdiction)}</dd></div><div><dt>${labels.authority}</dt><dd>${escapeHtml(item.regulation.authority)}</dd></div></dl>${item.versions
          .map((version) => {
            const sources =
              "sources" in version && Array.isArray(version.sources)
                ? version.sources
                : [];
            return `<section class="version" aria-labelledby="${escapeHtml(version.regulationVersionId)}-title"><h3 id="${escapeHtml(version.regulationVersionId)}-title">${labels.version} ${escapeHtml(version.revision)}</h3><p>${labels.effectiveFrom}: <time datetime="${escapeHtml(version.effectiveFrom)}">${escapeHtml(version.effectiveFrom)}</time></p><aside aria-label="${labels.provenance}"><strong>${labels.provenance}</strong><p>${sources.map((source) => `${escapeHtml(source.issuer)} · ${escapeHtml(source.verificationState)} · ${source.authoritative ? labels.authoritative : labels.synthetic}`).join("<br>")}</p></aside></section>`;
          })
          .join("")}</article>`,
    )
    .join("")}</div></div>`;
}

export function renderRegulatoryLibrary(model: RegulatoryLibraryModel): string {
  const catalog = createLocaleCatalog(model.locale);
  const labels =
    model.locale === "hi-IN"
      ? {
          title: "नियामक पुस्तकालय",
          regulations: "विनियम",
          publishedCorpus: "प्रकाशित संदर्भ संग्रह",
          published: "प्रकाशित",
          version: "संस्करण",
          effectiveFrom: "प्रभावी तिथि",
          jurisdiction: "अधिकार क्षेत्र",
          authority: "प्राधिकरण",
          provenance: "स्रोत और प्रमाणिकता",
          authoritative: "मान्य स्रोत",
          synthetic: "सिंथेटिक उदाहरण",
          loading: "प्रकाशित सामग्री लोड हो रही है…",
          emptyTitle: "कोई प्रकाशित विनियम नहीं",
          empty: "मानव समीक्षा के बाद प्रकाशित विनियम यहाँ दिखाई देंगे।",
          errorTitle: "पुस्तकालय लोड नहीं हो सका",
          error: "पुस्तकालय की सामग्री अभी उपलब्ध नहीं है।",
        }
      : {
          title: "Regulatory library",
          regulations: "Regulations",
          publishedCorpus: "Published reference corpus",
          published: "Published",
          version: "Version",
          effectiveFrom: "Effective from",
          jurisdiction: "Jurisdiction",
          authority: "Authority",
          provenance: "Provenance",
          authoritative: "Authoritative source",
          synthetic: "Synthetic fixture",
          loading: "Loading published material…",
          emptyTitle: "No published regulations",
          empty: "Regulations appear here after human review and publication.",
          errorTitle: "Library could not be loaded",
          error: "Published library content is not available right now.",
        };
  const css = `:root{--canvas:${designTokens.color.canvas};--surface:${designTokens.color.surface};--ink:${designTokens.color.ink};--muted:${designTokens.color.muted};--accent:${designTokens.color.accent};--rule:${designTokens.color.rule};--focus:${designTokens.color.focus};}body{margin:0;background:var(--canvas);color:var(--ink);font:15px/1.55 ${designTokens.type.family}}.library{max-width:1180px;margin:auto;padding:40px 28px}.library-header{border-bottom:1px solid var(--rule);padding-bottom:24px;margin-bottom:24px}.library-header h1{font-size:clamp(2rem,4vw,3.6rem);line-height:1.02;margin:.15rem 0}.eyebrow,.code{color:var(--accent);font-size:.76rem;letter-spacing:.08em;text-transform:uppercase}.library-layout{display:grid;grid-template-columns:260px 1fr;gap:28px}.library-rail{border-right:1px solid var(--rule);padding-right:20px}.library-rail ul{list-style:none;padding:0;margin:12px 0}.library-rail a{display:block;color:var(--ink);padding:10px 0;text-decoration:none;border-bottom:1px solid var(--rule)}.library-rail a:focus,.library-rail a:hover{color:var(--accent)}.library-rail span{display:block;color:var(--muted);font-size:.88rem}.regulation-entry{background:var(--surface);border:1px solid var(--rule);padding:24px;margin-bottom:20px}.regulation-entry header{display:flex;justify-content:space-between;gap:20px;align-items:start}.regulation-entry h2{font-size:1.65rem;line-height:1.15;margin:.15rem 0}.status{background:var(--accentSoft);color:var(--accent);padding:5px 9px;font-size:.75rem;font-weight:700}.metadata{display:flex;flex-wrap:wrap;gap:24px;border-block:1px solid var(--rule);padding:14px 0;margin:20px 0}.metadata dt{color:var(--muted);font-size:.78rem}.metadata dd{margin:2px 0 0}.version{border-left:3px solid var(--accent);padding-left:16px}.version h3{margin-bottom:0}.version aside{background:#f0f5f3;border:1px solid var(--rule);padding:12px;margin-top:18px;color:var(--muted)}.library-state{background:var(--surface);border:1px solid var(--rule);padding:40px;text-align:center}.skip-link{position:absolute;left:-9999px}.skip-link:focus{left:12px;top:12px;background:var(--surface);padding:8px;z-index:2}@media(max-width:760px){.library{padding:24px 16px}.library-layout{grid-template-columns:1fr}.library-rail{border-right:0;border-bottom:1px solid var(--rule);padding:0 0 16px}.regulation-entry header{display:block}.status{display:inline-block;margin-top:12px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}`;
  return `<style>${css}</style><a class="skip-link" href="#library-main">${catalog.messages.skipToContent}</a><main id="library-main" class="library" tabindex="-1"><header class="library-header"><p>${catalog.messages.staffTitle}</p><h1>${labels.title}</h1><p>${labels.publishedCorpus}</p></header>${stateContent(model, labels)}</main>`;
}
