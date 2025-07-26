// New physics architecture exports
export type { PhysicsEntity, DynamicPhysicsEntity } from './physics-entity';
export { PhysicsRegistry } from './physics-registry';
export { PhysicsSetupCoordinator } from './physics-setup-coordinator';
export { DynamicPhysicsGroup } from './dynamic-physics-group';
export { MapPhysicsFactory } from './map-physics-factory';

// Legacy exports (to be removed after full migration)
export { PhysicsConfigurator, type CollisionGroups } from './physics-configurator';