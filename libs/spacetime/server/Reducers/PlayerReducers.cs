using SpacetimeDB;
using System;
using System.Collections.Generic;

public static partial class Module
{
    [Reducer(ReducerKind.Init)]
    public static void Init(ReducerContext ctx)
    {
        Log.Info("Initializing module...");
        
        // Schedule dead body cleanup every 1 second
        ctx.Db.cleanup_dead_bodies_timer.Insert(new CleanupDeadBodiesTimer
        {
            scheduled_at = new ScheduleAt.Interval(TimeSpan.FromSeconds(1))
        });
        
        // Schedule enemy spawning every 10 seconds (checks per-route intervals)
        ctx.Db.spawn_enemies_timer.Insert(new SpawnEnemiesTimer
        {
            scheduled_at = new ScheduleAt.Interval(TimeSpan.FromSeconds(10))
        });
        
        // Schedule enemy patrol updates every 100ms
        ctx.Db.enemy_patrol_timer.Insert(new EnemyPatrolTimer
        {
            scheduled_at = new ScheduleAt.Interval(TimeSpan.FromMilliseconds(100))
        });
        
        Log.Info("Initialized dead body cleanup, enemy spawning, and enemy patrol schedulers");
    }

    [Reducer(ReducerKind.ClientConnected)]
    public static void Connect(ReducerContext ctx)
    {
        Log.Info($"{ctx.Sender} just connected.");

        // Create player with initial position and stats
        var startingLevel = PlayerConstants.STARTING_LEVEL;
        var maxHp = PlayerConstants.CalculateMaxHp(startingLevel);
        var maxMana = PlayerConstants.CalculateMaxMana(startingLevel);
        
        var newPlayer = new Player
        {
            identity = ctx.Sender,
            name = "Player",
            position = new DbVector2(PlayerConstants.SPAWN_POSITION_X, PlayerConstants.SPAWN_POSITION_Y), // Default spawn position
            state = PlayerState.Idle,
            facing = FacingDirection.Right,
            last_active = ctx.Timestamp,
            current_hp = maxHp,
            max_hp = maxHp,
            current_mana = maxMana,
            max_mana = maxMana,
            level = startingLevel,
            experience = PlayerConstants.STARTING_EXPERIENCE,
            is_typing = false
        };
        ctx.Db.Player.Insert(newPlayer);
    }

