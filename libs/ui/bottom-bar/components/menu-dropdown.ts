import Phaser from 'phaser';
import { BOTTOM_UI_CONFIG } from '../bottom-ui-config';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { ClassSelectionMenu } from '@/ui/menus/class-selection-menu';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { DbConnection } from '@/spacetime/client';

export interface MenuOption {
  label: string;
  action: () => void;
}

export class MenuDropdown {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private items: Phaser.GameObjects.Group;
  private logger: ModuleLogger = createLogger('MenuDropdown');

  private isVisible: boolean = false;
  private parentButton: Phaser.GameObjects.Container;
  private classSelectionMenu: ClassSelectionMenu | null = null;
  private playerIdentity: Identity | null = null;
  private dbConnection: DbConnection | null = null;
  private playerJobData: Map<number, boolean> = new Map();
  private jobTableData: any[] = [];

  private options: MenuOption[] = [
    {
      label: 'Inventory',
      action: () => {
        this.logger.info('Open inventory');
      },
    },
    {
      label: 'Jobs',
      action: () => {
        this.logger.info('Open job selection');
        this.showClassSelectionMenu();
      },
    },
    {
      label: 'Quests',
      action: () => {
        this.logger.info('Open quests');
      },
    },
    {
      label: 'Settings',
      action: () => {
        this.logger.info('Open settings');
      },
    },
    {
      label: 'Logout',
      action: () => {
        this.logger.info('Logout');
      },
    },
  ];

  constructor(scene: Phaser.Scene, parentButton: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.parentButton = parentButton;

    // Create container for the dropdown
    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(BOTTOM_UI_CONFIG.depth.buttons + 100); // Above the button
    this.container.setVisible(false);

    // Calculate dimensions
    const itemHeight = 30;
    const width = 120;
    const height = this.options.length * itemHeight + 10;

    // Create background
    this.background = this.scene.add.rectangle(0, 0, width, height, 0x2a2a2a);
    this.background.setStrokeStyle(1, 0x4a4a4a);
    this.background.setOrigin(0.5, 1); // Bottom center origin for upward dropdown

    this.container.add(this.background);

    // Create group for menu items
    this.items = this.scene.add.group();

    // Create menu items
    this.createMenuItems(width, itemHeight);

    // Setup click outside listener
    this.setupClickOutsideListener();
  }

  private createMenuItems(menuWidth: number, itemHeight: number): void {
    const startY = -this.background.height + itemHeight / 2 + 5;

    this.options.forEach((option, index) => {
      // Create item background (for hover effect)
      const itemBg = this.scene.add.rectangle(
        0,
        startY + index * itemHeight,
        menuWidth - 10,
        itemHeight - 5,
        0x2a2a2a,
        0
      );
      itemBg.setInteractive({ useHandCursor: true });

      // Create item text
      const itemText = this.scene.add.text(0, startY + index * itemHeight, option.label, {
        fontSize: '14px',
        color: '#ffffff',
      });
      itemText.setOrigin(0.5, 0.5);

      // Hover effects
      itemBg.on('pointerover', () => {
        itemBg.setFillStyle(0x3a3a3a, 1);
      });

      itemBg.on('pointerout', () => {
        itemBg.setFillStyle(0x2a2a2a, 0);
      });

      // Click handler
      itemBg.on('pointerdown', () => {
        option.action();
        this.hide();
      });

      this.container.add([itemBg, itemText]);
      this.items.add(itemBg);
      this.items.add(itemText);
    });
  }

  private setupClickOutsideListener(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.isVisible) return;

      // Get world position of container
      const worldPos = this.container.getWorldTransformMatrix();
      const bounds = new Phaser.Geom.Rectangle(
        worldPos.tx - this.background.width / 2,
        worldPos.ty - this.background.height,
        this.background.width,
        this.background.height
      );

      // Check if click is outside the menu and the parent button
      const parentBounds = this.parentButton.getBounds();
      if (!bounds.contains(pointer.x, pointer.y) && !parentBounds.contains(pointer.x, pointer.y)) {
        this.hide();
      }
    });
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public show(): void {
    // Position dropdown above the parent button
    const parentPos = this.parentButton.getWorldTransformMatrix();
    this.container.setPosition(parentPos.tx, parentPos.ty - 5);

    this.container.setVisible(true);
    this.isVisible = true;
  }

  public hide(): void {
    this.container.setVisible(false);
    this.isVisible = false;
  }

  private showClassSelectionMenu(): void {
    if (!this.classSelectionMenu && this.playerIdentity) {
      this.classSelectionMenu = new ClassSelectionMenu(this.scene, this.playerIdentity);
      // Set the database connection if available
      if (this.dbConnection) {
        this.classSelectionMenu.setDbConnection(this.dbConnection);
      }
      // Pass the pre-loaded job data - this is crucial!
      this.logger.info(
        `Passing job data to new ClassSelectionMenu: ${this.playerJobData.size} entries, ${this.jobTableData.length} jobs`
      );
      this.classSelectionMenu.setPlayerJobData(this.playerJobData, this.jobTableData);
    }
    this.classSelectionMenu?.show();
  }

  public setPlayerIdentity(identity: Identity): void {
    this.playerIdentity = identity;
  }

  public setDbConnection(dbConnection: DbConnection): void {
    this.dbConnection = dbConnection;
    // Update existing class selection menu if it exists
    if (this.classSelectionMenu) {
      this.classSelectionMenu.setDbConnection(dbConnection);
    }
  }

  public setPlayerJobData(jobData: Map<number, boolean>, jobTableData?: any[]): void {
    this.playerJobData = jobData;
    if (jobTableData) {
      this.jobTableData = jobTableData;
    }
    console.log('1');
    this.logger.info(`MenuDropdown received job data with ${jobData.size} entries, ${this.jobTableData.length} jobs`);
    // Update existing class selection menu if it exists
    if (this.classSelectionMenu) {
      console.log('2');
      this.logger.info('ClassSelectionMenu exists, updating it with job data');
      this.classSelectionMenu.setPlayerJobData(jobData, this.jobTableData);
    } else {
      console.log('3');
      this.logger.info('ClassSelectionMenu not created yet, storing data for later use');
    }
  }

  public destroy(): void {
    this.hide();
    this.items.destroy(true);
    this.container.destroy();
    this.classSelectionMenu?.destroy();
  }
}
