using SpacetimeDB;

[Type]
public enum AiBehavior : byte
{
    Patrol,      // Basic back-and-forth movement
    Aggressive,  // Actively seeks and chases players
}

public static partial class Module
{
    [Table(Name = "Spawn", Public = true)]
    public partial struct Spawn
    {
        [PrimaryKey, AutoInc]
        public uint spawn_id;
        public uint route_id;
        public string enemy; // References Enemy.name
        public float x;
        public float y;
        public PlayerState state;
        public FacingDirection facing;
        public float current_hp;
        public uint level; // Enemy level for EXP calculation
        public Timestamp last_updated;
        public bool moving_right; // Direction for patrol behavior
        public Identity? aggro_target; // Player being chased (null if not in aggro)
        public Timestamp aggro_start_time; // When aggro started
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
    }
}