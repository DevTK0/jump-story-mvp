import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { PhysicsRegistry } from './physics-registry';
import type { PhysicsEntity } from './physics-entity';

/**
 * Coordinates the setup of physics for all entities in the game.
 * Replaces the centralized PhysicsConfigurator with a coordinator
 * that allows entities to register their own physics.
 */
export class PhysicsSetupCoordinator {
  private logger: ModuleLogger;
  private registry: PhysicsRegistry;
  private entities: PhysicsEntity[] = [];
  
  constructor(scene: Phaser.Scene) {
    this.logger = createLogger('PhysicsSetupCoordinator');
    this.registry = new PhysicsRegistry(scene);
  }
  
  /**
   * Get the physics registry for manual group registration.
   */
  getRegistry(): PhysicsRegistry {
    return this.registry;
  }
  
  /**
   * Register collision groups with the physics registry.
   * Typically called after creating physics groups from map data.
   */
  registerCollisionGroups(groups: Record<string, Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup>): void {
    for (const [name, group] of Object.entries(groups)) {
      this.registry.registerGroup(name, group);
    }
    this.logger.debug(`Registered ${Object.keys(groups).length} collision groups`);
  }
  
  /**
   * Register an entity that implements PhysicsEntity.
   * The entity will have its setupPhysics method called during initialization.
   */
  registerEntity(entity: PhysicsEntity): void {
    this.entities.push(entity);
    this.registry.registerEntity(entity);
    this.logger.debug(`Registered physics entity: ${entity.constructor.name}`);
  }
  
  /**
   * Register multiple entities at once.
   */
  registerEntities(entities: PhysicsEntity[]): void {
    entities.forEach(entity => this.registerEntity(entity));
  }
  
  /**
   * Initialize physics for all registered entities.
   * Should be called after all collision groups and entities are registered.
   */
  setupAllPhysics(): void {
    this.logger.info('Setting up physics for all entities...');
    
    // Validate that required groups exist
    const requiredGroups = ['ground', 'platforms', 'boundaries'];
    const missingGroups = requiredGroups.filter(group => !this.registry.hasGroup(group));
    
    if (missingGroups.length > 0) {
      this.logger.warn(`Missing required collision groups: ${missingGroups.join(', ')}`);
    }
    
    // Call setupPhysics on each entity
    for (const entity of this.entities) {
      try {
        entity.setupPhysics(this.registry);
        this.logger.debug(`Physics setup complete for: ${entity.constructor.name}`);
      } catch (error) {
        this.logger.error(`Failed to setup physics for entity: ${entity.constructor.name}`, { error });
      }
    }
    
    this.logger.info(`Physics setup complete for ${this.entities.length} entities`);
  }
  
  /**
   * Clean up physics for all entities.
   * Should be called when the scene is shutting down.
   */
  cleanup(): void {
    this.logger.info('Cleaning up physics...');
    
    // Call cleanupPhysics on entities that implement it
    for (const entity of this.entities) {
      if (entity.cleanupPhysics) {
        try {
          entity.cleanupPhysics();
        } catch (error) {
          this.logger.error(`Failed to cleanup physics for entity: ${entity.constructor.name}`, { error });
        }
      }
    }
    
    // Clear the registry
    this.registry.clear();
    this.entities = [];
    
    this.logger.info('Physics cleanup complete');
  }
  
  /**
   * Get debug information about the physics setup.
   */
  getDebugInfo(): {
    registeredEntities: number;
    registryInfo: { groups: string[]; entityCount: number };
  } {
    return {
      registeredEntities: this.entities.length,
      registryInfo: this.registry.getDebugInfo(),
    };
  }
}