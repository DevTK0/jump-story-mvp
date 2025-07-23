using SpacetimeDB;

public static partial class Module
{
    [SpacetimeDB.Type]
    public partial struct DbVector2
    {
        public float x;
        public float y;

        public DbVector2(float x, float y)
        {
            this.x = x;
            this.y = y;
        }
    }

    [SpacetimeDB.Type]
    public partial struct DbRect
    {
        public DbVector2 position;
        public DbVector2 size;

        public DbRect(DbVector2 position, DbVector2 size)
        {
            this.position = position;
            this.size = size;
        }

        public DbVector2 GetRandomPoint(Random random)
        {
            var randomX = position.x + (float)random.NextDouble() * size.x;
            var y = position.y; // Use fixed y coordinate, don't randomize
            return new DbVector2(randomX, y);
        }
    }
}