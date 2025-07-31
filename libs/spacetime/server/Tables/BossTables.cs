using SpacetimeDB;

public static partial class Module
{
    [Table(Name = "Boss", Public = true)]
    public partial struct Boss
    {
        [PrimaryKey]
        public string boss_id;           // e.g., "goblin_king", "dragon_lord"
        public string display_name;      // "Goblin King Grukk"
        public float base_health;        // Base HP (will be scaled by level)
        public float base_damage;        // Base damage (will be scaled)
        public uint level;               // Boss level
        public uint exp_reward;          // Base experience reward
        public float move_speed;         // Movement speed
        public AiBehavior ai_behavior;   // Reuse enemy AI behaviors
        public float attack_range;       // Melee attack range
        public float aggro_range;        // Detection range
        
    }

    [Table(Name = "BossSpawn", Public = true)]
    public partial struct BossSpawn
    {
        [PrimaryKey, AutoInc]
        public uint boss_spawn_id;
        public uint route_id;            // References BossRoute.route_id
        public string boss_id;           // References Boss.boss_id
        public float x;
        public float y;
        public PlayerState state;        // Reuse player states
        public FacingDirection facing;
        public float current_hp;
        public float max_hp;             // Calculated from base_health
        public Timestamp spawn_time;
        public Timestamp last_updated;
        public Identity? current_target;      // Current attack target
    }

    [Table(Name = "BossRoute", Public = true)]
    public partial struct BossRoute
    {
        [PrimaryKey, AutoInc]
        public uint route_id;
        public string boss_id;           // References Boss.boss_id
        public DbRect spawn_area;        // Where boss can spawn
    }

    [Table(Name = "BossDamageEvent", Public = true)]
    public partial struct BossDamageEvent
    {
        [PrimaryKey, AutoInc]
        public uint damage_event_id;
        public uint boss_spawn_id;       // The boss instance
        public Identity player_identity; // Player who dealt damage
        public float damage_amount;
        public DamageType damage_type;   // Reuse existing damage types
        public string? projectile;       // Projectile sprite key
        public string? skill_effect;     // VFX to play
        public AttackType attack_type;   // Which player attack was used
        public Timestamp timestamp;
        
    }

    // Timer for boss attack processing
    // [Table(Name = "boss_attack_timer", Scheduled = nameof(ProcessBossAttacks), ScheduledAt = nameof(scheduled_at))]
    // public partial struct BossAttackTimer
    // {
    //     [PrimaryKey, AutoInc]
    //     public ulong scheduled_id;
    //     public ScheduleAt scheduled_at;
    // }

    // // Timer for boss respawning
    // [Table(Name = "boss_respawn_timer", Scheduled = nameof(CheckBossRespawns), ScheduledAt = nameof(scheduled_at))]
    // public partial struct BossRespawnTimer
    // {
    //     [PrimaryKey, AutoInc]
    //     public ulong scheduled_id;
    //     public ScheduleAt scheduled_at;
    // }
}