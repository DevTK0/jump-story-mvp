import type { System } from '../../shared/types';
import { Player } from '../player/player';
import { InputSystem } from '../player/input';
import type { IDebuggable } from './debug-interfaces';
import { DEBUG_CONFIG } from './config';
import { DebugState } from './debug-state';
import { BaseDebugRenderer } from './debug-renderer';

/**
 * Debug wrapper for Player class since Player extends Phaser.GameObjects.Sprite
 */
class PlayerDebugWrapper extends BaseDebugRenderer implements IDebuggable {
  private player: Player;

  constructor(player: Player) {
    super();
    this.player = player;
  }

  protected performDebugRender(graphics: Phaser.GameObjects.Graphics): void {
    const body = this.player.body;
    if (!body) return;

    // Draw player hitbox
    graphics.lineStyle(2, DEBUG_CONFIG.colors.hitbox, DEBUG_CONFIG.ui.hitboxAlpha);
    graphics.strokeRect(body.x, body.y, body.width, body.height);

    // Draw center point
    graphics.fillStyle(DEBUG_CONFIG.colors.hitbox, 1);
    graphics.fillCircle(this.player.x, this.player.y, DEBUG_CONFIG.ui.centerPointRadius);
  }

  protected provideDebugInfo(): Record<string, any> {
    const body = this.player.body;
    const playerState = this.player.getPlayerState();
    
    return {
      position: { x: Math.round(this.player.x), y: Math.round(this.player.y) },
      health: `${playerState.health}/${playerState.maxHealth}`,
      facing: playerState.facingDirection === 1 ? 'Right' : 'Left',
      canJump: playerState.canJump,
      isClimbing: playerState.isClimbing,
      isAttacking: playerState.isAttacking,
      isAlive: playerState.isAlive,
      hitboxSize: `${body.width}x${body.height}`,
    };
  }
}

export class DebugSystem implements System {
  private player: Player;
  private scene: Phaser.Scene;
  private debuggableComponents: IDebuggable[] = [];
  private componentsRefreshed = false;
  
  // Graphics objects
  private graphics?: Phaser.GameObjects.Graphics;
  private stateText?: Phaser.GameObjects.Text;
  
  // Scrollable debug window
  private debugContainer?: Phaser.GameObjects.Container;
  private debugBackground?: Phaser.GameObjects.Rectangle;
  private debugTexts: Phaser.GameObjects.Text[] = [];
  private scrollOffset = 0;
  private maxLines = 15; // Maximum visible lines
  
  constructor(player: Player, _inputSystem: InputSystem, scene: Phaser.Scene) {
    this.player = player;
    this.scene = scene;
    
    // Components will be collected on first update
    this.debuggableComponents = [];
  }
  
  private refreshDebuggableComponents(): void {
    // Create wrapper for player since it doesn't extend BaseDebugRenderer
    const playerWrapper = new PlayerDebugWrapper(this.player);
    
    // Collect all debuggable components
    const potentialComponents: unknown[] = [
      playerWrapper,
      this.player.getSystem('movement'),
      this.player.getSystem('combat'),
      this.player.getSystem('climbing'),
      this.scene,
    ];
    
    this.debuggableComponents = potentialComponents.filter((component): component is IDebuggable => 
      component != null && typeof component === 'object' && 'renderDebug' in component
    );
  }
  
  update(_time: number, _delta: number): void {
    // Refresh components on first update (after all systems are registered)
    if (!this.componentsRefreshed) {
      this.refreshDebuggableComponents();
      this.componentsRefreshed = true;
    }
    
    // Check for debug toggle
    this.handleDebugToggle();
    
    // Check for shadow effect toggle
    this.handleShadowToggle();
    
    // Render shadow effect if enabled (independent of debug mode)
    this.renderShadowEffect();
    
    if (!DebugState.getInstance().enabled) {
      return;
    }
    
    // Clear previous debug drawings
    if (this.graphics) {
      this.graphics.clear();
      
      // Let each component render its own debug info
      this.debuggableComponents.forEach(component => {
        component.renderDebug?.(this.graphics!);
      });
    }
    
    // Update state display
    this.updateStateDisplay();
  }
  
  private handleDebugToggle(): void {
    // Check if 'D' key was just pressed
    const keys = this.scene.input.keyboard!;
    const dKey = keys.addKey(DEBUG_CONFIG.input.toggleKey);
    
    if (Phaser.Input.Keyboard.JustDown(dKey)) {
      const debugState = DebugState.getInstance();
      debugState.toggle();
      
      if (debugState.enabled) {
        this.enableDebugMode();
      } else {
        this.disableDebugMode();
      }
    }
  }
  
  private handleShadowToggle(): void {
    // Shadow toggle removed - S key reserved for game features
    // Shadow effect can be controlled programmatically via ShadowState.getInstance()
  }
  
  private renderShadowEffect(): void {
    // Render shadow effect if enabled (works independently from debug mode)
    const movementSystem = this.player.getSystem('movement');
    if (movementSystem && 'renderShadowEffect' in movementSystem) {
      (movementSystem as any).renderShadowEffect();
    }
  }
  
