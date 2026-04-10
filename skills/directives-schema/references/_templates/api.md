---
type: api
priority: medium
area: 
---

# User management API

## Purpose & Context

Provides CRUD operations for user accounts including profile management, role assignments, and account lifecycle. This API supports the user administration interface, self-service profile updates, and authentication workflows. Features dependent on this endpoint include user registration, profile editing, and administrative user management.

## Actors and Roles

Define which roles can access this endpoint and their permissions:

- **Admin**: Full access to all user records, can perform all operations including role modifications and account suspension
- **Manager**: Can read user information within their department, modify non-sensitive fields, cannot delete accounts
- **User**: Can read and update own profile data, cannot access other user records or modify roles
- **Service**: Internal service-to-service access for authentication and audit systems

### Permission Matrix

| Role | GET | POST | PUT | DELETE |
|------|-----|------|-----|--------|
| Admin | Yes | Yes | Yes | Yes |
| Manager | Department only | No | Department only | No |
| User | Own only | Own only | Own only | No |
| Service | Yes | Yes | No | No |

## Desired Behavior

### Get User

**Method**: `GET`  
**Path**: `/api/v1/users/{userId}`

#### Request

```json
{
  "include": "string (optional) - Comma-separated list of related resources to include"
}
```

#### Response Success (200 OK)

```json
{
  "id": "string - Unique user identifier",
  "email": "string - User email address",
  "name": "string - Full display name",
  "role": "string - Assigned role identifier",
  "status": "string - Account status active|suspended|pending",
  "createdAt": "string - ISO 8601 timestamp",
  "updatedAt": "string - ISO 8601 timestamp"
}
```

#### Error Responses

| Status | Code | When it occurs |
|--------|------|----------------|
| 400 | Bad Request | Malformed user ID format or invalid query parameters |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Authenticated user lacks permission to view target user |
| 404 | Not Found | User ID does not exist in the system |
| 429 | Too Many Requests | Rate limit of 100 requests per minute exceeded |
| 500 | Internal Error | Unexpected server error, incident ID logged |

#### Rate Limiting

- **Limit**: 100 requests per minute per user
- **Scope**: Per authenticated user
- **Exceeded behavior**: Returns 429 response with Retry-After header indicating seconds until reset

## Inputs & Outputs

### Input Parameters

| Name | Type | Required | Location | Description |
|------|------|----------|----------|-------------|
| userId | UUID | Yes | path | Unique identifier of the user resource |
| include | string | No | query | Related resources to embed, default empty |
| fields | string | No | query | Specific fields to return, default all |

### Output Fields

| Name | Type | Nullable | Description |
|------|------|----------|-------------|
| id | UUID | No | System-generated unique identifier |
| email | string | No | Verified email address used for login |
| name | string | No | Display name shown in UI |
| role | string | No | Current role determining permissions |
| status | string | No | Account state affecting access |
| createdAt | string | No | Account creation timestamp in ISO 8601 |
| updatedAt | string | No | Last modification timestamp in ISO 8601 |

## Edge / Failure Cases

- **Invalid JSON body**: Returns 400 with validation error details and field-level error messages
- **Missing required field**: Returns 400 specifying missing fields and expected format
- **Authentication expired**: Returns 401 with error code indicating token expiration, client should refresh token
- **Insufficient permissions**: Returns 403 with required role information and current user role
- **Resource locked**: Returns 409 with conflict details when user record is being modified by another process
- **Rate limit hit**: Returns 429 with retry timing in seconds and current limit information
- **Database timeout**: Returns 500 with incident reference for support investigation

## Acceptance Criteria

- [ ] Endpoint returns 200 OK for valid GET requests with existing user ID
- [ ] Endpoint returns 201 Created for valid POST requests with complete data
- [ ] Endpoint returns 204 No Content for successful PUT and DELETE operations
- [ ] Endpoint returns 400 Bad Request for malformed JSON in request body
- [ ] Endpoint returns 400 Bad Request for missing required fields with specific field names
- [ ] Endpoint returns 401 Unauthorized for requests without valid authentication token
- [ ] Endpoint returns 403 Forbidden for users accessing records outside their permission scope
- [ ] Endpoint returns 404 Not Found for non-existent user IDs
- [ ] Endpoint returns 409 Conflict for concurrent modification attempts
- [ ] Endpoint returns 429 Too Many Requests when rate limit is exceeded
- [ ] Endpoint returns 500 Internal Server Error for unexpected failures with incident ID
- [ ] Input validation rejects requests with invalid email format
- [ ] Input validation rejects requests with names exceeding 100 characters
- [ ] Authentication middleware validates JWT token before processing request
- [ ] Authorization middleware checks role permissions before database operations
- [ ] Rate limiting tracks requests per user with 100 per minute limit
- [ ] Successful responses include all specified fields with correct data types
- [ ] Error responses include structured error objects with code and message
- [ ] OpenAPI specification documents all endpoints, parameters, and responses
- [ ] Request logging captures timestamp, user ID, endpoint, and response status
- [ ] Response logging captures execution time and any error details

## Constraints / Non-goals

- Bulk operations for multiple user records in single request
- Real-time WebSocket notifications for user changes
- Advanced search with full-text indexing
- Performance optimization for responses under 50ms
