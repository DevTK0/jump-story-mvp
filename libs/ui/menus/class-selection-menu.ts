import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { DbConnection } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { jobAttributes } from '../../../apps/playground/config/job-attributes';
import spriteConfig from '../../../apps/playground/config/sprite-config';

export interface ClassOption {
  id: string;
  name: string;
  spriteKey: string;
  unlocked: boolean;
  position: { row: number; col: number };
}

export class ClassSelectionMenu {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Rectangle;
  private logger: ModuleLogger = createLogger('ClassSelectionMenu');

  private isVisible: boolean = false;
  private _dbConnection: DbConnection | null = null;
  private _playerIdentity: Identity;

  // Available jobs loaded from job-attributes
  private classes: ClassOption[] = [];

  // Map of job keys to their unlock status
  private playerJobUnlockStatus: Map<string, boolean> = new Map();
  // Job table data
  private jobTableData: any[] = [];

  constructor(scene: Phaser.Scene, playerIdentity: Identity) {
    this.scene = scene;
    this._playerIdentity = playerIdentity;

    // Generate job options from job-attributes
    this.generateJobOptions();

    this.createUI();
    this.hide(); // Start hidden

    // Setup escape key to close
    this.scene.input.keyboard?.on('keydown-ESC', () => {
      if (this.isVisible) {
        this.hide();
      }
    });
  }

  private createUI(): void {
    // Create main container
    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(2000); // High depth to appear above everything

    const camera = this.scene.cameras.main;
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
    const title = this.scene.add.text(centerX, centerY - menuHeight / 2 + 40, 'Select Job', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0.5);

    // Create close button
    const closeButton = this.scene.add.text(
      centerX + menuWidth / 2 - 20,
      centerY - menuHeight / 2 + 20,
      'X',
      {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      }
    );
    closeButton.setOrigin(0.5, 0.5);
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on('pointerover', () => closeButton.setColor('#ff6666'));
    closeButton.on('pointerout', () => closeButton.setColor('#ffffff'));
    closeButton.on('pointerdown', () => this.hide());

    // Add all to container
    this.container.add([overlay, this.background, title, closeButton]);

    // Create class options
    this.createClassOptions(centerX, centerY, menuWidth, menuHeight);
  }

  private generateJobOptions(): void {
    let index = 0;
    const cols = 3;

    // Get first available sprite as fallback
    const availableSprites = Object.keys(spriteConfig.sprites.jobs || {});
    const fallbackSprite = availableSprites[0] || 'soldier';

    // Convert job attributes to class options
    Object.entries(jobAttributes).forEach(([jobId, jobConfig]) => {
      const row = Math.floor(index / cols);
      const col = index % cols;

      // Use the sprite key from job config
      let spriteKey = jobConfig.spriteKey;

      // Validate sprite exists in config and texture cache
      const spriteExistsInConfig =
        spriteConfig.sprites.jobs && spriteConfig.sprites.jobs[spriteKey];

      // If sprite doesn't exist in config, use fallback
      if (!spriteExistsInConfig) {
        this.logger.warn(
          `Sprite '${spriteKey}' for job '${jobId}' not found in config. Using fallback '${fallbackSprite}'.`
        );
        spriteKey = fallbackSprite;
      }

      this.classes.push({
        id: jobId,
        name: jobConfig.displayName,
        spriteKey: spriteKey,
        unlocked: false, // Start with all jobs locked until we get data from DB
        position: { row, col },
      });

      index++;
    });
  }

