export type AppOrigin = "staff" | "privacy-centre";
export type Locale = "en-IN" | "hi-IN";

export const designTokens = {
  color: {
    canvas: "#f5f7f8",
    surface: "#ffffff",
    ink: "#12212b",
    muted: "#52646e",
    accent: "#0b6e69",
    accentSoft: "#dcefed",
    rule: "#d8e0e3",
    danger: "#a43d3d",
  },
  type: {
    family: "Inter, ui-sans-serif, system-ui, sans-serif",
    displayWeight: 650,
    bodyWeight: 430,
  },
  radius: { panel: "14px", control: "8px" },
  focus: { outline: "#f2a900", width: "3px" },
  motion: { duration: "160ms", reducedDuration: "0ms" },
} as const;

const messages = {
  "en-IN": {
    skipToContent: "Skip to main content",
    primaryNavigation: "Primary navigation",
    staffTitle: "Privy360 workspace",
    portalTitle: "Privacy Centre",
    emptyShell: "No workspace selected",
    emptyShellHelp:
      "This foundation shell is ready for an approved workspace surface.",
  },
  "hi-IN": {
    skipToContent: "मुख्य सामग्री पर जाएँ",
    primaryNavigation: "प्राथमिक नेविगेशन",
    staffTitle: "Privy360 कार्यक्षेत्र",
    portalTitle: "गोपनीयता केंद्र",
    emptyShell: "कोई कार्यक्षेत्र चयनित नहीं है",
    emptyShellHelp: "यह आधार शेल स्वीकृत कार्यक्षेत्र सतह के लिए तैयार है।",
  },
} as const;

export type LocaleMessages = (typeof messages)[Locale];

export function createLocaleCatalog(requested: string): {
  locale: Locale;
  messages: LocaleMessages;
} {
  const locale: Locale = requested === "hi-IN" ? "hi-IN" : "en-IN";
  return { locale, messages: messages[locale] };
}

export type ShellModel = {
  origin: AppOrigin;
  locale: Locale;
  messages: LocaleMessages;
  navigation: readonly [];
  content: { kind: "empty-shell"; data: null };
};

export function createShellModel(
  origin: AppOrigin,
  requestedLocale: string,
): ShellModel {
  const catalog = createLocaleCatalog(requestedLocale);
  return {
    origin,
    locale: catalog.locale,
    messages: catalog.messages,
    navigation: [],
    content: { kind: "empty-shell", data: null },
  };
}

export function renderShell(model: ShellModel): string {
  const title =
    model.origin === "staff"
      ? model.messages.staffTitle
      : model.messages.portalTitle;
  return `<a class="skip-link" href="#main-content">${model.messages.skipToContent}</a><nav aria-label="${model.messages.primaryNavigation}"></nav><main id="main-content" tabindex="-1" data-focus-ring><header><p>${title}</p></header><section aria-live="polite"><h1>${model.messages.emptyShell}</h1><p>${model.messages.emptyShellHelp}</p></section></main>`;
}
