import {
  createShellModel,
  renderShell,
} from "../../../packages/ui/src/index.js";

export function createPrivacyCentreShell(locale = "en-IN") {
  return createShellModel("privacy-centre", locale);
}

export function renderPrivacyCentreShell(locale = "en-IN") {
  return renderShell(createPrivacyCentreShell(locale));
}
