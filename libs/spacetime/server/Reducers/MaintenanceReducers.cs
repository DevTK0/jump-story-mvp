using SpacetimeDB;
using System;
using System.Collections.Generic;

public static partial class Module
{
    // Helper method to count active players
    private static int CountPlayers(ReducerContext ctx)
    {
        var playerCount = 0;
        foreach (var _ in ctx.Db.Player.Iter())
        {
            playerCount++;
        }
        return playerCount;
    }

    // Helper method to process damaged enemy recovery
    private static bool ProcessDamagedEnemyRecovery(ReducerContext ctx, Spawn enemy)
    {
        if (enemy.state != PlayerState.Damaged)
        {
            return false;
        }

        var recoveryTimeAgo = ctx.Timestamp - EnemyConstants.GetRecoveryTimeSpan();
        if (enemy.last_updated < recoveryTimeAgo)
        {
            // Return enemy to idle state
            var idleEnemy = CreateEnemyUpdate(enemy, enemy.x, enemy.y, enemy.moving_right, 
                enemy.aggro_target, enemy.aggro_target.HasValue, ctx.Timestamp, PlayerState.Idle);
            ctx.Db.Spawn.spawn_id.Update(idleEnemy);
        }
        return true; // Processed as damaged enemy
    }

    // Helper method to process boss attack recovery
    private static bool ProcessBossAttackRecovery(ReducerContext ctx, Spawn boss)
    {
        // Only process bosses in attack states
        if (boss.enemy_type != EnemyType.Boss)
        {
            return false;
        }

        if (boss.state != PlayerState.Attack1 && 
            boss.state != PlayerState.Attack2 && 
            boss.state != PlayerState.Attack3)
        {
            return false;
        }

        // Use BossAttackState to track attack timing, not last_updated which changes when hit
        var attackState = ctx.Db.BossAttackState.spawn_id.Find(boss.spawn_id);
        if (attackState != null)
        {
            // Get the specific attack to find its animation duration
            var attack = ctx.Db.BossAttack.attack_id.Find(attackState.Value.attack_id);
            if (attack != null)
            {
                // Use the specific animation duration for this attack
                var attackRecoveryThreshold = attackState.Value.last_used + TimeSpan.FromMilliseconds(attack.Value.animation_duration);
                if (ctx.Timestamp > attackRecoveryThreshold)
                {
                    // Return boss to idle state after attack animation completes
                    var idleBoss = CreateEnemyUpdate(boss, boss.x, boss.y, boss.moving_right, 
                        boss.aggro_target, boss.aggro_target.HasValue, ctx.Timestamp, PlayerState.Idle);
                    ctx.Db.Spawn.spawn_id.Update(idleBoss);
                    Log.Info($"Boss {boss.enemy} recovered from {boss.state} to Idle after {attack.Value.animation_duration}ms");
                    return true; // Recovery performed
                }
            }
            else
            {
                // Attack not found, use default recovery time
                var attackRecoveryThreshold = attackState.Value.last_used + EnemyConstants.GetAttackRecoveryTimeSpan();
                if (ctx.Timestamp > attackRecoveryThreshold)
                {
                    // Return boss to idle state after attack animation completes
                    var idleBoss = CreateEnemyUpdate(boss, boss.x, boss.y, boss.moving_right, 
                        boss.aggro_target, boss.aggro_target.HasValue, ctx.Timestamp, PlayerState.Idle);
                    ctx.Db.Spawn.spawn_id.Update(idleBoss);
                    Log.Info($"Boss {boss.enemy} recovered from {boss.state} to Idle (using default time)");
                    return true; // Recovery performed
                }
            }
        }
        else
        {
            // No attack state found but boss is in attack animation - force recovery
            Log.Warn($"Boss {boss.enemy} in attack state but no BossAttackState found, forcing recovery");
            var idleBoss = CreateEnemyUpdate(boss, boss.x, boss.y, boss.moving_right, 
                boss.aggro_target, boss.aggro_target.HasValue, ctx.Timestamp, PlayerState.Idle);
            ctx.Db.Spawn.spawn_id.Update(idleBoss);
            return true;
        }
        return false; // Boss is attacking but recovery time hasn't elapsed yet
    }

