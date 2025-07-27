/**
 * Utilities for safe SpaceTimeDB subscription queries
 */

/**
 * Safely escape numeric values for SQL queries
 * @param value The numeric value to escape
 * @returns The escaped value as a string
 */
export function escapeNumeric(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error('Invalid numeric value for SQL query');
  }
  return value.toString();
}

/**
 * Safely escape hex string values (like identities) for SQL queries
 * @param hexString The hex string to escape (without 0x prefix)
 * @returns The escaped hex string with x'' format
 */
export function escapeHexString(hexString: string): string {
  // Validate hex string contains only valid hex characters
  if (!/^[0-9a-fA-F]+$/.test(hexString)) {
    throw new Error('Invalid hex string for SQL query');
  }
  return `x'${hexString}'`;
}

/**
 * Build a safe proximity query for SpaceTimeDB subscriptions
 * @param tableName The table to query
 * @param centerX X coordinate of the center point
 * @param centerY Y coordinate of the center point
 * @param radius The radius for proximity
 * @param excludeIdentity Optional identity to exclude from results
 * @returns A safe SQL query string
 */
export function buildProximityQuery(
  tableName: string,
  centerX: number,
  centerY: number,
  radius: number,
  excludeIdentity?: string
): string {
  // Validate table name to prevent injection
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error('Invalid table name');
  }

  const minX = escapeNumeric(centerX - radius);
  const maxX = escapeNumeric(centerX + radius);
  const minY = escapeNumeric(centerY - radius);
  const maxY = escapeNumeric(centerY + radius);

  let query = `SELECT * FROM ${tableName} WHERE x >= ${minX} AND x <= ${maxX} AND y >= ${minY} AND y <= ${maxY}`;

  if (excludeIdentity) {
    query += ` AND identity != ${escapeHexString(excludeIdentity)}`;
  }

  return query;
}

/**
 * Build a safe identity-specific query
 * @param tableName The table to query
 * @param identity The identity to query for
 * @returns A safe SQL query string
 */
export function buildIdentityQuery(tableName: string, identity: string): string {
  // Validate table name to prevent injection
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error('Invalid table name');
  }

  return `SELECT * FROM ${tableName} WHERE identity = ${escapeHexString(identity)}`;
}

/**
 * Configuration for proximity-based subscriptions
 */
export interface ProximitySubscriptionConfig {
  /** The table to subscribe to */
  tableName: string;
  /** Distance around center point to subscribe (in pixels) */
  radius: number;
  /** How often to update the subscription (in milliseconds) */
  updateInterval: number;
  /** Minimum distance to move before updating subscription */
  moveThreshold: number;
}

/**
 * Default proximity configurations for different entity types
 */
export const DEFAULT_PROXIMITY_CONFIGS = {
  enemies: {
    tableName: 'Enemy',
    radius: 2000,
    updateInterval: 5000,
    moveThreshold: 500,
  },
  peers: {
    tableName: 'Player',
    radius: 1500,
    updateInterval: 5000,
    moveThreshold: 375, // 25% of radius
  },
  messages: {
    tableName: 'PlayerMessage',
    radius: 1500,
    updateInterval: 10000,
    moveThreshold: 375,
  },
} as const;