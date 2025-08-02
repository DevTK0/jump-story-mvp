import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { UIContextService } from '../services/ui-context-service';
import type { PartyInvite } from '@/spacetime/client';

export class PartyInvitePopup {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private logger: ModuleLogger = createLogger('PartyInvitePopup');
  
  private activeInvite: PartyInvite | null = null;
  private isVisible: boolean = false;
  private inviteQueue: PartyInvite[] = [];
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
    this.subscribeToInvites();
    this.setupKeyboardHandlers();
  }
  
  private createUI(): void {
    // Create container that will hold the popup
    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(3000); // Very high depth to appear above everything
    this.container.setVisible(false);
    
    const camera = this.scene.cameras.main;
    const centerX = camera.width / 2;
    const topY = 100; // Position near top of screen
    
    // Create popup background
    const bgWidth = 450;
    const bgHeight = 180;
    const background = this.scene.add.rectangle(centerX, topY, bgWidth, bgHeight, 0x2a2a2a);
    background.setStrokeStyle(3, 0x4a4a4a);
    background.setAlpha(0.95);
    
    // Create title
    const title = this.scene.add.text(centerX, topY - 50, 'Party Invite', {
      fontSize: '20px',
      color: '#ffff00',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0.5);
    
    // Create invite message (will be updated dynamically)
    const message = this.scene.add.text(centerX, topY - 10, '', {
      fontSize: '16px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: bgWidth - 40 },
    });
    message.setOrigin(0.5, 0.5);
    message.setName('inviteMessage');
    
    // Create key prompts on separate lines
    const acceptPrompt = this.scene.add.text(centerX, topY + 30, 'Press Y to Accept', {
      fontSize: '16px',
      color: '#00ff00',
      fontStyle: 'bold',
    });
    acceptPrompt.setOrigin(0.5, 0.5);
    
    const declinePrompt = this.scene.add.text(centerX, topY + 55, 'Press N to Decline', {
      fontSize: '16px',
      color: '#ff6666',
      fontStyle: 'bold',
    });
    declinePrompt.setOrigin(0.5, 0.5);
    
    // Add all elements to container
    this.container.add([background, title, message, acceptPrompt, declinePrompt]);
  }
  
  private subscribeToInvites(): void {
    const context = UIContextService.getInstance();
    const connection = context.getDbConnection();
    const identity = context.getPlayerIdentity();
    
    if (!connection || !identity) return;
    
    // Subscribe to new party invites for this player
    connection.db.partyInvite.onInsert((_ctx, invite) => {
      // Check if this invite is for us
      if (invite.inviteeIdentity.toHexString() === identity.toHexString()) {
        this.logger.info(`Received party invite: ${invite.inviteId}`);
        this.handleNewInvite(invite);
      }
    });
    
    // Handle invite deletions (accepted/declined/expired)
    connection.db.partyInvite.onDelete((_ctx, invite) => {
      if (invite.inviteeIdentity.toHexString() === identity.toHexString()) {
        this.handleInviteRemoved(invite);
      }
    });
  }
  
  private setupKeyboardHandlers(): void {
    // Y key to accept
    this.scene.input.keyboard?.on('keydown-Y', () => {
      if (this.isVisible && this.activeInvite) {
        this.acceptInvite();
      }
    });
    
    // N key to decline
    this.scene.input.keyboard?.on('keydown-N', () => {
      if (this.isVisible && this.activeInvite) {
        this.declineInvite();
      }
    });
  }
  
  private handleNewInvite(invite: PartyInvite): void {
    // Add to queue
    this.inviteQueue.push(invite);
    
    // If no active invite, show this one
    if (!this.activeInvite) {
      this.showNextInvite();
    }
  }
  
  private handleInviteRemoved(invite: PartyInvite): void {
    // Remove from queue if present
    this.inviteQueue = this.inviteQueue.filter(i => i.inviteId !== invite.inviteId);
    
    // If this was the active invite, hide and show next
    if (this.activeInvite && this.activeInvite.inviteId === invite.inviteId) {
      this.hide();
      this.showNextInvite();
    }
  }
  
  private showNextInvite(): void {
    if (this.inviteQueue.length === 0) {
      this.activeInvite = null;
      return;
    }
    
    // Get next invite from queue
    this.activeInvite = this.inviteQueue[0];
    
    // Get details for display
    const context = UIContextService.getInstance();
    const connection = context.getDbConnection();
    if (!connection) return;
    
    const party = connection.db.party.partyId.find(this.activeInvite.partyId);
    const inviter = connection.db.player.identity.find(this.activeInvite.inviterIdentity);
    
    if (!party || !inviter) {
      // Invalid invite, skip it
      this.inviteQueue.shift();
      this.showNextInvite();
      return;
    }
    
    // Update message text
    const messageText = this.container.getByName('inviteMessage') as Phaser.GameObjects.Text;
    if (messageText) {
      messageText.setText(`${inviter.name} invited you to join "${party.partyName}"`);
    }
    
    // Show popup
    this.show();
  }
  
  private acceptInvite(): void {
    if (!this.activeInvite) return;
    
    const context = UIContextService.getInstance();
    const connection = context.getDbConnection();
    
    if (connection) {
      this.logger.info(`Accepting invite ${this.activeInvite.inviteId}`);
      connection.reducers.acceptPartyInvite(this.activeInvite.inviteId);
    }
    
    // Remove from queue and hide
    this.inviteQueue.shift();
    this.hide();
    
    // Show next invite if any
    this.showNextInvite();
  }
  
  private declineInvite(): void {
    if (!this.activeInvite) return;
    
    this.logger.info(`Declining invite ${this.activeInvite.inviteId}`);
    
    // Just remove from queue and hide
    // The invite will expire on its own server-side
    this.inviteQueue.shift();
    this.hide();
    
    // Show next invite if any
    this.showNextInvite();
  }
  
  private show(): void {
    this.container.setVisible(true);
    this.isVisible = true;
    
    // Add fade in animation
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
    });
  }
  
  private hide(): void {
    // Add fade out animation
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.container.setVisible(false);
        this.isVisible = false;
        this.activeInvite = null;
      },
    });
  }
  
  public destroy(): void {
    this.hide();
    this.container.destroy();
  }
}