import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { DbConnection } from '@/spacetime/client';
import { UIContextService, UIEvents } from '../services/ui-context-service';
import { UIMessageDisplay } from '../common/ui-message-display';
import { getAudioManager } from '@/core/audio/audio-manager';
import type { Teleport } from '@/spacetime/server/libs/spacetime/client';

export interface TeleportOption {
  locationName: string;
  x: number;
  y: number;
  unlocked: boolean;
  position: { row: number; col: number };
}

export class TeleportSelectionMenu {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private container!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Rectangle;
  private logger: ModuleLogger = createLogger('TeleportSelectionMenu');

  private isVisible: boolean = false;
  
  public get visible(): boolean {
    return this.isVisible;
  }
  private _dbConnection: DbConnection | null = null;

  // Available teleport locations
  private teleportOptions: TeleportOption[] = [];

  // Map of location names to their unlock status
  private playerTeleportUnlockStatus: Map<string, boolean> = new Map();
  // Teleport table data
  private teleportTableData: Teleport[] = [];
  // Keyboard handlers for cleanup
  private keyboardHandlers: { event: string; handler: () => void }[] = [];
  
  // UI message display
  private uiMessageDisplay: UIMessageDisplay;
  private page: number = 0; // page number of current teleport
  private maxPerPage: number = 9;
  private get totalPages (): number {
    return Math.ceil((this.teleportTableData?.length ?? 1) / 9);
  }
  
  // Audio cooldown tracking
  private lastActionBlockedSoundTime = 0;
  private readonly UI_SOUND_COOLDOWN_MS = 1000;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.getCamera('ui') ?? scene.cameras.main;

    // Get data from context service
    const context = UIContextService.getInstance();
    this._dbConnection = context.getDbConnection();

    // Get initial teleport data
    const teleportData = context.getTeleportData();
    this.playerTeleportUnlockStatus = teleportData.teleportData;
    this.teleportTableData = teleportData.teleportTableData;

    // Subscribe to teleport data updates
    context.on(UIEvents.TELEPORT_DATA_UPDATED, this.handleTeleportDataUpdate, this);

    // Generate teleport options from data
    this.generateTeleportOptions();

    this.createUI();
    this.hide(); // Start hidden
    
    // Create UI message display
    this.uiMessageDisplay = new UIMessageDisplay(scene);

    // Setup escape key to close
    const escHandler = () => {
      if (this.isVisible) {
        this.hide();
      }
    };
    this.scene.input.keyboard?.on('keydown-ESC', escHandler);
    this.keyboardHandlers.push({ event: 'keydown-ESC', handler: escHandler });
    
    // Setup number keys 1-9 to select teleports
    const keyCodes = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    const numpadKeyCodes = keyCodes.map(key => `NUMPAD_${key}`);
    const allNumKeys = [keyCodes, numpadKeyCodes];
    for (const keys of allNumKeys) {
      keys.forEach((keyCode, index) => {
        const numberKey = index + 1;
        const handler = () => {
          this.logger.info(`Number key ${numberKey} pressed, isVisible: ${this.isVisible}`);
          if (this.isVisible) {
            this.selectTeleportByNumber(numberKey);
          }
        };
        
        const keyName = `keydown-${keyCode}`;
        this.logger.info(`Setting up handler for ${keyName}`);
        
        this.scene.input.keyboard?.on(keyName, handler);
        this.keyboardHandlers.push({ event: keyName, handler });
      });
    }

