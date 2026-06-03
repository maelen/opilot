<!-- Context: project-intelligence/technical | Priority: critical | Version: 1.0 | Updated: 2026-06-02 -->

# Technical Domain

**Purpose**: Tech stack, architecture, and development patterns for the Opilot VS Code extension.
**Last Updated**: 2026-06-02

## Quick Reference

**Update Triggers**: Tech stack changes | New patterns | Architecture decisions
**Audience**: Developers, AI agents

## Primary Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | VS Code Extension API | ^1.109.0 | Copilot Chat integration via `LanguageModelChatProvider` |
| Language | TypeScript | ES2024 | Strict mode, `Bundler` module resolution |
| Runtime | Node.js | 20+ | VS Code extension host |
| Package Manager | pnpm | workspace | Monorepo support, strict dependency resolution |
| Testing | Vitest | latest | Fast, Vite-native, Jest-compatible API |
| Linting/Formatting | Biome (Ultracite) | latest | Zero-config, unified lint+format |
| Build | tsup | latest | TypeScript bundling for VS Code extensions |

## Code Patterns

### Chat Provider (API Pattern)

```typescript
import type { CancellationToken, LanguageModelChatMessageRole, LanguageModelChatProvider } from 'vscode';

export class OllamaChatModelProvider implements LanguageModelChatProvider {
  async provideLanguageModelChatResponse(
    messages: LanguageModelChatRequestMessage[],
    options: ProvideLanguageModelChatResponseOptions,
    token: CancellationToken
  ): Promise<LanguageModelChatResponse> {
    // Streaming response via EventEmitter
    // Tool call support via LanguageModelToolCallPart
    // Error handling via reportError()
  }
}
```

### Sidebar Provider (Component Pattern)

```typescript
import { window, type TreeDataProvider, TreeItem, type ExtensionContext } from 'vscode';

export function registerSidebar(
  context: ExtensionContext,
  client: Ollama,
  logChannel?: DiagnosticsLogger,
): SidebarRegistration {
  // TreeDataProvider for local/cloud/library models
  // context.subscriptions.push(...) for disposal
  // EventEmitter for refresh signals
}
```

### Extension Activation

```typescript
import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Register providers, sidebar, completions, modelfiles
  // context.subscriptions.push(...) pattern
  // Graceful error handling on connection failures
}
```

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files | `kebab-case` | `context-utils.ts`, `error-handler.ts` |
| Classes/Providers | `PascalCase` | `OllamaChatModelProvider`, `ThinkingParser` |
| Functions | `camelCase` | `registerSidebar()`, `testConnection()` |
| Constants | `UPPER_SNAKE` | `MODEL_LIST_REFRESH_MIN_INTERVAL_MS` |
| Interfaces | `PascalCase` | `ModelSettingsStore`, `DiagnosticsLogger` |
| File extension | `.ts` | `.js` imports not included in source |

## Code Standards

- **TypeScript strict** — `"strict": true` in tsconfig.json
- **Named exports only** — no `export default`, use `export function` / `export const`
- **Type-only imports** — `import type { ... }` for type-only dependencies
- **Async/await** — prefer `async/await` over raw promises
- **VS Code disposable pattern** — `context.subscriptions.push(disposable)` for cleanup
- **Dedicated error handler** — use `reportError()` from `error-handler.ts`
- **Inline tests** — `.test.ts` files co-located with source modules
- **Biome/Ultracite** — lint + format via `pnpm dlx ultracite fix`

## Security Requirements

- **Sanitized error handling** — errors routed through `reportError()`, no raw exposure
- **Connection validation** — `testConnection()` before Ollama communication
- **Auth token management** — cloud auth tokens handled via `getOllamaAuthToken()`
- **SSL configuration** — `ignoreSslErrors` setting for self-signed certs
- **No hardcoded secrets** — config loaded from VS Code settings, not code
- **Environment-aware paths** — `os.homedir()` / `process.platform` for cross-platform safety

## 📂 Codebase References

**Implementation**: `src/provider.ts` — Chat provider (API pattern)
**Implementation**: `src/sidebar.ts` — Sidebar view (component pattern)
**Implementation**: `src/extension.ts` — Extension activation entry point
**Implementation**: `src/error-handler.ts` — Error handling
**Implementation**: `src/settings.ts` — Settings/configuration
**Config**: `tsconfig.json`, `biome.json`, `package.json`

## Related Files

- `navigation.md` — Project intelligence index
- `AGENTS.md` — Agent instructions
