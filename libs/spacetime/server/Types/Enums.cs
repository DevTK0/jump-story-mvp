using SpacetimeDB;

public static partial class Module
{
    [SpacetimeDB.Type]
    public enum PlayerState : byte
    {
        Idle,
        Walk,
        Attack1,
        Attack2,
        Attack3,
        Climbing,
        Damaged,
        Dead,
        Unknown
    }

    [SpacetimeDB.Type]
    public enum FacingDirection : byte
    {
        Left,
        Right
    }

    [SpacetimeDB.Type]
    public enum DamageType : byte
    {
        Weak,
        Strong,
        Crit,
        Normal,
        Immune
    }

    [SpacetimeDB.Type]
    public enum AttackType : byte
    {
        Attack1,
        Attack2,
        Attack3
    }
}