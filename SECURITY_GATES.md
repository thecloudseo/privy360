# Privy360 Security Gates (T3.4)

**Version**: 1.0  
**Status**: Authority Document  
**Last Updated**: 2026-10-15  
**Authority**: AGENTS.md §29, §30

---

## Overview

All pull requests must pass the security gates below before merge. Failing gates block PR merge automatically.

**Critical Rule**: A security finding that passes the gate means the gate is not sufficiently strict, not that the code is secure. Humans review findings and may request additional remediation beyond what gates enforce.

---

## Mandatory Security Gates

### Gate 1: Dependency Audit (`audit:deps`)

**Purpose**: Detect vulnerable dependencies (npm packages)

**Command**: `pnpm audit --audit-level high`

**Severity**: CRITICAL  
**Failure**: PR blocked, must upgrade/patch dependencies

**Coverage**:
- Direct dependencies in all packages
- Transitive dependencies
- Both production and dev dependencies

**Enforcement**: CI workflow runs on every push/PR

---

### Gate 2: TypeScript Type Checking (`typecheck`)

**Purpose**: Catch type errors that can lead to security bugs

**Command**: `pnpm typecheck`

**Severity**: HIGH  
**Failure**: PR blocked, type errors must be resolved

**Coverage**:
- All TypeScript files in packages/, apps/
- Strict mode enabled
- No `any` type without justification

**Enforcement**: CI workflow runs on every push/PR

---

### Gate 3: Linting & Code Style (`lint`)

**Purpose**: Enforce consistent code style that reduces security bugs

**Command**: `pnpm lint`

**Severity**: MEDIUM  
**Failure**: PR blocked, linting issues must be resolved

**Coverage**:
- ESLint rules covering:
  - Unused variables (may hide security logic)
  - Unsafe patterns
  - Code quality issues

**Enforcement**: CI workflow runs on every push/PR

---

### Gate 4: Secret Scanning (`gitleaks`)

**Purpose**: Prevent accidental credential commits

**Command**: `.cache/gitleaks git --redact .` + `.cache/gitleaks dir --redact .`

**Severity**: CRITICAL  
**Failure**: PR blocked, secrets must be removed

**Coverage**:
- Detects:
  - API keys, tokens, passwords
  - Private keys
  - Database credentials
  - OAuth tokens
  - SSH keys
  - AWS access keys
- Scans:
  - Git history
  - Current working directory
  - Retained evidence files (synthetic data)

**Enforcement**: CI workflow runs on every push/PR  
**False Positives**: Add to `.gitleaksignore` with justification (reviewed separately)

---

### Gate 5: Static Application Security Testing (`semgrep`)

**Purpose**: Detect security vulnerabilities in source code

**Command**: `.venv-semgrep/bin/semgrep scan --config p/security-audit --error .`

**Severity**: HIGH  
**Failure**: PR blocked, security issues must be resolved

**Coverage**:
- p/security-audit ruleset includes:
  - Injection attacks
  - Broken authentication
  - Sensitive data exposure
  - XXE attacks
  - Broken access control
  - Insecure configuration

**Enforcement**: CI workflow runs on every push/PR

---

### Gate 6: CodeQL Static Analysis (`codeql`)

**Purpose**: Deep semantic analysis for security vulnerabilities

**Command**: `github/codeql-action` with javascript-typescript languages

**Severity**: HIGH  
**Failure**: PR blocked, CodeQL alerts must be resolved

**Coverage**:
- Detects:
  - SQL injection
  - Cross-site scripting (XSS)
  - Unsafe deserialization
  - Weak cryptography
  - Information leaks
  - Path traversal
  - Command injection

**Enforcement**: CI workflow runs on every push/PR  
**SARIF Validation**: `node scripts/assert-sarif-clean.mjs`

---

### Gate 7: Software Composition Analysis (`trivy`)

**Purpose**: Scan dependencies and files for vulnerabilities

**Command**: `trivy scan --scanners vuln,secret,misconfig --severity HIGH,CRITICAL`

**Severity**: CRITICAL (HIGH/CRITICAL only)  
**Failure**: PR blocked, vulnerabilities must be remediated

**Coverage**:
- Vulnerability scanning (known CVEs)
- Secret scanning (credentials in source)
- Misconfiguration scanning (IaC, configs)
- Container image scanning (infrastructure dependencies)

**Enforcement**: CI workflow runs on every push/PR

---

### Gate 8: Infrastructure as Code Scanning (`checkov`)

**Purpose**: Detect misconfigurations in IaC and CI workflows

**Command**: `checkov --directory .github/workflows --framework github_actions` + `checkov --directory infra`

**Severity**: MEDIUM  
**Failure**: Warnings may not block, but should be reviewed

**Coverage**:
- CI/CD workflow security
- Infrastructure configuration
- Hardening guidelines

**Enforcement**: CI workflow runs on every push/PR

---

### Gate 9: Unit & Security Tests (`test`)

**Purpose**: Verify authorization, tenant isolation, audit logging

**Command**: `pnpm test` (includes tests/unit, tests/security, tests/integration, tests/tenancy)

**Severity**: HIGH  
**Failure**: PR blocked, test failures must be resolved

**Coverage**:
- Unit tests for security modules (permissions, authz)
- Security test suites
- Integration tests (RLS validation, tenant isolation - T3.3)
- Tenancy tests (isolation verification)

