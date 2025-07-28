---
title: State Machine Architecture Refactoring
type: note
permalink: issues/state-machine-architecture-refactoring
---

# State Machine Architecture Refactoring
# State Machine Architecture Refactoring

**Status: Abandoned** - The refactoring proved too difficult to implement due to complex interdependencies between systems.
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

## Refactoring Outcome
After attempting the refactoring, it became clear that the complexity of the current implementation made a full architectural overhaul impractical:

### Challenges Encountered
- **Deep System Coupling**: The state machine logic is deeply intertwined with multiple systems (Combat, Animation, Movement, Scene Events)
- **Legacy Code Dependencies**: Too many existing features rely on the current bypass patterns
- **Risk vs Reward**: The potential for introducing new bugs outweighed the benefits of cleaner architecture
- **Time Investment**: The refactoring would require rewriting significant portions of the codebase

### Current Approach
Instead of a full refactoring, the team decided to:
1. Document the existing bypass patterns for better understanding
2. Add comments warning about state machine limitations
3. Implement targeted fixes for specific bugs as they arise
4. Consider incremental improvements rather than wholesale changes

### Lessons Learned
- Sometimes technical debt is too expensive to pay off immediately
- Working with the existing architecture, despite its flaws, can be more pragmatic
- Documentation of quirks and workarounds is valuable for future developers