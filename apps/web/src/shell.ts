import {
  createShellModel,
  renderShell,
} from "../../../packages/ui/src/index.js";
import {
  createAuditTrailModel,
  renderAuditTrail,
} from "../../../packages/ui/src/audit-trail.js";

export function createStaffShell(locale = "en-IN") {
  return createShellModel("staff", locale);
}

export function renderStaffShell(locale = "en-IN") {
  return renderShell(createStaffShell(locale));
}

export function renderStaffAuditTrail(
  input: Parameters<typeof createAuditTrailModel>[0],
) {
  return renderAuditTrail(createAuditTrailModel(input));
}
