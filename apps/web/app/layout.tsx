import type { Metadata } from "next";
import "@privy360/ui/design-tokens.css";
import "@privy360/ui/components.css";
import { createLocaleCatalog } from "@privy360/ui";
import { consentMessages } from "../src/consents/messages.ts";

export const metadata: Metadata = {
  title: consentMessages.workspaceTitle,
  description: "Privy360 workspace",
};

const catalog = createLocaleCatalog("en-IN");

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body>
        <a className="sr-only" href="#main-content">
          {catalog.messages.skipToContent}
        </a>
        <header className="p360-shell-header">
          <p className="p360-muted">{catalog.messages.staffTitle}</p>
        </header>
        <main id="main-content" tabIndex={-1} className="p360-shell-main">
          {children}
        </main>
      </body>
    </html>
  );
}
