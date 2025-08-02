import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { UIContextService } from '../services/ui-context-service';
import type { Party } from '@/spacetime/client';

export class PartyMenu {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Rectangle;
  private logger: ModuleLogger = createLogger('PartyMenu');

  private isVisible: boolean = false;
  private memberTexts: Phaser.GameObjects.Text[] = [];
  private leaderControls: Phaser.GameObjects.Container | null = null;
  
  // Party state
  private currentParty: Party | null = null;
  private isLeader: boolean = false;
  
  public get visible(): boolean {
    return this.isVisible;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    this.createUI();
    this.hide(); // Start hidden
    
    // Setup keyboard handlers
    this.setupKeyboardHandlers();
    
    // Subscribe to party updates
    this.subscribeToPartyUpdates();
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
    const menuHeight = 600;
    this.background = this.scene.add.rectangle(centerX, centerY, menuWidth, menuHeight, 0x2a2a2a);
    this.background.setStrokeStyle(2, 0x4a4a4a);

    // Create title
    const title = this.scene.add.text(centerX, centerY - menuHeight / 2 + 40, 'Party Menu', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0.5);

    // Create instruction text
    const instruction = this.scene.add.text(centerX, centerY - menuHeight / 2 + 70, 'Press ESC to close', {
      fontSize: '14px',
      color: '#cccccc',
      fontStyle: 'italic',
    });
    instruction.setOrigin(0.5, 0.5);

    // Add all to container
    this.container.add([overlay, this.background, title, instruction]);
  }

  private setupKeyboardHandlers(): void {
    // Setup escape key to close
    this.scene.input.keyboard?.on('keydown-ESC', () => {
      if (this.isVisible) {
        this.hide();
      }
    });
    
    // Setup L key to leave party
    this.scene.input.keyboard?.on('keydown-L', () => {
      if (this.isVisible && this.currentParty) {
        const context = UIContextService.getInstance();
        const connection = context.getDbConnection();
        if (connection) {
          this.logger.info('Leaving party via L key');
          connection.reducers.leaveParty();
        }
      }
    });
    
    // Setup R key to rename party (leader only)
    this.scene.input.keyboard?.on('keydown-R', () => {
      if (this.isVisible && this.isLeader && this.currentParty) {
        const newName = prompt('Enter new party name:', this.currentParty.partyName || '');
        if (newName && newName.trim()) {
          // Sanitize party name
          const sanitized = this.sanitizePartyName(newName.trim());
          if (sanitized) {
            const context = UIContextService.getInstance();
            const connection = context.getDbConnection();
            if (connection) {
              connection.reducers.updatePartyName(sanitized);
            }
          } else {
            this.logger.warn('Invalid party name - contains only special characters or is too long');
          }
        }
      }
    });
    
    // Setup K key to kick member (leader only)
    this.scene.input.keyboard?.on('keydown-K', () => {
      if (this.isVisible && this.isLeader && this.currentParty) {
        const memberName = prompt('Enter player name to kick:');
        if (memberName && memberName.trim()) {
          // Sanitize player name
          const sanitized = this.sanitizePlayerName(memberName.trim());
          if (sanitized) {
            const context = UIContextService.getInstance();
            const connection = context.getDbConnection();
            if (connection) {
              connection.reducers.removeFromParty(sanitized);
            }
          } else {
            this.logger.warn('Invalid player name - contains only special characters or is too long');
          }
        }
      }
    });
  }

