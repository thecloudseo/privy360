# Privy360 API Architecture

**Version**: 1.0  
**Status**: Authority Document  
**Framework**: Fastify 5+  
**References**: AGENTS.md §17, MASTER_SPEC.md §15, SECURITY_ARCHITECTURE.md

---

## 1. API Contracts (Foundation - Week 1)

### 1.1 POST /api/v1/consents (Create Consent)

**Authorization**: `consent:write` permission required

**Request**:
```json
{
  "dataPrincipalId": "principal-123",
  "purpose": "marketing",
  "grantConsent": true
}
```

**Request Validation** (Zod schema):
- `dataPrincipalId`: string, required, non-empty
- `purpose`: enum(marketing, analytics, operations, research)
- `grantConsent`: boolean

**Response 201**:
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "principalId": "principal-123",
  "purpose": "marketing",
  "status": "granted",
  "grantedDate": "2026-10-15T10:30:00Z",
  "createdAt": "2026-10-15T10:30:00Z"
}
```

**Response 400**: Validation failed
```json
{
  "error": "Validation failed",
  "details": { "purpose": "Invalid enum value" }
}
```

**Response 403**: Permission denied OR tenant mismatch
```json
{
  "error": "Forbidden"
}
```

**Response 409**: Duplicate consent for same principal+purpose
```json
{
  "error": "Consent already exists",
  "code": "DUPLICATE_CONSENT"
}
```

**Audit**: Creates `AuditEvent` with action=CREATE

---

### 1.2 GET /api/v1/consents (List Consents)

**Authorization**: `consent:read` permission required

**Query Parameters**:
- `principalId` (optional): Filter by principal
- `purpose` (optional): Filter by purpose
- `status` (optional): Filter by status
- `limit` (default 50, max 1000)
- `offset` (default 0)

**Response 200**:
```json
{
  "items": [
    { "id": "...", "principalId": "...", ... }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

**Tenant Isolation**: Returns only Tenant A consents (RLS enforced)

---

### 1.3 DELETE /api/v1/consents/{id} (Withdraw Consent)

**Authorization**: `consent:write` permission required

**Response 204**: No content (consent withdrawn)

**Response 403**: Not authorized OR tenant mismatch (no enumeration)

**Response 404**: Not found

**Audit**: Creates `AuditEvent` with action=DELETE, includes previous status

**Cascade**: Notifies processors of withdrawal (future Module)

---

## 2. Error Response Format (Standard)

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2026-10-15T10:30:00Z"
}
```

**Never include**:
- Stack traces
- SQL queries
- Tenant IDs (in error message)
- Internal system names

---

## 3. Authentication Header

All protected endpoints require:
```
Authorization: Bearer <JWT_TOKEN>
```

Invalid/missing JWT → `401 Unauthorized`

Expired JWT → `401 Unauthorized` (not 403)

---

## 4. Rate Limiting

Via `@fastify/rate-limit`:

```
GET /api/v1/consents: 100 requests per minute per user
POST /api/v1/consents: 20 requests per minute per user
```

Exceeded → `429 Too Many Requests`

---

## 5. API Versioning

**Version 1** (v1): Initial release

Future changes either:
- Add new optional fields (backward compatible)
- Create v2 endpoint (new URL)

---

## 6. Response Headers

All responses include:
```
X-Request-ID: <uuid>  (for tracing)
X-Tenant-ID: <uuid>   (for debugging)
Content-Type: application/json
```

---

## 7. OpenAPI Documentation

Every endpoint documented via OpenAPI 3.0 spec at:
```
GET /api/v1/openapi.json
```

Swagger UI available at:
```
GET /api/docs
```

---

## 8. Future Endpoints (Week 1+)

### Rights Requests
- POST /api/v1/rights-requests
- GET /api/v1/rights-requests/{id}
- GET /api/v1/data-summary

### Grievances
- POST /api/v1/grievances
- GET /api/v1/grievances/{id}

### Admin
- POST /api/v1/audit-events (read-only)
- GET /api/v1/users
- POST /api/v1/users

---

**Authority**: API contracts defined here are frozen before implementation  
**Supersedes**: Ad-hoc API design  
**Enforces**: Consistency across endpoints
