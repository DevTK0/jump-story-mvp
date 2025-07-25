/**
 * Player Stats UI Configuration
 * Centralized configuration for player stats display, level up animations, and UI styling
 */

/**
 * Main configuration object for player stats UI
 */
export const PLAYER_STATS_UI_CONFIG = {
  // UI Container positioning
  position: {
    x: 20,
    y: 20,
    barWidth: 200,
    barHeight: 16,
    barSpacing: 25,
    identitySpacing: 20,
  },

  // Typography settings
  typography: {
    fontSize: 14,
    fontFamily: 'Arial, sans-serif',
    fontStyle: 'normal',
  },

  // Color scheme
  colors: {
    bars: {
      hp: {
        fill: 0xff0000, // Red
        background: 0x660000, // Dark red
      },
      mana: {
        fill: 0x0066ff, // Blue
        background: 0x000066, // Dark blue
      },
      exp: {
        fill: 0xffd700, // Gold
        background: 0x666600, // Dark gold
      },
    },
    text: '#FFFFFF', // White
    barBorder: 0xffffff, // White border
  },

  // UI Depth settings
  display: {
    baseDepth: 1000,
    scrollFactor: { x: 0, y: 0 }, // Fix to camera
  },

  // Level up animation configuration
  levelUp: {
    text: 'LEVEL UP',
    style: {
      fontSize: '48px',
      fontStyle: 'bold',
      fontFamily: 'Impact, Arial Black, sans-serif',
      align: 'center',
      stroke: '#FFFFFF',
      strokeThickness: 8,
    },
    // Gradient colors - dark green to light green
    gradientColors: ['#068620ff', '#70e870ff'],
    offset: {
      y: -100, // Pixels above player
    },
    animation: {
      lingerDuration: 1500, // Time before fade starts
      fadeDuration: 2000, // Fade out duration
      scaleBounce: {
        scale: 1.3,
        duration: 300,
        yoyo: true,
        ease: 'Power2',
      },
    },
  },

  // Performance settings
  performance: {
    updateThrottle: 100, // Minimum ms between stat updates
  },
} as const;

/**
 * Type definitions for configuration
 */
export interface BarConfig {
  fill: number;
  background: number;
}

export interface LevelUpAnimationConfig {
  text: string;
  style: Phaser.Types.GameObjects.Text.TextStyle;
  gradientColors: readonly string[];
  offset: {
    y: number;
  };
  animation: {
    lingerDuration: number;
    fadeDuration: number;
    scaleBounce: {
      scale: number;
      duration: number;
      yoyo: boolean;
      ease: string;
    };
  };
}

/**
 * Helper function to get bar colors
 */
export function getBarColors(barType: 'hp' | 'mana' | 'exp'): BarConfig {
  return PLAYER_STATS_UI_CONFIG.colors.bars[barType];
}

/**
 * Helper function to create text style
 */
export function createTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontSize: `${PLAYER_STATS_UI_CONFIG.typography.fontSize}px`,
    fontFamily: PLAYER_STATS_UI_CONFIG.typography.fontFamily,
    fontStyle: PLAYER_STATS_UI_CONFIG.typography.fontStyle,
    color: PLAYER_STATS_UI_CONFIG.colors.text,
  };
}
