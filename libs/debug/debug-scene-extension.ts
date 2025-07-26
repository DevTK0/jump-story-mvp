import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { DebugState } from './debug-state';
import { DEBUG_CONFIG } from './config';
import type { IDebuggable } from './debug-interfaces';

/**
 * Plugin-based debug features for scenes
 */
export class DebugSceneExtension {
  private scene: Phaser.Scene;
  private logger: ModuleLogger;
  private debugState: DebugState;
  private graphics?: Phaser.GameObjects.Graphics;
  private debuggables: Map<string, IDebuggable> = new Map();
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.logger = createLogger('DebugSceneExtension');
    this.debugState = DebugState.getInstance();
  }
  
  /**
   * Enable debug features
   */
  enable(): void {
    // Don't toggle debug state here - it should be managed by the scene config
    // The DebugSystem in the player will handle rendering when DebugState is enabled
    
    // Create debug graphics layer
    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(9999); // Render above everything
    
    // Hook into scene render
    this.scene.events.on('postupdate', this.renderDebug, this);
    
    this.logger.info('Debug features enabled');
  }
  
  /**
   * Disable debug features
   */
  disable(): void {
    if (this.debugState.enabled) {
      this.debugState.toggle();
    }
    
    // Remove debug graphics
    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = undefined;
    }
    
    // Remove render hook
    this.scene.events.off('postupdate', this.renderDebug, this);
    
    this.logger.info('Debug features disabled');
  }
  
  /**
   * Register a debuggable object
   */
  registerDebuggable(name: string, debuggable: IDebuggable): void {
    this.debuggables.set(name, debuggable);
  }
  
  /**
   * Unregister a debuggable object
   */
  unregisterDebuggable(name: string): void {
    this.debuggables.delete(name);
  }
  
  /**
   * Get debug info from all registered objects
   */
  getDebugInfo(): Record<string, any> {
    const info: Record<string, any> = {};
    
    // Add scene info
    info.scene = {
      key: this.scene.scene.key,
      active: this.scene.scene.isActive(),
      visible: this.scene.scene.isVisible(),
    };
    
    // Add physics info
    const staticBodies = this.scene.physics.world.staticBodies.entries.length;
    const dynamicBodies = this.scene.physics.world.bodies.entries.length;
    
    info.physics = {
      staticBodies,
      dynamicBodies,
      totalBodies: staticBodies + dynamicBodies,
    };
    
    // Collect info from debuggables
    this.debuggables.forEach((debuggable, name) => {
      if (debuggable.isDebugEnabled && debuggable.isDebugEnabled()) {
        info[name] = debuggable.getDebugInfo ? debuggable.getDebugInfo() : {};
      }
    });
    
    return info;
  }
  
  /**
   * Cleanup debug extension
   */
  destroy(): void {
    this.disable();
    this.debuggables.clear();
  }
  
  // Private methods
  
  private renderDebug(): void {
    if (!this.debugState.enabled || !this.graphics) return;
    
    // Clear previous frame
    this.graphics.clear();
    
    // Render debug visuals for all debuggables
    this.debuggables.forEach((debuggable) => {
      if (debuggable.isDebugEnabled && debuggable.isDebugEnabled() && debuggable.renderDebug) {
        debuggable.renderDebug(this.graphics!);
      }
    });
    
    // Render collision boundaries near player
    this.drawNearbyCollisionBoundaries();
    
    // Render all object hitboxes
    this.drawAllObjectHitboxes();
  }
  
  private drawNearbyCollisionBoundaries(): void {
    if (!this.graphics) return;
    
    // Get player position (if available)
    const player = this.debuggables.get('player') as any;
    if (!player || !player.x || !player.y) return;
    
    const playerX = player.x;
    const playerY = player.y;
    const checkRadius = DEBUG_CONFIG.ui.collisionCheckRadius;
    
    // Set style for collision boundaries
    this.graphics.lineStyle(2, DEBUG_CONFIG.colors.collision, 0.8);
    
    // Get all physics bodies in the world
    const bodies = this.scene.physics.world.staticBodies.entries;
    
    for (const body of bodies) {
      // Only draw bodies near the player
      const distance = Phaser.Math.Distance.Between(
        playerX,
        playerY,
        body.x + body.halfWidth,
        body.y + body.halfHeight
      );
      
      if (distance < checkRadius) {
        // Draw collision boundary rectangle
        this.graphics.strokeRect(body.x, body.y, body.width, body.height);
      }
    }
  }
  
  private drawAllObjectHitboxes(): void {
    if (!this.graphics) return;
    
    // Get player position (if available)
    const player = this.debuggables.get('player') as any;
    if (!player || !player.x || !player.y) return;
    
    const playerX = player.x;
    const playerY = player.y;
    const checkRadius = DEBUG_CONFIG.ui.collisionCheckRadius;
    
    // Set style for object hitboxes
    this.graphics.lineStyle(2, 0xff0000, 0.7); // Red color for enemy hitboxes
    
    // Draw enemy hitboxes if we have an enemy manager
    const enemyManager = this.debuggables.get('enemyManager') as any;
    if (enemyManager && enemyManager.getEnemyGroup) {
      enemyManager.getEnemyGroup().children.entries.forEach((enemy: any) => {
        const enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
        if (enemySprite.body) {
          const body = enemySprite.body as Phaser.Physics.Arcade.Body;
          const distance = Phaser.Math.Distance.Between(
            playerX,
            playerY,
            enemySprite.x,
            enemySprite.y
          );
          
          if (distance < checkRadius && this.graphics) {
            // Draw enemy hitbox
            this.graphics.strokeRect(body.x, body.y, body.width, body.height);
            
            // Draw center point
            this.graphics.fillStyle(0xff0000, 0.8);
            this.graphics.fillCircle(enemySprite.x, enemySprite.y, 2);
          }
        }
      });
    }
    
    // Draw all dynamic bodies (non-player entities)
    this.graphics.lineStyle(1, 0xffff00, 0.5); // Yellow for other dynamic bodies
    
    // Get combat system to check for attack hitbox
    const combatSystem = player.getSystem ? player.getSystem('combat') : null;
    const attackHitbox = combatSystem ? (combatSystem as any).getHitboxSprite()?.body : null;
    
    this.scene.physics.world.bodies.entries.forEach((body) => {
      // Skip player body (it's handled by Player class)
      if (player.body && body === player.body) return;
      
      // Skip attack hitbox (it's handled by Combat system)
      if (attackHitbox && body === attackHitbox) return;
      
      const distance = Phaser.Math.Distance.Between(
        playerX,
        playerY,
        body.x + body.halfWidth,
        body.y + body.halfHeight
      );
      
      if (distance < checkRadius && this.graphics) {
        this.graphics.strokeRect(body.x, body.y, body.width, body.height);
      }
    });
  }
}