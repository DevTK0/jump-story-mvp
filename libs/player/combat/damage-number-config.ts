/**
 * Configuration for damage number visual effects
 * Defines styling, animation, and behavior for floating combat numbers
 */

import { DamageType } from "@/spacetime/client";

export const DAMAGE_NUMBER_CONFIG = {
  /**
   * Visual styles for different damage types
   */
  styles: {
    Normal: { 
      fontSize: '16px', 
      fontFamily: 'monospace', 
      color: '#FFFFFF',
      stroke: '#000000', 
      strokeThickness: 2,
      fontStyle: 'normal'
    },
    Crit: { 
      fontSize: '20px', 
      fontFamily: 'monospace', 
      color: '#FF0000',
      stroke: '#000000', 
      strokeThickness: 3,
      fontStyle: 'bold'
    },
    Weak: { 
      fontSize: '14px', 
      fontFamily: 'monospace', 
      color: '#FFA500',
      stroke: '#000000', 
      strokeThickness: 1,
      fontStyle: 'normal'
    },
    Strong: { 
      fontSize: '18px', 
      fontFamily: 'monospace', 
      color: '#8A2BE2',
      stroke: '#000000', 
      strokeThickness: 2,
      fontStyle: 'bold'
    },
    Immune: { 
      fontSize: '14px', 
      fontFamily: 'monospace', 
      color: '#808080',
      stroke: '#000000', 
      strokeThickness: 1,
      fontStyle: 'italic'
    },
  },

  /**
   * Animation timing and movement
   */
  animations: {
    duration: 1500,           // Total animation time in ms
    fadeInDuration: 200,      // Time to fade in
    fadeOutDuration: 300,     // Time to fade out
    riseDistance: 80,         // Pixels to rise upward
    spreadRadius: 15,         // Random horizontal spread
    easingCurve: 'Power2.easeOut',
  },

  /**
   * Stacking behavior for multiple hits
   */
  stacking: {
    verticalOffset: 25,       // Pixels between stacked numbers
    horizontalJitter: 10,     // Random horizontal offset
    maxStackHeight: 5,        // Maximum numbers per enemy
    batchWindowMs: 100,       // Milliseconds to batch rapid hits
  },

  /**
   * Display and rendering settings
   */
  display: {
    baseDepth: 100,           // Higher than all game objects
    stackDepthIncrement: 1,   // Depth increase per stacked number
    baseYOffset: -60,         // Pixels above enemy sprite
  },

  /**
   * Performance settings
   */
  performance: {
    poolSize: 50,             // Initial pool size
    maxPoolSize: 100,         // Maximum pool size
    maxConcurrentNumbers: 30, // Maximum active numbers
    staleEventThresholdMs: 5000, // Ignore events older than this
  },
} as const;

/**
 * Get damage type from SpacetimeDB enum
 */
export function getDamageTypeKey(damageType: DamageType): keyof typeof DAMAGE_NUMBER_CONFIG.styles {
  switch (damageType.tag) {
    case 'Normal': return 'Normal';
    case 'Crit': return 'Crit';
    case 'Weak': return 'Weak';
    case 'Strong': return 'Strong';
    case 'Immune': return 'Immune';
    default: return 'Normal';
  }
}

/**
 * Get display text for damage numbers
 */
export function getDamageDisplayText(damageAmount: number, damageType: DamageType): string {
  if (damageType.tag === 'Immune') {
    return 'IMMUNE';
  }
  return Math.round(damageAmount).toString();
}