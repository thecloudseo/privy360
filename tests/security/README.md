# tests/security

Reserved by the approved repository architecture. Content is added by the owning ticket.

# Local container review

ADR-034 separates local-development eligibility from production/deployable artifact approval. `tests/security/local-security-policy.test.mjs` and `f003-r2.test.mjs` exercise exact digest/path/material binding, timestamp and scanner-output rejection, volume containment, structured deployment rejection, disposition lifecycle, baseline identity and unchanged production denial. The R2 collector retains compressed original Trivy and Syft output only after a complete collection; the September 30 Keycloak scan remains separately labeled historical. No disposition is active, and no approval strings alone can authorize one. The production Trivy gate remains independent.
