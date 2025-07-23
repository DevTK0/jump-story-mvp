using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

// This is the main module entry point. All types, tables, and reducers are now organized in separate files:
// - Types/Enums.cs: PlayerState, DamageType, AttackType, FacingDirection
// - Types/Tables.cs: Player, Enemy, EnemyRoute, DamageEvent, CleanupDeadBodiesTimer
// - Types/DataTypes.cs: DbVector2, DbRect helper types
// - Reducers/PlayerReducers.cs: Connect, Disconnect, UpdatePlayerPosition, UpdatePlayerState, CleanupInactivePlayers, Init
// - Reducers/CombatReducers.cs: DamageEnemy
// - Reducers/EnemyReducers.cs: SpawnAllEnemies, InitializeEnemyRoutes
// - Reducers/MaintenanceReducers.cs: CleanupDeadBodies, Debug
// - Utils/GameLogic.cs: CalculateDamage and related helper functions

public static partial class Module
{
    // All module functionality is now organized in separate files
    // This file serves as the main entry point and can contain any shared utilities
    // that don't fit into the other categories
}