using SpacetimeDB;

public static partial class Module
{
    [Table(Name = "Player", Public = true)]
    public partial struct Player
    {
        [PrimaryKey]
        public Identity identity;
        [Unique, AutoInc]
        public uint player_id;
        public string name;
        public float x;
        public float y;
        public PlayerState state;
        public FacingDirection facing;
        public Timestamp last_active;
        public float current_hp;
        public float max_hp;
        public float current_mana;
        public float max_mana;
        public uint level;
        public uint experience;
        public bool is_typing;
        public string job; // Job key like "soldier", "knight", etc.
        public bool in_combat; // Whether player is currently in combat
        public Timestamp last_combat_time; // When player last entered combat or attacked/was attacked
        public bool is_online; // Whether player is currently online
        public bool ban_status; // Whether player is banned from the game
    }

    [Table(Name = "EnemyDamageEvent", Public = true)]
    public partial struct EnemyDamageEvent
    {
        [PrimaryKey, AutoInc]
        public uint damage_event_id;
        public uint spawn_id;
        public Identity player_identity;
        public float damage_amount;
        public DamageType damage_type;
        public string? projectile; // Projectile sprite key for ranged attacks
        public string? skill_effect; // VFX to play on enemy when hit
        public Timestamp timestamp;
    }

    [Table(Name = "PlayerDamageEvent", Public = true)]
    public partial struct PlayerDamageEvent
    {
        [PrimaryKey, AutoInc]
        public uint damage_event_id;
        public Identity player_identity;
        public uint spawn_id; // The spawn that caused the damage
        public float damage_amount;
        public DamageType damage_type;
        public string? projectile; // Projectile sprite key for ranged attacks
        public string? skill_effect; // VFX to play on player when hit
        public Timestamp timestamp;
    }

    [Table(Name = "cleanup_dead_bodies_timer", Scheduled = nameof(CleanupDeadBodies), ScheduledAt = nameof(scheduled_at))]
    public partial struct CleanupDeadBodiesTimer
    {
        [PrimaryKey, AutoInc]
        public ulong scheduled_id;
        public ScheduleAt scheduled_at;
    }

    [Table(Name = "spawn_enemies_timer", Scheduled = nameof(SpawnMissingEnemies), ScheduledAt = nameof(scheduled_at))]
    public partial struct SpawnEnemiesTimer
    {
        [PrimaryKey, AutoInc]
        public ulong scheduled_id;
        public ScheduleAt scheduled_at;
    }

    [Table(Name = "enemy_patrol_timer", Scheduled = nameof(UpdateEnemyPatrol), ScheduledAt = nameof(scheduled_at))]
    public partial struct EnemyPatrolTimer
    {
        [PrimaryKey, AutoInc]
        public ulong scheduled_id;
        public ScheduleAt scheduled_at;
    }

    [Table(Name = "boss_action_timer", Scheduled = nameof(UpdateBossActions), ScheduledAt = nameof(scheduled_at))]
    public partial struct BossActionTimer
    {
        [PrimaryKey, AutoInc]
        public ulong scheduled_id;
        public ScheduleAt scheduled_at;
    }
    
    [Table(Name = "message_cleanup_timer", Scheduled = nameof(CleanupOldMessages), ScheduledAt = nameof(scheduled_at))]
    public partial struct MessageCleanupTimer
    {
        [PrimaryKey, AutoInc]
        public ulong scheduled_id;
        public ScheduleAt scheduled_at;
    }

    [Table(Name = "combat_timeout_timer", Scheduled = nameof(CheckCombatTimeouts), ScheduledAt = nameof(scheduled_at))]
    public partial struct CombatTimeoutTimer
    {
        [PrimaryKey, AutoInc]
        public ulong scheduled_id;
        public ScheduleAt scheduled_at;
    }


    [Table(Name = "PlayerLevel", Public = true)]
    public partial struct PlayerLevel
    {
        [PrimaryKey]
        public uint level;
        public uint exp_required; // Total EXP required to reach this level from level 1
    }

    [Table(Name = "PlayerMessage", Public = true)]
    public partial struct PlayerMessage
    {
        [PrimaryKey, AutoInc]
        public uint message_id;
        public Identity player_id;
        public MessageType message_type;
        public string message;
        public Timestamp sent_dt;
    }

    [Table(Name = "PlayerJob", Public = true)]
    public partial struct PlayerJob
    {
        [PrimaryKey, AutoInc]
        public uint player_job_id;
        public Identity player_identity;
        public string job_key;
        public bool is_unlocked;
    }

    [Table(Name = "Leaderboard", Public = true)]
    public partial struct Leaderboard
    {
        [PrimaryKey]
        public uint rank; // 1-10
        public Identity player_identity;
        public string player_name;
        public uint level;
        public uint experience;
        public string job_name; // Display name of the job
        public Timestamp last_updated;
    }

    [Table(Name = "leaderboard_update_timer", Scheduled = nameof(UpdateLeaderboard), ScheduledAt = nameof(scheduled_at))]
    public partial struct LeaderboardUpdateTimer
    {
        [PrimaryKey, AutoInc]
        public ulong scheduled_id;
        public ScheduleAt scheduled_at;
    }

    [Table(Name = "Broadcast", Public = true)]
    public partial struct Broadcast
    {
        [PrimaryKey, AutoInc]
        public uint broadcast_id;
        public string message;
        public Timestamp publish_dt;
    }

    [Table(Name = "broadcast_cleanup_timer", Scheduled = nameof(CleanupOldBroadcasts), ScheduledAt = nameof(scheduled_at))]
    public partial struct BroadcastCleanupTimer
    {
        [PrimaryKey, AutoInc]
        public ulong scheduled_id;
        public ScheduleAt scheduled_at;
    }

    [Table(Name = "Teleport", Public = true)]
    public partial struct Teleport
    {
        [PrimaryKey]
        public string location_name;
        public float x;
        public float y;
    }

    [Table(Name = "PlayerTeleport", Public = true)]
    public partial struct PlayerTeleport
    {
        [PrimaryKey, AutoInc]
        public uint player_teleport_id;
        public Identity player_identity;
        public string location_name;
        public bool is_unlocked;
    }
}