# Claude Code Settings

Guidance for Claude Code and other AI tools working in this repository.

## Project Overview

WorkshopsAI CMS - A workshop management system built with:
- **Backend**: Express + tRPC + TypeScript
- **Frontend**: React + Vite + TailwindCSS
- **Database**: PostgreSQL with Drizzle ORM
- **Testing**: Jest (unit/integration), Playwright (E2E), Vitest
- **Infrastructure**: Docker, Railway, Firebase

## AI Guidance

### Core Principles
- Do what has been asked; nothing more, nothing less
- ALWAYS prefer editing existing files over creating new ones
- NEVER create documentation files unless explicitly requested
- Reuse existing code and minimize unnecessary arguments
- Focus on targeted modifications rather than large-scale changes
- When updating code, check for related code that needs updates for consistency

### Execution
- After receiving tool results, reflect on quality and plan optimal next steps
- For independent operations, invoke tools simultaneously rather than sequentially
- Verify your solution before finishing
- Never implement defensive programming without explicit user approval
- Prefer `rg` over `grep` for searching

### Language Standards
- This year is 2025
- Never use buzzwords in docstrings/commits: "consolidate", "modernize", "streamline", "flexible", "delve", "establish", "enhanced", "comprehensive", "optimize"

## TypeScript Coding

### Style
- Follow existing patterns in the codebase
- Use strict TypeScript - no `any` types unless unavoidable
- Prefer interfaces over type aliases for object shapes
- Use `const` assertions where appropriate

### Code Quality
- Integrate changes seamlessly within existing code
- Write concise code - avoid redundant lines and comments
- Exploit existing utilities/modules rather than duplicating functionality
- Example of concise patterns:
  ```typescript
  // Prefer this
  const report = includeComments ? generateReport(data) : "";

  // Not this
  let report: string;
  if (includeComments) {
    report = generateReport(data);
  } else {
    report = "";
  }
  ```

### Testing
- Tests go in `tests/` directory matching the source structure
- Use Jest for unit/integration tests
- Use Playwright for E2E tests
- Run `npm run test:ci` before submitting changes

## Database

- Use Drizzle ORM for all database operations
- Schema files in `src/db/schema/`
- Run `npm run db:generate` after schema changes
- Run `npm run db:migrate` to apply migrations

## MCP Tools

### Todo2 (REQUIRED)
- **ALWAYS** use Todo2 MCP for task tracking on multi-step operations
- Create tasks before starting work: `mcp__todo2__create_todo`
- Update task status as you progress: `mcp__todo2__update_todo`
- Mark tasks complete immediately after finishing: `mcp__todo2__complete_todo`
- Use for: feature implementation, bug fixes, refactoring, any work with 2+ steps

### Other Tools
- Use `mcp__tavily__tavily_search` for web discovery, `mcp__tavily__tavily_extract` for specific URLs
- For GitHub URLs, use `mcp__github__*` tools or `gh` CLI instead of web scraping

## Git and Pull Request Workflows

### Commit Messages
- Format: `{type}: brief description` (max 50 chars first line)
- Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `build`
- Focus on 'why' not 'what' - one logical change per commit
- ONLY analyze staged files (`git diff --cached`), ignore unstaged
- NO test plans in commit messages

### Pull Requests
- PR titles: NO type prefix - start with capital letter + verb
- Analyze ALL commits with `git diff <base-branch>...HEAD`
- Inline links: `[src/file.ts:42](src/file.ts#L42)`
- Self-assign with `-a @me`
- NO test plans in PR body

### Commands
- `/github-dev:commit-staged` - commit staged changes
- `/github-dev:create-pr` - create pull request

## Common Commands

```bash
# Development
npm run dev              # Start backend with hot reload
npm run build:frontend   # Build frontend

# Testing
npm run test             # Run Jest tests
npm run test:e2e         # Run Playwright E2E tests
npm run lint             # Run ESLint
npm run typecheck        # TypeScript type checking

# Database
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Apply migrations
npm run db:studio        # Open Drizzle Studio

# Validation
npm run validate         # lint + typecheck + tests
```
