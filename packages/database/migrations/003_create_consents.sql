-- Create consents table with tenant isolation
CREATE TABLE IF NOT EXISTS consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  principal_id VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_date TIMESTAMPTZ,
  withdrawn_by UUID REFERENCES users(id) ON DELETE SET NULL,
  withdrawn_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_consent_principal_purpose UNIQUE(tenant_id, principal_id, purpose)
);

CREATE INDEX IF NOT EXISTS idx_consents_tenant_principal ON consents(tenant_id, principal_id);
CREATE INDEX IF NOT EXISTS idx_consents_status ON consents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_consents_granted_by ON consents(granted_by);
