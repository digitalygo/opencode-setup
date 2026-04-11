---
name: expectations-schema
description: Ruleset for client expectations in the Mycelium framework
---

# Mycelium framework: client expectations

Use these rules and schemas for writing client expectations (EXP-*.md files). Expectations are higher-level, outcome-focused documents describing what the commissioning client expects from the product. They are intentionally lighter than directives.

## What expectations are

Client expectations describe *what* the product should achieve. They include:

- Business behavior and operational outcomes
- Success states and value propositions
- Product results and workflow expectations
- Acceptance criteria from the commissioning client's perspective

Expectations intentionally avoid:

- Implementation details and architecture
- Specific technologies or libraries
- Detailed algorithms or workflows
- Technical constraints (these belong in directives)

## What you do

- Use templates to write new expectations
- Validate against the schema
- Focus on outcomes, not implementation
- Keep structure intentionally light

## How to use

1. Open the reference template at [`references/_templates/default.md`](references/_templates/default.md)
2. Adapt it to your specific expectation
3. Keep it outcome-focused

If local references cannot be read, view them online at <https://github.com/digitalygo/opencode-setup/tree/main/skills/expectations-schema/references>

## Reference index

| File | Topics Covered |
|------|----------------|
| [`_schema.yaml`](references/_schema.yaml) | Schema validation rules, minimal required fields |
| [`default.md`](references/_templates/default.md) | General use template for expectations |

## Output format

```yaml
---
type: [feature|improvement|integration|other]
priority: [critical|high|medium|low]
area: string
---

# [Readable title]

## Purpose & Value
...

## Expected Outcomes
...

## Success Criteria
- [ ] ...

## Out of Scope
...
```

## Required sections

1. **Title** (H1)
2. **Purpose & Value** - why this expectation exists, business value
3. **Expected Outcomes** - what the product should deliver, high-level behavior
4. **Success Criteria** - checklist of verifiable outcomes (minimum 2 items)

## Optional sections

- **Out of Scope** - explicitly excluded
- **Open Questions** - unresolved items

## File naming

- Use kebab-case descriptive names
- Prefix with `EXP-` for expectations (e.g., `EXP-user-checkout-flow.md`)
- Place in `substrate/expectations/` or `substrate/expectations/{area}/`

## Directives vs expectations

| Aspect | Directives (DRC-*) | Expectations (EXP-*) |
|--------|-------------------|----------------------|
| Location | `substrate/directives/` | `substrate/expectations/` |
| Audience | Developers and AI agents | Commissioning client and stakeholders |
| Focus | Implementation details | Business outcomes and value |
| Structure | Detailed, structured | Lighter, high-level |
| Content | Architecture, logic, constraints | Business behavior, success states, product results |

For developer directives, see the `directives-schema` skill.

## Key differences from directives

- **Minimal structure**: Only 4 required sections vs 7 in directives
- **Outcome focus**: Describe business behavior and product results, not how it is built
- **No implementation**: Avoid mentioning specific technologies, APIs, or algorithms
- **Business language**: Use terms the commissioning client understands, not technical jargon

## Available templates

Reference template in `skills/expectations-schema/references/_templates/`:

- `default.md` for general use

Write expectations to `substrate/expectations/` in the target repository.

## Migration note

Legacy EXP files in `substrate/directives/` should be reviewed:

- If they contain implementation details → convert to DRC-* format
- If they describe outcomes → move to EXP-* in substrate/expectations/
