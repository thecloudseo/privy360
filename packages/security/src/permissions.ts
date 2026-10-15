// Permission types and matrix for Privy360 RBAC/ABAC
// Authority: RBAC_ABAC.md, SECURITY_ARCHITECTURE.md

export type PermissionDomain =
  | "platform"
  | "tenant"
  | "consent"
  | "rights"
  | "grievance"
  | "notice"
  | "inventory"
  | "dpia"
  | "incident"
  | "control"
  | "evidence"
  | "audit"
  | "connector"
  | "processor";

export type PermissionResource =
  | "tenants"
  | "users"
  | "consents"
  | "rights_requests"
  | "grievances"
  | "notices"
  | "inventory"
  | "dpias"
  | "incidents"
  | "controls"
  | "evidence"
  | "audit_events"
  | "connectors"
  | "processors";

export type PermissionAction =
  | "read"
  | "create"
  | "update"
  | "submit"
  | "approve"
  | "publish"
  | "assign"
  | "execute"
  | "export"
  | "download"
  | "administer"
  | "delete";

export type Permission = `${PermissionDomain}.${PermissionResource}.${PermissionAction}`;

export type RoleType =
  | "platform-super-admin"
  | "tenant-admin"
  | "dpo"
  | "privacy-officer"
  | "ciso"
  | "compliance-manager"
  | "legal-reviewer"
  | "security-analyst"
  | "data-steward"
  | "business-owner"
  | "processor-vendor-manager"
  | "incident-manager"
  | "auditor"
  | "executive-read-only"
  | "data-principal"
  | "service-account";

export interface PermissionMatrix {
  readonly [role in RoleType]: ReadonlySet<Permission>;
}

