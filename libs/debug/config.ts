// Debug configuration constants
export const DEBUG_CONFIG = {
  trajectory: {
    maxPoints: 60, // 1 second at 60fps
    sampleRate: 2, // Sample every 2 frames for performance
    shadowSkipRate: 4, // Only show every 4th point to avoid too many sprites
    shadowAlphaRange: [0.3, 0.7] as const, // Range from 0.3 to 0.7
    shadowTint: 0x666666, // Gray tint for shadow effect
  },
  colors: {
    hitbox: 0x00ff00, // Green
    attackHitbox: 0xff8800, // Orange
    velocity: 0xffff00, // Yellow
    collision: 0x4444ff, // Blue
    climbeable: 0x00ff00, // Green
    stateText: '#00ff00', // Green text
  },
  ui: {
    stateTextSize: 16,
    stateTextPosition: [10, 10] as const,
    velocityScale: 0.5,
    collisionCheckRadius: 400,
    hitboxAlpha: 0.5,
    arrowLength: 8,
    arrowAngle: Math.PI / 6,
    centerPointRadius: 3,
  },
  input: {
    toggleKey: Phaser.Input.Keyboard.KeyCodes.D,
  },
} as const;
