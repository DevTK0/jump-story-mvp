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

    [Table(Name = "BossAttack", Public = true)]
    public partial struct BossAttack
    {
        [PrimaryKey, AutoInc]
        public uint attack_id;
        public string boss_id;           // Which boss this attack belongs to
        public byte attack_slot;         // 1, 2, or 3 (attack1, attack2, attack3)
        public float damage;             // Base damage
        public float range;              // Attack range
        public float cooldown;           // Seconds between uses
        public uint knockback;           // Knockback distance
        public byte hits;                // Number of hits
        public string attack_type;       // "directional", "area", "summon"
        public string? projectile;       // Projectile sprite (if ranged)
        public string? skill_effect;     // Visual effect on hit
        public int animation_duration;   // Animation duration in milliseconds
    }

    [Table(Name = "BossAttackState", Public = true)]
    public partial struct BossAttackState
    {
        [PrimaryKey]
        public uint spawn_id;            // Boss spawn instance
        public uint attack_id;           // Which attack
        public Timestamp last_used;      // When last used
    }
}