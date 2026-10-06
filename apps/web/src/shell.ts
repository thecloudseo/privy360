import {
  createShellModel,
  renderShell,
} from "../../../packages/ui/src/index.js";

export function createStaffShell(locale = "en-IN") {
  return createShellModel("staff", locale);
}

export function renderStaffShell(locale = "en-IN") {
  return renderShell(createStaffShell(locale));
}
