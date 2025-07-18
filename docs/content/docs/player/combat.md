---
title: Combat
---

```d2
direction: right

Player: {
  label: "Player\n(Main Entity)"
}

CombatSystem: {
  label: "CombatSystem"
}

InputSystem: {
  label: "InputSystem"
}

HitboxSprite: {
  label: "Hitbox Sprite\n(Collision)"
}

GameEvents: {
  label: "Game Events"
}

AttackConfig: {
  label: "Attack Config"
}

# Dependencies
Player -> CombatSystem: owns
CombatSystem -> InputSystem: reads attack input
CombatSystem -> HitboxSprite: manages
CombatSystem -> AttackConfig: uses

# Event Communication
CombatSystem -> GameEvents: PLAYER_ATTACKED
CombatSystem -> GameEvents: DAMAGE_DEALT

# Attack Flow
InputSystem -> CombatSystem: attack pressed
CombatSystem -> Player: isAttacking = true
CombatSystem -> HitboxSprite: position & enable
```

## Overview

The CombatSystem manages player attacks with sophisticated timing phases and hitbox management. It implements a phase-based attack system with precise timing control, managing attack hitboxes, cooldowns, and damage dealing through a configurable attack system.

## Attack Phases

Each attack consists of three distinct phases:

1. **Startup Phase** (80ms default): Preparation before damage
2. **Active Phase** (100ms default): Hitbox is active, damage can be dealt
3. **Recovery Phase** (120ms default): Attack completion animation

## Key Features

- **Phase-based Attacks**: Startup → Active → Recovery timing
- **Dynamic Hitbox**: Physics-based collision sprite positioned relative to player
- **Cooldown System**: Prevents attack spam (400ms default total cooldown)
- **Configurable Attacks**: Customizable timing, reach, and damage
- **Direction-aware**: Hitbox positioned based on player facing direction

## Implementation Details

### Attack Configuration

```typescript
interface AttackConfig {
  name: string;              // Attack identifier
  startupMs: number;         // Startup phase duration
  activeMs: number;          // Active phase duration  
  recoveryMs: number;        // Recovery phase duration
  totalCooldownMs: number;   // Total cooldown before next attack
  arcStart: number;          // Attack arc start angle
  arcEnd: number;            // Attack arc end angle
  reach: number;             // Attack range
  damage: number;            // Damage dealt
}
```

### Default Configuration

```typescript
{
  name: 'basic_sword',
  startupMs: 80,
  activeMs: 100,
  recoveryMs: 120,
  totalCooldownMs: 400,
  arcStart: -30,
  arcEnd: 45,
  reach: 50,
  damage: 10
}
```

### Core Methods

```typescript
tryAttack(): boolean
```
Attempts to perform an attack. Returns false if on cooldown or already attacking.

```typescript
getHitboxSprite(): Phaser.Physics.Arcade.Sprite
```
Returns the hitbox sprite for collision detection with enemies.

```typescript
setConfig(config: AttackConfig): void
```
Updates attack configuration at runtime.

## Usage Example

```typescript
// Configure custom attack when creating player
const player = createPlayer({
  scene,
  x: 100,
  y: 100,
  attackConfig: {
    name: 'power_sword',
    startupMs: 100,
    activeMs: 150,
    recoveryMs: 200,
    totalCooldownMs: 500,
    arcStart: -45,
    arcEnd: 60,
    reach: 70,
    damage: 20
  }
});

// Access combat system
const combatSystem = player.getSystem<CombatSystem>('combat');

// Check if can attack
if (combatSystem.canAttack()) {
  // Attack will be triggered via input system
}

// Get hitbox for enemy collision detection
const hitbox = combatSystem.getHitboxSprite();
```

## Integration Points

### Events Emitted
- `PLAYER_ATTACKED`: Fired when attack starts (includes type and direction)
- `DAMAGE_DEALT`: Fired during active phase for damage calculation

### State Updates
- Sets `player.isAttacking` to true during attack
- Resets to false after recovery phase completes

### Hitbox Positioning
The hitbox is positioned dynamically based on:
- Player position
- Facing direction (1 or -1)
- Attack reach configuration
- Edge offset constants

## Best Practices

1. **Timing Balance**: Ensure total attack duration (startup + active + recovery) is less than totalCooldownMs
2. **Hitbox Size**: Set reach appropriately for your sprite scale
3. **Damage Tuning**: Balance damage with attack speed for gameplay
4. **Visual Feedback**: Sync animations with attack phases via PLAYER_ATTACKED event