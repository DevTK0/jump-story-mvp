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
    public static void AwardExperienceForKill(ReducerContext ctx, Enemy deadEnemy)
    {
        // Get enemy config for base EXP reward
        var enemyConfig = ctx.Db.EnemyConfig.enemy_type.Find(deadEnemy.enemy_type);
        if (enemyConfig == null)
        {
            Log.Warn($"Cannot award EXP - no config found for enemy type: {deadEnemy.enemy_type}");
            return;
        }

        // Calculate damage contributions
        var contributionData = CalculateDamageContributions(ctx, deadEnemy);
        if (contributionData.TotalDamage == 0 || contributionData.PlayerContributions.Count == 0)
        {
            Log.Warn($"No damage contributors found for killed enemy {deadEnemy.enemy_id}");
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
    private static DamageContributionData CalculateDamageContributions(ReducerContext ctx, Enemy deadEnemy)
    {
        var playerDamageMap = new Dictionary<Identity, float>();
        float totalDamage = 0;

        // Aggregate damage by player
        foreach (var damageEvent in ctx.Db.EnemyDamageEvent.Iter())
        {
            if (damageEvent.enemy_id == deadEnemy.enemy_id && damageEvent.damage_amount > 0)
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
        Enemy killedEnemy,
        float contributionPercentage)
    {
        var levelUpResult = CalculateLevelUp(ctx, player, expGained);

        // Update player with new level and experience
        var updatedPlayer = player with
        {
            experience = levelUpResult.RemainingExp,
            level = levelUpResult.NewLevel
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

        Log.Info($"Player {player.identity} gained {expGained} EXP from {killedEnemy.enemy_type} (Level {killedEnemy.level}). " +
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
            var nextLevelData = ctx.Db.PlayerLevelingConfig.level.Find(newLevel + 1);
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