  private subscribeToPartyUpdates(): void {
    const context = UIContextService.getInstance();
    const connection = context.getDbConnection();
    
    if (!connection) return;
    
    // Subscribe to party changes
    connection.db.party.onInsert((_ctx, _party) => {
      if (this.isVisible) {
        this.refreshUI();
      }
    });
    
    connection.db.party.onUpdate((_ctx, _oldParty, _newParty) => {
      if (this.isVisible) {
        this.refreshUI();
      }
    });
    
    connection.db.party.onDelete((_ctx, _party) => {
      if (this.isVisible) {
        this.refreshUI();
      }
    });
    
    // Subscribe to party member changes
    connection.db.partyMember.onInsert((_ctx, _member) => {
      if (this.isVisible) {
        this.refreshUI();
      }
    });
    
    connection.db.partyMember.onDelete((_ctx, _member) => {
      if (this.isVisible) {
        this.refreshUI();
      }
    });
    
    // Subscribe to party invite changes
    connection.db.partyInvite.onInsert((_ctx, _invite) => {
      if (this.isVisible) {
        this.refreshUI();
      }
    });
    
    connection.db.partyInvite.onDelete((_ctx, _invite) => {
      if (this.isVisible) {
        this.refreshUI();
      }
    });
  }

  private refreshUI(): void {
    // Clear existing dynamic content
    this.clearDynamicContent();
    
    const context = UIContextService.getInstance();
    const connection = context.getDbConnection();
    const identity = context.getPlayerIdentity();
    
    if (!connection || !identity) return;
    
    const camera = this.scene.cameras.main;
    const centerX = camera.width / 2;
    const centerY = camera.height / 2;
    const menuHeight = 600;
    
    // Check if player is in a party
    const membership = connection.db.partyMember.playerIdentity.find(identity);
    
    if (membership) {
      // Player is in a party
      const party = connection.db.party.partyId.find(membership.partyId);
      if (!party) return;
      
      this.currentParty = party;
      this.isLeader = party.leaderIdentity.toHexString() === identity.toHexString();
      
      // Show party info
      this.showPartyInfo(party, centerX, centerY - menuHeight / 2 + 120);
    } else {
      // Player is not in a party
      this.currentParty = null;
      this.isLeader = false;
      
      // Show create party button
      this.showNoPartyUI(centerX, centerY - menuHeight / 2 + 120);
    }
  }