  private enableDebugMode(): void {
    // Create graphics object for rendering
    this.graphics = this.scene.add.graphics();
    
    // Create scrollable debug window
    this.createScrollableDebugWindow();
    
    // Set up scroll controls
    this.setupScrollControls();
  }
  
  private createScrollableDebugWindow(): void {
    const windowWidth = 300;
    const windowHeight = this.maxLines * 20 + 20; // 20px per line + padding
    const windowX = 10;
    const windowY = 10;
    
    // Create container for the debug window
    this.debugContainer = this.scene.add.container(windowX, windowY);
    this.debugContainer.setScrollFactor(0);
    this.debugContainer.setDepth(1000);
    
    // Create background
    this.debugBackground = this.scene.add.rectangle(0, 0, windowWidth, windowHeight, 0x000000, 0.8);
    this.debugBackground.setOrigin(0, 0);
    this.debugBackground.setStrokeStyle(2, 0x00ff00, 0.8);
    this.debugContainer.add(this.debugBackground);
    
    // Create text objects for each line
    for (let i = 0; i < this.maxLines; i++) {
      const text = this.scene.add.text(10, 10 + i * 20, '', {
        fontSize: '14px',
        color: '#00ff00',
        fontFamily: 'monospace'
      });
      text.setOrigin(0, 0);
      this.debugTexts.push(text);
      this.debugContainer.add(text);
    }
    
    // Add scroll indicator
    const scrollText = this.scene.add.text(windowWidth - 80, windowHeight - 15, 'Mouse: Scroll', {
      fontSize: '10px',
      color: '#888888',
      fontFamily: 'monospace'
    });
    scrollText.setOrigin(0, 0);
    this.debugContainer.add(scrollText);
  }
  
  private setupScrollControls(): void {
    // Set up mouse wheel scrolling
    this.scene.input.on('wheel', (pointer: any, _gameObjects: any, _deltaX: number, deltaY: number, _deltaZ: number) => {
      if (!DebugState.getInstance().enabled) return;
      
      // Check if mouse is over the debug window
      if (this.debugContainer && this.isMouseOverDebugWindow(pointer)) {
        const scrollDirection = Math.sign(deltaY);
        
        if (scrollDirection > 0) {
          // Scroll down
          this.scrollOffset = Math.min(this.getTotalLines() - this.maxLines, this.scrollOffset + 1);
        } else if (scrollDirection < 0) {
          // Scroll up
          this.scrollOffset = Math.max(0, this.scrollOffset - 1);
        }
      }
    });
  }
  
  private isMouseOverDebugWindow(pointer: any): boolean {
    if (!this.debugContainer || !this.debugBackground) return false;
    
    // Get debug window bounds (container position + background bounds)
    const containerBounds = this.debugContainer.getBounds();
    
    return pointer.x >= containerBounds.x && 
           pointer.x <= containerBounds.x + containerBounds.width &&
           pointer.y >= containerBounds.y && 
           pointer.y <= containerBounds.y + containerBounds.height;
  }
  
  private disableDebugMode(): void {
    // Clean up graphics
    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = undefined;
    }
    
    if (this.stateText) {
      this.stateText.destroy();
      this.stateText = undefined;
    }
    
    // Clean up debug window
    if (this.debugContainer) {
      this.debugContainer.destroy();
      this.debugContainer = undefined;
    }
    
    this.debugTexts = [];
    this.scrollOffset = 0;
    
    // Clean up debug resources from all debuggable components
    this.debuggableComponents.forEach(component => {
      component.cleanupDebugResources?.();
    });
  }
  
  private getTotalLines(): number {
    // Collect debug info to count total lines
    const debugInfo = this.debuggableComponents
      .map(component => component.getDebugInfo?.() || {})
      .reduce((acc, info) => ({ ...acc, ...info }), {});
    
    return Object.keys(debugInfo).length;
  }
  
  private updateStateDisplay(): void {
    if (!this.debugContainer) return;
    
    // Collect debug info from all components
    const debugInfo = this.debuggableComponents
      .map(component => component.getDebugInfo?.() || {})
      .reduce((acc, info) => ({ ...acc, ...info }), {});
    
    // Convert to array of lines
    const lines = Object.entries(debugInfo).map(([key, value]) => {
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `${key}: ${valueStr}`;
    });
    
    // Update visible text lines with scrolling
    for (let i = 0; i < this.maxLines; i++) {
      const lineIndex = i + this.scrollOffset;
      const text = this.debugTexts[i];
      
      if (lineIndex < lines.length) {
        text.setText(lines[lineIndex]);
        text.setVisible(true);
      } else {
        text.setText('');
        text.setVisible(false);
      }
    }
    
    // Clamp scroll offset if we scrolled too far
    const maxScroll = Math.max(0, lines.length - this.maxLines);
    this.scrollOffset = Math.min(this.scrollOffset, maxScroll);
  }
  
  public isDebugEnabled(): boolean {
    return DebugState.getInstance().enabled;
  }
  
  destroy(): void {
    this.disableDebugMode();
  }
}