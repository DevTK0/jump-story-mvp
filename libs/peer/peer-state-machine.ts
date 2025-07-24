import { PlayerState as DbPlayerState } from '@/spacetime/client';
import { Peer } from './peer';

/**
 * Base class for all peer states
 * Manages state-specific behavior and animations for network peers
 */
export abstract class PeerState {
    protected peer: Peer;
    protected stateMachine: PeerStateMachine;

    constructor(peer: Peer, stateMachine: PeerStateMachine) {
        this.peer = peer;
        this.stateMachine = stateMachine;
    }

    /**
     * Called when entering this state
     */
    abstract onEnter(previousState?: PeerState): void;

    /**
     * Called when exiting this state
     */
    abstract onExit(nextState?: PeerState): void;

    /**
     * Called every frame while in this state
     */
    abstract update(time: number, delta: number): void;

    /**
     * Get the corresponding database state
     */
    abstract getDbState(): DbPlayerState;

    /**
     * Get the state name for debugging
     */
    abstract getName(): string;

    /**
     * Check if transition to another state is allowed
     */
    canTransitionTo(stateName: string): boolean {
        return this.getAllowedTransitions().includes(stateName);
    }

    /**
     * Get list of states this state can transition to
     */
    protected abstract getAllowedTransitions(): string[];
}

/**
 * Idle state - peer is standing still
 */
export class PeerIdleState extends PeerState {
    onEnter(_previousState?: PeerState): void {
        this.peer.playAnimation('soldier-idle-anim');
    }

    onExit(_nextState?: PeerState): void {
        // No cleanup needed
    }

    update(_time: number, _delta: number): void {
        // No special update logic for idle
    }

    getDbState(): DbPlayerState {
        return { tag: "Idle" };
    }

    getName(): string {
        return "Idle";
    }

    protected getAllowedTransitions(): string[] {
        return ["Walk", "Climbing", "Attack1", "Attack2", "Attack3", "Damaged", "Dead"];
    }
}

/**
 * Walk state - peer is moving
 */
export class PeerWalkState extends PeerState {
    onEnter(_previousState?: PeerState): void {
        this.peer.playAnimation('soldier-walk-anim');
    }

    onExit(_nextState?: PeerState): void {
        // No cleanup needed
    }

    update(_time: number, _delta: number): void {
        // Movement is handled by interpolation in Peer class
    }

    getDbState(): DbPlayerState {
        return { tag: "Walk" };
    }

    getName(): string {
        return "Walk";
    }

    protected getAllowedTransitions(): string[] {
        return ["Idle", "Climbing", "Attack1", "Attack2", "Attack3", "Damaged", "Dead"];
    }
}

/**
 * Climbing state - peer is on a climbable surface
 */
export class PeerClimbingState extends PeerState {
    onEnter(_previousState?: PeerState): void {
        // For now, use idle animation for climbing
        this.peer.playAnimation('soldier-idle-anim');
    }

    onExit(_nextState?: PeerState): void {
        // No cleanup needed
    }

    update(_time: number, _delta: number): void {
        // Climbing animation handled by server state
    }

    getDbState(): DbPlayerState {
        return { tag: "Climbing" };
    }

    getName(): string {
        return "Climbing";
    }

    protected getAllowedTransitions(): string[] {
        return ["Idle", "Walk", "Damaged", "Dead"];
    }
}

/**
 * Base attack state
 */
export abstract class PeerAttackState extends PeerState {
    protected attackNumber: number;
    protected animationKey: string;

    constructor(peer: Peer, stateMachine: PeerStateMachine, attackNumber: number) {
        super(peer, stateMachine);
        this.attackNumber = attackNumber;
        this.animationKey = `soldier-attack${attackNumber}-anim`;
    }

    onEnter(_previousState?: PeerState): void {
        // Play attack animation once
        console.log(`PeerAttackState: Attempting to play animation ${this.animationKey} for attack ${this.attackNumber}`);
        this.peer.playAnimation(this.animationKey);
        
        // Note: Peer class handles animation completion and state transitions
    }

    onExit(_nextState?: PeerState): void {
        // Cleanup is handled by Peer class
    }

    update(_time: number, _delta: number): void {
        // Attack duration is managed by animation system
    }

    protected getAllowedTransitions(): string[] {
        return ["Idle", "Walk", "Damaged", "Dead"];
    }
}

/**
 * Attack1 state
 */
export class PeerAttack1State extends PeerAttackState {
    constructor(peer: Peer, stateMachine: PeerStateMachine) {
        super(peer, stateMachine, 1);
    }

    getDbState(): DbPlayerState {
        return { tag: "Attack1" };
    }

    getName(): string {
        return "Attack1";
    }
}

/**
 * Attack2 state
 */
export class PeerAttack2State extends PeerAttackState {
    constructor(peer: Peer, stateMachine: PeerStateMachine) {
        super(peer, stateMachine, 2);
    }

    getDbState(): DbPlayerState {
        return { tag: "Attack2" };
    }

    getName(): string {
        return "Attack2";
    }
}

/**
 * Attack3 state
 */
export class PeerAttack3State extends PeerAttackState {
    constructor(peer: Peer, stateMachine: PeerStateMachine) {
        super(peer, stateMachine, 3);
    }

    getDbState(): DbPlayerState {
        return { tag: "Attack3" };
    }

