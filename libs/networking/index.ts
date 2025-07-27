export {
  SpacetimeConnector,
  type SpacetimeConnectionConfig,
  type SpacetimeConnectionCallbacks,
  type SubscriptionConfig,
} from './spacetime-connector';
export { SpacetimeConnectionBuilder } from './spacetime-connection-builder';
export { InteractionHandler, type InteractionConfig } from './interaction-handler';
export { SceneConnectionHelper, type ConnectionConfig } from './scene-connection-helper';
export { PROXIMITY_CONFIG } from './proximity-config';
export { 
  buildProximityQuery, 
  buildIdentityQuery,
  escapeNumeric,
  escapeHexString,
  DEFAULT_PROXIMITY_CONFIGS,
  type ProximitySubscriptionConfig,
} from './subscription-utils';