  private createClassOptions(
    centerX: number,
    centerY: number,
    _menuWidth: number,
    _menuHeight: number
  ): void {
    const gridSize = 120; // Larger cells for bigger sprites
    const padding = 30;
    const cols = 3;
    const rows = Math.ceil(this.classes.length / cols);

    // Calculate starting position to center the grid
    const totalWidth = cols * gridSize + (cols - 1) * padding;
    const totalHeight = rows * gridSize + (rows - 1) * padding;
    const startX = centerX - totalWidth / 2 + gridSize / 2;
    const startY = centerY - totalHeight / 2 + gridSize / 2 - 20; // Offset up a bit

    this.classes.forEach((classOption) => {
      const x = startX + classOption.position.col * (gridSize + padding);
      const y = startY + classOption.position.row * (gridSize + padding);

      // Create sprite background
      const spriteBg = this.scene.add.rectangle(
        x,
        y,
        gridSize,
        gridSize,
        classOption.unlocked ? 0x3a3a3a : 0x2a2a2a
      );
      spriteBg.setStrokeStyle(2, classOption.unlocked ? 0x5a5a5a : 0x3a3a3a);

      // Validate texture exists at runtime
      if (!this.scene.textures.exists(classOption.spriteKey)) {
        this.logger.error(
          `Texture '${classOption.spriteKey}' not loaded. Skipping sprite creation for job '${classOption.id}'.`
        );
        return;
      }

      // Create sprite
      const sprite = this.scene.add.sprite(x, y, classOption.spriteKey);
      sprite.setScale(2.2); // Scaled to fit within grid

      // Apply grayscale tint if locked
      if (!classOption.unlocked) {
        sprite.setTint(0x808080);
      }

      // Play idle animation
      const animKey = `${classOption.spriteKey}_idle`;
      if (this.scene.anims.exists(animKey)) {
        sprite.play(animKey);
      } else {
        this.logger.warn(`Animation ${animKey} not found`);
      }

      // Create class name below sprite
      const className = this.scene.add.text(x, y + gridSize / 2 + 10, classOption.name, {
        fontSize: '12px',
        color: classOption.unlocked ? '#ffffff' : '#808080',
        fontStyle: 'bold',
      });
      className.setOrigin(0.5, 0.5);

      // Add "LOCKED" text indicator for locked classes
      if (!classOption.unlocked) {
        const lockedText = this.scene.add.text(x, y, 'LOCKED', {
          fontSize: '14px',
          color: '#ff4444',
          fontStyle: 'bold',
          backgroundColor: '#000000',
          padding: { x: 4, y: 2 },
        });
        lockedText.setOrigin(0.5, 0.5);
        lockedText.setAlpha(0.9);

        this.container.add(lockedText);
      }

      // Only make unlocked classes interactive
      if (classOption.unlocked) {
        spriteBg.setInteractive({ useHandCursor: true });

        // Hover effects
        spriteBg.on('pointerover', () => {
          spriteBg.setFillStyle(0x4a4a4a);
          sprite.setScale(2.4);
        });

        spriteBg.on('pointerout', () => {
          spriteBg.setFillStyle(0x3a3a3a);
          sprite.setScale(2.2);
        });

        // Click handler
        spriteBg.on('pointerdown', () => {
          this.selectClass(classOption);
        });
      }

      this.container.add([spriteBg, sprite, className]);
    });
  }

  private selectClass(classOption: ClassOption): void {
    this.logger.info(`Selected class: ${classOption.name}`);

    // Call the ChangeJob reducer on the server
    if (this._dbConnection) {
      this._dbConnection.reducers.changeJob(classOption.id);
      this.logger.info(`Sent job change request for job: ${classOption.id}`);
    } else {
      this.logger.error('No database connection available to change job');
    }

    this.hide();
  }

  public setDbConnection(dbConnection: DbConnection): void {
    this._dbConnection = dbConnection;
  }

  public show(): void {
    this.container.setVisible(true);
    this.isVisible = true;

    // Use pre-loaded job data to refresh the display
    this.updateJobUnlockStates();
  }

  public hide(): void {
    this.container.setVisible(false);
    this.isVisible = false;
  }

  public destroy(): void {
    this.container.destroy();
  }

  public setPlayerJobData(jobData: Map<string, boolean>, jobTableData?: any[]): void {
    this.playerJobUnlockStatus = jobData;
    console.log(jobData, jobTableData);
    if (jobTableData) {
      this.jobTableData = jobTableData;
    }
    this.logger.info(
      `Received job data with ${jobData.size} entries and ${this.jobTableData.length} jobs`
    );
  }

  private updateJobUnlockStates(): void {
    console.log(this.jobTableData);
    console.log('hello', this.playerJobUnlockStatus);

    // Use pre-loaded job data instead of trying to access from dbConnection
    const jobs = this.jobTableData;
    this.logger.info(`Found ${jobs.length} jobs in pre-loaded data`);

    // Log first job to debug field names
    if (jobs.length > 0) {
      this.logger.info(`First job structure:`, jobs[0]);
      this.logger.info(`Available job keys: ${jobs.map((j) => j.jobKey).join(', ')}`);
    }

    // Update class options with unlock status
    this.classes.forEach((classOption) => {
      // Check if this job key is unlocked
      const isUnlocked = this.playerJobUnlockStatus.get(classOption.id) || false;
      classOption.unlocked = isUnlocked;
      this.logger.info(
        `Class option ${classOption.id}: unlocked=${isUnlocked}`
      );
    });

    // Refresh the UI to show updated unlock states
    this.refreshClassOptions();
  }

  private refreshClassOptions(): void {
    // Remove existing class option elements
    const elementsToRemove: Phaser.GameObjects.GameObject[] = [];
    this.container.list.forEach((child) => {
      // Keep the overlay, background, title, and close button (first 4 elements)
      if (this.container.list.indexOf(child) > 3) {
        elementsToRemove.push(child);
      }
    });
    elementsToRemove.forEach((element) => element.destroy());

    // Recreate class options with updated unlock states
    const camera = this.scene.cameras.main;
    const centerX = camera.width / 2;
    const centerY = camera.height / 2;
    const menuWidth = 500;
    const menuHeight = 650;
    this.createClassOptions(centerX, centerY, menuWidth, menuHeight);
  }
}
