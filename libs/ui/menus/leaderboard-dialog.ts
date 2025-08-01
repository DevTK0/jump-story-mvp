import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { DbConnection } from '@/spacetime/client';
import { UIContextService } from '../services/ui-context-service';
import { type Leaderboard } from '@/spacetime/client';

export class LeaderboardDialog {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Rectangle;
  private logger: ModuleLogger = createLogger('LeaderboardDialog');

  private isVisible: boolean = false;
  
  public get visible(): boolean {
    return this.isVisible;
  }
  private _dbConnection: DbConnection | null = null;
  private leaderboardData: Leaderboard[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Get data from context service
    const context = UIContextService.getInstance();
    this._dbConnection = context.getDbConnection();

    // Subscribe to leaderboard updates
    this.subscribeToLeaderboard();

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
    const menuWidth = 400;
    const menuHeight = 500;
    this.background = this.scene.add.rectangle(centerX, centerY, menuWidth, menuHeight, 0x2a2a2a);
    this.background.setStrokeStyle(2, 0x4a4a4a);

    // Create title
    const title = this.scene.add.text(centerX, centerY - menuHeight / 2 + 40, 'Leaderboard', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0.5);

    // Create subtitle
    const subtitle = this.scene.add.text(centerX, centerY - menuHeight / 2 + 65, 'Top 10 Players', {
      fontSize: '14px',
      color: '#aaaaaa',
    });
    subtitle.setOrigin(0.5, 0.5);

    // Close button removed - use L hotkey or ESC to close

    // Add all to container
    this.container.add([overlay, this.background, title, subtitle]);

    // Create leaderboard entries
    this.createLeaderboardEntries(centerX, centerY, menuWidth, menuHeight);
  }

  private createLeaderboardEntries(
    centerX: number,
    centerY: number,
    menuWidth: number,
    menuHeight: number
  ): void {
    const startY = centerY - menuHeight / 2 + 100;
    const entryHeight = 35;
    const padding = 20;

    // Headers
    const headerY = startY - 20;
    const rankHeader = this.scene.add.text(centerX - menuWidth / 2 + padding, headerY, '#', {
      fontSize: '14px',
      color: '#888888',
      fontStyle: 'bold',
    });
    const nameHeader = this.scene.add.text(centerX - menuWidth / 2 + padding + 40, headerY, 'Name', {
      fontSize: '14px',
      color: '#888888',
      fontStyle: 'bold',
    });
    const levelHeader = this.scene.add.text(centerX + 50, headerY, 'Level', {
      fontSize: '14px',
      color: '#888888',
      fontStyle: 'bold',
    });
    const expHeader = this.scene.add.text(centerX + 110, headerY, 'EXP', {
      fontSize: '14px',
      color: '#888888',
      fontStyle: 'bold',
    });

    this.container.add([rankHeader, nameHeader, levelHeader, expHeader]);

    // If no data, show loading or empty message
    if (this.leaderboardData.length === 0) {
      const emptyText = this.scene.add.text(centerX, centerY, 'No leaderboard data available', {
        fontSize: '16px',
        color: '#888888',
      });
      emptyText.setOrigin(0.5, 0.5);
      this.container.add(emptyText);
      return;
    }

    // Create entry for each player
    this.leaderboardData.forEach((entry, index) => {
      const y = startY + index * entryHeight;

      // Background for alternating rows
      if (index % 2 === 0) {
        const entryBg = this.scene.add.rectangle(
          centerX,
          y + entryHeight / 2,
          menuWidth - padding * 2,
          entryHeight - 5,
          0x333333,
          0.3
        );
        this.container.add(entryBg);
      }

      // Rank (with special colors for top 3)
      const rankColor = index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#ffffff';
      const rank = this.scene.add.text(centerX - menuWidth / 2 + padding, y, `${entry.rank}`, {
        fontSize: '16px',
        color: rankColor,
        fontStyle: 'bold',
      });

      // Name
      const name = this.scene.add.text(centerX - menuWidth / 2 + padding + 40, y, entry.playerName, {
        fontSize: '16px',
        color: '#ffffff',
      });

      // Level
      const level = this.scene.add.text(centerX + 50, y, `${entry.level}`, {
        fontSize: '16px',
        color: '#ffffff',
      });

      // Experience
      const exp = this.scene.add.text(centerX + 110, y, `${entry.experience}`, {
        fontSize: '16px',
        color: '#ffffff',
      });

      this.container.add([rank, name, level, exp]);
    });
  }

  private subscribeToLeaderboard(): void {
    if (!this._dbConnection) {
      this.logger.error('No database connection available');
      return;
    }

    // Get initial leaderboard data
    this.refreshLeaderboard();

    // Subscribe to leaderboard updates
    this._dbConnection.db.leaderboard.onInsert((_ctx, leaderboard) => {
      this.logger.info(`Leaderboard entry inserted: rank ${leaderboard.rank}`);
      this.refreshLeaderboard();
    });

    this._dbConnection.db.leaderboard.onUpdate((_ctx, _oldEntry, newEntry) => {
      this.logger.info(`Leaderboard entry updated: rank ${newEntry.rank}`);
      this.refreshLeaderboard();
    });

    this._dbConnection.db.leaderboard.onDelete((_ctx, leaderboard) => {
      this.logger.info(`Leaderboard entry deleted: rank ${leaderboard.rank}`);
      this.refreshLeaderboard();
    });
  }

  private refreshLeaderboard(): void {
    if (!this._dbConnection) {
      return;
    }

    // Get all leaderboard entries sorted by rank
    this.leaderboardData = Array.from(this._dbConnection.db.leaderboard.iter())
      .sort((a, b) => a.rank - b.rank);

    this.logger.info(`Loaded ${this.leaderboardData.length} leaderboard entries`);

    // If dialog is visible, refresh the display
    if (this.isVisible) {
      this.refreshDisplay();
    }
  }

  private refreshDisplay(): void {
    // Remove existing leaderboard entries (keep overlay, background, title, subtitle, close button)
    const elementsToRemove: Phaser.GameObjects.GameObject[] = [];
    this.container.list.forEach((child) => {
      // Keep the first 5 elements (overlay, background, title, subtitle, close)
      if (this.container.list.indexOf(child) > 4) {
        elementsToRemove.push(child);
      }
    });
    elementsToRemove.forEach((element) => element.destroy());

    // Recreate leaderboard entries with updated data
    const camera = this.scene.cameras.main;
    const centerX = camera.width / 2;
    const centerY = camera.height / 2;
    const menuWidth = 400;
    const menuHeight = 500;
    this.createLeaderboardEntries(centerX, centerY, menuWidth, menuHeight);
  }

  public show(): void {
    this.container.setVisible(true);
    this.isVisible = true;

    // Refresh display when showing
    this.refreshDisplay();
  }

  public hide(): void {
    this.container.setVisible(false);
    this.isVisible = false;
  }

  public destroy(): void {
    // Note: SpacetimeDB SDK doesn't provide a way to remove event listeners
    // They will be cleaned up when the connection is destroyed
    
    this.container.destroy();
  }
}