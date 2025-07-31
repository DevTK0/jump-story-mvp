using SpacetimeDB;

[Type]
public enum AiBehavior : byte
{
    Patrol,      // Basic back-and-forth movement
    Aggressive,  // Actively seeks and chases players
}

[Type]
public enum EnemyType : byte
{
    Regular,     // Normal enemy
    Boss,        // Boss enemy
}

public static partial class Module
{
    [Table(Name = "Spawn", Public = true)]
    public partial struct Spawn
    {
        [PrimaryKey, AutoInc]
        public uint spawn_id;
        public uint route_id;
        public string enemy; // References Enemy.name or Boss.boss_id
        public float x;
        public float y;
        public PlayerState state;
        public FacingDirection facing;
        public float current_hp;
        public float max_hp; // Max HP (for bosses especially)
        public uint level; // Enemy level for EXP calculation
        public Timestamp last_updated;
        public bool moving_right; // Direction for patrol behavior
        public Identity? aggro_target; // Player being chased (null if not in aggro)
        public Timestamp spawn_time; // When entity spawned
        public EnemyType enemy_type; // Regular enemy or boss
    }
    
    [Table(Name = "SpawnRoute", Public = true)]
    public partial struct SpawnRoute
    {
        [PrimaryKey, AutoInc]
        public uint route_id;
        public string enemy; // References Enemy.name
        public DbRect spawn_area;
        public byte max_enemies;
        public uint spawn_interval;
        public Timestamp last_spawn_time;
    }

    [Table(Name = "Enemy", Public = true)]
    public partial struct Enemy
    {
        [PrimaryKey]
        public string name;          // Enemy type name (e.g., "orc", "goblin")
        public uint level;           // Enemy level for scaling
        public uint exp_reward;      // Experience points awarded on kill
        public float health;         // Base health points
        public float move_speed;     // Movement speed in pixels per second
        public float damage;         // Base damage dealt to players
        public AiBehavior ai_behavior; // AI behavior pattern
        public float attack_range;   // Distance from which enemy can attack
        public float aggro_range;    // Distance at which enemy detects and pursues players
    }
    
    [Table(Name = "BossTrigger", Public = true)]
    public partial struct BossTrigger
    {
        [PrimaryKey]
        public string enemy_type;     // Enemy type to track kills for (e.g., "orc")
        public string boss_to_spawn;  // Boss type to spawn (e.g., "orc-rider")
        public uint current_kills;    // Current kill count
        public uint required_kills;   // Number of kills required to spawn boss
        public bool active;           // Whether this trigger is currently active
    }
}