    // Helper method to process aggro detection and validation
    private static (bool hasAggro, bool shouldChase, float targetX, float targetY, Identity? aggroTarget) ProcessAggroDetection(
        ReducerContext ctx, Spawn enemy, Enemy enemyData, float leftBound, float rightBound)
    {

        var hasAggro = enemy.aggro_target.HasValue;
        var shouldChase = false;
        var targetX = enemy.x;
        var targetY = enemy.y;
        var newAggroTarget = enemy.aggro_target;

        if (hasAggro)
        {
            // Check if aggro target still exists and is in range
            var aggroPlayer = enemy.aggro_target.HasValue ? ctx.Db.Player.identity.Find(enemy.aggro_target.Value) : null;
            if (aggroPlayer != null)
            {
                // Maintain aggro if player is within leash distance
                if (IsPlayerInLeashRange(aggroPlayer.Value.x, aggroPlayer.Value.y, enemy.x, enemy.y))
                {
                    shouldChase = true;
                    targetX = aggroPlayer.Value.x;
                    targetY = aggroPlayer.Value.y;
                }
                else
                {
                    // Player left leash range - clear aggro
                    hasAggro = false;
                    newAggroTarget = null;
                }
            }
            else
            {
                // Target player disconnected - clear aggro
                hasAggro = false;
                newAggroTarget = null;
            }
        }
        else if (enemyData.ai_behavior == AiBehavior.Aggressive)
        {
            // Check for nearby players within aggro range
            foreach (var player in ctx.Db.Player.Iter())
            {
                // Skip dead players
                if (player.current_hp <= 0 || player.state == PlayerState.Dead)
                    continue;

                // Calculate distance to player
                var distance = Math.Sqrt(
                    Math.Pow(player.x - enemy.x, 2) + 
                    Math.Pow(player.y - enemy.y, 2)
                );

                // Check if player is within aggro range
                if (distance <= enemyData.aggro_range)
                {
                    hasAggro = true;
                    shouldChase = true;
                    newAggroTarget = player.identity;
                    targetX = player.x;
                    targetY = player.y;
                    break; // Aggro on first valid target found
                }
            }
        }

        return (hasAggro, shouldChase, targetX, targetY, newAggroTarget);
    }

    // Helper method to calculate chase movement
    private static (float newX, bool newMovingRight) CalculateChaseMovement(
        Spawn enemy, float targetX, float targetY, float movement, float leftBound, float rightBound)
    {
        // Chase behavior - try to move towards target
        var proposedX = enemy.x;
        var newMovingRight = enemy.moving_right;
        
        if (targetX > enemy.x)
        {
            proposedX = enemy.x + movement;
            newMovingRight = true;
        }
        else if (targetX < enemy.x)
        {
            proposedX = enemy.x - movement;
            newMovingRight = false;
        }
        
        // Clamp to route boundaries
        proposedX = Math.Max(leftBound, Math.Min(rightBound, proposedX));
        
        // If we can't move closer to the target, step back a bit more
        if (Math.Abs(proposedX - enemy.x) < EnemyConstants.MOVEMENT_EPSILON)
        {
            // Can't move towards target, step back in opposite direction
            var stepBackDistance = movement * EnemyConstants.STEP_BACK_MULTIPLIER;
            return targetX > enemy.x
                ? (Math.Max(enemy.x - stepBackDistance, leftBound), false) // Target right, step left
                : (Math.Min(enemy.x + stepBackDistance, rightBound), true); // Target left, step right
        }
        else
        {
            return (proposedX, newMovingRight);
        }
    }

    // Helper method to calculate patrol movement
    private static (float newX, bool newMovingRight) CalculatePatrolMovement(
        Spawn enemy, float movement, float leftBound, float rightBound)
    {
        float newX = enemy.x;
        bool newMovingRight = enemy.moving_right;

        // Normal patrol behavior
        if (enemy.moving_right)
        {
            newX += movement;
            // Check if we hit the right boundary
            if (newX >= rightBound)
            {
                newX = rightBound;
                newMovingRight = false;
            }
        }
        else
        {
            newX -= movement;
            // Check if we hit the left boundary
            if (newX <= leftBound)
            {
                newX = leftBound;
                newMovingRight = true;
            }
        }

        return (newX, newMovingRight);
    }

    // Helper method to create enemy update struct
    private static Spawn CreateEnemyUpdate(Spawn originalEnemy, float newX, float newY, bool newMovingRight, 
        Identity? newAggroTarget, bool hasAggro, Timestamp currentTimestamp, PlayerState? newState = null)
    {
        var newFacing = newMovingRight ? FacingDirection.Right : FacingDirection.Left;
        
        return new Spawn
        {
            spawn_id = originalEnemy.spawn_id,
            route_id = originalEnemy.route_id,
            enemy = originalEnemy.enemy,
            x = newX,
            y = newY,
            state = newState ?? originalEnemy.state,
            facing = newFacing,
            current_hp = originalEnemy.current_hp,
            max_hp = originalEnemy.max_hp,
            level = originalEnemy.level,
            last_updated = currentTimestamp,
            moving_right = newMovingRight,
            aggro_target = newAggroTarget,
            spawn_time = originalEnemy.spawn_time, // Always preserve spawn time
            enemy_type = originalEnemy.enemy_type
        };
    }

    // Helper method to calculate route boundaries
    private static (float leftBound, float rightBound) CalculateRouteBounds(SpawnRoute route)
    {
        var leftBound = route.spawn_area.position.x;
        var rightBound = route.spawn_area.position.x + route.spawn_area.size.x;
        return (leftBound, rightBound);
    }

    // Helper method to check if player is within leash range
    private static bool IsPlayerInLeashRange(float playerX, float playerY, float enemyX, float enemyY)
    {
        var distanceToPlayer = Math.Sqrt(
            Math.Pow(playerX - enemyX, 2) + 
            Math.Pow(playerY - enemyY, 2)
        );
        
        return distanceToPlayer <= EnemyConstants.LEASH_DISTANCE;
    }

