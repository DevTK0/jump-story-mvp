---
title: State Machine Architecture Refactoring
type: note
permalink: issues/state-machine-architecture-refactoring
---

# State Machine Architecture Refactoring

## Problem Summary
The player state machine is being bypassed in multiple ways, causing bugs and making state management unpredictable:

1. **Combat System Bypass**: Sets `isAttacking=true` and starts attacks BEFORE checking if state transitions are allowed
2. **Direct State Access**: AnimationSystem calls `stateMachine.transitionTo()` directly, bypassing validation
3. **Independent Animation Control**: Attack animations triggered via scene events, disconnected from state machine
4. **Scattered State Logic**: State management spread across CombatSystem, AnimationSystem, Player, and StateMachine

## Current Issues
- Player can cancel attacks by spamming attack button despite state machine rules
- Setting `IdleState.getAllowedTransitions()` to empty array doesn't prevent transitions
- State machine validation is inconsistent - sometimes checked, sometimes bypassed
- Redundant state tracking with both flags (`isAttacking`, `isClimbing`) and state machine

## Proposed Solution
Move ALL state-related logic into the state machine classes themselves:

```typescript
class Attack1State extends PlayerState {
  private hitboxSprite: Phaser.Physics.Arcade.Sprite;
  private attackStartTime: number;
  
  onEnter() {
    // ALL attack logic lives here
    this.attackStartTime = Date.now();
    this.createHitbox();
    this.player.play('attack1_anim');
    this.player.body.setVelocityX(0);
  }
  
  update() {
    // Handle attack phases and transitions
  }
  
  onExit() {
    this.hitboxSprite.destroy();
  }
}
```

## Benefits
- Single source of truth for player state
- Encapsulated, cohesive state logic
- Predictable state transitions
- Simplified external systems
- Easier debugging and maintenance

## Affected Systems
- Player state machine
- Peer state machine  
- Enemy state machine
- Combat system
- Animation system
- Movement system

## Tags
#architecture #state-machine #refactoring #technical-debt