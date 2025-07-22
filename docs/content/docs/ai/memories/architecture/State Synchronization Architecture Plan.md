---
title: State Synchronization Architecture Plan
type: note
permalink: architecture/state-synchronization-architecture-plan
tags:
- '["spacetimedb"'
- '"multiplayer"'
- '"architecture"'
- '"state-sync"]'
---

# State Synchronization Architecture Plan

## Overview
Architecture plan for implementing multiplayer state synchronization in jump-story-mvp using SpacetimeDB.

## Key Decision: Separate Reducers with Composite Transactions

### Why NOT a Single UpdatePlayer Reducer
1. **Update Frequency Mismatch**
   - Position: High-frequency (every 200ms)
   - State changes: Event-driven (on attack/climb)
   - Health/Mana: Sporadic (on damage/cast)
   - Combining wastes bandwidth

2. **SpacetimeDB Design Philosophy**
   - Framework optimized for fine-grained updates
   - Table-level subscriptions work best with focused reducers

3. **Validation Complexity**
   - Each field type needs different validation rules
   - Single reducer becomes complex monolith

## Recommended Architecture

### Base Reducers (Single Responsibility)
```csharp
UpdatePlayerPosition(x, y)     // High-frequency
UpdatePlayerState(state)       // Event-driven
UpdatePlayerHealth(health)     // Combat-related
UpdatePlayerMana(mana)         // Combat-related
```

### Composite Transaction Reducers (Atomic Updates)
```csharp
PerformAttack(attackType)      // Updates state + mana atomically
TakeDamage(damage, attacker)   // Updates health + state atomically
```

## Player State Enum
```csharp
public enum PlayerState : byte {
    Idle = 0,
    Walk = 1,
    Attack1 = 2,
    Attack2 = 3,
    Attack3 = 4,
    Climbing = 5,
    Damaged = 6,
    Dead = 7
}
```

## Implementation Phases
1. **Phase 1**: Add state field to Player table (CURRENT)
2. **Phase 2**: Implement state synchronization for peers
3. **Phase 3**: Add health/mana fields and reducers (FUTURE)
4. **Phase 4**: Implement composite transaction reducers (FUTURE)

## Benefits
- Optimal network usage (only send what changes)
- Clear single responsibility per reducer
- Flexibility to add composite reducers as needed
- Consistency guarantees through transactions

## Current Implementation
Starting with just PlayerState synchronization:
- Add state field to Player table
- Create UpdatePlayerState reducer
- Update peer rendering to show states
- Integrate with combat and movement systems