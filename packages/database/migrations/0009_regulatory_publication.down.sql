DROP TRIGGER IF EXISTS publication_manifests_immutable ON regulatory.publication_manifests;
DROP FUNCTION IF EXISTS regulatory.reject_published_manifest_mutation();
DROP TABLE IF EXISTS regulatory.regulatory_reviews;
