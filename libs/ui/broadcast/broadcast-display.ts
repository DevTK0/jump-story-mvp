import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { DbConnection } from '@/spacetime/client';
import { type Broadcast } from '@/spacetime/client';

export class BroadcastDisplay {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private container!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Rectangle;
  private broadcastText!: Phaser.GameObjects.Text;
  private logger: ModuleLogger = createLogger('BroadcastDisplay');

  private dbConnection: DbConnection;
  private currentBroadcast: Broadcast | null = null;
  private fadeOutTimer?: Phaser.Time.TimerEvent;
  private broadcastQueue: Broadcast[] = [];
  private isDisplaying: boolean = false;

  constructor(scene: Phaser.Scene, dbConnection: DbConnection) {
    this.scene = scene;
    this.camera = scene.cameras.getCamera('ui') ?? scene.cameras.main;
    this.dbConnection = dbConnection;

    this.createUI();
    this.subscribeToUpdates();
    this.hide(); // Start hidden
  }

  private createUI(): void {
    const camera = this.camera;
    const centerX = camera.width / 2;
    const topY = 100; // Position from top of screen

    // Create container
    this.container = this.scene.add.container(centerX, topY);
    this.container.setScrollFactor(0);
    this.container.setDepth(1000); // High depth to appear above game elements

    // Create background
    const padding = 20;
    const width = 600;
    const height = 50;
    
    this.background = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.8);
    this.background.setStrokeStyle(2, 0xffd700); // Gold border for importance

    // Create text
    this.broadcastText = this.scene.add.text(0, 0, '', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width - padding * 2 }
    });
    this.broadcastText.setOrigin(0.5, 0.5);

    // Add to container
    this.container.add([this.background, this.broadcastText]);
  }

  private subscribeToUpdates(): void {
    // Get initial broadcasts and add to queue
    this.initializeQueue();

    // Subscribe to new broadcasts
    this.dbConnection.db.broadcast.onInsert((_ctx, broadcast) => {
      this.logger.info(`New broadcast received: ${broadcast.message}`);
      this.addToQueue(broadcast);
    });

    // Handle updates (shouldn't happen with our current design, but good to have)
    this.dbConnection.db.broadcast.onUpdate((_ctx, _oldBroadcast, newBroadcast) => {
      this.logger.info(`Broadcast updated: ${newBroadcast.message}`);
      // Update in queue if it exists
      const index = this.broadcastQueue.findIndex(b => b.broadcastId === newBroadcast.broadcastId);
      if (index !== -1) {
        this.broadcastQueue[index] = newBroadcast;
      }
      // Update current if it's being displayed
      if (this.currentBroadcast && this.currentBroadcast.broadcastId === newBroadcast.broadcastId) {
        this.broadcastText.setText(newBroadcast.message);
      }
    });

    // Handle deletions
    this.dbConnection.db.broadcast.onDelete((_ctx, deletedBroadcast) => {
      // Remove from queue if it exists
      this.broadcastQueue = this.broadcastQueue.filter(b => b.broadcastId !== deletedBroadcast.broadcastId);
      
      // If the deleted broadcast was the one we're showing, don't do anything
      // Let the natural 10-second timer handle the fade out
      // This prevents the broadcast from disappearing early when server deletes it after 15s
    });
  }

  private initializeQueue(): void {
    // Get all broadcasts sorted by publish date (oldest first for queue order)
    const broadcasts = Array.from(this.dbConnection.db.broadcast.iter())
      .sort((a, b) => a.publishDt.toDate().getTime() - b.publishDt.toDate().getTime());

    this.broadcastQueue = broadcasts;
    this.processQueue();
  }

  private addToQueue(broadcast: Broadcast): void {
    this.broadcastQueue.push(broadcast);
    
    // If not currently displaying, start processing the queue
    if (!this.isDisplaying) {
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.broadcastQueue.length === 0) {
      this.isDisplaying = false;
      this.logger.info('No more broadcasts in queue');
      return;
    }

    // Get the oldest broadcast from the queue
    const broadcast = this.broadcastQueue.shift();
    if (broadcast) {
      this.logger.info(`Processing next broadcast from queue: ${broadcast.message} (${this.broadcastQueue.length} remaining)`);
      this.showBroadcast(broadcast);
    }
  }

  private showBroadcast(broadcast: Broadcast): void {
    this.isDisplaying = true;
    this.currentBroadcast = broadcast;
    this.broadcastText.setText(broadcast.message);

    // Show with fade in animation
    this.container.setVisible(true);
    this.container.setAlpha(0);
    
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 500,
      ease: 'Power2'
    });

    // Cancel any existing fade out timer
    if (this.fadeOutTimer) {
      this.fadeOutTimer.destroy();
    }

    // Set up fade out after 10 seconds (broadcasts are cleaned up after 15s server-side)
    this.fadeOutTimer = this.scene.time.delayedCall(10000, () => {
      this.fadeOut();
    });
  }

  private fadeOut(): void {
    this.logger.info('Fading out current broadcast');
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        this.hide();
        // Process next broadcast in queue
        this.logger.info('Fade out complete, processing next in queue');
        this.processQueue();
      }
    });
  }

  private hide(): void {
    this.container.setVisible(false);
    this.currentBroadcast = null;
    this.isDisplaying = false;
  }

  public destroy(): void {
    if (this.fadeOutTimer) {
      this.fadeOutTimer.destroy();
    }
    this.container.destroy();
  }
}