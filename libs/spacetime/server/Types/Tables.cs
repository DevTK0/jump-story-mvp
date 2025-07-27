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

    [Table(Name = "EnemyConfig", Public = true)]
    public partial struct EnemyConfig
    {
        [PrimaryKey]
        public string enemy_type;
        public float max_hp;
        public uint level;
        public string behavior; // patrol, aggressive
        public uint base_exp_reward;
        public uint movement_speed;
        public uint damage;
        public uint attack_range;
        public uint aggro_range;
    }

    [Table(Name = "PlayerLevelingConfig", Public = true)]
    public partial struct PlayerLevelingConfig
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

    [Table(Name = "PlayerCooldown", Public = true)]
    public partial struct PlayerCooldown
    {
        [PrimaryKey]
        public Identity player_identity;
        public string job; // Current job of the player
        public Timestamp attack1_last_used; // When attack1 was last used
        public Timestamp attack2_last_used; // When attack2 was last used
        public Timestamp attack3_last_used; // When attack3 was last used
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

}