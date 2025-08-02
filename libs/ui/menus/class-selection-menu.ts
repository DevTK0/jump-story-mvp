import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { DbConnection } from '@/spacetime/client';
import { jobAttributes } from '../../../apps/playground/config/job-attributes';
import spriteConfig from '../../../apps/playground/config/sprite-config';
import { UIContextService, UIEvents } from '../services/ui-context-service';

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
  
  public get visible(): boolean {
    return this.isVisible;
  }
  private _dbConnection: DbConnection | null = null;

  // Available jobs loaded from job-attributes
  private classes: ClassOption[] = [];

  // Map of job keys to their unlock status
  private playerJobUnlockStatus: Map<string, boolean> = new Map();
  // Job table data
  private jobTableData: any[] = [];
  // Keyboard handlers for cleanup
  private keyboardHandlers: { event: string; handler: () => void }[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Get data from context service
    const context = UIContextService.getInstance();
    this._dbConnection = context.getDbConnection();

    // Get initial job data
    const jobData = context.getJobData();
    this.playerJobUnlockStatus = jobData.jobData;
    this.jobTableData = jobData.jobTableData;

    // Subscribe to job data updates
    context.on(UIEvents.PLAYER_JOB_DATA_UPDATED, this.handleJobDataUpdate, this);

    // Generate job options from job-attributes
    this.generateJobOptions();

    this.createUI();
    this.hide(); // Start hidden

    // Setup escape key to close
    const escHandler = () => {
      if (this.isVisible) {
        this.hide();
      }
    };
    this.scene.input.keyboard?.on('keydown-ESC', escHandler);
    this.keyboardHandlers.push({ event: 'keydown-ESC', handler: escHandler });
    
    // Setup number keys 1-9 to select jobs
    // Try using Phaser key codes
    const keyCodes = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    const numpadKeyCodes = keyCodes.map(key => `NUMPAD_${key}`);
    const allNumKeys = [keyCodes, numpadKeyCodes];
    for (const keys of allNumKeys) {
      keys.forEach((keyCode, index) => {
        const numberKey = index + 1;
        const handler = () => {
          this.logger.info(`Number key ${numberKey} pressed, isVisible: ${this.isVisible}`);
          if (this.isVisible) {
            this.selectJobByNumber(numberKey);
          }
        };
        
        const keyName = `keydown-${keyCode}`;
        this.logger.info(`Setting up handler for ${keyName}`);
        
        this.scene.input.keyboard?.on(keyName, handler);
        this.keyboardHandlers.push({ event: keyName, handler });
      });
    }
    
    // Log that keyboard handlers are set up
    this.logger.info('Keyboard handlers set up for ClassSelectionMenu');
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

    // Close button removed - use J hotkey or ESC to close
    
    // Create instruction text
    const instruction = this.scene.add.text(centerX, centerY - menuHeight / 2 + 80, 'Use number keys 1-9 to select a job', {
      fontSize: '16px',
      color: '#cccccc',
      fontStyle: 'italic',
    });
    instruction.setOrigin(0.5, 0.5);

    // Add all to container
    this.container.add([overlay, this.background, title, instruction]);

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

    this.classes.forEach((classOption, index) => {
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
      
      // Add number indicator in top-left corner
      const numberKey = index + 1; // 1-based indexing for display
      const numberBg = this.scene.add.circle(x - gridSize/2 + 15, y - gridSize/2 + 15, 12, 0x4a4a4a);
      numberBg.setStrokeStyle(1, 0x6a6a6a);
      
      const numberText = this.scene.add.text(x - gridSize/2 + 15, y - gridSize/2 + 15, numberKey.toString(), {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      });
      numberText.setOrigin(0.5, 0.5);

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

      this.container.add([spriteBg, numberBg, numberText, sprite, className]);
    });
  }

  private selectJobByNumber(numberKey: number): void {
    this.logger.info(`selectJobByNumber called with key: ${numberKey}`);
    
    // Convert 1-based number to 0-based index
    const index = numberKey - 1;
    
    this.logger.info(`Total classes: ${this.classes.length}, index: ${index}`);
    
    // Check if index is valid
    if (index >= 0 && index < this.classes.length) {
      const classOption = this.classes[index];
      this.logger.info(`Found class option: ${classOption.name}, unlocked: ${classOption.unlocked}`);
      
      // Only select if unlocked
      if (classOption.unlocked) {
        this.logger.info(`Selecting class: ${classOption.name}`);
        this.selectClass(classOption);
      } else {
        this.logger.info(`Job ${classOption.name} is locked`);
      }
    } else {
      this.logger.warn(`Invalid job index: ${index}`);
    }
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
    this.logger.info('Showing ClassSelectionMenu');
    this.container.setVisible(true);
    this.isVisible = true;
    this.logger.info(`ClassSelectionMenu visible: ${this.isVisible}, keyboard available: ${!!this.scene.input.keyboard}`);

    // Use pre-loaded job data to refresh the display
    this.updateJobUnlockStates();
  }

  public hide(): void {
    this.container.setVisible(false);
    this.isVisible = false;
  }

  private handleJobDataUpdate(data: { jobData: Map<string, boolean>; jobTableData: any[] }): void {
    this.playerJobUnlockStatus = data.jobData;
    this.jobTableData = data.jobTableData;

    this.logger.info(
      `Job data updated via context: ${data.jobData.size} entries, ${data.jobTableData.length} jobs`
    );

    // Update display if menu is visible
    if (this.isVisible) {
      this.updateJobUnlockStates();
    }
  }

  public destroy(): void {
    // Unsubscribe from context events
    const context = UIContextService.getInstance();
    context.off(UIEvents.PLAYER_JOB_DATA_UPDATED, this.handleJobDataUpdate, this);
    
    // Remove keyboard handlers
    this.keyboardHandlers.forEach(({ event, handler }) => {
      this.scene.input.keyboard?.off(event, handler);
    });
    this.keyboardHandlers = [];

    this.container.destroy();
  }


  private updateJobUnlockStates(): void {
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
      this.logger.info(`Class option ${classOption.id}: unlocked=${isUnlocked}`);
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
