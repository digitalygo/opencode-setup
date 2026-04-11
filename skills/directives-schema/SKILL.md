---
name: directives-schema
description: Complete ruleset for developer-facing directives in the Mycelium framework
---

# Mycelium framework: developer directives

Use these rules and schemas for writing developer directives (DRC-*.md files). Directives are detailed, implementation-focused instructions for AI and human developers. Schema and templates live in this skill and are not replicated elsewhere.

## What directives are

Developer directives specify *how* to implement features. They include:

- Architecture and design patterns
- Implementation constraints and technical boundaries
- Logic, algorithms, and workflows
- API contracts and data structures
- Detailed acceptance criteria for verification

## What you do

- Use templates to write new directives
- Validate against the schema
- Follow general rules for the directives framework
- Detect and migrate from legacy layouts

## How to use

1. Open the relevant reference set under [`references/`](references/)
2. Find templates and schemas matching your case
3. Verify

If local references cannot be read, view them online at <https://github.com/digitalygo/opencode-setup/tree/main/skills/directives-schema/references>

## Reference index

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

## Implementation Requirements
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
2. **Purpose & Context** - why this directive exists, technical rationale
3. **Actors and Roles** - role-based differences, capabilities per role
4. **Implementation Requirements** - architecture, logic, workflows, base flow
5. **Inputs & Outputs** - required for api and logic, optional for others
6. **Edge / Failure Cases** - exception scenarios
7. **Acceptance Criteria** - checklist with minimum 3 verifiable items

## Optional sections

- **Constraints / Non-goals** - explicitly out of scope
- **Open Questions** - unresolved items

## File naming

- Use kebab-case descriptive names
- Prefix with `DRC-` for developer directives (e.g., `DRC-user-authentication.md`)
- Place in `substrate/directives/` or `substrate/directives/{area}/`

## Directives vs expectations

| Aspect | Directives (DRC-*) | Expectations (EXP-*) |
|--------|-------------------|----------------------|
| Location | `substrate/directives/` | `substrate/expectations/` |
| Audience | Developers and AI agents | Customers and stakeholders |
| Focus | Implementation details | Outcomes and value |
| Structure | Detailed, structured | Lighter, high-level |
| Content | Architecture, logic, constraints | Behavior, success states, UX |

For customer-facing expectations, see the `expectations-schema` skill.

## Available templates

Reference templates in `skills/directives-schema/references/_templates/`:

- `default.md` for general use
- `ui.md` for interface components
- `api.md` for endpoints
- `logic.md` for business logic
- `security.md` for security features

Write directives to `substrate/directives/` in the target repository, using these templates as reference.

## Legacy layout detection

When `substrate/directives/` or `substrate/traces/` are not found, the repository may use the legacy layout:

- Legacy directives location: `intents/`
- Legacy traces location: `thoughts/`

### Detection steps

1. Check if `substrate/directives/` exists → new layout present
2. Check if `intents/` exists → legacy layout present
3. If neither exists → new repository, create `substrate/directives/` as needed

### Migration

If legacy layout detected, recommend running the official migration command:
`migrate-to-mycelium`
