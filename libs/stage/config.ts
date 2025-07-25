// Stage configuration
export const STAGE_CONFIG = {
  world: {
    width: 800,
    height: 600,
  },
  platform: {
    color: 0x654321,
    height: 20,
    width: 100,
  },
  ground: {
    height: 50,
  },
  climbeable: {
    color: 0x8b4513,
    knotColor: 0x654321,
  },
} as const;
