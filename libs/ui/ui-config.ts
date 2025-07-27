/**
 * Centralized configuration for UI components
 * Eliminates magic numbers and provides single source of truth
 */

export const UI_CONFIG = {
  /**
   * Z-index depth layers for UI elements
   */
  depth: {
    emote: 100, // Above player but below UI
    performanceMetrics: 1000, // Top-most UI layer
    chat: 900, // Above most UI but below metrics
    playerStats: 950, // Near top but below metrics
  },

  /**
   * Emote display settings
   */
  emote: {
    defaultScale: 0.3, // Scale down the 187x187 sprite
    defaultDuration: 2000, // 2 seconds
    defaultFrameRate: 12,
  },

  /**
   * Performance metrics display
   */
  performanceMetrics: {
    updateInterval: 500, // Update every 500ms
    position: {
      x: 10,
      y: 50,
    },
    panel: {
      width: 200,
      height: 120,
    },
  },

  /**
   * Chat system settings
   */
  chat: {
    speech: {
      maxWidth: 200,
      padding: 10,
      borderRadius: 10,
      fadeDelay: 3000, // 3 seconds before fade
      fadeDuration: 500, // 0.5 second fade
    },
  },

  /**
   * FPS counter settings
   */
  fpsCounter: {
    defaultPosition: {
      xOffset: -130, // From right edge
      y: 50,
    },
    fontSize: '14px',
    alpha: 0.7,
  },
} as const;