    // Toggle pages
    const arrowKeys = ['LEFT', 'RIGHT'];
    arrowKeys.forEach((keyCode) => {
        const handler = () => {
          this.logger.info(`Arrow key ${keyCode} pressed, isVisible: ${this.isVisible}`);
          if (this.isVisible) {
            this.changePage(keyCode);
          }
        };
        
        const keyName = `keydown-${keyCode}`;
        this.logger.info(`Setting up handler for ${keyName}`);
        
        this.scene.input.keyboard?.on(keyName, handler);
        this.keyboardHandlers.push({ event: keyName, handler });
    });

    
    // Log that keyboard handlers are set up
    this.logger.info('Keyboard handlers set up for TeleportSelectionMenu');
  }

  private changePage(direction: string) {
    if (direction === 'LEFT' && this.page > 0) {
      this.page--;
    } else if (direction === 'RIGHT' && this.page < this.totalPages - 1) {
      this.page++;
    } else {
      return;
    }
    this.refreshTeleportOptions();
  }

  private createUI(): void {
    // Create main container
    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(2000); // High depth to appear above everything

    const camera = this.camera;
    const centerX = camera.width / 2;
    const centerY = camera.height / 2;

    // Create semi-transparent background overlay
    const overlay = this.scene.add.rectangle(
      centerX,
      centerY,
      camera.width,
      camera.height,
      0x000000,
      0.7
    );
    overlay.setInteractive(); // Block clicks from going through

    // Create menu background
    const menuWidth = 500;
    const menuHeight = 650;
    this.background = this.scene.add.rectangle(centerX, centerY, menuWidth, menuHeight, 0x2a2a2a);
    this.background.setStrokeStyle(2, 0x4a4a4a);

    // Create title
    const title = this.scene.add.text(centerX, centerY - menuHeight / 2 + 40, 'Select Teleport Point', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0.5);

    // Close button removed - use T hotkey or ESC to close
    
    // Create instruction text
    const instruction = this.scene.add.text(centerX, centerY - menuHeight / 2 + 80, 'Use number keys 1-9 to select a teleport location' , {
      fontSize: '16px',
      color: '#cccccc',
      fontStyle: 'italic',
    });
    instruction.setOrigin(0.5, 0.5);

    // Add all to container
    this.container.add([overlay, this.background, title, instruction]);

    // Add arrow keys
    this.addPageArrowKeys(centerX, centerY, menuWidth, menuHeight);

    // Create teleport options
    this.createTeleportOptions(centerX, centerY, menuWidth, menuHeight);
  }

  private addPageArrowKeys (centerX: number, centerY: number, menuWidth: number, menuHeight: number) {

    // Create arrow keys
    const previousPage = this.scene.add.text(centerX - menuWidth / 2 + 50, centerY + menuHeight / 2 - 40, '< Previous', {
      fontSize: '16px',
      color: '#cccccc',
      fontStyle: 'bold',
    });
    previousPage.setOrigin(0, 0.5);
    previousPage.setVisible(this.page > 0);

    const nextPage = this.scene.add.text(centerX + menuWidth / 2 - 50, centerY + menuHeight / 2 - 40, 'Next >', {
      fontSize: '16px',
      color: '#cccccc',
      fontStyle: 'bold',
    });
    nextPage.setOrigin(1, 0.5);
    nextPage.setVisible(this.page < this.totalPages - 1);

    // Add left and right arrow
    this.container.add([previousPage, nextPage]);
  }

  private generateTeleportOptions(): void {
    let index = 0;
    const cols = 3;

    // Convert teleport data to options
    this.teleportTableData.forEach((teleport) => {
      const row = Math.floor((index % this.maxPerPage) / cols);
      const col = index % cols;

      const unlocked = this.playerTeleportUnlockStatus.get(teleport.locationName) || false;

      this.teleportOptions.push({
        locationName: teleport.locationName,
        x: teleport.x,
        y: teleport.y,
        unlocked: unlocked,
        position: { row, col },
      });

      index++;
    });
  }

  private createTeleportOptions(
    centerX: number,
    centerY: number,
    _menuWidth: number,
    _menuHeight: number
  ): void {
    const gridSize = 120; // Same as job cells
    const padding = 30;
    const cols = 3;
    const rows = Math.ceil(Math.min(this.maxPerPage, this.teleportOptions.length) / cols);
    const total = cols * rows;

    // Calculate starting position to center the grid
    const totalWidth = cols * gridSize + (cols - 1) * padding;
    const totalHeight = rows * gridSize + (rows - 1) * padding;
    const startX = centerX - totalWidth / 2 + gridSize / 2;
    const startY = centerY - totalHeight / 2 + gridSize / 2 + 20; // Offset down a bit

    // Page skip
    const pageStart = this.page * this.maxPerPage;
    const pageEnd = pageStart + total;

    this.teleportOptions.forEach((teleportOption, index) => {
      if (index < pageStart || index >= pageEnd) return;
      const x = startX + teleportOption.position.col * (gridSize + padding);
      const y = startY + teleportOption.position.row * (gridSize + padding);

      // Create sprite background
      const spriteBg = this.scene.add.rectangle(
        x,
        y,
        gridSize,
        gridSize,
        teleportOption.unlocked ? 0x3a3a3a : 0x2a2a2a
      );
      spriteBg.setStrokeStyle(2, teleportOption.unlocked ? 0x5a5a5a : 0x3a3a3a);
      
      // Add number indicator in top-left corner
      const numberKey = index - pageStart + 1; // 1-based indexing for display
      const numberBg = this.scene.add.circle(x - gridSize/2 + 15, y - gridSize/2 + 15, 12, 0x4a4a4a);
      numberBg.setStrokeStyle(1, 0x6a6a6a);
      
      const numberText = this.scene.add.text(x - gridSize/2 + 15, y - gridSize/2 + 15, numberKey.toString(), {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      });
      numberText.setOrigin(0.5, 0.5);

      // Create teleport stone sprite
      const sprite = this.scene.add.sprite(x, y, 'teleport-stone');
      // Set frame based on unlock status (0 = locked, 1 = unlocked)
      sprite.setFrame(teleportOption.unlocked ? 1 : 0);
      sprite.setScale(1.0); // Teleport stones are 100x100, grid is 120x120
      
      // Apply grayscale tint if locked
      if (!teleportOption.unlocked) {
        sprite.setTint(0x808080);
      }

      // Create location name below sprite
      const locationName = this.scene.add.text(x, y + gridSize / 2 + 10, teleportOption.locationName, {
        fontSize: '12px',
        color: teleportOption.unlocked ? '#ffffff' : '#808080',
        fontStyle: 'bold',
      });
      locationName.setOrigin(0.5, 0.5);

      // Add "LOCKED" text indicator for locked teleports
      let lockedText: Phaser.GameObjects.Text | undefined;
      if (!teleportOption.unlocked) {
        lockedText = this.scene.add.text(x, y, 'LOCKED', {
          fontSize: '14px',
          color: '#ff4444',
          fontStyle: 'bold',
          backgroundColor: '#000000',
          padding: { x: 4, y: 2 },
        });
        lockedText.setOrigin(0.5, 0.5);
        lockedText.setAlpha(0.9);
      }

      // Only make unlocked teleports interactive
      if (teleportOption.unlocked) {
        spriteBg.setInteractive({ useHandCursor: true });

        // Hover effects
        spriteBg.on('pointerover', () => {
          spriteBg.setFillStyle(0x4a4a4a);
          sprite.setScale(1.1);
        });

        spriteBg.on('pointerout', () => {
          spriteBg.setFillStyle(0x3a3a3a);
          sprite.setScale(1.0);
        });

        // Click handler
        spriteBg.on('pointerdown', () => {
          this.selectTeleport(teleportOption);
        });
      }

      this.container.add([spriteBg, numberBg, numberText, sprite, locationName]
        .concat(lockedText === undefined ? [] : [lockedText])
      );
    });
  }

  private selectTeleportByNumber(numberKey: number): void {
    this.logger.info(`selectTeleportByNumber called with key: ${numberKey}`);
    
    // Convert 1-based number to 0-based index
    const index = numberKey - 1 + this.page * this.maxPerPage;
    
    this.logger.info(`Total teleports: ${this.teleportOptions.length}, index: ${index}`);
    
    // Check if index is valid
    if (index >= 0 && index < this.teleportOptions.length) {
      const teleportOption = this.teleportOptions[index];
      this.logger.info(`Found teleport option: ${teleportOption.locationName}, unlocked: ${teleportOption.unlocked}`);
      
      // Only select if unlocked
      if (teleportOption.unlocked) {
        this.logger.info(`Selecting teleport: ${teleportOption.locationName}`);
        this.selectTeleport(teleportOption);
      } else {
        this.logger.info(`Teleport ${teleportOption.locationName} is locked`);
      }
    } else {
      this.logger.warn(`Invalid teleport index: ${index}`);
    }
  }

  private selectTeleport(teleportOption: TeleportOption): void {
    this.logger.info(`Selected teleport: ${teleportOption.locationName} at (${teleportOption.x}, ${teleportOption.y})`);

    // Call the TeleportPlayer reducer with the location coordinates
    if (this._dbConnection) {
      // Teleport to the center of the tile (add 16 to both x and y since teleport coords are top-left)
      const teleportX = teleportOption.x + 16;
      const teleportY = teleportOption.y + 16;
      
      this._dbConnection.reducers.teleportPlayer(teleportX, teleportY);
      this.logger.info(`Sent teleport request to (${teleportX}, ${teleportY})`);
      
      // Force immediate client position update to handle short-distance teleports
      // Get player from scene data if available
      const player = this.scene.data.get('player');
      if (player && player.setPosition) {
        // Small delay to ensure server has processed the teleport
        this.scene.time.delayedCall(100, () => {
          player.setPosition(teleportX, teleportY);
          this.logger.info(`Forced client position update to (${teleportX}, ${teleportY})`);
        });
      }
    } else {
      this.logger.error('No database connection available to teleport');
    }

    this.hide();
  }

  public setDbConnection(dbConnection: DbConnection): void {
    this._dbConnection = dbConnection;
  }

  public show(): void {
    // Check if player is dead or in combat before showing
    if (this._dbConnection && this._dbConnection.identity) {
      let playerFound = false;
      for (const player of this._dbConnection.db.player.iter()) {
        if (player.identity.toHexString() === this._dbConnection.identity.toHexString()) {
          playerFound = true;
          
          // Check if player is dead
          if (player.currentHp <= 0 || player.state.tag === 'Dead') {
            this.logger.warn('Cannot teleport while dead');
            return;
          }
          
          // Check if player is in combat
          if (player.inCombat === true) {
            this.logger.warn('Cannot teleport while in combat');
            
            // Show message and play sound
            this.uiMessageDisplay.showMessage('Cannot teleport while in combat!');
            this.playActionBlockedSound();
            
            return;
          }
          
          break;
        }
      }
      if (!playerFound) {
        this.logger.warn('Player not found in database');
      }
    }

    this.container.setVisible(true);
    this.isVisible = true;

    // Refresh teleport options
    this.updateTeleportUnlockStates();
  }

  public hide(): void {
    this.container.setVisible(false);
    this.isVisible = false;
  }

  private handleTeleportDataUpdate(data: { teleportData: Map<string, boolean>; teleportTableData: any[] }): void {
    this.playerTeleportUnlockStatus = data.teleportData;
    this.teleportTableData = data.teleportTableData;

    this.logger.info(
      `Teleport data updated via context: ${data.teleportData.size} entries, ${data.teleportTableData.length} teleports`
    );

    // Update display if menu is visible
    if (this.isVisible) {
      this.updateTeleportUnlockStates();
    }
  }

  public destroy(): void {
    // Unsubscribe from context events
    const context = UIContextService.getInstance();
    context.off(UIEvents.TELEPORT_DATA_UPDATED, this.handleTeleportDataUpdate, this);
    
    // Remove keyboard handlers
    this.keyboardHandlers.forEach(({ event, handler }) => {
      this.scene.input.keyboard?.off(event, handler);
    });
    this.keyboardHandlers = [];

    this.container.destroy();
    
    // Destroy UI message display
    if (this.uiMessageDisplay) {
      this.uiMessageDisplay.destroy();
    }
  }

  private updateTeleportUnlockStates(): void {
    // Regenerate options with latest data
    this.teleportOptions = [];
    this.generateTeleportOptions();

    // Refresh the UI to show updated unlock states
    this.refreshTeleportOptions();
  }

  private refreshTeleportOptions(): void {
    // Remove existing teleport option elements
    const elementsToRemove: Phaser.GameObjects.GameObject[] = [];
    this.container.list.forEach((child) => {
      // Keep the overlay, background, title, and instruction (first 4 elements)
      // Adding arrow keys + 2
      if (this.container.list.indexOf(child) > 5) {
        elementsToRemove.push(child);
      }
    });
    elementsToRemove.forEach((element) => element.destroy());

    // Recreate teleport options with updated unlock states
    const camera = this.camera;
    const centerX = camera.width / 2;
    const centerY = camera.height / 2;
    const menuWidth = 500;
    const menuHeight = 650;
    this.createTeleportOptions(centerX, centerY, menuWidth, menuHeight);
  }
  
  private playActionBlockedSound(): void {
    const now = Date.now();
    if (now - this.lastActionBlockedSoundTime > this.UI_SOUND_COOLDOWN_MS) {
      const audioManager = getAudioManager(this.scene);
      audioManager.playSound('actionBlocked');
      this.lastActionBlockedSoundTime = now;
    }
  }
}