---
title: Enemy Damage Event Cleanup Process
type: note
permalink: development/issues/enemy-damage-event-cleanup-process
---

# Enemy Damage Event Cleanup Process

## Issue

Killing blow damage numbers were not appearing when an enemy died from a hit.

## Root Cause

The `AwardExperienceForKill` method in `CombatReducers.cs` was immediately deleting all damage events when an enemy died. This happened before the client could render the damage numbers, especially the killing blow.

## Solution

Removed the premature damage event deletion from `AwardExperienceForKill` and let the existing `CleanupDeadBodies` reducer handle it after 5 seconds.

## Important Design Principles

### DO NOT Delete Damage Events Immediately

- When an enemy dies, damage events should remain in the database for visualization
- The `CleanupDeadBodies` reducer runs every few seconds and removes dead enemies that have been dead for > 5 seconds
- This same reducer also cleans up the associated damage events

### Proper Cleanup Flow

1. Enemy dies (state set to "Dead")
2. Damage events remain in database
3. Clients have 5 seconds to receive and render all damage numbers
4. `CleanupDeadBodies` runs and removes both the dead enemy and its damage events

### Code Locations

- **Server-side damage processing**: `/libs/spacetime/server/Reducers/CombatReducers.cs`
- **Cleanup logic**: `/libs/spacetime/server/Reducers/MaintenanceReducers.cs` (CleanupDeadBodies method)
- **Client-side rendering**: `/libs/player/combat/enemy-damage-renderer.ts`

## Lessons Learned

- Always consider the full lifecycle of game events
- Visual feedback (damage numbers) needs time to be displayed before cleanup
- Centralize cleanup logic to avoid premature deletions
- The `CleanupDeadBodies` reducer is the single source of truth for removing dead enemies and their associated data
