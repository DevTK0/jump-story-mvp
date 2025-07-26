import type { PhysicsRegistry } from './physics-registry';

/**
 * Interface for entities that manage their own physics setup.
 * Entities implementing this interface are responsible for registering
 * their collision and overlap relationships with the physics system.
 */
export interface PhysicsEntity {
  /**
   * Set up physics for this entity.
   * Called during physics initialization phase.
   * 
   * @param registry - The physics registry to register collisions/overlaps with
   */
  setupPhysics(registry: PhysicsRegistry): void;

  /**
   * Get the primary physics body for this entity.
   * This is optional as some entities might not have a single primary body.
   */
  getPhysicsBody?(): Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;

  /**
   * Called when physics needs to be cleaned up (e.g., entity destruction).
   * Optional - implement if entity needs special cleanup.
   */
  cleanupPhysics?(): void;
}

/**
 * Interface for entities that have dynamic physics groups (e.g., enemy spawners).
 */
export interface DynamicPhysicsEntity extends PhysicsEntity {
  /**
   * Called when a new member is added to a dynamic group.
   * Allows the entity to set up physics for the new member.
   */
  onPhysicsMemberAdded?(member: Phaser.Physics.Arcade.Sprite, registry: PhysicsRegistry): void;

  /**
   * Called when a member is removed from a dynamic group.
   * Allows the entity to clean up physics for the removed member.
   */
  onPhysicsMemberRemoved?(member: Phaser.Physics.Arcade.Sprite): void;
}