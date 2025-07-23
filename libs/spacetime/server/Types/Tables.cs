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
        public DbVector2 position;
        public PlayerState state;
        public FacingDirection facing;
        public Timestamp last_active;
    }

    [Table(Name = "EnemyRoute", Public = true)]
    public partial struct EnemyRoute
    {
        [PrimaryKey, AutoInc]
        public uint route_id;
        public string enemy_type;
        public DbRect spawn_area;
        public byte max_enemies;
    }

    [Table(Name = "Enemy", Public = true)]
    public partial struct Enemy
    {
        [PrimaryKey, AutoInc]
        public uint enemy_id;
        public uint route_id;
        public string enemy_type;
        public DbVector2 position;
        public PlayerState state;
        public FacingDirection facing;
        public float current_hp;
        public Timestamp last_updated;
    }

    [Table(Name = "DamageEvent", Public = true)]
    public partial struct DamageEvent
    {
        [PrimaryKey, AutoInc]
        public uint damage_event_id;
        public uint enemy_id;
        public Identity player_identity;
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
}