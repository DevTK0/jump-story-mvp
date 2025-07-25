// Shadow effect state management (separate from debug mode)
export class ShadowState {
  private static instance: ShadowState;
  private _enabled = false;

  static getInstance(): ShadowState {
    if (!ShadowState.instance) {
      ShadowState.instance = new ShadowState();
    }
    return ShadowState.instance;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
    console.log(`Shadow effect ${value ? 'enabled' : 'disabled'}`);
  }

  toggle(): void {
    this.enabled = !this.enabled;
  }
}

// Debug state management
export class DebugState {
  private static instance: DebugState;
  private _enabled = false;

  static getInstance(): DebugState {
    if (!DebugState.instance) {
      DebugState.instance = new DebugState();
    }
    return DebugState.instance;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
    console.log(`Debug mode ${value ? 'enabled' : 'disabled'}`);
  }

  toggle(): void {
    this.enabled = !this.enabled;
  }
}
