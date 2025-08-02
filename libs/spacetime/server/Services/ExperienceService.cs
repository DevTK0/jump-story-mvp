using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.Linq;

public static partial class Module
{
    /// <summary>
    /// Service responsible for experience calculation and distribution
    /// </summary>
    public static class ExperienceService
    {
    /// <summary>
    /// Award experience to all contributors when an enemy is killed
    /// </summary>
    public static void AwardExperienceForKill(ReducerContext ctx, Spawn deadEnemy)
    {
        // Get base EXP reward based on enemy type
        uint baseExpReward = 0;
        
        if (deadEnemy.enemy_type == EnemyType.Boss)
        {
            // Look up boss data
            var boss = ctx.Db.Boss.boss_id.Find(deadEnemy.enemy);
            if (boss == null)
            {
                Log.Warn($"Cannot award EXP - no boss found for type: {deadEnemy.enemy}");
                return;
            }
            baseExpReward = boss.Value.exp_reward;
        }
        else
        {
            // Look up regular enemy data
            var enemy = ctx.Db.Enemy.name.Find(deadEnemy.enemy);
            if (enemy == null)
            {
                Log.Warn($"Cannot award EXP - no enemy found for type: {deadEnemy.enemy}");
                return;
            }
            baseExpReward = enemy.Value.exp_reward;
        }

        // Calculate damage contributions
        var contributionData = CalculateDamageContributions(ctx, deadEnemy);
        if (contributionData.TotalDamage == 0 || contributionData.PlayerContributions.Count == 0)
        {
            Log.Warn($"No damage contributors found for killed enemy {deadEnemy.spawn_id}");
            return;
        }

        // Award EXP to each contributor
        foreach (var contribution in contributionData.PlayerContributions)
        {
            var player = ctx.Db.Player.identity.Find(contribution.PlayerIdentity);
            if (player == null) continue;

            // Calculate EXP gain based on contribution
            var expGained = CalculateExpGain(
                baseExpReward,
                contribution.ContributionPercentage
            );

            // Award experience and check for level up
            AwardExperienceToPlayer(ctx, player.Value, expGained, deadEnemy, contribution.ContributionPercentage);
        }
    }

    /// <summary>
    /// Calculate damage contributions for each player
    /// </summary>
    private static DamageContributionData CalculateDamageContributions(ReducerContext ctx, Spawn deadEnemy)
    {
        var playerDamageMap = new Dictionary<Identity, float>();
        float totalDamage = 0;

        // Aggregate damage by player
        foreach (var damageEvent in ctx.Db.EnemyDamageEvent.Iter())
        {
            if (damageEvent.spawn_id == deadEnemy.spawn_id && damageEvent.damage_amount > 0)
            {
                if (playerDamageMap.ContainsKey(damageEvent.player_identity))
                {
                    playerDamageMap[damageEvent.player_identity] += damageEvent.damage_amount;
                }
                else
                {
                    playerDamageMap[damageEvent.player_identity] = damageEvent.damage_amount;
                }
                totalDamage += damageEvent.damage_amount;
            }
        }

        // Convert to contribution list
        var contributions = playerDamageMap.Select(kvp => new PlayerContribution
        {
            PlayerIdentity = kvp.Key,
            DamageDealt = kvp.Value,
            ContributionPercentage = totalDamage > 0 ? kvp.Value / totalDamage : 0f
        }).ToList();

        return new DamageContributionData
        {
            TotalDamage = totalDamage,
            PlayerContributions = contributions
        };
    }

    /// <summary>
    /// Calculate experience gain based on contribution
    /// </summary>
    private static uint CalculateExpGain(uint baseExpReward, float contributionPercentage)
    {
        // Ensure at least 1 EXP is awarded for any contribution
        return (uint)Math.Max(1, Math.Round(baseExpReward * contributionPercentage));
    }

