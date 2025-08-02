import Phaser from 'phaser';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { PlayerProfileDialog } from '../menus/player-profile-dialog';
import { UIContextService } from '../services/ui-context-service';

export interface MenuAction {
  label: string;
  icon?: string;
  color?: number;
  requiresAdmin?: boolean;
  action: (playerIdentity: Identity, playerName: string) => void;
}

export class PlayerContextMenu {
  private scene: Phaser.Scene;
  private background: Phaser.GameObjects.Rectangle;
  private items: Phaser.GameObjects.Group;
  private logger: ModuleLogger = createLogger('PlayerContextMenu');

  private targetIdentity: Identity | null = null;
  private targetName: string = '';
  private isVisible: boolean = false;

  private actions: (MenuAction | null)[] = [
    {
      label: 'View Profile',
      action: (identity, name) => {
        this.logger.info(`View profile: ${name}`);
        
        // Get player data from database
        const uiContext = UIContextService.getInstance();
        const dbConnection = uiContext.getDbConnection();
        
        if (dbConnection) {
          const player = dbConnection.db.player.identity.find(identity);
          if (player) {
            // Show player profile dialog
            const profileDialog = new PlayerProfileDialog(this.scene, player);
            profileDialog.show();
          } else {
            this.logger.warn(`Player not found: ${identity.toHexString()}`);
          }
        }
      },
    },
    {
      label: 'Invite to Party',
      action: (_identity, name) => {
        this.logger.info(`Invite to party: ${name}`);
        
        // Get connection from UI context
        const uiContext = UIContextService.getInstance();
        const dbConnection = uiContext.getDbConnection();
        const myIdentity = uiContext.getPlayerIdentity();
        
        if (dbConnection && myIdentity) {
          // Check if we're in a party and not the leader
          const myMembership = dbConnection.db.partyMember.playerIdentity.find(myIdentity);
          if (myMembership) {
            const party = dbConnection.db.party.partyId.find(myMembership.partyId);
            if (party && party.leaderIdentity.toHexString() !== myIdentity.toHexString()) {
              this.logger.warn('Only the party leader can invite players');
              alert('Only the party leader can invite players');
              return;
            }
          }
          
          // Call the invite reducer (will create party if needed)
          this.logger.info(`Calling inviteToParty reducer for ${name}`);
          dbConnection.reducers.inviteToParty(name);
        } else {
          this.logger.warn('No database connection available for party invite');
        }
      },
    },
  ];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Create a simple background rectangle
    this.background = this.scene.add.rectangle(0, 0, 200, 120, 0x2a2a2a);
    this.background.setScrollFactor(0);
    this.background.setDepth(9999);
    this.background.setVisible(false);
    this.background.setStrokeStyle(2, 0x4a4a4a);

    // Create group for menu items
    this.items = this.scene.add.group();

    // Setup click outside listener
    this.setupClickOutsideListener();
  }

  private setupClickOutsideListener(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.isVisible) return;

      // Check if click is outside the menu
      const bounds = this.background.getBounds();
      if (!bounds.contains(pointer.x, pointer.y)) {
        this.hide();
      }
    });
  }

  public show(
    x: number,
    y: number,
    playerIdentity: Identity,
    playerName: string,
    isAdmin: boolean = false
  ): void {
    this.targetIdentity = playerIdentity;
    this.targetName = playerName;

    // Clear previous items
    this.clearMenuItems();

    // Convert world coordinates to screen coordinates
    const camera = this.scene.cameras.main;
    const screenX = x - camera.scrollX;
    const screenY = y - camera.scrollY;

    // Position background - offset by half width/height to make top-left at click position
    const bgWidth = 150;
    const bgHeight = 110;
    this.background.setPosition(screenX + bgWidth / 2, screenY + bgHeight / 2);
    this.background.setVisible(true);
    this.isVisible = true;

    // Add header text
    const headerText = this.scene.add.text(screenX + bgWidth / 2, screenY + 20, playerName, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    headerText.setOrigin(0.5, 0.5);
    headerText.setScrollFactor(0);
    headerText.setDepth(10000);
    this.items.add(headerText);

    // Add menu items
    let yOffset = 50;
    this.actions.forEach((action) => {
      if (action && (!action.requiresAdmin || isAdmin)) {
        const itemText = this.scene.add.text(screenX + 15, screenY + yOffset, action.label, {
          fontSize: '12px',
          color: '#ffffff',
        });
        itemText.setScrollFactor(0);
        itemText.setDepth(10000);
        itemText.setInteractive({ useHandCursor: true });

        itemText.on('pointerover', () => {
          itemText.setColor('#aaaaff');
        });

        itemText.on('pointerout', () => {
          itemText.setColor('#ffffff');
        });

        itemText.on('pointerdown', () => {
          if (this.targetIdentity) {
            action.action(this.targetIdentity, this.targetName);
            this.hide();
          }
        });

        this.items.add(itemText);
        yOffset += 25;
      }
    });
  }

  public hide(): void {
    this.background.setVisible(false);
    this.clearMenuItems();
    this.isVisible = false;
  }

  private clearMenuItems(): void {
    this.items.clear(true, true);
  }

  public destroy(): void {
    this.hide();
    this.background.destroy();
    this.items.destroy(true);
  }
}
