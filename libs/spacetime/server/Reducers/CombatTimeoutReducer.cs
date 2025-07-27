using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void CheckCombatTimeouts(ReducerContext ctx, CombatTimeoutTimer timer)
    {
        CombatService.CheckAllPlayersCombatTimeout(ctx);
    }
}