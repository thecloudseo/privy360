-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS users_isolation ON users
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- Enable RLS on consents table
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS consents_isolation ON consents
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- Enable RLS on audit_events table
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS audit_events_isolation ON audit_events
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- Enable RLS on rights_requests table
ALTER TABLE rights_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS rights_requests_isolation ON rights_requests
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- Enable RLS on grievances table
ALTER TABLE grievances ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS grievances_isolation ON grievances
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