    // Helper method to update enemy if any values changed
    private static void UpdateEnemyIfChanged(ReducerContext ctx, Spawn enemy, float newX, bool newMovingRight, 
        Identity? newAggroTarget, bool hasAggro)
    {
        // Update enemy position and direction if changed
        var positionChanged = Math.Abs(newX - enemy.x) > EnemyConstants.POSITION_EPSILON;
        var directionChanged = newMovingRight != enemy.moving_right;
        var aggroChanged = (newAggroTarget?.Equals(enemy.aggro_target) != true) || (!hasAggro && enemy.aggro_target.HasValue);

        if (positionChanged || directionChanged || aggroChanged)
        {
            // Determine new state - Walk if moving, Idle if stationary
            PlayerState newState = positionChanged ? PlayerState.Walk : PlayerState.Idle;
            var updatedEnemy = CreateEnemyUpdate(enemy, newX, enemy.y, newMovingRight, newAggroTarget, hasAggro, ctx.Timestamp, newState);
            ctx.Db.Spawn.spawn_id.Update(updatedEnemy);
        }
    }

    [Reducer]
    public static void CleanupDeadBodies(ReducerContext ctx, CleanupDeadBodiesTimer timer)
    {
        // Skip cleanup if no players are connected
        if (CountPlayers(ctx) == 0)
        {
            return;
        }
        
        var fiveSecondsAgo = ctx.Timestamp - EnemyConstants.GetCleanupTimeSpan();
        var enemiesToRemove = new List<uint>();
        
        foreach (var enemy in ctx.Db.Spawn.Iter())
        {
            // Check if enemy is dead AND has been dead for > 5 seconds
            if (enemy.state == PlayerState.Dead && 
                enemy.last_updated < fiveSecondsAgo)
            {
                enemiesToRemove.Add(enemy.spawn_id);
            }
        }
        
        // Delete all expired dead bodies and their associated damage events
        foreach (var spawnId in enemiesToRemove)
        {
            // Get the spawn to check if it's a boss
            var spawn = ctx.Db.Spawn.spawn_id.Find(spawnId);
            
            // First, delete all damage events for this enemy
            var damageEventsToRemove = new List<uint>();
            foreach (var damageEvent in ctx.Db.EnemyDamageEvent.Iter())
            {
                if (damageEvent.spawn_id == spawnId)
                {
                    damageEventsToRemove.Add(damageEvent.damage_event_id);
                }
            }
            
            foreach (var damageEventId in damageEventsToRemove)
            {
                ctx.Db.EnemyDamageEvent.damage_event_id.Delete(damageEventId);
            }
            
            // If it's a boss, also clean up BossAttackState entries
            if (spawn != null && spawn.Value.enemy_type == EnemyType.Boss)
            {
                var attackStatesToRemove = new List<uint>();
                foreach (var attackState in ctx.Db.BossAttackState.Iter())
                {
                    if (attackState.spawn_id == spawnId)
                    {
                        attackStatesToRemove.Add(attackState.spawn_id);
                    }
                }
                foreach (var attackSpawnId in attackStatesToRemove)
                {
                    ctx.Db.BossAttackState.spawn_id.Delete(attackSpawnId);
                }
                if (attackStatesToRemove.Count > 0)
                {
                    Log.Info($"Cleaned up {attackStatesToRemove.Count} BossAttackState entries for dead boss {spawnId}");
                }
            }
            
            // Then delete the enemy
            ctx.Db.Spawn.spawn_id.Delete(spawnId);
        }
        
        if (enemiesToRemove.Count > 0)
        {
            Log.Info($"Cleaned up {enemiesToRemove.Count} dead enemies");
        }
        
        // Also clean up old player damage events (older than 5 seconds)
        var playerDamageEventsToRemove = new List<uint>();
        foreach (var playerDamageEvent in ctx.Db.PlayerDamageEvent.Iter())
        {
            if (playerDamageEvent.timestamp < fiveSecondsAgo)
            {
                playerDamageEventsToRemove.Add(playerDamageEvent.damage_event_id);
            }
        }
        
        foreach (var damageEventId in playerDamageEventsToRemove)
        {
            ctx.Db.PlayerDamageEvent.damage_event_id.Delete(damageEventId);
        }
        
        if (playerDamageEventsToRemove.Count > 0)
        {
            Log.Info($"Cleaned up {playerDamageEventsToRemove.Count} old player damage events");
        }
    }

