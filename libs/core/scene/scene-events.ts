/**
 * Type-safe scene event system
 * 
 * Provides compile-time type safety for Phaser scene events
 */

import type { Identity } from '@clockworklabs/spacetimedb-sdk';
import type { Teleport } from '@/spacetime/client';

// Define all scene event types
export interface SceneEventMap {
  'player:attacked': {
    type: 'standard' | 'dash' | 'projectile';
    direction: number;
    attackType: number;
    damage?: number;
    critChance?: number;
    projectile?: string;
  };
  'player:died': {
    position: { x: number; y: number };
  };
  'peer:clicked': {
    peer: any; // The peer sprite instance
    identity: Identity;
    name: string;
    x: number;
    y: number;
  };
  'player:clicked': {
    player: any; // The player sprite instance
    identity: Identity;
    name: string;
    x: number;
    y: number;
  };
  'skill:activated': {
    slotIndex: number;
    skillName: string;
    cooldown: number;
    audio?: string;
  };
  'teleport:data-updated': {
    unlockStatus: Map<string, boolean>;
    locations: Teleport[];
  };
  'boss:spawned': {
    enemy: string;
    spawnId: number;
    x: number;
    y: number;
  };
  'boss:despawned': {
    spawnId: number;
  };
  // Add more events here as the game grows
}

/**
 * Type-safe event emission
 * @param scene - The Phaser scene
 * @param event - The event name (must be a key of SceneEventMap)
 * @param data - The event data (type-checked based on event name)
 */
export function emitSceneEvent<K extends keyof SceneEventMap>(
  scene: Phaser.Scene,
  event: K,
  data: SceneEventMap[K]
): void {
  scene.events.emit(event, data);
}

/**
 * Type-safe event listener
 * @param scene - The Phaser scene
 * @param event - The event name (must be a key of SceneEventMap)
 * @param fn - Callback function with typed data parameter
 * @param context - Optional context for the callback
 */
export function onSceneEvent<K extends keyof SceneEventMap>(
  scene: Phaser.Scene,
  event: K,
  fn: (data: SceneEventMap[K]) => void,
  context?: any
): void {
  scene.events.on(event, fn, context);
}

/**
 * Type-safe one-time event listener
 * @param scene - The Phaser scene
 * @param event - The event name (must be a key of SceneEventMap)
 * @param fn - Callback function with typed data parameter
 * @param context - Optional context for the callback
 */
export function onceSceneEvent<K extends keyof SceneEventMap>(
  scene: Phaser.Scene,
  event: K,
  fn: (data: SceneEventMap[K]) => void,
  context?: any
): void {
  scene.events.once(event, fn, context);
}

/**
 * Type-safe event removal
 * @param scene - The Phaser scene
 * @param event - The event name (must be a key of SceneEventMap)
 * @param fn - Optional callback function to remove
 * @param context - Optional context
 */
export function offSceneEvent<K extends keyof SceneEventMap>(
  scene: Phaser.Scene,
  event: K,
  fn?: (data: SceneEventMap[K]) => void,
  context?: any
): void {
  scene.events.off(event, fn, context);
}