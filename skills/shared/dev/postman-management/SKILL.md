---
name: postman-management
description: >
  How to create and run Postman collections for API testing against a repo's backend —
  generating collection files from route/endpoint definitions (or an OpenAPI spec), running
  tests via Newman CLI, and validating API endpoints. Generic across stacks —
  endpoint-discovery examples cover Retrofit (Kotlin) and Express route files; adapt the
  discovery step to whatever the target repo actually uses.
applies_to: all
---

# postman-management

Was previously a standalone `postman-manager` subagent, duplicated per repo. Converted to a
skill for the same reason as `code-audit`: no distinct tool/permission scope needed, and this
path already has a real live-fetch mechanism rather than needing one built from scratch.

## Prerequisites

Install Newman (Postman CLI) if not available:
```bash
which newman || npm install -g newman newman-reporter-htmlextra
```

## How to Execute

### Create Postman Collection

1. **Identify API endpoints** by scanning the codebase — adapt to the stack:
```bash
# Kotlin/Retrofit
grep -rn "@GET\|@POST\|@PUT\|@DELETE\|@PATCH" --include="*.kt" .
grep -rn "baseUrl\|BASE_URL" --include="*.kt" .

# Express/Node
grep -rn "router\.\(get\|post\|put\|delete\|patch\)" --include="*.js" --include="*.ts" .
```

2. **Create collection file** (`postman/<repo-name>-api.json`):

```json
{
  "info": {
    "name": "<Repo Name> API",
    "description": "API collection for <repo name> backend",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    { "key": "baseUrl", "value": "{{baseUrl}}" },
    { "key": "token", "value": "{{authToken}}" }
  ],
  "item": [
    {
      "name": "Authentication",
      "item": [
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "header": [{ "key": "Content-Type", "value": "application/json" }],
            "body": { "mode": "raw", "raw": "{\"email\": \"{{email}}\", \"password\": \"{{password}}\"}" },
            "url": { "raw": "{{baseUrl}}/api/auth/login", "host": ["{{baseUrl}}"], "path": ["api", "auth", "login"] }
          },
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
                  "pm.test('Response has token', function () { var jsonData = pm.response.json(); pm.expect(jsonData).to.have.property('token'); pm.environment.set('authToken', jsonData.token); });"
                ],
                "type": "text/javascript"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### Create Environment File

```json
{
  "name": "<Repo Name> - Development",
  "values": [
    { "key": "baseUrl", "value": "http://localhost:8080", "enabled": true },
    { "key": "email", "value": "test@example.com", "enabled": true },
    { "key": "password", "value": "testpassword", "enabled": true },
    { "key": "authToken", "value": "", "enabled": true }
  ]
}
```

### Run Collection with Newman

```bash
newman run postman/<repo-name>-api.json -e postman/environment-dev.json --reporters cli,htmlextra --reporter-htmlextra-export postman/report.html
newman run postman/<repo-name>-api.json -e postman/environment-dev.json --folder "Authentication"
newman run postman/<repo-name>-api.json -e postman/environment-dev.json --iteration-count 5
newman run postman/<repo-name>-api.json -e postman/environment-dev.json --iteration-data postman/test-data.json
```

### Generate Collection from OpenAPI Spec

If an OpenAPI/Swagger spec exists:
```bash
npm install -g openapi-to-postmanv2
openapi2postmanv2 -s api/openapi.yaml -o postman/generated-collection.json
```

## Collection Structure Template

```
postman/
├── <repo-name>-api.json         # Main collection
├── environment-dev.json         # Development environment
├── environment-staging.json     # Staging environment
├── environment-prod.json        # Production environment (read-only tests)
├── test-data/
│   ├── users.json
│   └── orders.json
└── reports/
    └── .gitkeep                 # Test reports (gitignored)
```

## Test Script Templates

### Basic Response Validation
```javascript
pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
pm.test("Response time is acceptable", function () { pm.expect(pm.response.responseTime).to.be.below(2000); });
pm.test("Content-Type is JSON", function () { pm.response.to.have.header("Content-Type", /application\/json/); });
```

### Schema Validation
```javascript
const schema = {
    "type": "object",
    "required": ["id", "name", "email"],
    "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "email": { "type": "string", "format": "email" }
    }
};
pm.test("Response matches schema", function () { pm.response.to.have.jsonSchema(schema); });
```

### Authentication Flow
```javascript
if (!pm.environment.get("authToken")) {
    pm.sendRequest({
        url: pm.environment.get("baseUrl") + "/api/auth/login",
        method: "POST",
        header: { "Content-Type": "application/json" },
        body: { mode: "raw", raw: JSON.stringify({ email: pm.environment.get("email"), password: pm.environment.get("password") }) }
    }, function (err, res) {
        pm.environment.set("authToken", res.json().token);
    });
}
```

### Chained Requests
```javascript
var jsonData = pm.response.json();
pm.environment.set("createdOrderId", jsonData.id);
// Use in next request URL: {{baseUrl}}/api/orders/{{createdOrderId}}
```

## Output Format

### Collection Creation Report
```markdown
## Postman Collection Created: <Repo Name> API

**File:** `postman/<repo-name>-api.json`
**Date:** [YYYY-MM-DD]

### Endpoints Covered
| Folder | Endpoint | Method | Description |
|--------|----------|--------|-------------|
| Auth | `/api/auth/login` | POST | User login |

### Environments Created
| Environment | Base URL | Purpose |
|-------------|----------|---------|
| Development | `http://localhost:8080` | Local testing |

### Tests Included
- Response status validation, response time checks, schema validation, auth flow, error handling

### How to Run
```bash
newman run postman/<repo-name>-api.json -e postman/environment-dev.json
```
```

### Test Run Report
```markdown
## API Test Results: <Repo Name>

**Date:** [YYYY-MM-DD HH:MM]
**Environment:** [Development/Staging/Production]
**Duration:** [X seconds]

### Summary
| Metric | Value |
|--------|-------|
| Total Requests | XX |
| Passed Tests | XX |
| Failed Tests | XX |
| Skipped | XX |
| **Pass Rate** | **XX%** |

### Failed Tests
#### ❌ [Request Name] - [Test Name]
**Endpoint:** `[METHOD] /api/path`
**Expected:** [Expected result]
**Actual:** [Actual result]

### Response Time Analysis
| Endpoint | Avg Time | Max Time | Status |
|----------|----------|----------|--------|

### Recommendations
1. [Recommendation]

### Full Report
View detailed HTML report: `postman/reports/report.html`
```

## Gotchas

- Do not hardcode tokens or credentials in collection files - use environment variables
- Do not run destructive tests (DELETE, data modification) against production
- Do not commit test reports to git - add to .gitignore
- Do not assume API is running - check server status before running tests
- Do not skip authentication tests - they often catch permission issues

## Edge Cases

- **API server not running**: Start the server or use mock server
- **Token expired during test run**: Add token refresh in pre-request scripts
- **Rate limiting**: Add delays between requests with `--delay-request`
- **Large response bodies**: Set response size limit or use streaming
- **Self-signed certificates**: Use `--insecure` flag for development
