import Phaser from 'phaser';
import { PlayerContextMenu } from '@/ui';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { onSceneEvent, offSceneEvent } from '../scene-events';

export interface ContextMenuExtensionConfig {
  enabled: boolean;
  isAdmin?: boolean;
}

/**
 * Scene extension that adds click context menu functionality
 * for interacting with other players
 */
export class ContextMenuExtension {
  private scene: Phaser.Scene;
  private contextMenu: PlayerContextMenu;
  private config: ContextMenuExtensionConfig;
  private logger: ModuleLogger = createLogger('ContextMenuExtension');

  constructor(scene: Phaser.Scene, config: ContextMenuExtensionConfig) {
    this.scene = scene;
    this.config = config;

    // Create context menu
    this.contextMenu = new PlayerContextMenu(scene);

    if (config.enabled) {
      this.setupEventListeners();
    }
  }

  private setupEventListeners(): void {
    // Listen for click events from peers using type-safe event system
    onSceneEvent(this.scene, 'peer:clicked', this.handlePeerClick, this);

    // Listen for click on the main player if needed
    onSceneEvent(this.scene, 'player:clicked', this.handlePlayerClick, this);
  }

  private handlePeerClick = (data: {
    peer: any;
    identity: any;
    name: string;
    x: number;
    y: number;
  }): void => {
    // Show context menu at click position
    this.contextMenu.show(data.x, data.y, data.identity, data.name, this.config.isAdmin || false);
  };

  private handlePlayerClick = (data: {
    player: any;
    identity: any;
    name: string;
    x: number;
    y: number;
  }): void => {
    // Show context menu at click position
    this.contextMenu.show(data.x, data.y, data.identity, data.name, this.config.isAdmin || false);
  };

  public setAdmin(isAdmin: boolean): void {
    this.config.isAdmin = isAdmin;
  }

  public destroy(): void {
    offSceneEvent(this.scene, 'peer:clicked', this.handlePeerClick, this);
    offSceneEvent(this.scene, 'player:clicked', this.handlePlayerClick, this);
    this.contextMenu.destroy();
  }
}
