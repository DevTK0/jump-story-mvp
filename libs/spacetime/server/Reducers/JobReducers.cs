using SpacetimeDB;
using System.Linq;

public static partial class Module
{
    // Initialize a job with its base stats
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
        uint unlockLevel)
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
            unlock_level = unlockLevel
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
        uint manaLeech,
        uint hpLeech,
        string? projectile,
        string? skillEffect,
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
            mana_leech = manaLeech,
            hp_leech = hpLeech,
            projectile = projectile,
            skill_effect = skillEffect,
            area_radius = areaRadius
        };

        ctx.Db.JobAttack.Insert(attack);
        Log.Info($"Initialized attack '{name}' for job {jobKey}");
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