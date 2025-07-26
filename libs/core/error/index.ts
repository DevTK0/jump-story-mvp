// Error system exports
export { 
  ErrorBoundary, 
  GameError, 
  AssetError, 
  GameStateError, 
  NetworkError,
  PhysicsError,
  type ErrorContext,
  type ErrorRecoveryStrategy,
  ErrorSeverity,
  ErrorBoundaryMethod
} from './error-boundary';

export { 
  PlayerStateRecoveryStrategy,
  EnemySystemRecoveryStrategy,
  PhysicsRecoveryStrategy,
  AnimationRecoveryStrategy,
  NetworkReconnectionStrategy,
  registerAllRecoveryStrategies
} from './error-recovery-strategies';

export { 
  SafeMethod,
  ContinueOnError,
  Critical,
  Retry
} from './error-decorators';

export { 
  SceneErrorHandler,
  protectScene
} from './scene-error-handler';