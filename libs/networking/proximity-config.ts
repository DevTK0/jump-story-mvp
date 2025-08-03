/**
 * Proximity subscription configuration for networked entities
 */
export const PROXIMITY_CONFIG = {
  enemy: {
    defaultRadius: 1200,
    defaultUpdateInterval: 1000,
  },
  peer: {
    defaultRadius: 1200,
    defaultUpdateInterval: 1000,
  },
  boss: {
    defaultRadius: 1200, // Proximity radius for bosses
    defaultUpdateInterval: 1000,
  },
} as const;
