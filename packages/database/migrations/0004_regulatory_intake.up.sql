CREATE TABLE regulatory.source_imports (
  import_id uuid PRIMARY KEY,
  manifest_id text NOT NULL,
  manifest_digest text NOT NULL REFERENCES regulatory.publication_manifests(digest),
  state text NOT NULL CHECK (state = 'QUARANTINED'),
  actor_ref text NOT NULL,
  correlation_id uuid NOT NULL,
  policy_decision_id uuid NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manifest_digest)
);
CREATE INDEX source_imports_correlation_idx ON regulatory.source_imports (correlation_id);
