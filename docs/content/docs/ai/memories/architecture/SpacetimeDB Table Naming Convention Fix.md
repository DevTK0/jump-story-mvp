---
title: SpacetimeDB Table Naming Convention Fix
type: note
permalink: architecture/spacetime-db-table-naming-convention-fix
tags:
  - '["spacetimedb"'
  - '"naming-conventions"'
  - '"warnings"'
  - '"best-practices"]'
---

# SpacetimeDB Table Naming Convention Fix

## Warning Fixed

Fixed CS8981 warning in SpacetimeDB code generation:

```
warning CS8981: The type name 'player' only contains lower-cased ascii characters. Such names may become reserved for the language.
```

## Root Cause

SpacetimeDB generates C# types based on the table name specified in the `[Table(Name = "...")]` attribute. When using lowercase names like "player", it generates lowercase type names which may conflict with future C# reserved keywords.

## Solution

Use PascalCase for all table names in SpacetimeDB:

- ❌ `[Table(Name = "player")]` → generates `player` type
- ✅ `[Table(Name = "Player")]` → generates `Player` type

## Changes Made

1. **Server-side**: Changed table name from "player" to "Player"
2. **Server-side**: Updated all database access from `ctx.Db.player` to `ctx.Db.Player`
3. **Client-side**: Updated event handlers from `conn.db.player` to `conn.db.Player`
4. **Regenerated TypeScript bindings** with new naming

## Best Practice

Always use PascalCase for SpacetimeDB table names to:

- Follow C# naming conventions
- Avoid future reserved keyword conflicts
- Generate clean, professional code
- Prevent compiler warnings

## Example Pattern

```csharp
// ✅ Good - PascalCase table names
[Table(Name = "Player", Public = true)]
[Table(Name = "GameSession", Public = true)]
[Table(Name = "InventoryItem", Public = true)]

// ❌ Avoid - lowercase table names
[Table(Name = "player", Public = true)]
[Table(Name = "game_session", Public = true)]
[Table(Name = "inventory_item", Public = true)]
```
