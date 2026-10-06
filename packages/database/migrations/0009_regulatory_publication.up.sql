CREATE TABLE regulatory.regulatory_reviews (
  review_id uuid PRIMARY KEY DEFAULT uuidv7(),
  manifest_ref text NOT NULL,
  reviewer_ref text NOT NULL,
  publisher_ref text,
  state text NOT NULL CHECK (state IN ('DRAFT', 'REVIEWED', 'PUBLISHED', 'SUPERSEDED')),
  supersedes_manifest_id text,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(reviewer_ref) <> ''),
  CHECK (publisher_ref IS NULL OR btrim(publisher_ref) <> ''),
  CHECK ((state = 'DRAFT' AND published_at IS NULL) OR state <> 'DRAFT'),
  CHECK ((state IN ('PUBLISHED', 'SUPERSEDED') AND publisher_ref IS NOT NULL) OR state NOT IN ('PUBLISHED', 'SUPERSEDED')),
  UNIQUE (manifest_ref)
);

CREATE INDEX regulatory_reviews_state_idx
  ON regulatory.regulatory_reviews (state, created_at);

CREATE OR REPLACE FUNCTION regulatory.reject_published_manifest_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state = 'PUBLISHED' THEN
    RAISE EXCEPTION 'published regulatory manifests are immutable';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER publication_manifests_immutable
  BEFORE UPDATE OR DELETE ON regulatory.publication_manifests
  FOR EACH ROW EXECUTE FUNCTION regulatory.reject_published_manifest_mutation();

INSERT INTO audit.schema_migrations(version, checksum)
VALUES ('0009_regulatory_publication', 'REGULATORY-003-SQL-V1')
ON CONFLICT (version) DO NOTHING;
