---
name: intents-schema
description: Complete ruleset for the Intents framework, with templates, schemas and how the framework works
---

# Intents framework

Collection of rules and schemas for our custom Intents framework. Schema and templates live in this skill and are not replicated elsewhere.

## What this skill does

- provides templates ready to be used for writing new intents
- provides a schema to validate against
- provides general rules for our intents framework

## How to use this skill

1. open the relevant reference set under [`references/`](references/)
2. locate templates and schemas matching your case
3. verify

## Reference Index

| File | Topics Covered |
|------|----------------|
| [`_schema.yaml`](references/_schema.yaml) | Schema validation rules, required fields, section patterns |
| [`default.md`](references/_templates/default.md) | General use template |
| [`ui.md`](references/_templates/ui.md) | Interface components and visual states |
| [`api.md`](references/_templates/api.md) | Endpoints, methods, request/response, auth, errors |
| [`logic.md`](references/_templates/logic.md) | Business logic, algorithms, inputs/outputs |
| [`security.md`](references/_templates/security.md) | Security features, threats, audit/logging |

## Output format

```yaml
---
type: [ui|api|logic|security|performance|integration|other]
priority: [critical|high|medium|low]
area: string
---

# [Readable title]

## Purpose & Context
...

## Actors and Roles
...

## Desired Behavior
...

## Inputs & Outputs
...

## Edge / Failure Cases
...

## Acceptance Criteria
- [ ] ...

## Constraints / Non-goals
...

## Open Questions
...
```

## Required sections

1. **Title** (H1)
2. **Purpose & Context** - why this exists
3. **Actors and Roles** - role-based differences, capabilities per role
4. **Desired Behavior** - base flow, role distinctions where relevant
5. **Inputs & Outputs** - required for api and logic, optional for others
6. **Edge / Failure Cases**
7. **Acceptance Criteria** - checklist with minimum 3 verifiable items

## Optional sections

- **Constraints / Non-goals**
- **Open Questions**

## Available templates

Reference templates in intents/_templates/:

- `default.md` for general use
- `ui.md` for interface components
- `api.md` for endpoints
- `logic.md` for business logic
- `security.md` for security features