    /// <summary>
    /// Award experience to a player and handle level ups
    /// </summary>
    public static void AwardExperienceToPlayer(
        ReducerContext ctx,
        Player player,
        uint expGained,
        Spawn killedEnemy,
        float contributionPercentage,
        bool isSharedExp = false)
    {
        var levelUpResult = CalculateLevelUp(ctx, player, expGained);

        // Calculate new max stats if player leveled up
        float newMaxHp = player.max_hp;
        float newMaxMana = player.max_mana;
        float newCurrentHp = player.current_hp;
        float newCurrentMana = player.current_mana;
        
        if (levelUpResult.LevelsGained > 0)
        {
            // Look up job to get base stats for scaling
            var job = ctx.Db.Job.job_key.Find(player.job);
            if (job != null)
            {
                newMaxHp = PlayerConstants.CalculateMaxHpWithJob(levelUpResult.NewLevel, job.Value.health);
                newMaxMana = PlayerConstants.CalculateMaxManaWithJob(levelUpResult.NewLevel, job.Value.mana);
                // Restore to full health and mana on level up
                newCurrentHp = newMaxHp;
                newCurrentMana = newMaxMana;
            }
            else
            {
                // Fallback to old calculation if job not found
                Log.Warn($"Job {player.job} not found for level up calculations");
                newMaxHp = PlayerConstants.CalculateMaxHp(levelUpResult.NewLevel);
                newMaxMana = PlayerConstants.CalculateMaxMana(levelUpResult.NewLevel);
                newCurrentHp = newMaxHp;
                newCurrentMana = newMaxMana;
            }
        }
        
        // Update player with new level, experience, and restored health
        var updatedPlayer = player with
        {
            experience = levelUpResult.RemainingExp,
            level = levelUpResult.NewLevel,
            max_hp = newMaxHp,
            current_hp = newCurrentHp,
            max_mana = newMaxMana,
            current_mana = newCurrentMana
        };
        ctx.Db.Player.identity.Update(updatedPlayer);

        // Log level ups and check for leaderboard broadcast
        if (levelUpResult.LevelsGained > 0)
        {
            Log.Info($"🎉 Player {player.identity} leveled up! {player.level} -> {levelUpResult.NewLevel}");
            if (levelUpResult.ExpSpent > 0)
            {
                Log.Info($"   Spent {levelUpResult.ExpSpent} EXP on level ups, {levelUpResult.RemainingExp} EXP remaining");
            }
            
            // Check for job unlocks at new level
            CheckAndUnlockJobs(ctx, player.identity, levelUpResult.NewLevel);

            // Check if player is on the leaderboard
            var onLeaderboard = false;
            foreach (var leaderboardEntry in ctx.Db.Leaderboard.Iter())
            {
                if (leaderboardEntry.player_identity == player.identity)
                {
                    onLeaderboard = true;
                    break;
                }
            }

            // Broadcast if player is on leaderboard
            if (onLeaderboard)
            {
                var broadcastMessage = $"{player.name} has reached level {levelUpResult.NewLevel}!";
                var broadcast = new Broadcast
                {
                    message = broadcastMessage,
                    publish_dt = ctx.Timestamp
                };
                ctx.Db.Broadcast.Insert(broadcast);
                Log.Info($"Broadcast level up for leaderboard player: {broadcastMessage}");
            }
        }

        // Share experience with party members (only for direct damage contribution, not shared exp)
        if (!isSharedExp && expGained > 0)
        {
            // Find player's party membership
            var membership = ctx.Db.PartyMember.player_identity.Find(player.identity);
            if (membership != null)
            {
                // Get all other party members
                var partyMembers = ctx.Db.PartyMember.Iter()
                    .Where(m => m.party_id == membership.Value.party_id)
                    .Where(m => m.player_identity != player.identity); // Skip self
                
                foreach (var member in partyMembers)
                {
                    var memberPlayer = ctx.Db.Player.identity.Find(member.player_identity);
                    if (memberPlayer != null)
                    {
                        // Share the exact same expGained amount
                        AwardExperienceToPlayer(ctx, memberPlayer.Value, expGained, killedEnemy, 0f, true);
                    }
                }
            }
        }

        // Log differently for shared vs earned EXP
        if (isSharedExp)
        {
            Log.Info($"Player {player.identity} received {expGained} shared EXP from party member's kill of {killedEnemy.enemy} (Level {killedEnemy.level})");
        }
        else
        {
            Log.Info($"Player {player.identity} gained {expGained} EXP from {killedEnemy.enemy} (Level {killedEnemy.level}). " +
                    $"Contribution: {contributionPercentage:P1}, Total EXP: {player.experience} -> {player.experience + expGained}, Current: {levelUpResult.RemainingExp}");
        }
    }

