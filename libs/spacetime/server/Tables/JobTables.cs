using SpacetimeDB;

public static partial class Module
{
    // Main Job table storing base stats and resistances
    [Table(Name = "Job", Public = true)]
    public partial struct Job
    {
        [PrimaryKey]
        [AutoInc]
        public uint job_id;
        
        [Unique]
        public string job_key; // e.g., "soldier", "knight", "wizard"
        
        public string display_name;
        public uint health;
        public uint move_speed;
        public uint mana;
        public float hp_recovery;
        public float mana_recovery;
        
        // Resistances
        public int res_sword;
        public int res_axe;
        public int res_bow;
        public int res_spear;
        public int res_dark;
        public int res_spike;
        public int res_claw;
        public int res_greatsword;
        
        // Default unlock state
        public bool default_unlocked;
    }

    // JobAttack table storing all attacks for each job
    [Table(Name = "JobAttack", Public = true)]
    public partial struct JobAttack
    {
        [PrimaryKey]
        [AutoInc]
        public uint attack_id;
        
        public uint job_id; // Foreign key to Job
        public byte attack_slot; // 1, 2, or 3
        public string attack_type; // "standard", "projectile", "area"
        public string name;
        public uint damage;
        public uint cooldown;
        public float crit_chance;
        public uint knockback;
        public uint range;
        public byte hits;
        public byte targets;
        public uint mana_cost;
        public uint ammo_cost;
        public string modifiers; // comma-separated, e.g., "sword,greatsword"
        
        // Optional field for projectile attacks
        public string? projectile; // Sprite key for projectile visual
        
        // Optional field for skill visual effects
        public string? skill_effect; // VFX sprite key for on-hit effects
        
        // Optional field for area attacks
        public uint? area_radius;
    }

    // JobPassive table storing passive abilities
    [Table(Name = "JobPassive", Public = true)]
    public partial struct JobPassive
    {
        [PrimaryKey]
        [AutoInc]
        public uint passive_id;
        
        public uint job_id; // Foreign key to Job
        public byte passive_slot; // 1 for now, but extensible
        public string name;
    }
}