**Enforcement**: CI workflow runs on every push/PR

---

### Gate 10: SBOM Generation (`sbom`)

**Purpose**: Generate Software Bill of Materials for supply chain transparency

**Command**: `anchore/sbom-action --format cyclonedx-json`

**Severity**: LOW  
**Failure**: Does not block, artifact uploaded

**Coverage**:
- Lists all dependencies and versions
- Enables vulnerability tracking
- Supports software supply chain compliance

**Enforcement**: CI workflow runs on every push/PR  
**Artifact**: `privy360-foundation-sbom.cdx.json`

---

## Security Gate Flow

```
Git Push / PR Creation
        ↓
GitHub Actions Workflow Triggered
        ↓
┌─────────────────────────────────────────┐
│ 1. Format + Build Quality               │
│    - format (prettier)                  │
│    - lint (eslint)                      │
│    - typecheck (tsc)                    │
│    - build (tsc -p)                     │
└─────────────────────────────────────────┘
        ↓ (ALL MUST PASS)
┌─────────────────────────────────────────┐
│ 2. Tests & Code Analysis                │
│    - test (unit + integration + security)│
│    - semgrep (SAST)                     │
│    - codeql (semantic analysis)         │
│    - checkov (IaC)                      │
└─────────────────────────────────────────┘
        ↓ (ALL MUST PASS)
┌─────────────────────────────────────────┐
│ 3. Dependency & Secret Scanning         │
│    - audit:deps (npm vulnerabilities)   │
│    - gitleaks (secrets)                 │
│    - trivy (vulns + secrets + misconfig)│
└─────────────────────────────────────────┘
        ↓ (ALL MUST PASS)
┌─────────────────────────────────────────┐
│ 4. Supply Chain Visibility              │
│    - sbom (component inventory)         │
│    - container-images (Trivy)           │
└─────────────────────────────────────────┘
        ↓
✓ PR Eligible for Review
  (Human code review required)
        ↓
✓ PR Eligible for Merge
  (Only after approval + all gates pass)
```

---

## Failing a Gate: Remediation Process

### If `audit:deps` fails:
1. Run `pnpm install` to update lockfile
2. Update vulnerable packages: `pnpm update <pkg>@latest`
3. If no safe version exists: document risk and escalate
4. Re-run `pnpm audit --audit-level high` to verify

### If `typecheck`, `lint`, or `format` fails:
1. Run `pnpm format:write` to auto-fix formatting
2. Run `pnpm lint` and manually fix remaining issues
3. Run `pnpm typecheck` and resolve type errors
4. Commit fix and push

### If `gitleaks` fails:
1. **NEVER** edit the secret out and re-commit (it's in history)
2. Force-push to rewrite history (if pre-merge): `git reset HEAD~1`, remove secret, `git push --force-with-lease`
3. If already merged: rotate the secret immediately
4. Document incident for audit trail

### If `semgrep` or `codeql` fails:
1. Review the finding in detail
2. Fix the underlying issue (not just suppress the warning)
3. Avoid `# nosemgrep` or `# codeql-ignore` in production code
4. If legitimate false positive: document and escalate
5. Re-run analysis to verify fix

### If `trivy` fails:
1. For vulnerable dependencies: upgrade to patched version
2. For misconfiguration: fix the config per Trivy recommendation
3. For false positives: document and escalate
4. Re-scan to verify

### If `test` fails:
1. Review failing test case
2. Fix the underlying logic (do not weaken the test)
3. AGENTS.ms §37: "Do not delete failing security tests to obtain a passing build"
4. Add new test case if gap identified
5. Re-run tests to verify

---

## Disabling or Bypassing Gates

**STRICTLY FORBIDDEN** except by explicit Chief Architect approval.

Bypassing gates requires:
1. Written justification documented in ADR
2. Chief Architect written approval
3. Security review and sign-off
4. Audit trail entry
5. Time-bound exception (max 48 hours)

**Never use**: `--no-verify`, `--allow-dirty`, `-f` flags to skip gates

---

## Gate Maintenance & Updates

**Responsibility**: Security team  
**Frequency**: Quarterly review, or when new threat identified

**When updating gates**:
1. Document the change in this file
2. Update CI workflow version pins
3. Test gate locally before enabling
4. Communicate to team about new/stricter gates
5. Allow grace period for remediation if significantly stricter

---

## Audit & Metrics

**Tracked metrics**:
- Gate failure rates (which gates fail most often?)
- Mean time to resolution (MTTR) per gate
- False positive rates (alerts that were not real issues)
- Vulnerability escape rate (bugs found after merge)

**Reviewed**: Monthly by security team

---

## References

- AGENTS.md §29: Mandatory Security Verification
- AGENTS.md §30: Security-Critical Areas
- AGENTS.md §37: Failure Handling (do not suppress failures)
- SECURITY_ARCHITECTURE.md: Security baseline
- DATABASE_SPEC.md: RLS policies (tested by T3.3 gates)
- RBAC_ABAC.md: Authorization rules (tested by T3.1 gates)

---

**Authority**: This document is the authoritative source for security gate policy.  
**Next**: Monitor gate metrics and escalate to Chief Architect if trends indicate weakness.
