# GlobCRM Claude Starter (skills + subagents only)

This zip is intentionally **code-free**. Drop the `.claude/` folder into the root of your new repo and Claude Code will pick up:

- **Project subagents** in `.claude/agents/`
- **Project skills** in `.claude/skills/<skill-name>/SKILL.md`

## How to use in Claude Code

- Run `/agents` to see and invoke the included subagents.
- Use slash commands for the included skills, e.g.:
  - `/scaffold-crm-page <PageName> <RouteOrFeatureKey>`
  - `/scaffold-integration <IntegrationName>`
  - `/qa-verify <Scope>`

If you later copy in the reference pages (`src/app/pages/globcrm/`), the skills/subagents are designed to help you reproduce the same behavior in a clean, modular way.

## Included subagents

- `product-manager` – turns the required pages into testable requirements + acceptance criteria.
- `frontend-architect` – defines the UI architecture and reusable UI patterns for mobile/desktop.
- `integration-engineer` – designs integrations as reusable modules (ports/adapters) to keep your CRM modular.
- `ui-ux-designer` – improves flows, information architecture, and responsive UX.
- `qa-engineer` – builds verification checklists and “definition of done”.

## Included skills

- `globcrm-domain-map` (background knowledge) – the required GlobCRM page map + cross-cutting modules.
- `scaffold-crm-page` – generates a consistent, modular scaffold plan for any page/feature.
- `scaffold-integration` – generates a reusable integration module spec (WhatsApp, Email, etc.).
- `qa-verify` – generates a smoke test / verification checklist for a feature or phase.