  private showPartyInfo(party: Party, x: number, startY: number): void {
    // Party name
    const partyNameText = this.scene.add.text(x, startY, `Party: ${party.partyName}`, {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    partyNameText.setOrigin(0.5, 0.5);
    this.container.add(partyNameText);
    
    // Members header
    const membersHeaderY = startY + 40;
    const membersHeader = this.scene.add.text(x, membersHeaderY, `Members (${party.memberCount}/4):`, {
      fontSize: '16px',
      color: '#ffffff',
    });
    membersHeader.setOrigin(0.5, 0.5);
    this.container.add(membersHeader);
    
    // Get member details
    const context = UIContextService.getInstance();
    const connection = context.getDbConnection();
    if (!connection) return;
    
    // List members
    let memberY = membersHeaderY + 30;
    const members = Array.from(connection.db.partyMember.iter())
      .filter(m => m.partyId === party.partyId);
    
    for (const member of members) {
      const player = connection.db.player.identity.find(member.playerIdentity);
      if (!player) continue;
      
      const isLeader = member.playerIdentity.toHexString() === party.leaderIdentity.toHexString();
      const memberText = this.scene.add.text(x - 100, memberY, 
        `${player.name}${isLeader ? ' (Leader)' : ''}`, {
        fontSize: '14px',
        color: isLeader ? '#ffaa00' : '#ffffff',
      });
      memberText.setOrigin(0, 0.5);
      this.container.add(memberText);
      this.memberTexts.push(memberText);
      
      // Show kick instruction for leader (except for themselves)
      if (this.isLeader && !isLeader) {
        const kickText = this.scene.add.text(x + 100, memberY, '[K]ick', {
          fontSize: '12px',
          color: '#ff6666',
          fontStyle: 'italic',
        });
        kickText.setOrigin(0, 0.5);
        this.container.add(kickText);
        this.memberTexts.push(kickText);
      }
      
      memberY += 30;
    }
    
    // Leader controls
    if (this.isLeader) {
      this.showLeaderControls(x, memberY + 40);
    }
    
    // Leave party instruction
    const leaveText = this.scene.add.text(x, memberY + 100, 'Press L to Leave Party', {
      fontSize: '16px',
      color: '#ffaa00',
      fontStyle: 'italic',
    });
    leaveText.setOrigin(0.5, 0.5);
    this.container.add(leaveText);
  }

  private showNoPartyUI(x: number, startY: number): void {
    // No party message
    const noPartyText = this.scene.add.text(x, startY, 'You are not in a party', {
      fontSize: '18px',
      color: '#cccccc',
    });
    noPartyText.setOrigin(0.5, 0.5);
    this.container.add(noPartyText);
    
    // Create party instruction
    const createText = this.scene.add.text(x, startY + 50, 'Invite a player to create a party', {
      fontSize: '16px',
      color: '#cccccc',
      fontStyle: 'italic',
    });
    createText.setOrigin(0.5, 0.5);
    this.container.add(createText);
  }

  private showLeaderControls(x: number, startY: number): void {
    this.leaderControls = this.scene.add.container(x, startY);
    
    // Leader controls instruction
    const leaderText = this.scene.add.text(0, 0, 'Leader Controls: [R]ename Party', {
      fontSize: '14px',
      color: '#aaffaa',
      fontStyle: 'italic',
    });
    leaderText.setOrigin(0.5, 0.5);
    this.leaderControls.add(leaderText);
    
    this.container.add(this.leaderControls);
  }


  private clearDynamicContent(): void {
    // Clear member texts
    this.memberTexts.forEach(text => text.destroy());
    this.memberTexts = [];
    
    // Clear leader controls
    if (this.leaderControls) {
      this.leaderControls.destroy();
      this.leaderControls = null;
    }
    
    // Remove all game objects except the base UI elements
    const baseElementCount = 4; // overlay, background, title, instruction
    while (this.container.list.length > baseElementCount) {
      const element = this.container.list[this.container.list.length - 1];
      if (element && typeof element.destroy === 'function') {
        element.destroy();
      }
    }
  }

  public show(): void {
    this.logger.info('Showing PartyMenu');
    this.container.setVisible(true);
    this.isVisible = true;
    this.refreshUI();
  }

  public hide(): void {
    this.logger.info('Hiding PartyMenu');
    this.container.setVisible(false);
    this.isVisible = false;
    this.clearDynamicContent();
  }

  public destroy(): void {
    this.hide();
    this.container.destroy();
  }

  /**
   * Sanitize party name input
   * - Max 20 characters
   * - Remove dangerous characters
   * - Ensure at least one alphanumeric character
   */
  private sanitizePartyName(input: string): string | null {
    // Remove control characters and dangerous characters
    let sanitized = input
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/[<>"'`&\\]/g, '') // Remove potentially dangerous characters
      .trim();
    
    // Enforce max length
    if (sanitized.length > 20) {
      sanitized = sanitized.substring(0, 20);
    }
    
    // Ensure at least one alphanumeric character
    if (!/[a-zA-Z0-9]/.test(sanitized)) {
      return null;
    }
    
    return sanitized;
  }

  /**
   * Sanitize player name input
   * - Max 16 characters (game's player name limit)
   * - Remove dangerous characters
   * - Ensure at least one alphanumeric character
   */
  private sanitizePlayerName(input: string): string | null {
    // Remove control characters and dangerous characters
    let sanitized = input
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/[<>"'`&\\]/g, '') // Remove potentially dangerous characters
      .trim();
    
    // Enforce max length
    if (sanitized.length > 16) {
      sanitized = sanitized.substring(0, 16);
    }
    
    // Ensure at least one alphanumeric character
    if (!/[a-zA-Z0-9]/.test(sanitized)) {
      return null;
    }
    
    return sanitized;
  }
}