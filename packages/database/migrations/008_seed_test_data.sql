-- Seed test data for development and testing
-- NOTE: Use synthetic data only. Never use production or real citizen data.

-- Create test tenant
INSERT INTO tenants (id, name, email, onboarding_status)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'Test Organization',
  'admin@test.example.com',
  'completed'
) ON CONFLICT DO NOTHING;

-- Create test user (admin)
INSERT INTO users (id, tenant_id, keycloak_id, email, role)
VALUES (
  '660e8400-e29b-41d4-a716-446655440001'::UUID,
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'test-admin-keycloak-id',
  'admin@test.example.com',
  'admin'
) ON CONFLICT (keycloak_id) DO NOTHING;

-- Create test user (operator)
INSERT INTO users (id, tenant_id, keycloak_id, email, role)
VALUES (
  '660e8400-e29b-41d4-a716-446655440002'::UUID,
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'test-operator-keycloak-id',
  'operator@test.example.com',
  'operator'
) ON CONFLICT (keycloak_id) DO NOTHING;

-- Create test consent (granted)
INSERT INTO consents (id, tenant_id, principal_id, purpose, status, granted_by, granted_date)
VALUES (
  '770e8400-e29b-41d4-a716-446655440003'::UUID,
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'principal-001',
  'marketing',
  'granted',
  '660e8400-e29b-41d4-a716-446655440001'::UUID,
  now()
) ON CONFLICT DO NOTHING;

-- Create test consent (pending)
INSERT INTO consents (id, tenant_id, principal_id, purpose, status)
VALUES (
  '770e8400-e29b-41d4-a716-446655440004'::UUID,
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'principal-002',
  'analytics',
  'pending'
) ON CONFLICT DO NOTHING;
