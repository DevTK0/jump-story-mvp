---
title: Code Organisation
type: note
permalink: development/guidelines/code-organisation
---

## Folder structure

- Follow a feature first structure (i.e. player/ enemy/)
  - All corelated code should live as close as possible.

## File Naming

- **Always use lowercase** for all file names (no exceptions)
- Use kebab-case for multi-word files (e.g. `enemy-manager.ts`, `map-loader.ts`)
- Components should have a config.ts file to store all constants and configurations for that component
- Class files should be lowercase even if they export PascalCase classes (e.g. `enemy.ts` exports `Enemy`)
