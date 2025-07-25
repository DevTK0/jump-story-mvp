// Debug interface for components that can render debug information
export interface IDebuggable {
  renderDebug?(graphics: Phaser.GameObjects.Graphics): void;
  getDebugInfo?(): Record<string, any>;
  isDebugEnabled?(): boolean;
  cleanupDebugResources?(): void;
}

// Trajectory point interface
export interface TrajectoryPoint {
  x: number;
  y: number;
  timestamp: number;
  texture: string;
  frame: string | number;
  flipX: boolean;
  scaleX: number;
  scaleY: number;
}