    getName(): string {
        return "Attack3";
    }
}

/**
 * Damaged state - peer is taking damage
 */
export class PeerDamagedState extends PeerState {
    onEnter(_previousState?: PeerState): void {
        this.peer.playAnimation('soldier-damaged-anim');
    }

    onExit(_nextState?: PeerState): void {
        // No cleanup needed
    }

    update(_time: number, _delta: number): void {
        // Damage recovery handled by server
    }

    getDbState(): DbPlayerState {
        return { tag: "Damaged" };
    }

    getName(): string {
        return "Damaged";
    }

    protected getAllowedTransitions(): string[] {
        return ["Idle", "Walk", "Dead"];
    }
}

/**
 * Dead state - peer has died
 */
export class PeerDeadState extends PeerState {
    onEnter(_previousState?: PeerState): void {
        // Death animation is handled specially by Peer class
        this.peer.playAnimation('soldier-death-anim');
    }

    onExit(_nextState?: PeerState): void {
        // Reset death animation state when respawning
        this.peer.resetDeathAnimation();
    }

    update(_time: number, _delta: number): void {
        // Dead state has no updates
    }

    getDbState(): DbPlayerState {
        return { tag: "Dead" };
    }

    getName(): string {
        return "Dead";
    }

    protected getAllowedTransitions(): string[] {
        // Can only transition to Idle when respawning
        return ["Idle"];
    }
}

/**
 * Peer State Machine
 * Manages state transitions and animation synchronization for network peers
 */
export class PeerStateMachine {
    private states: Map<string, PeerState> = new Map();
    private currentState: PeerState | null = null;
    private peer: Peer;

    constructor(peer: Peer, initialState: DbPlayerState) {
        this.peer = peer;
        
        // Initialize all states
        this.initializeStates();
        
        // Set initial state without transition
        const stateName = this.getStateNameFromDb(initialState);
        const state = this.states.get(stateName);
        if (state) {
            this.currentState = state;
            state.onEnter();
        }
    }

    private initializeStates(): void {
        // Create all possible states
        this.states.set("Idle", new PeerIdleState(this.peer, this));
        this.states.set("Walk", new PeerWalkState(this.peer, this));
        this.states.set("Climbing", new PeerClimbingState(this.peer, this));
        this.states.set("Attack1", new PeerAttack1State(this.peer, this));
        this.states.set("Attack2", new PeerAttack2State(this.peer, this));
        this.states.set("Attack3", new PeerAttack3State(this.peer, this));
        this.states.set("Damaged", new PeerDamagedState(this.peer, this));
        this.states.set("Dead", new PeerDeadState(this.peer, this));
    }

    /**
     * Update the state machine
     */
    update(time: number, delta: number): void {
        if (this.currentState) {
            this.currentState.update(time, delta);
        }
    }

    /**
     * Transition to a new state
     */
    transitionTo(stateName: string): boolean {
        const newState = this.states.get(stateName);
        if (!newState) {
            console.warn(`State ${stateName} not found in peer state machine`);
            return false;
        }

        // Check if transition is allowed
        if (this.currentState && !this.currentState.canTransitionTo(stateName)) {
            // For peers, we are more lenient since state comes from server
            console.warn(`Unusual transition from ${this.currentState.getName()} to ${stateName} for peer`);
        }

        // Exit current state
        if (this.currentState) {
            this.currentState.onExit(newState);
        }

        // Enter new state
        const previousState = this.currentState;
        this.currentState = newState;
        newState.onEnter(previousState || undefined);

        return true;
    }

    /**
     * Handle state change from server update
     */
    handleServerStateChange(dbState: DbPlayerState): void {
        const stateName = this.getStateNameFromDb(dbState);
        if (this.getCurrentStateName() !== stateName) {
            this.transitionTo(stateName);
        }
    }

    /**
     * Get current state name
     */
    getCurrentStateName(): string {
        return this.currentState?.getName() || "Unknown";
    }

    /**
     * Check if in a specific state
     */
    isInState(stateName: string): boolean {
        return this.getCurrentStateName() === stateName;
    }

    /**
     * Get current database state
     */
    getCurrentDbState(): DbPlayerState {
        return this.currentState?.getDbState() || { tag: "Unknown" };
    }

    /**
     * Convert database state to state machine state name
     */
    private getStateNameFromDb(dbState: DbPlayerState): string {
        // Direct mapping since peer states match database states
        switch (dbState.tag) {
            case "Idle":
                return "Idle";
            case "Walk":
                return "Walk";
            case "Climbing":
                return "Climbing";
            case "Attack1":
                return "Attack1";
            case "Attack2":
                return "Attack2";
            case "Attack3":
                return "Attack3";
            case "Damaged":
                return "Damaged";
            case "Dead":
                return "Dead";
            case "Unknown":
            default:
                console.warn(`Unknown peer state: ${dbState.tag}, defaulting to Idle`);
                return "Idle";
        }
    }

    /**
     * Force animation update (used when peer needs to replay animation)
     */
    forceAnimationUpdate(): void {
        if (this.currentState) {
            // Re-enter current state to replay animation
            this.currentState.onEnter(this.currentState);
        }
    }

    /**
     * Cleanup state machine
     */
    destroy(): void {
        if (this.currentState) {
            this.currentState.onExit();
        }
        this.states.clear();
        this.currentState = null;
    }
}