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
        // Get enemy config for base EXP reward
        var enemyConfig = ctx.Db.EnemyConfig.enemy_type.Find(deadEnemy.enemy);
        if (enemyConfig == null)
        {
            Log.Warn($"Cannot award EXP - no config found for enemy type: {deadEnemy.enemy}");
            return;
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
                enemyConfig.Value.base_exp_reward,
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
        float contributionPercentage)
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

        // Log level ups
        if (levelUpResult.LevelsGained > 0)
        {
            Log.Info($"🎉 Player {player.identity} leveled up! {player.level} -> {levelUpResult.NewLevel}");
            if (levelUpResult.ExpSpent > 0)
            {
                Log.Info($"   Spent {levelUpResult.ExpSpent} EXP on level ups, {levelUpResult.RemainingExp} EXP remaining");
            }
        }

        Log.Info($"Player {player.identity} gained {expGained} EXP from {killedEnemy.enemy} (Level {killedEnemy.level}). " +
                $"Contribution: {contributionPercentage:P1}, Total EXP: {player.experience} -> {player.experience + expGained}, Current: {levelUpResult.RemainingExp}");
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