// Frozen permission matrix per RBAC_ABAC.md § "Role grants"
export const PERMISSION_MATRIX: PermissionMatrix = {
  "platform-super-admin": new Set([
    // Platform operations only, no tenant content
    "platform.tenants.read",
    "platform.tenants.create",
    "platform.tenants.update",
    "platform.tenants.administer",
    "platform.tenants.delete",
  ]),

  "tenant-admin": new Set([
    // Organisation hierarchy, membership, settings
    "tenant.users.read",
    "tenant.users.create",
    "tenant.users.update",
    "tenant.users.delete",
    "tenant.tenants.read",
    "tenant.tenants.update",
    "tenant.tenants.administer",
    "inventory.inventory.read",
    "inventory.inventory.update",
    "connector.connectors.read",
    "connector.connectors.create",
    "connector.connectors.update",
    "processor.processors.read",
    "processor.processors.create",
    "processor.processors.update",
    "processor.processors.delete",
  ]),

  dpo: new Set([
    // Scoped compliance, inventory, rights, notices, vendors, risk, DPIA, incidents
    "consent.consents.read",
    "consent.consents.create",
    "consent.consents.update",
    "consent.consents.delete",
    "rights.rights_requests.read",
    "rights.rights_requests.assign",
    "rights.rights_requests.approve",
    "grievance.grievances.read",
    "grievance.grievances.update",
    "notice.notices.read",
    "notice.notices.create",
    "notice.notices.publish",
    "inventory.inventory.read",
    "inventory.inventory.update",
    "dpia.dpias.read",
    "dpia.dpias.create",
    "dpia.dpias.approve",
    "incident.incidents.read",
    "incident.incidents.update",
    "control.controls.read",
    "evidence.evidence.read",
    "processor.processors.read",
  ]),

  "privacy-officer": new Set([
    // Rights casework/verification/tasks, draft notices, consent lookup
    "consent.consents.read",
    "rights.rights_requests.read",
    "rights.rights_requests.assign",
    "grievance.grievances.read",
    "grievance.grievances.update",
    "notice.notices.read",
    "notice.notices.create",
    "inventory.inventory.read",
  ]),

  ciso: new Set([
    // Security control implementations/tests, evidence, risk, incident
    "control.controls.read",
    "control.controls.update",
    "evidence.evidence.read",
    "evidence.evidence.create",
    "incident.incidents.read",
    "incident.incidents.update",
    "audit.audit_events.read",
  ]),

  "compliance-manager": new Set([
    // Assessments, controls, applicability, testing, evidence metadata, remediation
    "control.controls.read",
    "control.controls.create",
    "control.controls.update",
    "evidence.evidence.read",
    "evidence.evidence.update",
    "audit.audit_events.read",
  ]),

  "legal-reviewer": new Set([
    // Reviewed legal sources/mappings, tenant legal/applicability review
    "notice.notices.read",
    "notice.notices.approve",
    "dpia.dpias.read",
    "dpia.dpias.approve",
    "rights.rights_requests.read",
    "incident.incidents.read",
  ]),

  "security-analyst": new Set([
    // Assigned security tests, incident actions, sanitized logs/evidence
    "control.controls.read",
    "evidence.evidence.read",
    "incident.incidents.read",
    "incident.incidents.update",
    "audit.audit_events.read",
  ]),

  "data-steward": new Set([
    // Assigned inventory, categories, data elements, systems, flows
    "inventory.inventory.read",
    "inventory.inventory.update",
    "rights.rights_requests.read",
    "rights.rights_requests.assign",
  ]),

  "business-owner": new Set([
    // Owned activities/systems, implementation updates, assigned tasks, risk remediation
    "inventory.inventory.read",
    "inventory.inventory.update",
    "control.controls.read",
    "dpia.dpias.read",
    "incident.incidents.read",
  ]),

  "processor-vendor-manager": new Set([
    // Vendors/processors/services/contracts/subprocessors
    "processor.processors.read",
    "processor.processors.update",
    "connector.connectors.read",
  ]),

  "incident-manager": new Set([
    // Incident declaration, assignment, containment, determination, notification
    "incident.incidents.read",
    "incident.incidents.create",
    "incident.incidents.update",
    "incident.incidents.approve",
  ]),

  auditor: new Set([
    // Scoped immutable records, controls/tests, evidence metadata
    "audit.audit_events.read",
    "control.controls.read",
    "evidence.evidence.read",
    "evidence.evidence.download",
  ]),

  "executive-read-only": new Set([
    // Aggregate dashboards, readiness counts, top risks
    "tenant.tenants.read",
    "control.controls.read",
    "incident.incidents.read",
  ]),

  "data-principal": new Set([
    // Own profile, consents/preferences, requests/responses
    "consent.consents.read",
    "rights.rights_requests.read",
    "rights.rights_requests.create",
    "grievance.grievances.read",
    "grievance.grievances.create",
  ]),

  "service-account": new Set([
    // Exact registered API capabilities (defined per credential)
    // This is a placeholder; actual permissions are binding-specific
  ]),
};

// Verify all roles are defined
const DEFINED_ROLES = new Set(Object.keys(PERMISSION_MATRIX) as RoleType[]);
export function isValidRole(role: string): role is RoleType {
  return DEFINED_ROLES.has(role as RoleType);
}

// Check if a role has a permission
export function hasPermission(
  role: RoleType,
  permission: Permission,
): boolean {
  const permissions = PERMISSION_MATRIX[role];
  return permissions.has(permission);
}

// Validate permission string format
export function isValidPermission(value: string): value is Permission {
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [domain, resource, action] = parts;
  // Simplified validation; in production, check against registered enums
  return /^[a-z-]+$/.test(domain) && /^[a-z_]+$/.test(resource) && /^[a-z-]+$/.test(action);
}

export interface RoleContext {
  readonly role: RoleType;
  readonly permissions: ReadonlySet<Permission>;
}

export function createRoleContext(role: RoleType): RoleContext {
  if (!isValidRole(role)) {
    throw new Error(`Invalid role: ${role}`);
  }
  return {
    role,
    permissions: PERMISSION_MATRIX[role],
  };
}
