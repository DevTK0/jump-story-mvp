using SpacetimeDB;
using System.Linq;

public static partial class Module
{
    // Initialize a job with its base stats and resistances
    [Reducer]
    public static void InitializeJob(
        ReducerContext ctx,
        string adminApiKey,
        string jobKey,
        string displayName,
        uint health,
        uint moveSpeed,
        uint mana,
        float hpRecovery,
        float manaRecovery,
        int resSword,
        int resAxe,
        int resBow,
        int resSpear,
        int resDark,
        int resSpike,
        int resClaw,
        int resGreatsword,
        bool defaultUnlocked)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to initialize job from {ctx.Sender}");
            return;
        }
        // Check if job already exists
        var existingJob = ctx.Db.Job.job_key.Find(jobKey);
        if (existingJob != null)
        {
            Log.Info($"Job {jobKey} already exists, skipping initialization");
            return;
        }

        // Insert new job
        var job = new Job
        {
            job_key = jobKey,
            display_name = displayName,
            health = health,
            move_speed = moveSpeed,
            mana = mana,
            hp_recovery = hpRecovery,
            mana_recovery = manaRecovery,
            res_sword = resSword,
            res_axe = resAxe,
            res_bow = resBow,
            res_spear = resSpear,
            res_dark = resDark,
            res_spike = resSpike,
            res_claw = resClaw,
            res_greatsword = resGreatsword,
            default_unlocked = defaultUnlocked
        };

        ctx.Db.Job.Insert(job);
        Log.Info($"Initialized job: {jobKey} ({displayName})");
    }

    // Initialize an attack for a job
    [Reducer]
    public static void InitializeJobAttack(
        ReducerContext ctx,
        string adminApiKey,
        string jobKey,
        byte attackSlot,
        string attackType,
        string name,
        uint damage,
        uint cooldown,
        float critChance,
        uint knockback,
        uint range,
        byte hits,
        byte targets,
        uint manaCost,
        uint ammoCost,
        string modifiers,
        string? projectile,
        uint? areaRadius)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to initialize job attack from {ctx.Sender}");
            return;
        }
        // Find the job
        var job = ctx.Db.Job.job_key.Find(jobKey);
        if (job == null)
        {
            Log.Error($"Job {jobKey} not found when adding attack");
            return;
        }

        // Check if attack already exists for this job and slot
        JobAttack? existingAttack = null;
        foreach (var a in ctx.Db.JobAttack.Iter())
        {
            if (a.job_id == job.Value.job_id && a.attack_slot == attackSlot)
            {
                existingAttack = a;
                break;
            }
        }
            
        if (existingAttack != null)
        {
            Log.Info($"Attack slot {attackSlot} for job {jobKey} already exists, skipping");
            return;
        }

        // Insert new attack
        var attack = new JobAttack
        {
            job_id = job.Value.job_id,
            attack_slot = attackSlot,
            attack_type = attackType,
            name = name,
            damage = damage,
            cooldown = cooldown,
            crit_chance = critChance,
            knockback = knockback,
            range = range,
            hits = hits,
            targets = targets,
            mana_cost = manaCost,
            ammo_cost = ammoCost,
            modifiers = modifiers,
            projectile = projectile,
            area_radius = areaRadius
        };

        ctx.Db.JobAttack.Insert(attack);
        Log.Info($"Initialized attack '{name}' for job {jobKey}");
    }

    // Initialize a passive for a job
    [Reducer]
    public static void InitializeJobPassive(
        ReducerContext ctx,
        string adminApiKey,
        string jobKey,
        byte passiveSlot,
        string name)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to initialize job passive from {ctx.Sender}");
            return;
        }
        // Find the job
        var job = ctx.Db.Job.job_key.Find(jobKey);
        if (job == null)
        {
            Log.Error($"Job {jobKey} not found when adding passive");
            return;
        }

        // Check if passive already exists for this job and slot
        JobPassive? existingPassive = null;
        foreach (var p in ctx.Db.JobPassive.Iter())
        {
            if (p.job_id == job.Value.job_id && p.passive_slot == passiveSlot)
            {
                existingPassive = p;
                break;
            }
        }
            
        if (existingPassive != null)
        {
            Log.Info($"Passive slot {passiveSlot} for job {jobKey} already exists, skipping");
            return;
        }

        // Insert new passive
        var passive = new JobPassive
        {
            job_id = job.Value.job_id,
            passive_slot = passiveSlot,
            name = name
        };

        ctx.Db.JobPassive.Insert(passive);
        Log.Info($"Initialized passive '{name}' for job {jobKey}");
    }

    // Clear all job data (useful for development/testing)
    [Reducer]
    public static void ClearAllJobData(ReducerContext ctx, string adminApiKey)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to clear job data from {ctx.Sender}");
            return;
        }
        // Delete all passives first (foreign key constraint)
        foreach (var passive in ctx.Db.JobPassive.Iter())
        {
            ctx.Db.JobPassive.passive_id.Delete(passive.passive_id);
        }

        // Delete all attacks
        foreach (var attack in ctx.Db.JobAttack.Iter())
        {
            ctx.Db.JobAttack.attack_id.Delete(attack.attack_id);
        }

        // Delete all jobs
        foreach (var job in ctx.Db.Job.Iter())
        {
            ctx.Db.Job.job_id.Delete(job.job_id);
        }

        Log.Info("Cleared all job data");
    }
}