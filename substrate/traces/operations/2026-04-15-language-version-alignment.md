---
status: completed
created_at: 2026-04-15
files_edited:
  - agent/php-laravel-dev.md
  - agent/ruby-dev.md
rationale:
  - align explicit language/framework version guidance with current official stable releases
  - restore consistency between PHP/Laravel and Ruby/Rails developer prompts
supporting_docs:
  - https://www.php.net/downloads
  - https://www.php.net/supported-versions
  - https://laravel.com/docs/13.x/releases
  - https://www.ruby-lang.org/en/downloads/
  - https://rubyonrails.org/
---

# Summary of changes

- Added explicit `PHP 8.5+` and `Laravel 13+` guidance back to `agent/php-laravel-dev.md`.
- Updated `agent/ruby-dev.md` to `Ruby 4.0+` and `Rails 8.1+`.
- Aligned the Rails version mention inside the Ruby guidance section so the file uses the same branch target consistently.

# Technical reasoning

The previous developer-agent refresh left an inconsistency: explicit version guidance remained in the Ruby/Rails prompt but was removed from the PHP/Laravel prompt. The user requested restoring explicit versioning and verifying that the referenced versions match the latest official stable branches.

Research was done against official project sources. For PHP, the latest release series is 8.5.x, while 8.4 remains the more mature production branch; because the request was to use the latest version, the prompt now targets `PHP 8.5+`. Laravel stable is 13.x, Ruby stable is 4.0.x, and Rails stable is 8.1.x.

# Impact assessment

- PHP/Laravel and Ruby/Rails developer prompts now present explicit and current version expectations.
- Prompt guidance is more internally consistent across language agents.
- Existing flexibility wording remains intact, so these version defaults guide new work without forcing refusal on older project contexts.

# Validation steps

- Checked current repository state before changes and recorded pre-existing pending work in a status note.
- Verified current stable versions from official upstream sources.
- Read the edited file contents directly after subagent changes.
- Confirmed the final Ruby prompt uses `Rails 8.1+` consistently in both the core role and the guidelines section.
