# contributing to our OpenCode setup

welcome to the repository for the OpenCode setup of [digitalygo](https://digitalygo.it)!
please follow our rules and convention when contributing to this repository

## project overview

this repository contains our full OpenCode setup, including configurations, agents, skills, commands, and our custom made docker image for pentesting

you can expect automated releases via semantic-release

## getting started

prerequisites:

- git
- bash shell
- Docker

### setup your development environment

1. **fork the repository**

   ```bash
   # fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/opencode-setup.git
   cd opencode-setup
   ```

2. **add upstream remote**

   ```bash
   git remote add upstream https://github.com/digitalygo/opencode-setup.git
   ```

3. **test the setup locally**

   this process is pretty manual. use your OpenCode setup, explain why you made changes, test them and report back your results

4. **create a feature / fix branch**

   please adhere to conventional commits and git flow standards

   ```bash
   git checkout -b feature/your-feature-name
   ```

## folder structure

understanding the repository structure is crucial for effective contributions. please keep files and edits as tidy as possible

- `.github/` - gitHub automation and configuration
- `agent/` - our collection of ai agents and subagents
- `command/` - custom command definitions
- `skills/` - our skills collection
- `.markdownlint*` - markdownlint configuration
- `.releaserc.jsonc` - semantic-release configuration
- `opencode.jsonc` - main OpenCode configuration
- `setup.sh` - our automatic installation script
- `AGENTS.md` - agent documentation

## code style guidelines

### bash scripts

- always use `set -euo pipefail`
- use readonly variables for constants
- quote all variables: `"$variable"` not `$variable`
- use snake_case for function and variable names
- functions must be declared before use

### no comments policy

please *never* write comments in the codebase

- code should be self-explanatory through clear naming and structure
- if code is too complex without comments, simplify and split into multiple files
- use descriptive variable names, function names, and file names
- follow semantic organization and file structure

### file naming conventions

- scripts: `kebab-case.sh` (e.g., `setup-script.sh`)
- config files: `kebab-case` or `camelCase` depending on tool requirements
- documentation: `kebab-case.md`
- plugins: `kebab-case.js`

### agent naming conventions

agent definition files live in `agent/`. use these patterns so names stay predictable and match the `subagent_type` you invoke:

- `*-dev.md` for language or framework implementers (e.g., `javascript-typescript-dev.md`, `react-nextjs-dev.md`, `php-laravel-dev.md`, `elixir-dev.md`)
- `*-specialist.md` for domain/tool implementers (design systems, Docker, Ansible, OpenTofu, OpenSCAD, etc.)
- `*-locator.md`, `*-analyzer.md`, `*-pattern-finder.md` for read-only mapping agents
- `*-researcher.md` for research/fallback agents (e.g., `generalist-researcher.md`, `web-researcher.md`)
- stick with lowercase kebab-case and avoid titles like `engineer` or `expert` in filenames

### prompt writing style

when writing agent prompts, skill instructions, command definitions, or any instruction file that gets injected into an active agent, address the reader directly in second person:

- write to `you`, not about agents as an external group
- use active, direct phrasing

applies to files like:

- `agent/*.md`
- `command/*.md`
- `skills/**/SKILL.md`
- any other prompt or instruction file

examples:

| avoid | prefer |
|-------|--------|
| "all agents must" | "you must" |
| "this skill does" | "you will" |
| "the agent should" | "you should" |
| "agents are expected to" | "you are expected to" |

## conventional commits

this repository uses semantic-release, which *requires* conventional commits

### format

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### commit types

- `feat`: new feature for the user
- `fix`: bug fix for the user  
- `docs`: documentation changes only
- `style`: code formatting, no production code change
- `refactor`: code change that neither fixes bug nor adds feature
- `perf`: performance improvement
- `test`: adding missing tests or correcting existing tests
- `build`: changes to build system or dependencies
- `ci`: changes to CI configuration files and scripts
- `chore`: other changes that don't modify src or test files
- `revert`: reverts a previous commit

### impact on releases

- `feat` commits trigger minor version bump
- `fix` and `chore` commits trigger patch version bump  
- commits with `BREAKING CHANGE:` footer trigger major version bump
- other types don't trigger version bumps

## pull request process

when opening new pr, *always target `alpha`* branch. please try to keep prs *small* and *focused*

### branching strategy always target `alpha`

- `main` - production branch (protected)
- `beta` - beta releases branch (protected)
- `alpha` - alpha releases branch (protected) - DEFAULT BRANCH
- `feature/*` - feature development branches
- `fix/*` - bug fix branches

### pr requirements

1. **conventional commits** - all commits must follow conventional commit format
2. **tested changes** - all changes must be tested and documented
3. **no comments** - code must follow no-comments policy
4. **code style** - must follow style guidelines
5. **documentation** - update relevant documentation

## release process

### automated releases

this repository uses **semantic-release** for fully automated releases:

- **commits to `main`** → production releases
- **commits to `beta`** → beta releases  
- **commits to `alpha`** → alpha releases

### release triggers

- `feat` commits → minor version (1.x.0)
- `fix` and `chore` commits → patch version (1.0.x)
- `BREAKING CHANGE:` → major version (2.0.0)

### branch strategy

```text
main (production) ← beta ← alpha ← feature / fix branches
```

## additional guidelines

### before contributing

- read existing code to understand patterns
- check existing issues for similar work
- start with good first issues if new to project

### code review process

- all prs will be manually reviewed
- focus on quality, style, and functionality
- ensure conventional commits are properly formatted

### getting help

- review existing code patterns
- ask questions in pr discussions

---

thank you for contributing to this repository! we hope you'll find this repo useful and we look forward to your contributions

the [digitalygo](https://digitalygo.it) team
