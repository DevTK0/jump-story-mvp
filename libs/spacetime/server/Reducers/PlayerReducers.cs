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
        
        // Schedule message cleanup every 30 seconds
        ctx.Db.message_cleanup_timer.Insert(new MessageCleanupTimer
        {
            scheduled_at = new ScheduleAt.Interval(TimeSpan.FromSeconds(30))
        });
        
        Log.Info("Initialized dead body cleanup, enemy spawning, enemy patrol, and message cleanup schedulers");
    }

    // Helper function to populate PlayerJob entries for a new player
    private static void PopulatePlayerJobs(ReducerContext ctx, Identity playerIdentity)
    {
        // Get all jobs from the Job table
        var allJobs = ctx.Db.Job.Iter();
        
        foreach (var job in allJobs)
        {
            // Check if this player-job combination already exists
            var existingEntries = ctx.Db.PlayerJob
                .Iter()
                .Where(pj => pj.player_identity == playerIdentity && pj.job_key == job.job_key)
                .ToList();
                
            if (existingEntries.Count > 0)
            {
                Log.Info($"PlayerJob entry already exists for player {playerIdentity} - job: {job.job_key}");
                continue;
            }
            
            var playerJob = new PlayerJob
            {
                player_identity = playerIdentity,
                job_key = job.job_key,
                is_unlocked = job.default_unlocked
            };
            
            ctx.Db.PlayerJob.Insert(playerJob);
            Log.Info($"Created PlayerJob entry for player {playerIdentity} - job: {job.job_key}, unlocked: {job.default_unlocked}");
        }
    }

    [Reducer(ReducerKind.ClientConnected)]
    public static void Connect(ReducerContext ctx)
    {
        Log.Info($"{ctx.Sender} just connected.");

        // Create player with initial position and stats
        var startingLevel = PlayerConstants.STARTING_LEVEL;
        var defaultJob = "soldier"; // Default job for new players
        
        // Look up job to get base stats
        var job = ctx.Db.Job.job_key.Find(defaultJob);
        float maxHp, maxMana;
        
        if (job != null)
        {
            // Use job-specific base values with exponential scaling
            maxHp = PlayerConstants.CalculateMaxHpWithJob(startingLevel, job.Value.health);
            maxMana = PlayerConstants.CalculateMaxManaWithJob(startingLevel, job.Value.mana);
            Log.Info($"Created player with job {defaultJob}: Base HP={job.Value.health}, Scaled HP={maxHp}");
        }
        else
        {
            // Fallback to old calculation if job not found
            Log.Warn($"Job {defaultJob} not found, using default calculations");
            maxHp = PlayerConstants.CalculateMaxHp(startingLevel);
            maxMana = PlayerConstants.CalculateMaxMana(startingLevel);
        }
        
        var newPlayer = new Player
        {
            identity = ctx.Sender,
            name = "Player",
            x = PlayerConstants.SPAWN_POSITION_X,
            y = PlayerConstants.SPAWN_POSITION_Y,
            state = PlayerState.Idle,
            facing = FacingDirection.Right,
            last_active = ctx.Timestamp,
            current_hp = maxHp,
            max_hp = maxHp,
            current_mana = maxMana,
            max_mana = maxMana,
            level = startingLevel,
            experience = PlayerConstants.STARTING_EXPERIENCE,
            is_typing = false,
            job = defaultJob
        };
        ctx.Db.Player.Insert(newPlayer);
        
        // Populate PlayerJob entries for all jobs
        PopulatePlayerJobs(ctx, ctx.Sender);
        
        // Initialize player cooldowns with very old timestamp (attacks available immediately)
        var veryOldTime = ctx.Timestamp - TimeSpan.FromDays(1); // 1 day ago
        var playerCooldown = new PlayerCooldown
        {
            player_identity = ctx.Sender,
            job = "soldier", // Default job
            attack1_last_used = veryOldTime, // All attacks available immediately
            attack2_last_used = veryOldTime,
            attack3_last_used = veryOldTime
        };
        ctx.Db.PlayerCooldown.Insert(playerCooldown);
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
        
        // Remove player cooldowns
        var playerCooldown = ctx.Db.PlayerCooldown.player_identity.Find(ctx.Sender);
        if (playerCooldown is not null)
        {
            ctx.Db.PlayerCooldown.player_identity.Delete(ctx.Sender);
            Log.Info($"Removed player cooldowns for {ctx.Sender}");
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

        var currentX = player.Value.x;
        var currentY = player.Value.y;
        
        // For dead players, only allow gravity-based movement (falling)
        if (player.Value.current_hp <= 0 || player.Value.state == PlayerState.Dead)
        {
            // Check if this is just gravity movement (only Y position changing, or very small X changes)
            var xDelta = Math.Abs(x - currentX);
            
            // Allow if X movement is minimal (just physics drift) and Y is changing (falling)
            if (xDelta > 5.0f) // More than 5 pixels of horizontal movement
            {
                Log.Info($"Dead player {ctx.Sender} cannot move horizontally");
                return;
            }
            // Allow Y movement for gravity
        }

        // Prevent teleportation by checking distance between current and new position
        var distance = Math.Sqrt(Math.Pow(x - currentX, 2) + Math.Pow(y - currentY, 2));
        
        // Reject position updates that are too far from current position (likely teleportation attempts)
        if (distance > PlayerConstants.MAX_POSITION_UPDATE_DISTANCE)
        {
            Log.Info($"Rejected position update for {ctx.Sender} - too large movement ({distance:F1} pixels from ({currentX}, {currentY}) to ({x}, {y}))");
            return;
        }

        // Update player position
        ctx.Db.Player.identity.Update(player.Value with
        {
            x = x,
            y = y,
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
        float maxHp, maxMana;
        
        // Look up job to get base stats for scaling
        var job = ctx.Db.Job.job_key.Find(player.Value.job);
        if (job != null)
        {
            maxHp = PlayerConstants.CalculateMaxHpWithJob(player.Value.level, job.Value.health);
            maxMana = PlayerConstants.CalculateMaxManaWithJob(player.Value.level, job.Value.mana);
        }
        else
        {
            // Fallback to old calculation if job not found
            Log.Warn($"Job {player.Value.job} not found, using default calculations");
            maxHp = PlayerConstants.CalculateMaxHp(player.Value.level);
            maxMana = PlayerConstants.CalculateMaxMana(player.Value.level);
        }
        
        // First update HP and position
        var respawnedPlayer = player.Value with
        {
            current_hp = maxHp,
            current_mana = maxMana,
            x = PlayerConstants.SPAWN_POSITION_X,
            y = PlayerConstants.SPAWN_POSITION_Y,
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

        var oldX = player.Value.x;
        var oldY = player.Value.y;

        // Update player position
        ctx.Db.Player.identity.Update(player.Value with
        {
            x = x,
            y = y,
            last_active = ctx.Timestamp
        });

        Log.Info($"Player {ctx.Sender} teleported from ({oldX}, {oldY}) to ({x}, {y})");
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

    [Reducer]
    public static void ChangeJob(ReducerContext ctx, string newJobKey)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player == null)
        {
            Log.Info($"Player not found for job change: {ctx.Sender}");
            return;
        }

        // Don't allow job change if player is dead
        if (player.Value.current_hp <= 0 || player.Value.state == PlayerState.Dead)
        {
            Log.Info($"Player {ctx.Sender} cannot change jobs while dead");
            return;
        }

        // Check if the player is already this job
        if (player.Value.job == newJobKey)
        {
            Log.Info($"Player {ctx.Sender} is already job: {newJobKey}");
            return;
        }

        // Look up the new job to validate it exists
        var newJob = ctx.Db.Job.job_key.Find(newJobKey);
        if (newJob == null)
        {
            Log.Info($"Job not found: {newJobKey}");
            return;
        }

        // Check if the player has unlocked this job
        var playerJobs = ctx.Db.PlayerJob
            .Iter()
            .Where(pj => pj.player_identity == ctx.Sender && pj.job_key == newJobKey)
            .ToList();

        if (playerJobs.Count == 0 || !playerJobs[0].is_unlocked)
        {
            Log.Info($"Player {ctx.Sender} has not unlocked job: {newJobKey}");
            return;
        }

        // Calculate new max HP and Mana based on new job's base stats
        float newMaxHp = PlayerConstants.CalculateMaxHpWithJob(player.Value.level, newJob.Value.health);
        float newMaxMana = PlayerConstants.CalculateMaxManaWithJob(player.Value.level, newJob.Value.mana);

        // Calculate HP/Mana percentage to maintain relative values
        float hpPercentage = player.Value.current_hp / player.Value.max_hp;
        float manaPercentage = player.Value.current_mana / player.Value.max_mana;

        // Apply percentage to new max values (but ensure at least 1 HP)
        float newCurrentHp = Math.Max(1, newMaxHp * hpPercentage);
        float newCurrentMana = Math.Max(0, newMaxMana * manaPercentage);

        // Update player with new job and stats
        ctx.Db.Player.identity.Update(player.Value with
        {
            job = newJobKey,
            max_hp = newMaxHp,
            current_hp = newCurrentHp,
            max_mana = newMaxMana,
            current_mana = newCurrentMana,
            last_active = ctx.Timestamp
        });

        // Update player cooldown to track the new job
        var playerCooldown = ctx.Db.PlayerCooldown.player_identity.Find(ctx.Sender);
        if (playerCooldown != null)
        {
            ctx.Db.PlayerCooldown.player_identity.Update(playerCooldown.Value with
            {
                job = newJobKey
                // Cooldowns remain the same - player keeps their current cooldown timers
            });
        }

        Log.Info($"Player {ctx.Sender} changed job from {player.Value.job} to {newJobKey}. HP: {player.Value.max_hp} -> {newMaxHp}, Mana: {player.Value.max_mana} -> {newMaxMana}");
    }

    private static bool IsAttackState(PlayerState state)
    {
        return PlayerStateMachine.IsAttackState(state);
    }
}