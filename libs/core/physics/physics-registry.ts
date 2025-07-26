import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';

/**
 * Registry for managing physics collision groups and providing
 * helper methods for setting up physics relationships.
 * 
 * This replaces the centralized PhysicsConfigurator with a more
 * flexible registry pattern where entities register their own physics.
 */
export class PhysicsRegistry {
  private scene: Phaser.Scene;
  private logger: ModuleLogger;
  
  // Collision groups stored by name
  private collisionGroups = new Map<string, Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup>();
  
  // Track registered entities for cleanup
  private registeredEntities = new Set<any>();
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.logger = createLogger('PhysicsRegistry');
  }
  
  /**
   * Register a collision group by name.
   */
  registerGroup(name: string, group: Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup): void {
    if (this.collisionGroups.has(name)) {
      this.logger.warn(`Collision group '${name}' already registered, overwriting`);
    }
    this.collisionGroups.set(name, group);
    this.logger.debug(`Registered collision group: ${name}`);
  }
  
  /**
   * Get a collision group by name.
   */
  getGroup(name: string): Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup | undefined {
    return this.collisionGroups.get(name);
  }
  
  /**
   * Check if a group exists.
   */
  hasGroup(name: string): boolean {
    return this.collisionGroups.has(name);
  }
  
  /**
   * Get all registered group names.
   */
  getGroupNames(): string[] {
    return Array.from(this.collisionGroups.keys());
  }
  
  /**
   * Register an entity as using this physics registry.
   */
  registerEntity(entity: any): void {
    this.registeredEntities.add(entity);
  }
  
  // Helper methods for common physics setups
  
  /**
   * Add a collider between an entity and a named group.
   */
  addCollider(
    entity: any,
    groupName: string,
    collideCallback?: ArcadePhysicsCallback,
    processCallback?: ArcadePhysicsCallback,
    callbackContext?: any
  ): Phaser.Physics.Arcade.Collider | null {
    const group = this.getGroup(groupName);
    if (!group) {
      this.logger.warn(`Cannot add collider: group '${groupName}' not found`);
      return null;
    }
    
    return this.scene.physics.add.collider(
      entity,
      group,
      collideCallback,
      processCallback,
      callbackContext
    );
  }
  
  /**
   * Add an overlap between an entity and a named group.
   */
  addOverlap(
    entity: any,
    groupName: string,
    overlapCallback?: ArcadePhysicsCallback,
    processCallback?: ArcadePhysicsCallback,
    callbackContext?: any
  ): Phaser.Physics.Arcade.Collider | null {
    const group = this.getGroup(groupName);
    if (!group) {
      this.logger.warn(`Cannot add overlap: group '${groupName}' not found`);
      return null;
    }
    
    return this.scene.physics.add.overlap(
      entity,
      group,
      overlapCallback,
      processCallback,
      callbackContext
    );
  }
  
  /**
   * Add a collider between two named groups.
   */
  addGroupCollider(
    groupName1: string,
    groupName2: string,
    collideCallback?: ArcadePhysicsCallback,
    processCallback?: ArcadePhysicsCallback,
    callbackContext?: any
  ): Phaser.Physics.Arcade.Collider | null {
    const group1 = this.getGroup(groupName1);
    const group2 = this.getGroup(groupName2);
    
    if (!group1 || !group2) {
      this.logger.warn(`Cannot add group collider: missing groups`);
      return null;
    }
    
    return this.scene.physics.add.collider(
      group1,
      group2,
      collideCallback,
      processCallback,
      callbackContext
    );
  }
  
  /**
   * Add an overlap between two named groups.
   */
  addGroupOverlap(
    groupName1: string,
    groupName2: string,
    overlapCallback?: ArcadePhysicsCallback,
    processCallback?: ArcadePhysicsCallback,
    callbackContext?: any
  ): Phaser.Physics.Arcade.Collider | null {
    const group1 = this.getGroup(groupName1);
    const group2 = this.getGroup(groupName2);
    
    if (!group1 || !group2) {
      this.logger.warn(`Cannot add group overlap: missing groups`);
      return null;
    }
    
    return this.scene.physics.add.overlap(
      group1,
      group2,
      overlapCallback,
      processCallback,
      callbackContext
    );
  }
  
  /**
   * Create a one-way platform collision callback.
   * Platforms only collide when the object is falling from above.
   */
  createOneWayPlatformCallback(): ArcadePhysicsCallback {
    return (object1: any, platform: any) => {
      const body = object1.body as Phaser.Physics.Arcade.Body;
      const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody;
      
      // Only allow collision if object is coming from above (falling down)
      return body.velocity.y > 0 && body.y < platformBody.y;
    };
  }
  
  /**
   * Clear all registered groups and entities.
   */
  clear(): void {
    this.collisionGroups.clear();
    this.registeredEntities.clear();
    this.logger.debug('Cleared all collision groups and entities');
  }
  
  /**
   * Get debug information about registered groups.
   */
  getDebugInfo(): { groups: string[]; entityCount: number } {
    return {
      groups: this.getGroupNames(),
      entityCount: this.registeredEntities.size,
    };
  }
}

// Type alias for Phaser's arcade physics callback
type ArcadePhysicsCallback = Phaser.Types.Physics.Arcade.ArcadePhysicsCallback;