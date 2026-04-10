# Recommended Initial Intents for opencode-setup

**Date:** 2026-03-27
**Purpose:** Identify initial intents to capture human expectations for this repository

---

## Overview

This document lists recommended intents for the opencode-setup repository based on its purpose as an OpenCode configuration repository. Intents follow the EXP- naming convention and are organized by functional area.

---

## auth/

- **EXP-agent-authentication.md** - How agents authenticate and validate permissions
- **EXP-api-token-management.md** - Management of API tokens for external services

## navigation/

- **EXP-agent-discovery.md** - How users discover and select appropriate agents
- **EXP-command-discovery.md** - How users find available commands
- **EXP-skill-discovery.md** - How users browse and understand available skills

## content/

- **EXP-agent-creation-workflow.md** - Process for creating new agent definitions
- **EXP-skill-creation-workflow.md** - Process for creating new skills
- **EXP-command-creation-workflow.md** - Process for defining new commands
- **EXP-configuration-validation.md** - Validation of opencode.jsonc and related configs

## settings/

- **EXP-model-selection-preferences.md** - How users configure default models per agent type
- **EXP-permission-management.md** - How file and execution permissions are configured
- **EXP-repository-customization.md** - How teams customize setup for their needs

## integrations/

- **EXP-github-actions-integration.md** - CI/CD workflow integration expectations
- **EXP-docker-workspace-setup.md** - Container-based development environment
- **EXP-huggingface-hub-integration.md** - Integration with Hugging Face services

---

## Implementation Priority

### High Priority (Foundation)

1. EXP-agent-discovery.md
2. EXP-agent-creation-workflow.md
3. EXP-configuration-validation.md
4. EXP-permission-management.md

### Medium Priority (Workflows)

1. EXP-skill-creation-workflow.md
2. EXP-command-creation-workflow.md
3. EXP-model-selection-preferences.md

### Lower Priority (Advanced)

1. EXP-github-actions-integration.md
2. EXP-docker-workspace-setup.md
3. EXP-huggingface-hub-integration.md

---

## Notes

- These are recommendations only; actual intents should be created based on user needs
- Each intent should follow the template in `intents/_templates/`
- Naming uses EXP- prefix with kebab-case descriptive names
- No numbering in intent names per repository standards
