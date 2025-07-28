import { DbConnection } from '@/spacetime/client';
import { createLogger, type ModuleLogger } from '@/core/logger';

export interface TableMetrics {
  [tableName: string]: number;
}

export interface NetworkMetrics {
  totalRows: number;
  eventsPerSecond: number;
  lastEventTime: number;
}

export class DbMetricsTracker {
  private static instance: DbMetricsTracker | null = null;
  private tableMetrics: TableMetrics = {};
  private dbConnection: DbConnection | null = null;
  private logger: ModuleLogger = createLogger('DbMetricsTracker');

  // Event tracking
  private eventCount: number = 0;
  private lastEventTime: number = Date.now();
  private eventHistory: number[] = []; // Timestamps of recent events
  private readonly EVENT_HISTORY_WINDOW = 5000; // 5 second window

  private constructor() {}

  public static getInstance(): DbMetricsTracker {
    if (!DbMetricsTracker.instance) {
      DbMetricsTracker.instance = new DbMetricsTracker();
    }
    return DbMetricsTracker.instance;
  }

  public initialize(dbConnection: DbConnection): void {
    this.dbConnection = dbConnection;
    this.setupTableTracking();
  }

  private setupTableTracking(): void {
    if (!this.dbConnection?.db) {
      this.logger.error('No db connection available');
      return;
    }

    // Known tables in SpacetimeDB (from RemoteTables class)
    const tableNames = [
      'player',
      'enemy',
      'enemyDamageEvent',
      'playerDamageEvent',
      'job',
      'jobAttack',
      'jobPassive',
      'playerCooldown',
      'playerJob',
      'playerLevel',
      'playerMessage',
      'spawn',
      'spawnRoute',
      'cleanupDeadBodiesTimer',
      'combatTimeoutTimer',
      'enemyPatrolTimer',
      'messageCleanupTimer',
      'spawnEnemiesTimer',
    ];

    // Filter to only tables that actually exist
    const validTables = tableNames.filter((tableName) => {
      try {
        const table = (this.dbConnection!.db as any)[tableName];
        return table && typeof table.iter === 'function';
      } catch (e) {
        this.logger.warn(`Failed to validate table ${tableName}:`, e);
        return false;
      }
    });

    // Set up tracking for each table
    validTables.forEach((tableName) => {
      const table = (this.dbConnection!.db as any)[tableName];

      // Subscribe to table events
      if (table.onInsert) {
        table.onInsert(() => {
          this.recordEvent();
          this.updateTableCount(tableName);
        });
      }
      if (table.onUpdate) {
        table.onUpdate(() => {
          this.recordEvent();
          this.updateTableCount(tableName);
        });
      }
      if (table.onDelete) {
        table.onDelete(() => {
          this.recordEvent();
          this.updateTableCount(tableName);
        });
      }

      // Initial count
      this.updateTableCount(tableName);
    });
  }

  private updateTableCount(tableName: string): void {
    if (!this.dbConnection?.db) return;

    const table = (this.dbConnection.db as any)[tableName];
    if (table && table.iter) {
      // Count by iterating since count() might not exist
      let count = 0;
      for (const _ of table.iter()) {
        count++;
      }
      this.tableMetrics[tableName] = count;
    }
  }

  public getMetrics(): TableMetrics {
    return { ...this.tableMetrics };
  }

  public getTotalRows(): number {
    return Object.values(this.tableMetrics).reduce((sum, count) => sum + count, 0);
  }

  public getFormattedSummary(): string {
    const metrics = this.getMetrics();

    // Special handling for key tables
    const playerCount = metrics.player || 0;
    const enemyCount = metrics.enemy || 0;
    const damageEventCount = metrics.damageEvent || 0;

    // Build summary
    const parts = [`${playerCount}p`, `${enemyCount}e`];

    // Only show damage events if there are any
    if (damageEventCount > 0) {
      parts.push(`${damageEventCount}d`);
    }

    // Add other tables if they have significant counts
    Object.entries(metrics).forEach(([table, count]) => {
      if (!['player', 'enemy', 'damageEvent'].includes(table) && count > 0) {
        // Shorten table names for display
        const shortName = table.substring(0, 3);
        parts.push(`${count}${shortName}`);
      }
    });

    return parts.join(', ');
  }

  public isConnected(): boolean {
    return this.dbConnection !== null && Object.keys(this.tableMetrics).length > 0;
  }

  private recordEvent(): void {
    const now = Date.now();
    this.eventCount++;
    this.lastEventTime = now;
    this.eventHistory.push(now);

    // Clean up old events outside the window
    const cutoff = now - this.EVENT_HISTORY_WINDOW;
    this.eventHistory = this.eventHistory.filter((timestamp) => timestamp > cutoff);
  }

  public getEventsPerSecond(): number {
    const now = Date.now();
    const cutoff = now - this.EVENT_HISTORY_WINDOW;

    // Count events in the window
    const recentEvents = this.eventHistory.filter((timestamp) => timestamp > cutoff);

    // Calculate rate
    if (recentEvents.length === 0) return 0;

    const timeSpan = (now - recentEvents[0]) / 1000; // Convert to seconds
    return timeSpan > 0 ? recentEvents.length / timeSpan : 0;
  }

  public getNetworkMetrics(): NetworkMetrics {
    return {
      totalRows: this.getTotalRows(),
      eventsPerSecond: this.getEventsPerSecond(),
      lastEventTime: this.lastEventTime,
    };
  }

  public getNetworkSummary(): string {
    const metrics = this.getNetworkMetrics();
    const eps = metrics.eventsPerSecond.toFixed(1);

    if (metrics.eventsPerSecond > 0) {
      return `${metrics.totalRows} rows, ${eps} evt/s`;
    } else {
      return `${metrics.totalRows} rows`;
    }
  }
}
