import Phaser from 'phaser';
import { SceneInitializer, type SceneConfig } from '@/core';
import { SceneConnectionHelper } from '@/networking';
import spriteConfig from '../config/sprite-config';
import audioConfig from '../config/audio-config';

// Default spawn position
const _defaultPosition = { x: 500, y: 400 };

// Scene configuration (same as PlaygroundScene)
const sceneConfig: SceneConfig = {
  key: 'preloader', // Different key for preloader
  player: {
    spawnX: _defaultPosition.x,
    spawnY: _defaultPosition.y,
    texture: 'soldier',
  },
  database: {
    target: (import.meta.env.VITE_SPACETIME_TARGET || 'local') as 'local' | 'cloud',
    moduleName: 'jump-story',
  },
  debug: {
    enabled: false,
    shadow: false,
    invulnerable: false,
    fps: false,
    metrics: true,
  },
  sprites: spriteConfig,
  audio: audioConfig,
};

/**
 * Preloader scene that loads all game assets and establishes database connection
 * before starting the main game
 */
export class PreloaderScene extends Phaser.Scene {
  private initializer: SceneInitializer;
  private connectionHelper?: SceneConnectionHelper;
  private loadingStage: string = 'assets';
  private connectionEstablished: boolean = false;
  
  constructor() {
    super({ key: 'preloader' });
    this.initializer = new SceneInitializer(this, sceneConfig);
  }

  preload(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Create loading UI
    this.createLoadingUI(width, height);
    
    // Load all game assets
    this.initializer.loadAssets();
  }

  private createLoadingUI(width: number, height: number): void {
    // Background
    this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);
    
    // Title
    this.add.text(width / 2, height / 2 - 100, 'Jump Story', {
      font: '48px Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    
    // Loading text
    const loadingText = this.add.text(width / 2, height / 2 - 20, 'Loading...', {
      font: '24px Arial',
      color: '#ffffff',
    }).setOrigin(0.5).setName('loadingText');
    
    // Progress bar background
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRoundedRect(width / 2 - 160, height / 2 + 20, 320, 50, 8);
    
    // Progress bar
    const progressBar = this.add.graphics().setName('progressBar');
    
    // Progress text
    const percentText = this.add.text(width / 2, height / 2 + 45, '0%', {
      font: '18px Arial',
      color: '#ffffff',
    }).setOrigin(0.5).setName('percentText');
    
    // Asset being loaded text
    const assetText = this.add.text(width / 2, height / 2 + 90, '', {
      font: '16px Arial',
      color: '#888888',
    }).setOrigin(0.5).setName('assetText');
    
    // Update progress bar
    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x4ecca3, 1);
      progressBar.fillRoundedRect(
        width / 2 - 150,
        height / 2 + 30,
        300 * value,
        30,
        5
      );
      
      percentText.setText(`${Math.floor(value * 100)}%`);
      
      if (value === 1) {
        loadingText.setText('Complete!');
      }
    });
    
    // Show current file being loaded
    this.load.on('fileprogress', (file: any) => {
      assetText.setText(`Loading: ${file.key}`);
    });
    
    // Handle load complete
    this.load.on('complete', () => {
      // Move to database connection phase
      this.connectToDatabase();
    });
    
    // Handle load error
    this.load.on('loaderror', (file: any) => {
      console.error('Error loading file:', file.key);
      assetText.setText(`Error loading: ${file.key}`);
      assetText.setColor('#ff0000');
    });
  }

  async create(): Promise<void> {
    // If assets are already loaded (e.g., from cache), continue to database connection
    if (this.load.totalToLoad === 0) {
      await this.connectToDatabase();
    }
  }
  
  private async connectToDatabase(): Promise<void> {
    this.loadingStage = 'database';
    
    // Update UI for database connection
    const loadingText = this.children.getByName('loadingText') as Phaser.GameObjects.Text;
    const assetText = this.children.getByName('assetText') as Phaser.GameObjects.Text;
    const percentText = this.children.getByName('percentText') as Phaser.GameObjects.Text;
    const progressBar = this.children.getByName('progressBar') as Phaser.GameObjects.Graphics;
    
    if (loadingText) loadingText.setText('Connecting to server...');
    if (assetText) assetText.setText('Establishing database connection');
    if (percentText) percentText.setText('');
    
    try {
      // Initialize connection helper
      this.connectionHelper = new SceneConnectionHelper(this, {
        target: sceneConfig.database?.target || 'local',
        moduleName: sceneConfig.database?.moduleName || 'jump-story',
      });
      
      // Connect to database
      await this.connectionHelper.connect();
      
      // Update progress bar to full
      if (progressBar) {
        progressBar.clear();
        progressBar.fillStyle(0x4ecca3, 1);
        progressBar.fillRoundedRect(
          this.cameras.main.width / 2 - 150,
          this.cameras.main.height / 2 + 30,
          300,
          30,
          5
        );
      }
      
      if (loadingText) loadingText.setText('Complete!');
      if (assetText) {
        assetText.setText('Click to start');
        assetText.setColor('#4ecca3');
        assetText.setFontSize(20);
        
        // Add pulsing animation
        this.tweens.add({
          targets: assetText,
          alpha: 0.5,
          duration: 800,
          ease: 'Power2',
          yoyo: true,
          repeat: -1,
        });
      }
      
      this.connectionEstablished = true;
      
      // Store connection in registry for PlaygroundScene to use
      this.registry.set('dbConnection', this.connectionHelper.getConnection());
      this.registry.set('dbIdentity', this.connectionHelper.getIdentity());
      
      // Click to start
      this.input.once('pointerdown', () => {
        this.startGame();
      });
      
    } catch (error) {
      console.error('Failed to connect to database:', error);
      if (loadingText) loadingText.setText('Connection Failed');
      if (assetText) {
        assetText.setText('Failed to connect to server. Please refresh the page.');
        assetText.setColor('#ff0000');
      }
    }
  }
  
  private startGame(): void {
    // Don't disconnect here - let PlaygroundScene take over the connection
    // Fade out before transitioning
    this.cameras.main.fadeOut(500, 0, 0, 0);
    
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('playground');
    });
  }
}