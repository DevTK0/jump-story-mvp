public static partial class Module
{
    private static (float finalDamage, DamageType type) CalculateDamage(AttackType attackType, string enemyType)
    {
        // Get base damage from attack type
        float baseDamage = attackType switch
        {
            AttackType.Attack1 => 25f,   // Quick slash
            AttackType.Attack2 => 40f,  // Heavy strike  
            AttackType.Attack3 => 30f,  // Combo attack
            _ => 0f
        };

        // 10% chance to crit, otherwise normal damage
        var random = new Random();
        if (random.NextDouble() < 0.1) // 10% crit chance
        {
            return (baseDamage * 2.0f, DamageType.Crit);
        }
        else
        {
            return (baseDamage, DamageType.Normal);
        }
    }
}