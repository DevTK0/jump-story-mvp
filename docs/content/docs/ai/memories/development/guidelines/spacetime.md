---
title: SpacetimeDB Subscription Best Practices
type: note
permalink: development/guidelines/spacetime-db-subscription-best-practices
---

# SpacetimeDB Subscription Best Practices

## Overview

SpacetimeDB subscriptions are powerful but can impact performance if not used correctly. Following these guidelines ensures optimal performance and scalability.

## Key Principles

### 1. Use Targeted Subscriptions

Instead of subscribing to entire tables, use SQL queries to subscribe only to relevant data:

```typescript
// ❌ Bad - subscribes to ALL players
dbConnection.subscribeToAllTables();

// ✅ Good - subscribes only to current player
const myIdentity = dbConnection.identity.toHexString();
dbConnection
  .subscriptionBuilder()
  .subscribe([`SELECT * FROM Player WHERE identity = x'${myIdentity}'`]);
```

### 2. Implement Singleton Services for Shared Data

When multiple components need the same data, use a singleton pattern to avoid duplicate subscriptions:

```typescript
// ✅ Good - singleton pattern prevents duplicate subscriptions
export class PlayerQueryService {
  private static instance: PlayerQueryService | null = null;

  private constructor(dbConnection: DbConnection) {
    this.setupTargetedSubscription();
  }

  public static getInstance(dbConnection?: DbConnection): PlayerQueryService | null {
    if (!PlayerQueryService.instance && dbConnection) {
      PlayerQueryService.instance = new PlayerQueryService(dbConnection);
    }
    return PlayerQueryService.instance;
  }
}
```

### 3. Use Proximity-Based Subscriptions for Spatial Data

For entities like enemies or other players, subscribe based on proximity to reduce data transfer:

```typescript
// ✅ Good - only subscribe to nearby enemies
const radius = 2000;
dbConnection.subscriptionBuilder().subscribe([
  `SELECT * FROM Enemy WHERE 
         x >= ${playerX - radius} AND x <= ${playerX + radius} AND 
         y >= ${playerY - radius} AND y <= ${playerY + radius}`,
]);
```

#### SQL Subscription Rules

SpacetimeDB has specific SQL limitations for subscriptions:

1. **No BETWEEN operator** - Use `>=` and `<=` instead

   ```sql
   -- ❌ Bad
   WHERE x BETWEEN 100 AND 200

   -- ✅ Good
   WHERE x >= 100 AND x <= 200
   ```

2. **No non-inner joins** - Only inner joins are supported

   ```sql
   -- ❌ Bad - LEFT JOIN not supported
   SELECT * FROM Player LEFT JOIN Inventory ON ...

   -- ✅ Good - INNER JOIN
   SELECT * FROM Player JOIN Inventory ON ...
   ```

3. **No implicit joins** - Always use explicit JOIN syntax

   ```sql
   -- ❌ Bad - implicit join
   SELECT * FROM Player, Inventory WHERE Player.id = Inventory.playerId

   -- ✅ Good - explicit join
   SELECT * FROM Player JOIN Inventory ON Player.id = Inventory.playerId
   ```

4. **No object property queries** - Cannot query nested object properties

   ```sql
   -- ❌ Bad - if position is an object column
   WHERE position.x > 0

   -- ✅ Good - use flat columns
   WHERE x > 0
   ```

   This is why we use `x` and `y` as separate columns instead of a `position` object.

### 4. Clean Up Subscriptions

Always clean up subscriptions and timers when components are destroyed to prevent memory leaks:

```typescript
public destroy(): void {
    if (this.proximityUpdateTimer) {
        this.proximityUpdateTimer.destroy();
    }
    // Clean up other resources
}
```

## Common Patterns

### Player-Specific Data

For data specific to the current player (stats, inventory, etc.):

- Use a singleton service with targeted subscription
- Subscribe using the player's identity hex string
- Share the service instance across all components

### Spatial/Proximity Data

For enemies, other players, or world objects:

- Implement proximity-based subscriptions
- Update subscription area as player moves
- Remove entities outside proximity range
- Consider update frequency (e.g., every 5 seconds)

### Global Events

For damage events, chat messages, etc.:

- These often need global subscriptions
- Consider implementing a message queue or event system
- Clean up old events to prevent memory growth

## Performance Considerations

1. **Subscription Cost**: Each subscription has overhead. Minimize the number of unique subscriptions.
2. **Data Transfer**: Targeted subscriptions significantly reduce bandwidth usage.
3. **Memory Usage**: Unsubscribe from data you no longer need.
4. **Update Frequency**: For proximity subscriptions, balance update frequency with performance.

## Example Implementation

See the PlayerQueryService and EnemyManager implementations in the jump-story-mvp project for production examples of these patterns.
