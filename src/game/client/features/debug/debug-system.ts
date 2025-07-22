import type { System } from '../../shared/types';
import { Player } from '../player/player';
import { InputSystem } from '../player/input';
import type { IDebuggable } from './debug-interfaces';
import { DEBUG_CONFIG } from './config';
import { DebugState } from './debug-state';
import { BaseDebugRenderer } from './debug-renderer';
import { DebugWindow } from './debug-window';

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
  
  // Debug window component
  private debugWindow: DebugWindow;
  
  constructor(player: Player, _inputSystem: InputSystem, scene: Phaser.Scene) {
    this.player = player;
    this.scene = scene;
    
    // Initialize debug window
    this.debugWindow = new DebugWindow({
      scene: this.scene,
      width: 300,
      height: 300,
      x: 10,
      y: 10,
      maxLines: 15,
    });
    
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
    
    // Update debug window display
    this.debugWindow.updateDisplay(this.debuggableComponents);
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
    
    // Show debug window
    this.debugWindow.show();
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
    
    // Hide debug window
    this.debugWindow.hide();
    
    // Clean up debug resources from all debuggable components
    this.debuggableComponents.forEach(component => {
      component.cleanupDebugResources?.();
    });
  }
  
  
  public isDebugEnabled(): boolean {
    return DebugState.getInstance().enabled;
  }
  
  destroy(): void {
    this.disableDebugMode();
    this.debugWindow.destroy();
  }
}