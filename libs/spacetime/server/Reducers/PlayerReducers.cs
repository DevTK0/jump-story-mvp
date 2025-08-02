using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

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
        
        // Schedule combat timeout checks every 1 second
        ctx.Db.combat_timeout_timer.Insert(new CombatTimeoutTimer
        {
            scheduled_at = new ScheduleAt.Interval(TimeSpan.FromSeconds(1))
        });
        
        // Schedule leaderboard updates every 60 seconds
        ctx.Db.leaderboard_update_timer.Insert(new LeaderboardUpdateTimer
        {
            scheduled_at = new ScheduleAt.Interval(TimeSpan.FromSeconds(60))
        });
        
        // Schedule broadcast cleanup every 15 seconds
        ctx.Db.broadcast_cleanup_timer.Insert(new BroadcastCleanupTimer
        {
            scheduled_at = new ScheduleAt.Interval(TimeSpan.FromSeconds(15))
        });
        
        // Schedule boss action updates every 100ms
        ctx.Db.boss_action_timer.Insert(new BossActionTimer
        {
            scheduled_at = new ScheduleAt.Interval(TimeSpan.FromMilliseconds(100))
        });
        
        // Schedule party invite cleanup every 30 seconds
        ctx.Db.party_invite_cleanup_timer.Insert(new PartyInviteCleanupTimer
        {
            scheduled_at = new ScheduleAt.Interval(TimeSpan.FromSeconds(30))
        });
        
        Log.Info("Initialized dead body cleanup, enemy spawning, enemy patrol, message cleanup, combat timeout, leaderboard update, broadcast cleanup, boss action, and party invite cleanup schedulers");
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
            
            // Check if job should be unlocked based on player's level
            var player = ctx.Db.Player.identity.Find(playerIdentity);
            bool shouldUnlock = false;
            if (player != null)
            {
                // Unlock if job's unlock_level is 0 (default unlocked) or player meets the level requirement
                shouldUnlock = (job.unlock_level == 0) || (player.Value.level >= job.unlock_level);
            }
            
            var playerJob = new PlayerJob
            {
                player_identity = playerIdentity,
                job_key = job.job_key,
                is_unlocked = shouldUnlock
            };
            
            ctx.Db.PlayerJob.Insert(playerJob);
            Log.Info($"Created PlayerJob entry for player {playerIdentity} - job: {job.job_key}, unlocked: {shouldUnlock} (unlock_level: {job.unlock_level})");
        }
    }

    private static void PopulatePlayerTeleports(ReducerContext ctx, Identity playerIdentity)
    {
        // Get all teleports from the Teleport table
        var allTeleports = ctx.Db.Teleport.Iter();
        
        foreach (var teleport in allTeleports)
        {
            // Check if this player-teleport combination already exists
            var existingEntries = ctx.Db.PlayerTeleport
                .Iter()
                .Where(pt => pt.player_identity == playerIdentity && pt.location_name == teleport.location_name)
                .ToList();
                
            if (existingEntries.Count > 0)
            {
                Log.Info($"PlayerTeleport entry already exists for player {playerIdentity} - teleport: {teleport.location_name}");
                continue;
            }
            
            var playerTeleport = new PlayerTeleport
            {
                player_identity = playerIdentity,
                location_name = teleport.location_name,
                is_unlocked = false // All teleports start locked
            };
            
            ctx.Db.PlayerTeleport.Insert(playerTeleport);
            Log.Info($"Created PlayerTeleport entry for player {playerIdentity} - teleport: {teleport.location_name}, unlocked: false");
        }
    }

    [Reducer(ReducerKind.ClientConnected)]
    public static void Connect(ReducerContext ctx)
    {
        Log.Info($"{ctx.Sender} just connected.");

        // Check if player already exists
        var existingPlayer = ctx.Db.Player.identity.Find(ctx.Sender);
        if (existingPlayer is not null)
        {
            // Check if player is banned
            if (existingPlayer.Value.ban_status)
            {
                Log.Info($"Banned player {ctx.Sender} attempted to connect");
                // Note: We can't prevent connection at this level, but we mark them as online
                // The client should handle the ban status and disconnect
                ctx.Db.Player.identity.Update(existingPlayer.Value with
                {
                    is_online = true,
                    last_active = ctx.Timestamp
                });
                return;
            }
            
            // Player exists - just update their online status
            Log.Info($"Existing player {ctx.Sender} reconnected. Level: {existingPlayer.Value.level}, Experience: {existingPlayer.Value.experience}");
            ctx.Db.Player.identity.Update(existingPlayer.Value with
            {
                is_online = true,
                last_active = ctx.Timestamp
            });
            return;
        }

        // Create new player with initial position and stats
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
            job = defaultJob,
            in_combat = false,
            last_combat_time = ctx.Timestamp - TimeSpan.FromDays(1), // Initialize to old time
            teleport_id = "",
            is_online = true,
            ban_status = false // New players are not banned
        };
        ctx.Db.Player.Insert(newPlayer);
        
        // Populate PlayerJob entries for all jobs
        PopulatePlayerJobs(ctx, ctx.Sender);
        
        // Populate PlayerTeleport entries for all teleports (all locked initially)
        PopulatePlayerTeleports(ctx, ctx.Sender);
    }

    [Reducer(ReducerKind.ClientDisconnected)]
    public static void Disconnect(ReducerContext ctx)
    {
        Log.Info($"{ctx.Sender} disconnected.");

        // Update player online status instead of deleting
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player is not null)
        {
            ctx.Db.Player.identity.Update(player.Value with
            {
                is_online = false,
                last_active = ctx.Timestamp
            });
            Log.Info($"Player {ctx.Sender} marked as offline. Level: {player.Value.level}, Experience: {player.Value.experience}");
            
            // Remove player from party when they disconnect
            RemovePlayerFromPartyOnDisconnect(ctx, player.Value);
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

        // Check if player is banned
        if (player.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to update position");
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
        
        // Check for teleport unlocks
        foreach (var teleport in ctx.Db.Teleport.Iter())
        {
            // Teleport coordinates are from top-left of a 32x32 tile
            // Calculate center of the teleport tile
            var teleportCenterX = teleport.x + 16f;
            var teleportCenterY = teleport.y + 16f;
            
            // Check if player is within range of teleport center (35x35 pixel area for leeway)
            var xDiff = Math.Abs(x - teleportCenterX);
            var yDiff = Math.Abs(y - teleportCenterY);
            
            if (xDiff <= 17.5f && yDiff <= 17.5f) // Within 17.5 pixels in each direction = 35x35 pixel area
            {
                // Check if already unlocked
                var existingUnlock = ctx.Db.PlayerTeleport
                    .Iter()
                    .FirstOrDefault(pt => pt.player_identity == ctx.Sender && 
                                         pt.location_name == teleport.location_name);
                ctx.Db.Player.identity.Update(player.Value with
                {
                    teleport_id = teleport.location_name,
                });
                if (existingUnlock.player_identity == ctx.Sender && !existingUnlock.is_unlocked)
                {
                    // Delete old entry and insert updated one
                    ctx.Db.PlayerTeleport.player_teleport_id.Delete(existingUnlock.player_teleport_id);
                    ctx.Db.PlayerTeleport.Insert(new PlayerTeleport
                    {
                        player_identity = ctx.Sender,
                        location_name = teleport.location_name,
                        is_unlocked = true
                    });
                    Log.Info($"Player {ctx.Sender} unlocked teleport: {teleport.location_name}");
                }
            }
        }
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

        // Check if player is banned
        if (player.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to update state");
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
    public static void PlayerTakeDamage(ReducerContext ctx, uint spawnId)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player == null)
        {
            Log.Info($"Player not found for damage: {ctx.Sender}");
            return;
        }

        // Check if player is banned
        if (player.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to take damage");
            return;
        }

        // Don't damage already dead players
        if (player.Value.current_hp <= 0)
        {
            Log.Info($"Player {ctx.Sender} is already dead");
            return;
        }

        var enemy = ctx.Db.Spawn.spawn_id.Find(spawnId);
        if (enemy == null)
        {
            Log.Info($"Enemy {spawnId} not found for damage calculation");
            return;
        }

        // Don't take damage from dead enemies
        if (enemy.Value.current_hp <= 0)
        {
            Log.Info($"Enemy {spawnId} is dead, cannot deal damage");
            return;
        }

        // Calculate damage based on enemy level (assume enemy level = 1 for now, can be enhanced later)
        uint enemyLevel = 1; // TODO: Add enemy levels
        var damage = PlayerConstants.CalculateEnemyDamage(enemyLevel, player.Value.level);
        
        // Determine damage type based on player level vs enemy level
        var damageType = DamageCalculator.DeterminePlayerDamageType(player.Value.level, enemyLevel);
        
        // Apply damage multiplier based on damage type and floor to prevent decimals
        var finalDamage = (float)Math.Floor(damage * DamageCalculator.GetDamageMultiplier(damageType));
        
        // Apply damage
        var newHp = Math.Max(0, (float)Math.Floor(player.Value.current_hp - finalDamage));
        var targetState = newHp <= 0 ? PlayerState.Dead : PlayerState.Damaged;

        Log.Info($"Player {ctx.Sender} damage calculation - Current HP: {player.Value.current_hp}, Damage: {finalDamage}, New HP: {newHp}, Target State: {targetState}");

        // Update player HP first and enter combat
        var updatedPlayer = player.Value with
        {
            current_hp = newHp,
            last_active = ctx.Timestamp
        };
        ctx.Db.Player.identity.Update(updatedPlayer);
        
        // Enter combat state
        CombatService.EnterCombat(ctx, updatedPlayer);
        
        // Get the latest player data after combat state update
        var playerAfterCombat = ctx.Db.Player.identity.Find(ctx.Sender);
        if (playerAfterCombat == null)
        {
            Log.Error($"Could not find player after combat update");
            return;
        }
        
        // Then apply state transition using StateMachine with the latest player data
        var stateResult = PlayerStateMachine.ApplyStateTransition(ctx, playerAfterCombat.Value, targetState);
        var newState = stateResult.Success ? stateResult.NewState : player.Value.state;

        // Create player damage event for visual display
        ctx.Db.PlayerDamageEvent.Insert(new PlayerDamageEvent
        {
            player_identity = ctx.Sender,
            spawn_id = spawnId,
            damage_amount = finalDamage,
            damage_type = damageType,
            damage_source = "client_collision", // Phase 1 already handled effects
            timestamp = ctx.Timestamp
        });

        Log.Info($"Player {ctx.Sender} took {finalDamage} damage from enemy {spawnId}. HP: {player.Value.current_hp} -> {newHp}");

        // If player died, store death location and calculate respawn timer
        if (newState == PlayerState.Dead)
        {
            Log.Info($"Player {ctx.Sender} died!");
            
            // Store death location and calculate respawn timer
            var deadPlayer = ctx.Db.Player.identity.Find(ctx.Sender);
            if (deadPlayer != null)
            {
                // Calculate respawn timer: level seconds
                var respawnDelay = TimeSpan.FromSeconds(deadPlayer.Value.level);
                var respawnAvailableAt = ctx.Timestamp + respawnDelay;
                
                ctx.Db.Player.identity.Update(deadPlayer.Value with
                {
                    death_x = deadPlayer.Value.x,
                    death_y = deadPlayer.Value.y,
                    respawn_available_at = respawnAvailableAt
                });
                
                Log.Info($"Player {ctx.Sender} death location stored at ({deadPlayer.Value.x}, {deadPlayer.Value.y}). Respawn available at: {respawnAvailableAt}");
            }
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

        // Check if player is banned
        if (player.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to respawn");
            return;
        }

        // Only allow respawn if player is dead (HP <= 0 or state is Dead)
        if (player.Value.current_hp > 0 && player.Value.state != PlayerState.Dead)
        {
            Log.Info($"Player {ctx.Sender} is not dead (HP: {player.Value.current_hp}, State: {player.Value.state}), cannot respawn");
            return;
        }
        
        // Check respawn timer
        if (player.Value.respawn_available_at > ctx.Timestamp)
        {
            Log.Info($"Player {ctx.Sender} must wait before respawning. Timer expires at: {player.Value.respawn_available_at}");
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

        // Get last teleport location
        var respawn_x = player.Value.death_x; // Respawn at death location as default
        var respawn_y = player.Value.death_y;

        if (!String.IsNullOrEmpty(player.Value.teleport_id)) {
            foreach (var teleport in ctx.Db.Teleport.Iter())
            {
                if (player.Value.teleport_id != teleport.location_name) continue;
                // Teleport coordinates are from top-left of a 32x32 tile
                // Calculate center of the teleport tile
                respawn_x = teleport.x + 16f;
                respawn_y = teleport.y + 16f;
            }
        }
        
        // First update HP and position (use teleport location)
        var respawnedPlayer = player.Value with
        {
            current_hp = maxHp,
            current_mana = maxMana,
            x = respawn_x,  
            y = respawn_y,
            last_active = ctx.Timestamp,
            respawn_available_at = ctx.Timestamp  // Clear respawn timer by setting to current time
        };
        ctx.Db.Player.identity.Update(respawnedPlayer);
        
        // Then apply state transition to Idle using StateMachine (force transition since we're respawning)
        var stateResult = PlayerStateMachine.ApplyStateTransition(ctx, respawnedPlayer, PlayerState.Idle, forceTransition: true);
        if (!stateResult.Success)
        {
            Log.Warn($"Failed to transition respawned player to Idle state: {stateResult.Reason}");
        }

        Log.Info($"Player {ctx.Sender} respawned with {maxHp} HP at death location ({respawn_x}, {respawn_y})");
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

        // Check if player is banned
        if (player.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to teleport");
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

        // Check if player is banned
        if (player.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to change job");
            return;
        }

        // Don't allow job change if player is dead
        if (player.Value.current_hp <= 0 || player.Value.state == PlayerState.Dead)
        {
            Log.Info($"Player {ctx.Sender} cannot change jobs while dead");
            return;
        }

        // Don't allow job change if player is in combat
        if (player.Value.in_combat)
        {
            Log.Info($"Player {ctx.Sender} cannot change jobs while in combat");
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

        Log.Info($"Player {ctx.Sender} changed job from {player.Value.job} to {newJobKey}. HP: {player.Value.max_hp} -> {newMaxHp}, Mana: {player.Value.max_mana} -> {newMaxMana}");
    }

    [Reducer]
    public static void SetName(ReducerContext ctx, string newName)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player == null)
        {
            Log.Info($"Player not found for name change: {ctx.Sender}");
            return;
        }

        // Check if player is banned
        if (player.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to set name");
            return;
        }

        // Validate name length
        if (string.IsNullOrWhiteSpace(newName))
        {
            Log.Info($"Player {ctx.Sender} attempted to set empty name");
            return;
        }

        if (newName.Length > 20)
        {
            Log.Info($"Player {ctx.Sender} attempted to set name longer than 20 characters");
            return;
        }

        // Trim the name to remove leading/trailing whitespace
        newName = newName.Trim();

        // Sanitize the name - only allow alphanumeric characters, spaces, hyphens, and underscores
        newName = Regex.Replace(newName, @"[^a-zA-Z0-9\s\-_]", "");
        
        // Remove multiple consecutive spaces
        newName = Regex.Replace(newName, @"\s+", " ");
        
        // Check if name is still valid after sanitization
        if (string.IsNullOrWhiteSpace(newName))
        {
            Log.Info($"Player {ctx.Sender} attempted to set name that became empty after sanitization");
            return;
        }

        // Check if the name is already taken by another player
        foreach (var otherPlayer in ctx.Db.Player.Iter())
        {
            // Skip checking against self
            if (otherPlayer.identity == ctx.Sender)
            {
                continue;
            }

            // Case-insensitive comparison to prevent similar names
            if (string.Equals(otherPlayer.name, newName, StringComparison.OrdinalIgnoreCase))
            {
                Log.Info($"Player {ctx.Sender} attempted to set name '{newName}' which is already taken by {otherPlayer.identity}");
                return;
            }
        }

        // Update player name
        ctx.Db.Player.identity.Update(player.Value with
        {
            name = newName,
            last_active = ctx.Timestamp
        });

        Log.Info($"Player {ctx.Sender} changed name to: {newName}");
    }

    private static bool IsAttackState(PlayerState state)
    {
        return PlayerStateMachine.IsAttackState(state);
    }

    [Reducer]
    public static void BroadcastMessage(ReducerContext ctx, string message)
    {
        // Validate the message
        if (string.IsNullOrWhiteSpace(message))
        {
            Log.Info($"Player {ctx.Sender} attempted to broadcast empty message");
            return;
        }

        // Limit message length to prevent abuse
        if (message.Length > 200)
        {
            Log.Info($"Player {ctx.Sender} attempted to broadcast message longer than 200 characters");
            return;
        }

        // Create broadcast entry
        var broadcast = new Broadcast
        {
            message = message,
            publish_dt = ctx.Timestamp
        };

        ctx.Db.Broadcast.Insert(broadcast);
        Log.Info($"Broadcast message created: {message}");
    }

    private static void RemovePlayerFromPartyOnDisconnect(ReducerContext ctx, Player player)
    {
        // Find player's party membership
        var membership = ctx.Db.PartyMember.player_identity.Find(player.identity);
        if (membership == null)
        {
            // Player is not in a party
            return;
        }

        // Get the party
        var party = ctx.Db.Party.party_id.Find(membership.Value.party_id);
        if (party == null)
        {
            Log.Error($"Party {membership.Value.party_id} not found for disconnecting player");
            return;
        }

        // Remove player from party
        ctx.Db.PartyMember.party_member_id.Delete(membership.Value.party_member_id);

        // Update party member count
        var newMemberCount = party.Value.member_count - 1;

        // Check if party should be disbanded (1 or 0 members left)
        if (newMemberCount <= 1)
        {
            // Disband the party
            DisbandPartyOnDisconnect(ctx, party.Value);
            Log.Info($"Player {player.name} disconnected from party '{party.Value.party_name}' - party disbanded");
        }
        else
        {
            // Update member count
            var updatedParty = party.Value with { member_count = newMemberCount };

            // If the leader disconnected, promote the next member
            if (party.Value.leader_identity == player.identity)
            {
                var nextMember = ctx.Db.PartyMember.Iter()
                    .Where(m => m.party_id == party.Value.party_id)
                    .FirstOrDefault();

                if (nextMember.party_member_id != default)
                {
                    updatedParty = updatedParty with { leader_identity = nextMember.player_identity };
                    Log.Info($"Promoted player {nextMember.player_identity} to party leader after disconnect");
                }
            }

            ctx.Db.Party.party_id.Update(updatedParty);
            Log.Info($"Player {player.name} disconnected from party '{party.Value.party_name}'");
        }
    }

    private static void DisbandPartyOnDisconnect(ReducerContext ctx, Party party)
    {
        // Remove all remaining members
        foreach (var member in ctx.Db.PartyMember.Iter().Where(m => m.party_id == party.party_id))
        {
            ctx.Db.PartyMember.party_member_id.Delete(member.party_member_id);
        }

        // Delete all pending invites
        foreach (var invite in ctx.Db.PartyInvite.Iter().Where(i => i.party_id == party.party_id))
        {
            ctx.Db.PartyInvite.invite_id.Delete(invite.invite_id);
        }

        // Delete the party
        ctx.Db.Party.party_id.Delete(party.party_id);

        Log.Info($"Party '{party.party_name}' (ID: {party.party_id}) has been disbanded due to disconnect");
    }

    /// <summary>
    /// Regenerates player's health and mana to full when out of combat
    /// </summary>
    [Reducer]
    public static void RegenHealthMana(ReducerContext ctx, Identity playerIdentity)
    {
        var player = ctx.Db.Player.identity.Find(playerIdentity);
        if (player == null)
        {
            Log.Error($"RegenHealthMana: Player not found for identity {playerIdentity}");
            return;
        }

        // Don't regenerate if player is dead
        if (player.Value.state == PlayerState.Dead || player.Value.current_hp <= 0)
        {
            Log.Info($"RegenHealthMana: Player {player.Value.name} is dead, skipping regeneration");
            return;
        }

        // Don't regenerate if player is still in combat
        if (player.Value.in_combat)
        {
            Log.Info($"RegenHealthMana: Player {player.Value.name} is still in combat, skipping regeneration");
            return;
        }

        // Check if regeneration is needed
        bool needsRegen = player.Value.current_hp < player.Value.max_hp || player.Value.current_mana < player.Value.max_mana;
        
        if (needsRegen)
        {
            Log.Info($"RegenHealthMana: Regenerating player {player.Value.name} from HP: {player.Value.current_hp}/{player.Value.max_hp}, Mana: {player.Value.current_mana}/{player.Value.max_mana}");
            
            // Update player with full health and mana
            ctx.Db.Player.identity.Update(player.Value with
            {
                current_hp = player.Value.max_hp,
                current_mana = player.Value.max_mana
            });
            
            Log.Info($"RegenHealthMana: Player {player.Value.name} regenerated to full HP and Mana");
        }
    }
}