    /// <summary>
    /// Calculate level ups based on experience gained
    /// </summary>
    private static LevelUpResult CalculateLevelUp(ReducerContext ctx, Player player, uint expGained)
    {
        var oldLevel = player.level;
        var oldExp = player.experience;
        var newExp = oldExp + expGained;
        uint totalExpSpent = 0;
        var newLevel = oldLevel;

        // Check for level ups
        while (true)
        {
            var nextLevelData = ctx.Db.PlayerLevel.level.Find(newLevel + 1);
            if (nextLevelData == null)
            {
                // No more levels defined
                break;
            }

            if (newExp >= nextLevelData.Value.exp_required)
            {
                // Subtract the experience required for this level
                newExp -= nextLevelData.Value.exp_required;
                totalExpSpent += nextLevelData.Value.exp_required;
                newLevel++;
            }
            else
            {
                break;
            }
        }

        return new LevelUpResult
        {
            NewLevel = newLevel,
            RemainingExp = newExp,
            ExpSpent = totalExpSpent,
            LevelsGained = newLevel - oldLevel
        };
    }
    
    /// <summary>
    /// Check and unlock jobs based on player's new level
    /// </summary>
    private static void CheckAndUnlockJobs(ReducerContext ctx, Identity playerIdentity, uint playerLevel)
    {
        // Get all jobs with unlock level requirements
        foreach (var job in ctx.Db.Job.Iter())
        {
            // Skip jobs that are already unlocked at level 0 (default unlocked)
            if (job.unlock_level == 0)
                continue;
                
            // Skip jobs with requirements higher than player's level
            if (job.unlock_level > playerLevel)
                continue;
                
            // Check if player already has this job unlocked
            var playerJob = ctx.Db.PlayerJob
                .Iter()
                .FirstOrDefault(pj => pj.player_identity == playerIdentity && pj.job_key == job.job_key);
                
            if (playerJob.player_identity == playerIdentity)
            {
                // Player has the job entry
                if (!playerJob.is_unlocked)
                {
                    // Unlock the job
                    ctx.Db.PlayerJob.player_job_id.Update(playerJob with
                    {
                        is_unlocked = true
                    });
                    Log.Info($"🔓 Job '{job.display_name}' unlocked for player {playerIdentity} at level {playerLevel}!");
                }
            }
            else
            {
                // Player doesn't have the job entry yet (shouldn't happen normally, but handle it)
                var newPlayerJob = new PlayerJob
                {
                    player_identity = playerIdentity,
                    job_key = job.job_key,
                    is_unlocked = true
                };
                ctx.Db.PlayerJob.Insert(newPlayerJob);
                Log.Info($"🔓 Job '{job.display_name}' unlocked for player {playerIdentity} at level {playerLevel} (created new entry)!");
            }
        }
    }

    #region Helper Classes

    private class DamageContributionData
    {
        public float TotalDamage { get; set; }
        public List<PlayerContribution> PlayerContributions { get; set; } = new List<PlayerContribution>();
    }

    private class PlayerContribution
    {
        public Identity PlayerIdentity { get; set; }
        public float DamageDealt { get; set; }
        public float ContributionPercentage { get; set; }
    }

    private class LevelUpResult
    {
        public uint NewLevel { get; set; }
        public uint RemainingExp { get; set; }
        public uint ExpSpent { get; set; }
        public uint LevelsGained { get; set; }
    }

    #endregion
    }
}