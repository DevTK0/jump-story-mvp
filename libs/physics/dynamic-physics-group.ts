import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';

/**
 * Wrapper for Phaser physics groups that need dynamic membership updates.
 * Useful for entities that spawn/despawn during gameplay (like enemies).
 * 
 * This wrapper ensures physics relationships are maintained when
 * group membership changes.
 */
export class DynamicPhysicsGroup {
  private group: Phaser.Physics.Arcade.Group;
  private logger: ModuleLogger;
  private onMemberAdded?: (member: Phaser.Physics.Arcade.Sprite) => void;
  private onMemberRemoved?: (member: Phaser.Physics.Arcade.Sprite) => void;
  
  constructor(
    scene: Phaser.Scene,
    config?: Phaser.Types.Physics.Arcade.PhysicsGroupConfig
  ) {
    this.group = scene.physics.add.group(config);
    this.logger = createLogger('DynamicPhysicsGroup');
  }
  
  /**
   * Set callbacks for member lifecycle events.
   */
  setLifecycleCallbacks(
    onAdded?: (member: Phaser.Physics.Arcade.Sprite) => void,
    onRemoved?: (member: Phaser.Physics.Arcade.Sprite) => void
  ): void {
    this.onMemberAdded = onAdded;
    this.onMemberRemoved = onRemoved;
  }
  
  /**
   * Add a sprite to the group and trigger lifecycle callback.
   */
  add(
    child: Phaser.Physics.Arcade.Sprite,
    addToScene?: boolean
  ): Phaser.Physics.Arcade.Group {
    this.group.add(child, addToScene);
    
    if (this.onMemberAdded) {
      this.onMemberAdded(child);
    }
    
    this.logger.debug('Added member to dynamic group');
    return this.group;
  }
  
  /**
   * Remove a sprite from the group and trigger lifecycle callback.
   */
  remove(
    child: Phaser.Physics.Arcade.Sprite,
    removeFromScene?: boolean,
    destroyChild?: boolean
  ): Phaser.Physics.Arcade.Group {
    if (this.onMemberRemoved && this.group.contains(child)) {
      this.onMemberRemoved(child);
    }
    
    this.group.remove(child, removeFromScene, destroyChild);
    this.logger.debug('Removed member from dynamic group');
    return this.group;
  }
  
  /**
   * Clear all members from the group.
   */
  clear(removeFromScene?: boolean, destroyChildren?: boolean): Phaser.Physics.Arcade.Group {
    // Trigger removal callback for each member
    if (this.onMemberRemoved) {
      this.group.children.entries.forEach(child => {
        if (child instanceof Phaser.Physics.Arcade.Sprite) {
          this.onMemberRemoved!(child);
        }
      });
    }
    
    this.group.clear(removeFromScene, destroyChildren);
    this.logger.debug('Cleared all members from dynamic group');
    return this.group;
  }
  
  /**
   * Get the underlying Phaser group.
   */
  getGroup(): Phaser.Physics.Arcade.Group {
    return this.group;
  }
  
  /**
   * Check if a sprite is in the group.
   */
  contains(child: Phaser.Physics.Arcade.Sprite): boolean {
    return this.group.contains(child);
  }
  
  /**
   * Get the number of members in the group.
   */
  getLength(): number {
    return this.group.getLength();
  }
  
  /**
   * Get all members of the group.
   */
  getChildren(): Phaser.GameObjects.GameObject[] {
    return this.group.getChildren();
  }
  
  /**
   * Destroy the group and all its members.
   */
  destroy(): void {
    this.clear(true, true);
    this.group.destroy();
    this.logger.debug('Destroyed dynamic physics group');
  }
}