using SpacetimeDB;

// Main Job table storing base stats and resistances
[Table]
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
}

// JobAttack table storing all attacks for each job
[Table]
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
    
    // Optional fields for projectile attacks
    public uint? projectile_speed;
    public uint? projectile_size;
    
    // Optional field for area attacks
    public uint? area_radius;
}

// JobPassive table storing passive abilities
[Table]
public partial struct JobPassive
{
    [PrimaryKey]
    [AutoInc]
    public uint passive_id;
    
    public uint job_id; // Foreign key to Job
    public byte passive_slot; // 1 for now, but extensible
    public string name;
}