    [Reducer]
    public static void Debug(ReducerContext ctx, string adminApiKey)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to call debug from {ctx.Sender}");
            return;
        }

        var playerCount = 0;
        foreach (var _ in ctx.Db.Player.Iter())
        {
            playerCount++;
        }
        
        var enemyCount = 0;
        foreach (var _ in ctx.Db.Spawn.Iter())
        {
            enemyCount++;
        }
        
        var routeCount = 0;
        foreach (var _ in ctx.Db.SpawnRoute.Iter())
        {
            routeCount++;
        }
        
        Log.Info($"Debug info - Players: {playerCount}, Enemies: {enemyCount}, Routes: {routeCount}");
    }

    [Reducer]
    public static void SpawnMissingEnemies(ReducerContext ctx, SpawnEnemiesTimer timer)
    {
        // Skip spawning if no players are connected
        if (CountPlayers(ctx) == 0)
        {
            return;
        }

        var random = new Random();
        var totalSpawned = 0;

        // Check each route and spawn missing enemies if interval has passed
        foreach (var route in ctx.Db.SpawnRoute.Iter())
        {
            // Check if this route is due for spawning
            var intervalAgo = ctx.Timestamp - TimeSpan.FromSeconds(route.spawn_interval);
            
            if (route.last_spawn_time < intervalAgo)
            {
                // Get enemy data from database
                var enemyData = ctx.Db.Enemy.name.Find(route.enemy);
                if (enemyData == null)
                {
                    Log.Warn($"No enemy found for type: {route.enemy}, skipping spawn");
                    continue;
                }

                // Use helper method to spawn enemies
                var spawned = SpawnEnemiesOnRoute(ctx, route, random, false);
                totalSpawned += spawned;
            }
        }

        if (totalSpawned > 0)
        {
            Log.Info($"Spawned {totalSpawned} missing enemies across routes with individual intervals");
        }
    }

    [Reducer]
    public static void UpdateEnemyPatrol(ReducerContext ctx, EnemyPatrolTimer timer)
    {
        // Skip patrol if no players are connected
        if (CountPlayers(ctx) == 0)
        {
            return;
        }

        const float deltaTime = EnemyConstants.DELTA_TIME;

        foreach (var enemy in ctx.Db.Spawn.Iter())
        {
            // Skip bosses - they have their own update logic
            if (enemy.enemy_type == EnemyType.Boss)
            {
                continue;
            }

            // Handle damaged enemies - recover them after 500ms
            if (ProcessDamagedEnemyRecovery(ctx, enemy))
            {
                continue;
            }

            // Only process idle and walking enemies (not damaged or dead)
            if (enemy.state != PlayerState.Idle && enemy.state != PlayerState.Walk)
            {
                continue;
            }

            // Get the route for this enemy
            var route = ctx.Db.SpawnRoute.route_id.Find(enemy.route_id);
            if (route == null)
            {
                continue;
            }

            // Get enemy data for behavior and movement speed
            var enemyData = ctx.Db.Enemy.name.Find(enemy.enemy);
            if (enemyData == null)
            {
                Log.Warn($"No enemy found for type: {enemy.enemy}");
                continue;
            }

            // Calculate route boundaries
            var (leftBound, rightBound) = CalculateRouteBounds(route.Value);

            // Process aggro detection and validation
            var (hasAggro, shouldChase, targetX, targetY, newAggroTarget) = ProcessAggroDetection(ctx, enemy, enemyData.Value, leftBound, rightBound);
            
            // Calculate new position based on behavior
            var movement = enemyData.Value.move_speed * deltaTime;
            float newX;
            bool newMovingRight;

            if (shouldChase)
            {
                (newX, newMovingRight) = CalculateChaseMovement(enemy, targetX, targetY, movement, leftBound, rightBound);
            }
            else if (enemyData.Value.ai_behavior == AiBehavior.Patrol && !hasAggro)
            {
                (newX, newMovingRight) = CalculatePatrolMovement(enemy, movement, leftBound, rightBound);
            }
            else
            {
                (newX, newMovingRight) = (enemy.x, enemy.moving_right);
            }

            // Update enemy if any values changed
            UpdateEnemyIfChanged(ctx, enemy, newX, newMovingRight, newAggroTarget, hasAggro);
        }
    }

    [Reducer]
    public static void UpdateLeaderboard(ReducerContext ctx, LeaderboardUpdateTimer timer)
    {
        // Query top 10 players sorted by level (desc) then experience (desc)
        var topPlayers = ctx.Db.Player.Iter()
            .Where(p => !p.ban_status) // Exclude banned players
            .OrderByDescending(p => p.level)
            .ThenByDescending(p => p.experience)
            .Take(10)
            .ToList();

        // Clear existing leaderboard entries
        var existingEntries = ctx.Db.Leaderboard.Iter().ToList();
        foreach (var entry in existingEntries)
        {
            ctx.Db.Leaderboard.rank.Delete(entry.rank);
        }

        // Insert new leaderboard entries
        uint rank = 1;
        foreach (var player in topPlayers)
        {
            // Get job display name
            var job = ctx.Db.Job.job_key.Find(player.job);
            var jobDisplayName = job != null ? job.Value.display_name : player.job; // Fallback to job key if not found

            var leaderboardEntry = new Leaderboard
            {
                rank = rank,
                player_identity = player.identity,
                player_name = player.name,
                level = player.level,
                experience = player.experience,
                job_name = jobDisplayName,
                last_updated = ctx.Timestamp
            };

            ctx.Db.Leaderboard.Insert(leaderboardEntry);
            rank++;
        }

        Log.Info($"Updated leaderboard with {topPlayers.Count} players");
    }

    [Reducer]
    public static void CleanupOldBroadcasts(ReducerContext ctx, BroadcastCleanupTimer timer)
    {
        // Clean up broadcasts older than 15 seconds
        var fifteenSecondsAgo = ctx.Timestamp - TimeSpan.FromSeconds(15);
        var broadcastsToRemove = new List<uint>();

        foreach (var broadcast in ctx.Db.Broadcast.Iter())
        {
            if (broadcast.publish_dt < fifteenSecondsAgo)
            {
                broadcastsToRemove.Add(broadcast.broadcast_id);
            }
        }

        // Delete old broadcasts
        foreach (var broadcastId in broadcastsToRemove)
        {
            ctx.Db.Broadcast.broadcast_id.Delete(broadcastId);
        }

        if (broadcastsToRemove.Count > 0)
        {
            Log.Info($"Cleaned up {broadcastsToRemove.Count} old broadcasts");
        }
    }

    [Reducer]
    public static void UpdateBossActions(ReducerContext ctx, BossActionTimer timer)
    {
        // Skip if no players are connected
        if (CountPlayers(ctx) == 0)
        {
            return;
        }

        const float deltaTime = EnemyConstants.DELTA_TIME;
        const int BOSS_DESPAWN_MINUTES = 10;

        foreach (var bossEntity in ctx.Db.Spawn.Iter())
        {
            // Only process bosses
            if (bossEntity.enemy_type != EnemyType.Boss)
            {
                continue;
            }
            
            var boss = bossEntity; // Create a mutable copy

            // Check if boss should despawn due to timeout
            var despawnThreshold = ctx.Timestamp - TimeSpan.FromMinutes(BOSS_DESPAWN_MINUTES);
            if (boss.spawn_time < despawnThreshold)
            {
                Log.Info($"Boss {boss.enemy} has been active for more than {BOSS_DESPAWN_MINUTES} minutes, despawning...");
                CleanupBoss(ctx, boss, "timeout");
                continue; // Skip further processing
            }

            // Handle attack recovery for bosses - recover them after attack animation completes
            var wasRecovering = ProcessBossAttackRecovery(ctx, boss);
            if (wasRecovering)
            {
                Log.Info($"Boss {boss.enemy} recovered from attack state, can now act again");
            }

            // Skip dead bosses
            if (boss.state == PlayerState.Dead)
            {
                continue;
            }

            // Log current boss state for debugging
            Log.Info($"Boss {boss.enemy} update - State: {boss.state}, Position: ({boss.x}, {boss.y}), Facing: {boss.facing}");

            // Bosses can continue their AI logic even while in attack animations
            // This allows them to move, track players, and chain attacks for more aggressive behavior
            // The attack cooldown system prevents attack spam

            // Bosses no longer use Damaged state - they maintain their current state when hit
            // This prevents the stun-lock issue where bosses get stuck in Damaged->Idle cycles

            // Get boss data
            var bossData = ctx.Db.Boss.boss_id.Find(boss.enemy);
            if (bossData == null)
            {
                Log.Warn($"No boss data found for type: {boss.enemy}");
                continue;
            }

            // Get the route for this boss
            var route = ctx.Db.BossRoute.route_id.Find(boss.route_id);
            if (route == null)
            {
                continue;
            }

            // Calculate route boundaries for movement
            var (leftBound, rightBound) = CalculateRouteBounds(route.Value.spawn_area);

            // Get attack3 data early to know the exact range needed (testing summon attacks)
            BossAttack? attack1 = null;
            foreach (var attack in ctx.Db.BossAttack.Iter())
            {
                if (attack.boss_id == boss.enemy && attack.attack_slot == 3) // Changed to slot 3 for testing
                {
                    attack1 = attack;
                    break;
                }
            }
            
            if (attack1 == null)
            {
                Log.Warn($"No attack3 found for boss {boss.enemy}");
                continue;
            }

            // Find nearest player for targeting
            var nearestPlayer = FindNearestAlivePlayer(ctx, boss.x, boss.y);
            
            if (nearestPlayer != null)
            {
                var distance = Math.Abs(nearestPlayer.Value.x - boss.x);
                Log.Info($"Boss {boss.enemy} found player at distance {distance}, aggro range: {bossData.Value.aggro_range}");
                
                // Check if player is in aggro range
                if (distance <= bossData.Value.aggro_range)
                {
                    // Use attack1's specific range, not the generic attack_range
                    var attackRange = attack1.Value.range;
                    Log.Info($"Boss {boss.enemy} player in aggro range. Attack range: {attackRange}, Current distance: {distance}");
                    
                    // Check if we're close enough to use attack1
                    if (distance <= attackRange)
                    {
                        Log.Info($"Boss {boss.enemy} in attack range! Attempting to attack...");
                        // Within attack range - turn to face player first, then attack
                        var shouldFaceRight = nearestPlayer.Value.x > boss.x;
                        if ((shouldFaceRight && boss.facing == FacingDirection.Left) || 
                            (!shouldFaceRight && boss.facing == FacingDirection.Right))
                        {
                            // Boss needs to turn around to face the player
                            var turnedBoss = CreateEnemyUpdate(boss, boss.x, boss.y, shouldFaceRight, 
                                boss.aggro_target, true, ctx.Timestamp, boss.state);
                            ctx.Db.Spawn.spawn_id.Update(turnedBoss);
                            
                            Log.Info($"Boss {boss.enemy} turning to face player - New facing: {turnedBoss.facing}");
                            
                            // Update the boss reference to the turned version
                            boss = turnedBoss;
                        }
                        
                        // Now execute attack with boss facing the correct direction
                        ExecuteBossAttack(ctx, boss, bossData.Value);
                    }
                    else
                    {
                        // Chase player to get within attack1 range
                        // Calculate optimal position: just within attack range (90% of max range for safety)
                        var optimalDistance = attackRange * 0.9f;
                        var targetX = nearestPlayer.Value.x > boss.x 
                            ? nearestPlayer.Value.x - optimalDistance 
                            : nearestPlayer.Value.x + optimalDistance;
                        
                        ExecuteBossMovement(ctx, boss, targetX, deltaTime, bossData.Value.move_speed, leftBound, rightBound, true);
                        
                        Log.Info($"Boss {boss.enemy} chasing to optimal attack distance. Current: {distance}, Target: {optimalDistance}, Attack range: {attackRange}");
                    }
                }
                // If player is outside aggro range, boss returns to idle
                else if (boss.state != PlayerState.Idle)
                {
                    // Return to idle state when no threats nearby
                    var idleBoss = CreateEnemyUpdate(boss, boss.x, boss.y, boss.moving_right, 
                        null, false, ctx.Timestamp, PlayerState.Idle);
                    ctx.Db.Spawn.spawn_id.Update(idleBoss);
                }
            }
            else if (boss.state != PlayerState.Idle)
            {
                // No players nearby - return to idle if not already
                var idleBoss = CreateEnemyUpdate(boss, boss.x, boss.y, boss.moving_right, 
                    null, false, ctx.Timestamp, PlayerState.Idle);
                ctx.Db.Spawn.spawn_id.Update(idleBoss);
            }
        }
    }

    private static Player? FindNearestAlivePlayer(ReducerContext ctx, float bossX, float bossY)
    {
        Player? nearest = null;
        float nearestDistance = float.MaxValue;

        foreach (var player in ctx.Db.Player.Iter())
        {
            if (player.current_hp <= 0 || player.state == PlayerState.Dead || !player.is_online)
            {
                continue;
            }

            var distance = Math.Abs(player.x - bossX);
            if (distance < nearestDistance)
            {
                nearestDistance = distance;
                nearest = player;
            }
        }

        return nearest;
    }


    private static int SpawnEnemiesOnRoute(ReducerContext ctx, SpawnRoute route, Random random, bool forceSummon)
    {
        // Get enemy data
        var enemyData = ctx.Db.Enemy.name.Find(route.enemy);
        if (enemyData == null)
        {
            Log.Warn($"No enemy found for type: {route.enemy}");
            return 0;
        }
        
        // Count current alive enemies for this route
        var currentEnemyCount = 0;
        foreach (var enemy in ctx.Db.Spawn.Iter())
        {
            if (enemy.route_id == route.route_id && 
                enemy.state != PlayerState.Dead &&
                enemy.enemy_type == EnemyType.Regular) // Don't count bosses
            {
                currentEnemyCount++;
            }
        }
        
        // Calculate how many to spawn
        var enemiesToSpawn = route.max_enemies - currentEnemyCount;
        var spawned = 0;
        
        for (int i = 0; i < enemiesToSpawn; i++)
        {
            var spawnPosition = route.spawn_area.GetRandomPoint(random);
            
            var baseEnemy = new Spawn
            {
                route_id = route.route_id,
                enemy = route.enemy,
                current_hp = enemyData.Value.health,
                max_hp = enemyData.Value.health,
                level = enemyData.Value.level,
                spawn_time = ctx.Timestamp,
                enemy_type = EnemyType.Regular
            };
            
            var newEnemy = CreateEnemyUpdate(baseEnemy, spawnPosition.x, spawnPosition.y, true, null, false, ctx.Timestamp, PlayerState.Idle);
            
            ctx.Db.Spawn.Insert(newEnemy);
            spawned++;
        }
        
        // Don't update last_spawn_time for summons to avoid interfering with normal spawning
        if (!forceSummon && spawned > 0)
        {
            var updatedRoute = route with { last_spawn_time = ctx.Timestamp };
            ctx.Db.SpawnRoute.route_id.Update(updatedRoute);
        }
        
        return spawned;
    }

    private static void ExecuteBossSummon(ReducerContext ctx, Spawn boss, BossAttack summonAttack)
    {
        // Find all SpawnRoutes within summon range
        var routesInRange = new List<SpawnRoute>();
        
        foreach (var route in ctx.Db.SpawnRoute.Iter())
        {
            // Calculate distance from boss to spawn area center
            var centerX = route.spawn_area.position.x + (route.spawn_area.size.x / 2);
            var centerY = route.spawn_area.position.y + (route.spawn_area.size.y / 2);
            var distance = Math.Sqrt(Math.Pow(centerX - boss.x, 2) + Math.Pow(centerY - boss.y, 2));
            
            if (distance <= summonAttack.range)
            {
                routesInRange.Add(route);
                Log.Info($"Found route {route.route_id} with enemy {route.enemy} within summon range (distance: {distance:F1})");
            }
        }
        
        // Spawn enemies on each route up to max capacity
        var totalSpawned = 0;
        var random = new Random();
        
        foreach (var route in routesInRange)
        {
            var spawned = SpawnEnemiesOnRoute(ctx, route, random, true);
            totalSpawned += spawned;
            if (spawned > 0)
            {
                Log.Info($"Spawned {spawned} {route.enemy} enemies on route {route.route_id}");
            }
        }
        
        Log.Info($"Boss {boss.enemy} summoned {totalSpawned} enemies on {routesInRange.Count} routes");
    }

    private static void ExecuteBossMovement(ReducerContext ctx, Spawn boss, float targetX, float deltaTime, float moveSpeed, float leftBound, float rightBound, bool isChasing)
    {
        var movement = moveSpeed * deltaTime;
        float newX = boss.x;
        bool newMovingRight = boss.moving_right;

        if (targetX > boss.x)
        {
            newX = boss.x + movement;
            newMovingRight = true;
        }
        else if (targetX < boss.x)
        {
            newX = boss.x - movement;
            newMovingRight = false;
        }

        // Clamp to route boundaries
        newX = Math.Max(leftBound, Math.Min(rightBound, newX));

        var positionDiff = Math.Abs(newX - boss.x);
        Log.Info($"Boss {boss.enemy} movement - Target: {targetX}, Current: {boss.x}, New: {newX}, Diff: {positionDiff}, Speed: {moveSpeed}, DeltaTime: {deltaTime}, Movement: {movement}");

        // Update boss if position changed or direction changed
        if (positionDiff > 0.01f || newMovingRight != boss.moving_right)
        {
            // Set state to Walk when moving (use smaller threshold for walk detection)
            PlayerState newState = positionDiff > 0.001f ? PlayerState.Walk : PlayerState.Idle;
            var updatedBoss = CreateEnemyUpdate(boss, newX, boss.y, newMovingRight, 
                isChasing ? boss.aggro_target : null, isChasing, ctx.Timestamp, newState);
            ctx.Db.Spawn.spawn_id.Update(updatedBoss);
            
            Log.Info($"Boss {boss.enemy} state updated to {newState} - Position changed by {positionDiff}");
        }
        else
        {
            Log.Info($"Boss {boss.enemy} no update needed - Position diff: {positionDiff}, Direction change: {newMovingRight != boss.moving_right}");
        }
    }


    private static (float leftBound, float rightBound) CalculateRouteBounds(DbRect spawnArea)
    {
        var leftBound = spawnArea.position.x;
        var rightBound = spawnArea.position.x + spawnArea.size.x;
        return (leftBound, rightBound);
    }

    private static void ExecuteBossAttack(ReducerContext ctx, Spawn boss, Boss bossData)
    {
        // 1. Get attack3 data from BossAttack table (testing summon attacks)
        BossAttack? attack1 = null;
        foreach (var attack in ctx.Db.BossAttack.Iter())
        {
            if (attack.boss_id == boss.enemy && attack.attack_slot == 3) // Changed to slot 3 for testing
            {
                attack1 = attack;
                break;
            }
        }
        
        if (attack1 == null)
        {
            Log.Warn($"No attack3 found for boss {boss.enemy}");
            return;
        }
        
        // 2. Check cooldown using BossAttackState
        var attackState = ctx.Db.BossAttackState.spawn_id.Find(boss.spawn_id);
        if (attackState != null)
        {
            var cooldownThreshold = attackState.Value.last_used + TimeSpan.FromSeconds(attack1.Value.cooldown);
            if (ctx.Timestamp < cooldownThreshold)
            {
                Log.Info($"Boss {boss.enemy} attack still on cooldown");
                return;
            }
        }
        
        // 3. Update boss to Attack3 state (testing summon attacks)
        var attackingBoss = boss with { 
            state = PlayerState.Attack3, 
            last_updated = ctx.Timestamp 
        };
        ctx.Db.Spawn.spawn_id.Update(attackingBoss);
        
        Log.Info($"Boss {boss.enemy} executing attack3 ({attack1.Value.attack_type}) - Position: ({boss.x}, {boss.y}), Facing: {boss.facing}, Range: {attack1.Value.range}");
        
        // 4. Handle different attack types
        if (attack1.Value.attack_type == "summon")
        {
            // Summon attacks spawn enemies instead of damaging players
            ExecuteBossSummon(ctx, boss, attack1.Value);
        }
        else
        {
            // Damage-based attacks (area and directional)
            var playersHit = new List<Player>();
            var totalPlayers = 0;
            var skippedPlayers = 0;
            
            foreach (var player in ctx.Db.Player.Iter())
        {
            totalPlayers++;
            
            // Skip dead, damaged (invulnerable), or offline players
            if (player.current_hp <= 0 || player.state == PlayerState.Dead || player.state == PlayerState.Damaged || !player.is_online)
            {
                skippedPlayers++;
                Log.Info($"Skipping player {player.name} - HP: {player.current_hp}, State: {player.state}, Online: {player.is_online}");
                continue;
            }
            
            // Calculate distance from boss to player
            var xDistance = player.x - boss.x;
            var yDistance = Math.Abs(player.y - boss.y);
            
            // Check if player is within vertical range (some leniency for height differences)
            const float verticalTolerance = 200f; // Increased to handle platform height differences
            if (yDistance > verticalTolerance)
            {
                Log.Info($"Player {player.name} too far vertically - yDistance: {yDistance} > tolerance: {verticalTolerance}");
                continue;
            }
            
            // Check if player is within attack range based on attack type
            bool isInRange = false;
            
            if (attack1.Value.attack_type == "area")
            {
                // Area attacks hit all players within range, regardless of direction
                if (Math.Abs(xDistance) <= attack1.Value.range)
                {
                    isInRange = true;
                    Log.Info($"Player {player.name} in area attack range - xDistance: {Math.Abs(xDistance)}, range: {attack1.Value.range}");
                }
                else
                {
                    Log.Info($"Player {player.name} NOT in area range - xDistance: {Math.Abs(xDistance)}, range: {attack1.Value.range}");
                }
            }
            else // Default to directional for "directional" or any other type
            {
                // Directional attacks only hit players in front of the boss
                if (boss.facing == FacingDirection.Right && xDistance > 0 && xDistance <= attack1.Value.range)
                {
                    isInRange = true;
                    Log.Info($"Player {player.name} is in front (right) - xDistance: {xDistance}, range: {attack1.Value.range}");
                }
                else if (boss.facing == FacingDirection.Left && xDistance < 0 && Math.Abs(xDistance) <= attack1.Value.range)
                {
                    isInRange = true;
                    Log.Info($"Player {player.name} is in front (left) - xDistance: {xDistance}, range: {attack1.Value.range}");
                }
                else
                {
                    Log.Info($"Player {player.name} NOT in directional range - Position: ({player.x}, {player.y}), xDistance: {xDistance}, yDistance: {yDistance}, Boss facing: {boss.facing}");
                }
            }
            
            if (isInRange)
            {
                playersHit.Add(player);
            }
        }
        
        Log.Info($"Attack detection complete - Total players: {totalPlayers}, Skipped: {skippedPlayers}, Hit: {playersHit.Count}");
        
        // 5. Apply damage to each player hit
        foreach (var player in playersHit)
        {
            var currentPlayer = player; // Local copy for multiple hits
            
            // Apply multiple hits if specified
            for (int hit = 0; hit < attack1.Value.hits; hit++)
            {
                // Skip if player already died from previous hits
                if (currentPlayer.current_hp <= 0)
                {
                    break;
                }
                
                // Calculate damage
                var damage = attack1.Value.damage;
                var newHp = Math.Max(0f, currentPlayer.current_hp - damage);
                var isDead = newHp <= 0;
                
                // Calculate knockback
                var knockbackDirection = currentPlayer.x > boss.x ? 1 : -1;
                var knockbackDistance = attack1.Value.knockback;
                var newX = currentPlayer.x + (knockbackDistance * knockbackDirection);
                
                // Update player state
                var damagedPlayer = currentPlayer with {
                    current_hp = newHp,
                    x = newX,
                    state = isDead ? PlayerState.Dead : PlayerState.Damaged,
                    last_active = ctx.Timestamp
                };
                ctx.Db.Player.identity.Update(damagedPlayer);
                
                // Create damage event for client
                ctx.Db.PlayerDamageEvent.Insert(new PlayerDamageEvent {
                    player_identity = currentPlayer.identity,
                    spawn_id = boss.spawn_id,
                    damage_amount = (uint)damage,
                    damage_type = DamageType.Normal,
                    skill_effect = attack1.Value.skill_effect,
                    damage_source = "server_attack", // Need Phase 2 effects
                    timestamp = ctx.Timestamp
                });
                
                // Update local player reference for next hit
                currentPlayer = damagedPlayer;
                
                Log.Info($"Boss {boss.enemy} hit player {currentPlayer.name} for {damage} damage (hit {hit + 1}/{attack1.Value.hits})");
                
                // Enter combat for the player
                if (!isDead)
                {
                    CombatService.EnterCombat(ctx, damagedPlayer);
                }
            }
        }
        
        // 6. Update or create attack cooldown state
        if (attackState != null)
        {
            ctx.Db.BossAttackState.spawn_id.Update(attackState.Value with { 
                last_used = ctx.Timestamp 
            });
        }
        else
        {
            ctx.Db.BossAttackState.Insert(new BossAttackState {
                spawn_id = boss.spawn_id,
                attack_id = attack1.Value.attack_id,
                last_used = ctx.Timestamp
            });
        }
        
            if (playersHit.Count > 0)
            {
                Log.Info($"Boss {boss.enemy} attack3 hit {playersHit.Count} players");
            }
        } // End of damage-based attacks
    }
}