    [Reducer(ReducerKind.ClientDisconnected)]
    public static void Disconnect(ReducerContext ctx)
    {
        Log.Info($"{ctx.Sender} disconnected.");

        // Remove player from database when they disconnect
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player is not null)
        {
            ctx.Db.Player.identity.Delete(ctx.Sender);
            Log.Info($"Removed player {ctx.Sender} from database");
        }
    }

    [Reducer]
    public static void UpdatePlayerPosition(ReducerContext ctx, float x, float y, FacingDirection facing)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player is null)
        {
            Log.Info($"Player not found: {ctx.Sender}");
            return;
        }

        var currentPos = player.Value.position;
        
        // For dead players, only allow gravity-based movement (falling)
        if (player.Value.current_hp <= 0 || player.Value.state == PlayerState.Dead)
        {
            // Check if this is just gravity movement (only Y position changing, or very small X changes)
            var xDelta = Math.Abs(x - currentPos.x);
            
            // Allow if X movement is minimal (just physics drift) and Y is changing (falling)
            if (xDelta > 5.0f) // More than 5 pixels of horizontal movement
            {
                Log.Info($"Dead player {ctx.Sender} cannot move horizontally");
                return;
            }
            // Allow Y movement for gravity
        }

        // Prevent teleportation by checking distance between current and new position
        var distance = Math.Sqrt(Math.Pow(x - currentPos.x, 2) + Math.Pow(y - currentPos.y, 2));
        
        // Reject position updates that are too far from current position (likely teleportation attempts)
        if (distance > PlayerConstants.MAX_POSITION_UPDATE_DISTANCE)
        {
            Log.Info($"Rejected position update for {ctx.Sender} - too large movement ({distance:F1} pixels from ({currentPos.x}, {currentPos.y}) to ({x}, {y}))");
            return;
        }

        // Update player position
        ctx.Db.Player.identity.Update(player.Value with
        {
            position = new DbVector2(x, y),
            facing = facing,
            last_active = ctx.Timestamp
        });
        Log.Info($"Updated position for {ctx.Sender} to ({x}, {y}) facing {facing}");
    }

    [Reducer]
    public static void UpdatePlayerState(ReducerContext ctx, PlayerState newState)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player is null)
        {
            Log.Info($"Player not found: {ctx.Sender}");
            return;
        }

        // Use StateMachine to handle state transition
        var result = PlayerStateMachine.ApplyStateTransition(ctx, player.Value, newState);
        
        if (!result.Success)
        {
            Log.Info($"State transition failed for {ctx.Sender}: {result.Reason}");
        }
        else if (result.OldState != result.NewState)
        {
            Log.Info($"Updated state for {ctx.Sender} from {result.OldState} to {result.NewState}");
        }
    }

    [Reducer]
    public static void CleanupInactivePlayers(ReducerContext ctx, string adminApiKey)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to cleanup inactive players from {ctx.Sender}");
            return;
        }

        // Manual cleanup - remove all players (for testing purposes)
        // In production, this would have time-based logic
        var playersToRemove = new List<Identity>();

        foreach (var player in ctx.Db.Player.Iter())
        {
            playersToRemove.Add(player.identity);
        }

        foreach (var identity in playersToRemove)
        {
            ctx.Db.Player.identity.Delete(identity);
            Log.Info($"Cleaned up player {identity}");
        }

        if (playersToRemove.Count > 0)
        {
            Log.Info($"Cleaned up {playersToRemove.Count} players");
        }
    }

    [Reducer]
    public static void PlayerTakeDamage(ReducerContext ctx, uint enemyId)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player == null)
        {
            Log.Info($"Player not found for damage: {ctx.Sender}");
            return;
        }

        // Don't damage already dead players
        if (player.Value.current_hp <= 0)
        {
            Log.Info($"Player {ctx.Sender} is already dead");
            return;
        }

        var enemy = ctx.Db.Enemy.enemy_id.Find(enemyId);
        if (enemy == null)
        {
            Log.Info($"Enemy {enemyId} not found for damage calculation");
            return;
        }

        // Don't take damage from dead enemies
        if (enemy.Value.current_hp <= 0)
        {
            Log.Info($"Enemy {enemyId} is dead, cannot deal damage");
            return;
        }

        // Calculate damage based on enemy level (assume enemy level = 1 for now, can be enhanced later)
        uint enemyLevel = 1; // TODO: Add enemy levels
        var damage = PlayerConstants.CalculateEnemyDamage(enemyLevel, player.Value.level);
        
        // Determine damage type based on player level vs enemy level
        var damageType = DamageCalculator.DeterminePlayerDamageType(player.Value.level, enemyLevel);
        
        // Apply damage multiplier based on damage type
        var finalDamage = damage * DamageCalculator.GetDamageMultiplier(damageType);
        
        // Apply damage
        var newHp = Math.Max(0, player.Value.current_hp - finalDamage);
        var targetState = newHp <= 0 ? PlayerState.Dead : PlayerState.Damaged;

        Log.Info($"Player {ctx.Sender} damage calculation - Current HP: {player.Value.current_hp}, Damage: {finalDamage}, New HP: {newHp}, Target State: {targetState}");

        // Update player HP first
        var updatedPlayer = player.Value with
        {
            current_hp = newHp,
            last_active = ctx.Timestamp
        };
        ctx.Db.Player.identity.Update(updatedPlayer);
        
        // Then apply state transition using StateMachine
        var stateResult = PlayerStateMachine.ApplyStateTransition(ctx, updatedPlayer, targetState);
        var newState = stateResult.Success ? stateResult.NewState : player.Value.state;

        // Create player damage event for visual display
        ctx.Db.PlayerDamageEvent.Insert(new PlayerDamageEvent
        {
            player_identity = ctx.Sender,
            enemy_id = enemyId,
            damage_amount = finalDamage,
            damage_type = damageType,
            timestamp = ctx.Timestamp
        });

        Log.Info($"Player {ctx.Sender} took {finalDamage} damage from enemy {enemyId}. HP: {player.Value.current_hp} -> {newHp}");

        // If player died, log it
        if (newState == PlayerState.Dead)
        {
            Log.Info($"Player {ctx.Sender} died!");
        }
    }

    [Reducer]
    public static void RespawnPlayer(ReducerContext ctx)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player == null)
        {
            Log.Info($"Player not found for respawn: {ctx.Sender}");
            return;
        }

        // Only allow respawn if player is dead (HP <= 0 or state is Dead)
        if (player.Value.current_hp > 0 && player.Value.state != PlayerState.Dead)
        {
            Log.Info($"Player {ctx.Sender} is not dead (HP: {player.Value.current_hp}, State: {player.Value.state}), cannot respawn");
            return;
        }

        // Restore player to full health and set to idle state at spawn position
        var maxHp = PlayerConstants.CalculateMaxHp(player.Value.level);
        var maxMana = PlayerConstants.CalculateMaxMana(player.Value.level);
        
        // First update HP and position
        var respawnedPlayer = player.Value with
        {
            current_hp = maxHp,
            current_mana = maxMana,
            position = new DbVector2(PlayerConstants.SPAWN_POSITION_X, PlayerConstants.SPAWN_POSITION_Y), // Set spawn position
            last_active = ctx.Timestamp
        };
        ctx.Db.Player.identity.Update(respawnedPlayer);
        
        // Then apply state transition to Idle using StateMachine (force transition since we're respawning)
        var stateResult = PlayerStateMachine.ApplyStateTransition(ctx, respawnedPlayer, PlayerState.Idle, forceTransition: true);
        if (!stateResult.Success)
        {
            Log.Warn($"Failed to transition respawned player to Idle state: {stateResult.Reason}");
        }

        Log.Info($"Player {ctx.Sender} respawned with {maxHp} HP at position ({PlayerConstants.SPAWN_POSITION_X}, {PlayerConstants.SPAWN_POSITION_Y})");
    }


    [Reducer]
    public static void TeleportPlayer(ReducerContext ctx, float x, float y)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player == null)
        {
            Log.Info($"Player not found for teleport: {ctx.Sender}");
            return;
        }

        // Don't allow teleport if player is dead
        if (player.Value.current_hp <= 0 || player.Value.state == PlayerState.Dead)
        {
            Log.Info($"Player {ctx.Sender} is dead, cannot teleport");
            return;
        }

        // Validate the teleport position is within reasonable bounds (e.g., map limits)
        // You might want to adjust these based on your actual map size
        const float MIN_X = -5000f;
        const float MAX_X = 5000f;
        const float MIN_Y = -5000f;
        const float MAX_Y = 5000f;

        if (x < MIN_X || x > MAX_X || y < MIN_Y || y > MAX_Y)
        {
            Log.Info($"Player {ctx.Sender} attempted to teleport out of bounds: ({x}, {y})");
            return;
        }

        var oldPos = player.Value.position;
        var newPos = new DbVector2(x, y);

        // Update player position
        ctx.Db.Player.identity.Update(player.Value with
        {
            position = newPos,
            last_active = ctx.Timestamp
        });

        Log.Info($"Player {ctx.Sender} teleported from ({oldPos.x}, {oldPos.y}) to ({x}, {y})");
    }

    [Reducer]
    public static void InstakillPlayer(ReducerContext ctx, string adminApiKey)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to instakill player from {ctx.Sender}");
            return;
        }

        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player == null)
        {
            Log.Info($"Player not found for instakill: {ctx.Sender}");
            return;
        }

        // Don't instakill already dead players
        if (player.Value.current_hp <= 0 || player.Value.state == PlayerState.Dead)
        {
            Log.Info($"Player {ctx.Sender} is already dead");
            return;
        }

        // First set HP to 0
        var killedPlayer = player.Value with
        {
            current_hp = 0,
            last_active = ctx.Timestamp
        };
        ctx.Db.Player.identity.Update(killedPlayer);
        
        // Then apply state transition to Dead using StateMachine
        var stateResult = PlayerStateMachine.ApplyStateTransition(ctx, killedPlayer, PlayerState.Dead);
        if (!stateResult.Success)
        {
            Log.Warn($"Failed to transition instakilled player to Dead state: {stateResult.Reason}");
        }

        Log.Info($"Player {ctx.Sender} was instakilled (testing feature)");
    }

    private static bool IsAttackState(PlayerState state)
    {
        return PlayerStateMachine.IsAttackState(state);
    }
}