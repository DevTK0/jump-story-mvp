using SpacetimeDB;
using System;

public static partial class Module
{
    public static class CombatService
    {
        // Time after which a player automatically exits combat
        private static readonly TimeSpan COMBAT_TIMEOUT = TimeSpan.FromSeconds(5);

        /// <summary>
        /// Puts a player into combat state
        /// </summary>
        public static void EnterCombat(ReducerContext ctx, Player player)
        {
            Log.Info($"[COMBAT DEBUG] EnterCombat called for player {player.identity}, current in_combat: {player.in_combat}");
            
            if (!player.in_combat)
            {
                Log.Info($"Player {player.identity} entering combat");
            }

            var updatedPlayer = player with
            {
                in_combat = true,
                last_combat_time = ctx.Timestamp
            };
            
            ctx.Db.Player.identity.Update(updatedPlayer);
            Log.Info($"[COMBAT DEBUG] Player {player.identity} combat state updated to: {updatedPlayer.in_combat}");
        }

        /// <summary>
        /// Removes a player from combat state and triggers health/mana regeneration
        /// </summary>
        public static void ExitCombat(ReducerContext ctx, Player player)
        {
            if (player.in_combat)
            {
                Log.Info($"Player {player.identity} exiting combat");
                
                ctx.Db.Player.identity.Update(player with
                {
                    in_combat = false
                });

                // Trigger health and mana regeneration
                Module.RegenHealthMana(ctx, player.identity);
            }
        }

        /// <summary>
        /// Checks if a player should exit combat due to timeout
        /// </summary>
        public static void CheckCombatTimeout(ReducerContext ctx, Player player)
        {
            if (!player.in_combat)
            {
                return;
            }

            var combatTimeoutThreshold = ctx.Timestamp - COMBAT_TIMEOUT;
            
            if (player.last_combat_time < combatTimeoutThreshold)
            {
                Log.Info($"Player {player.identity} combat timeout - exiting combat");
                ExitCombat(ctx, player);
            }
        }

        /// <summary>
        /// Checks all players for combat timeout
        /// </summary>
        public static void CheckAllPlayersCombatTimeout(ReducerContext ctx)
        {
            foreach (var player in ctx.Db.Player.Iter())
            {
                if (player.in_combat)
                {
                    CheckCombatTimeout(ctx, player);
                }
            }
        }
    }
}