import Phaser from 'phaser';
import { SceneInitializer, type SceneConfig } from '@/core';
import type { IDebuggable } from '@/debug/debug-interfaces';
import { DebugState } from '@/debug/debug-state';
import { ContextMenuExtension } from '@/core/scene/extensions/context-menu-extension';
import spriteConfig from '../config/sprite-config';
import audioConfig from '../config/audio-config';

// Scene configuration
const sceneConfig: SceneConfig = {
  key: 'playground',
  player: {
    spawnX: _defaultPosition.x,
    spawnY: _defaultPosition.y,
    texture: 'soldier',
  },
  database: {
    target: (import.meta.env.VITE_SPACETIME_TARGET || 'local') as 'local' | 'cloud',
    moduleName: 'jump-story',
  },
  debug: {
    enabled: false, // Debug mode disabled
    shadow: false, // Shadow effect enabled independently
    invulnerable: false, // Set to true to prevent player from taking damage (useful for testing)
    fps: false, // Show FPS counter
    metrics: false, // Show performance metrics
  },
  sprites: spriteConfig, // Pass sprite configuration
  audio: audioConfig, // Pass audio configuration
};

/**
 * Refactored PlaygroundScene using SceneInitializer
 * Reduced from 637 lines to ~40 lines
 */
export class PlaygroundScene extends Phaser.Scene implements IDebuggable {
  private initializer: SceneInitializer;
  private contextMenuExtension?: ContextMenuExtension;
  public player?: any; // For backward compatibility with systems expecting scene.player

  constructor() {
    super({ key: 'playground' });
    this.initializer = new SceneInitializer(this, sceneConfig);
  }

  preload(): void {
    this.initializer.loadAssets();
  }

  async create(): Promise<void> {
    await this.initializer.start();

    // Set player reference for backward compatibility
    const systems = this.initializer.getSystems();
    this.player = systems.player;

    // Initialize context menu extension
    this.contextMenuExtension = new ContextMenuExtension(this, {
      enabled: true,
      isAdmin: false, // TODO: Get from user permissions
    });
  }

  update(time: number, delta: number): void {
    this.initializer.update(time, delta);
  }

  shutdown(): void {
    this.contextMenuExtension?.destroy();
    this.initializer.shutdown();

    // Clean up registry entries from preloader
    this.registry.remove('dbConnection');
    this.registry.remove('dbIdentity');
  }

  // Debug methods for IDebuggable interface
  renderDebug(_graphics: Phaser.GameObjects.Graphics): void {
    if (!DebugState.getInstance().enabled) return;

    // The debug extension handles most debug rendering
    // Add any scene-specific debug rendering here if needed
  }

  getDebugInfo(): Record<string, any> {
    if (!DebugState.getInstance().enabled) return {};

    try {
      const systems = this.initializer.getSystems();

      // Get enemy damage renderer debug info if available
      const damageRenderer = systems.managers?.getEnemyDamageManager();
      const damageNumbers = damageRenderer ? damageRenderer.getDebugInfo() : {};

      return {
        mapSize: systems.mapData
          ? `${systems.mapData.tilemap.widthInPixels}x${systems.mapData.tilemap.heightInPixels}`
          : 'N/A',
        peers: systems.managers?.getPeerManager()?.getPeerCount() || 0,
        damageNumbers,
      };
    } catch {
      // Systems not fully initialized yet
      return {
        mapSize: 'N/A',
        peers: 0,
        damageNumbers: {},
      };
    }
  }

  isDebugEnabled(): boolean {
    return DebugState.getInstance().enabled;
  }
}
