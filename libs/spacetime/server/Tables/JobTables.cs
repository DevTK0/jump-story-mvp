using SpacetimeDB;

public static partial class Module
{
    // Main Job table storing base stats
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
        
        // Level required to unlock this job (0 = unlocked by default)
        public uint unlock_level;
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
        public uint mana_leech; // Mana restored per enemy hit by this attack
        public uint hp_leech; // HP restored per enemy hit by this attack
        
        // Optional field for projectile attacks
        public string? projectile; // Sprite key for projectile visual
        
        // Optional field for skill visual effects
        public string? skill_effect; // VFX sprite key for on-hit effects
        
        // Optional field for area attacks
        public uint? area_radius;
    }
}