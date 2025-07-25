---
title: Phaser Overlap Detection Issue - Climbing System
type: bug_report
permalink: development/issues/phaser-overlap-detection-issue-climbing-system
tags:
  - '["phaser"'
  - '"physics"'
  - '"collision"'
  - '"climbing"'
  - '"bug"'
  - '"resolved"]'
---

# Phaser Overlap Detection Issue - Climbing System

## Entity: Bug Report

**Type**: Technical Issue  
**Status**: Resolved  
**Severity**: Critical  
**Component**: Climbing System  
**File**: `src/game/client/features/player/climbing.ts`

## Problem Statement

Phaser's built-in `scene.physics.world.overlap(playerBody, climbeableBody)` method consistently returned `false` even when player character was visually overlapping with climbable areas.

## Solution Implemented

Manual AABB (Axis-Aligned Bounding Box) collision detection in `checkClimbeableOverlap()` method.

```typescript
if (
  climbeableBody &&
  playerBody.x < climbeableBody.x + climbeableBody.width &&
  playerBody.x + playerBody.width > climbeableBody.x &&
  playerBody.y < climbeableBody.y + climbeableBody.height &&
  playerBody.y + playerBody.height > climbeableBody.y
) {
  this.isInClimbeableArea = true;
}
```

## Related Components

- **ClimbingSystem**: Main affected system
- **Player**: Entity with physics body
- **MapLoader**: Creates climbable physics areas
- **Phaser Physics**: Unreliable overlap detection

## Lessons Learned

- Phaser's overlap detection can be unreliable with static/dynamic body combinations
- Manual geometric calculations provide more reliable collision detection
- Always implement fallback methods for critical game mechanics
- Debug tools are essential for identifying physics issues
