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

    // BossSpawn table removed - now using unified Spawn table with enemy_type field

    [Table(Name = "BossRoute", Public = true)]
    public partial struct BossRoute
    {
        [PrimaryKey, AutoInc]
        public uint route_id;
        public string boss_id;           // References Boss.boss_id
        public DbRect spawn_area;        // Where boss can spawn
    }

    // BossDamageEvent table removed - now using unified EnemyDamageEvent table for both enemies and bosses

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