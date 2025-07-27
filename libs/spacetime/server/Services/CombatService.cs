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
            if (!player.in_combat)
            {
                Log.Info($"Player {player.identity} entering combat");
            }

            ctx.Db.Player.identity.Update(player with
            {
                in_combat = true,
                last_combat_time = ctx.Timestamp
            });
        }

        /// <summary>
        /// Removes a player from combat state
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