/**
 * Proximity subscription configuration for networked entities
 */
export const PROXIMITY_CONFIG = {
  enemy: {
    defaultRadius: 700,
    defaultUpdateInterval: 1000,
  },
  peer: {
    defaultRadius: 700,
    defaultUpdateInterval: 1000,
  },
  boss: {
    defaultRadius: 400, // Proximity radius for bosses
    defaultUpdateInterval: 1000,
  },
} as const;
