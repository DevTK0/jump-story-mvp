import Phaser from 'phaser';
import { BOTTOM_UI_CONFIG } from '../bottom-ui-config';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { ClassSelectionMenu } from '@/ui/menus/class-selection-menu';
import { NameChangeDialog } from '@/ui/menus/name-change-dialog';
import { LeaderboardDialog } from '@/ui/menus/leaderboard-dialog';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { DbConnection } from '@/spacetime/client';
import { UIContextService, UIEvents } from '../../services/ui-context-service';

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
  private nameChangeDialog: NameChangeDialog | null = null;
  private leaderboardDialog: LeaderboardDialog | null = null;
  private playerIdentity: Identity | null = null;
  private dbConnection: DbConnection | null = null;

  private options: MenuOption[] = [
    {
      label: 'Jobs',
      action: () => {
        this.logger.info('Open job selection');
        this.showClassSelectionMenu();
      },
    },
    {
      label: 'Change name',
      action: () => {
        this.logger.info('Change player name');
        this.showChangeNameDialog();
      },
    },
    {
      label: 'Leaderboard',
      action: () => {
        this.logger.info('Open leaderboard');
        this.showLeaderboardDialog();
      },
    },
  ];

  constructor(scene: Phaser.Scene, parentButton: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.parentButton = parentButton;

    // Get data from context service
    const context = UIContextService.getInstance();
    this.playerIdentity = context.getPlayerIdentity();
    this.dbConnection = context.getDbConnection();

    // Subscribe to job data updates
    context.on(UIEvents.PLAYER_JOB_DATA_UPDATED, this.handleJobDataUpdate, this);

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
    // Check if player is in combat
    if (this.dbConnection && this.playerIdentity) {
      let playerFound = false;
      for (const player of this.dbConnection.db.player.iter()) {
        if (player.identity.toHexString() === this.playerIdentity.toHexString()) {
          playerFound = true;
          this.logger.info(`Player combat state: inCombat=${player.inCombat}`);
          if (player.inCombat === true) {
            this.logger.warn('Cannot change jobs while in combat');
            // Show combat warning (could add a visual notification here)
            return;
          }
          break;
        }
      }
      if (!playerFound) {
        this.logger.warn('Player not found in database');
      }
    }

    if (!this.classSelectionMenu) {
      // ClassSelectionMenu will get identity and connection from context
      this.classSelectionMenu = new ClassSelectionMenu(this.scene);
    }
    this.classSelectionMenu?.show();
  }

  private handleJobDataUpdate(data: { jobData: Map<string, boolean>; jobTableData: any[] }): void {
    this.logger.info(
      `Job data updated via context: ${data.jobData.size} entries, ${data.jobTableData.length} jobs`
    );
    
    // No need to update ClassSelectionMenu here as it has its own event subscription
  }

  private showChangeNameDialog(): void {
    if (!this.nameChangeDialog) {
      // NameChangeDialog will get identity and connection from context
      this.nameChangeDialog = new NameChangeDialog(this.scene);
    }
    this.nameChangeDialog.show();
  }

  private showLeaderboardDialog(): void {
    if (!this.leaderboardDialog) {
      // LeaderboardDialog will get data from context
      this.leaderboardDialog = new LeaderboardDialog(this.scene);
    }
    this.leaderboardDialog.show();
  }

  // Keep these methods for backward compatibility but they won't be called anymore
  public setPlayerIdentity(_identity: Identity): void {
    // No longer needed - gets from context
  }

  public setDbConnection(_dbConnection: DbConnection): void {
    // No longer needed - gets from context
  }

  public destroy(): void {
    // Unsubscribe from context events
    const context = UIContextService.getInstance();
    context.off(UIEvents.PLAYER_JOB_DATA_UPDATED, this.handleJobDataUpdate, this);

    this.hide();
    this.items.destroy(true);
    this.container.destroy();
    this.classSelectionMenu?.destroy();
    this.nameChangeDialog?.destroy();
    this.leaderboardDialog?.destroy();
  }
}
