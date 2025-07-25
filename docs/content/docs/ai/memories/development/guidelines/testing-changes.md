---
title: Testing Changes
type: note
permalink: development/guidelines/testing-changes
---

## Build Validation

Always run `pnpm run build` after making code changes to ensure:

- All imports are valid
- TypeScript compilation succeeds
- No breaking changes were introduced

## Common Issues

- **Import path errors** - Check file renaming has updated all import statements
- **Case sensitivity** - Ensure file names match import paths exactly
- **Unused imports** - Remove unused variables to keep code clean

## Workflow

1. Make code changes
2. Run `pnpm run build`
3. Fix any compilation errors
