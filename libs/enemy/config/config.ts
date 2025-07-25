// Enemy configuration
export const ENEMY_CONFIG = {
  properties: {
    size: 16,
    speed: 80,
    maxSpeed: 120,
    trackingRange: 300,
  },
  spawning: {
    margin: 50,
    maxCount: 5,
    interval: 3000,
    initialDelay: 1000,
    initialCount: 3,
  },
  visual: {
    color: 0xff4444,
  },
  physics: {
    drag: 50,
    bounce: 0.8,
  },
} as const;
