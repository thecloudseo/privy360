-- Create rights_requests table
CREATE TABLE IF NOT EXISTS rights_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  principal_id VARCHAR(255) NOT NULL,
  request_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'submitted',
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rights_tenant_status ON rights_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_rights_principal ON rights_requests(principal_id);
