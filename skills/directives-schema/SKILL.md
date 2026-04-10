---
name: directives-schema
description: Complete ruleset for the Mycelium framework directives, with templates, schemas and how the framework works
---

# Mycelium framework directives

Collection of rules and schemas for our custom Mycelium directives framework. Schema and templates live in this skill and are not replicated elsewhere.

## What this skill does

- provides templates ready to be used for writing new directives
- provides a schema to validate against
- provides general rules for our directives framework
- explains how to detect and migrate from legacy layouts

## How to use this skill

1. open the relevant reference set under [`references/`](references/)
2. locate templates and schemas matching your case
3. verify

if local references cannot be read, view them online at <https://github.com/digitalygo/opencode-setup/tree/main/skills/directives-schema/references>

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

Reference templates in `skills/directives-schema/references/_templates/`:

- `default.md` for general use
- `ui.md` for interface components
- `api.md` for endpoints
- `logic.md` for business logic
- `security.md` for security features

Directives are written to `substrate/directives/` in the target repository, using these templates as reference.

## Legacy layout detection

If you cannot find `substrate/directives/` or `substrate/traces/`, the repository may use the legacy layout:

- Legacy directives location: `intents/`
- Legacy traces location: `thoughts/`

### Detection steps

1. Check if `substrate/directives/` exists → new layout present
2. Check if `intents/` exists → legacy layout present
3. If neither exists → new repository, create `substrate/directives/` as needed

### Migration

If legacy layout detected, recommend running the official migration command:
`migrate-to-mycelium`

This command safely moves all files from the old layout to the new substrate-based structure.
