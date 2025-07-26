---
title: Combat
---

```d2 layout="elk"
CombatSystem: {
    shape: class
    CombatSystem
    CombatSystemEnhanced
    AttackConfig
    PlayerDamageRenderer
    EnemyDamageRenderer
    DeathMonitor
    DamageRendererConfig
}

CombatSystem.CombatSystem -> AttackConfig: uses
CombatSystem.CombatSystemEnhanced -> AttackConfig: uses
CombatSystem.CombatSystem -> Physics.Hitbox: creates
CombatSystem.CombatSystemEnhanced -> Physics.Hitbox: creates

Physics: {
    shape: class
    PhysicsConfigurator
    Hitbox
}

Physics.PhysicsConfigurator -> Physics.Hitbox: configures overlap
Physics.PhysicsConfigurator -> Enemy.EnemyGroup: collision detection

SpacetimeDB: {
    shape: class
    damageEnemy
    PlayerDamageEvent
    EnemyDamageEvent
}

Physics.Hitbox -> SpacetimeDB.damageEnemy: triggers on collision
SpacetimeDB.PlayerDamageEvent -> CombatSystem.PlayerDamageRenderer: subscribes
SpacetimeDB.EnemyDamageEvent -> CombatSystem.EnemyDamageRenderer: subscribes

Player: {
    shape: class
    StateMachine
    InputSystem
}

Player.InputSystem -> CombatSystem.CombatSystem: attack inputs
Player.StateMachine -> CombatSystem.DeathMonitor: death state
CombatSystem.DeathMonitor -> SpacetimeDB.PlayerDamageEvent: monitors health

Enemy: {
    shape: class
    EnemyGroup
    EnemyManager
}

CombatSystem.EnemyDamageRenderer -> Enemy.EnemyManager: gets positions
```

The combat system handles all player attacks, enemy damage, and death mechanics through a combination of client-side physics and server-side state management.

## Components

### Combat Systems
- **CombatSystem**: Basic melee combat with three fixed attack types (quick_slash, heavy_strike, combo_attack)
- **CombatSystemEnhanced**: Class-based combat supporting different player classes with configurable attacks

### Attack Configuration
- **AttackConfig**: Defines attack properties including damage, cooldown, reach, and animation phases
- **Attack Types**: Standard (melee), Projectile, and Area attacks supported

### Damage Rendering
- **PlayerDamageRenderer**: Displays floating damage numbers when player takes damage
- **EnemyDamageRenderer**: Shows damage dealt to enemies with stacking support
- **DamageRendererConfig**: Unified configuration for visual styles and performance settings

### Health Management
- **DeathMonitor**: Watches player health via SpacetimeDB and triggers death state transitions
- **DeathStateService**: Determines appropriate state actions based on health changes

## Usage

### Basic Attack Implementation
```ts
// Attack input handling in combat system
if (this.inputSystem.isJustPressed('attack1')) {
  this.tryAttack(1);
}

// Attack execution creates hitbox at calculated position
const hitboxX = facing === 1 
  ? attackX + attackConfig.reach * hitboxMultiplier
  : attackX - attackConfig.reach * hitboxMultiplier;

this.hitboxSprite.setPosition(hitboxX, playerY);
this.hitboxSprite.body.enable = true;
```

### Class-Based Combat
```ts
// Enhanced combat system uses class configurations
const attackConfig = this.classConfig.attacks[`attack${attackNum}`];
if (attackConfig.attackType === 'standard') {
  this.performStandardAttack(attackNum, attackConfig);
}
```

### Damage Events
```ts
// Subscribe to damage events from SpacetimeDB
this.dbConnection.db.enemyDamageEvent.onInsert((_ctx, damageEvent) => {
  this.handleDamageEvent(damageEvent);
});
```

## Integration

```d2 layout="elk"
Player -> InputSystem: attack key pressed
InputSystem -> CombatSystem: tryAttack()
CombatSystem -> Hitbox: enable collision
Hitbox -> PhysicsConfigurator: overlap detected
PhysicsConfigurator -> SpacetimeDB: damageEnemy reducer
SpacetimeDB -> EnemyDamageEvent: create event
EnemyDamageEvent -> EnemyDamageRenderer: display number
```

## Configuration

### Attack Properties
- **Damage**: Base damage amount (default: 8-15 depending on attack)
- **Cooldown**: Time between attacks in milliseconds (default: 300-600ms)
- **Reach**: Attack range in pixels (default: 45-60)
- **CritChance**: Critical hit probability (default: 0.15-0.25)

### Damage Display
- **Rise Distance**: How far damage numbers float up (default: 80px for enemies, 100px for player)
- **Duration**: Total animation time (default: 1500ms for enemies, 2000ms for player)
- **Pool Size**: Number of pre-allocated text objects (default: 50)

### Visual Styles
- **Enemy Damage Colors**: Yellow/gold gradient theme
- **Player Damage Colors**: Red gradient theme
- **Damage Types**: Normal, Crit, Weak, Strong, Immune
