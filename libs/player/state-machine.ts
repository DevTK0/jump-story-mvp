import { Player } from './player';
import { PlayerState as DbPlayerState } from '@/spacetime/client';

/**
 * Base class for all player states
 */
export abstract class PlayerState {
    protected player: Player;
    protected stateMachine: PlayerStateMachine;

    constructor(player: Player, stateMachine: PlayerStateMachine) {
        this.player = player;
        this.stateMachine = stateMachine;
    }

    /**
     * Called when entering this state
     */
    abstract onEnter(previousState?: PlayerState): void;

    /**
     * Called when exiting this state
     */
    abstract onExit(nextState?: PlayerState): void;

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
 * Idle state - player is standing still
 */
export class IdleState extends PlayerState {
    onEnter(previousState?: PlayerState): void {
        console.log(`Player entering Idle state from ${previousState?.getName() || 'none'}`);
        this.player.setPlayerState({ 
            isAttacking: false,
            isClimbing: false 
        });
    }

    onExit(nextState?: PlayerState): void {
        console.log(`Player exiting Idle state to ${nextState?.getName() || 'none'}`);
    }

    update(_time: number, _delta: number): void {
        // Idle state doesn't need special update logic
    }

    getDbState(): DbPlayerState {
        return { tag: "Idle" };
    }

    getName(): string {
        return "Idle";
    }

    protected getAllowedTransitions(): string[] {
        return ["Walk", "Jump", "Climbing", "Attack1", "Attack2", "Attack3", "Damaged", "Dead"];
    }
}

/**
 * Walking state - player is moving
 */
export class WalkState extends PlayerState {
    onEnter(previousState?: PlayerState): void {
        console.log(`Player entering Walk state from ${previousState?.getName() || 'none'}`);
        this.player.setPlayerState({ 
            isAttacking: false,
            isClimbing: false 
        });
    }

    onExit(nextState?: PlayerState): void {
        console.log(`Player exiting Walk state to ${nextState?.getName() || 'none'}`);
    }

    update(_time: number, _delta: number): void {
        // Check if player stopped moving
        const body = this.player.body;
        if (Math.abs(body.velocity.x) <= 0.1) {
            this.stateMachine.transitionTo("Idle");
        }
    }

    getDbState(): DbPlayerState {
        return { tag: "Walk" };
    }

    getName(): string {
        return "Walk";
    }

    protected getAllowedTransitions(): string[] {
        return ["Idle", "Jump", "Climbing", "Attack1", "Attack2", "Attack3", "Damaged", "Dead"];
    }
}

/**
 * Jumping state - player is in the air
 */
export class JumpState extends PlayerState {
    onEnter(previousState?: PlayerState): void {
        console.log(`Player entering Jump state from ${previousState?.getName() || 'none'}`);
        this.player.setPlayerState({ 
            isAttacking: false,
            isClimbing: false 
        });
    }

    onExit(nextState?: PlayerState): void {
        console.log(`Player exiting Jump state to ${nextState?.getName() || 'none'}`);
    }

    update(_time: number, _delta: number): void {
        const body = this.player.body;
        
        // Check if player landed
        if (body.onFloor()) {
            // Transition based on horizontal movement
            if (Math.abs(body.velocity.x) > 0.1) {
                this.stateMachine.transitionTo("Walk");
            } else {
                this.stateMachine.transitionTo("Idle");
            }
        }
    }

    getDbState(): DbPlayerState {
        return { tag: "Idle" }; // Jump maps to Idle for DB sync
    }

    getName(): string {
        return "Jump";
    }

    protected getAllowedTransitions(): string[] {
        return ["Idle", "Walk", "Climbing", "Attack1", "Attack2", "Attack3", "Damaged", "Dead"];
    }
}

/**
 * Climbing state - player is on a climbable surface
 */
export class ClimbingState extends PlayerState {
    onEnter(previousState?: PlayerState): void {
        console.log(`Player entering Climbing state from ${previousState?.getName() || 'none'}`);
        this.player.setPlayerState({ 
            isClimbing: true,
            isAttacking: false 
        });
    }

    onExit(nextState?: PlayerState): void {
        console.log(`Player exiting Climbing state to ${nextState?.getName() || 'none'}`);
        this.player.setPlayerState({ isClimbing: false });
    }

    update(_time: number, _delta: number): void {
        // Climbing logic is handled by ClimbingSystem
        // This state mainly tracks that we're in climbing mode
    }

    getDbState(): DbPlayerState {
        return { tag: "Climbing" };
    }

    getName(): string {
        return "Climbing";
    }

    protected getAllowedTransitions(): string[] {
        return ["Idle", "Walk", "Jump", "Damaged", "Dead"];
    }
}

/**
 * Attack states - player is attacking
 */
export abstract class AttackState extends PlayerState {
    protected attackType: number;
    protected attackDuration: number;
    private startTime: number = 0;

    constructor(player: Player, stateMachine: PlayerStateMachine, attackType: number, attackDuration: number) {
        super(player, stateMachine);
        this.attackType = attackType;
        this.attackDuration = attackDuration;
    }

    onEnter(previousState?: PlayerState): void {
        console.log(`Player entering ${this.getName()} state from ${previousState?.getName() || 'none'}`);
        this.player.setPlayerState({ 
            isAttacking: true,
            isClimbing: false 
        });
        this.startTime = Date.now();
    }

    onExit(nextState?: PlayerState): void {
        console.log(`Player exiting ${this.getName()} state to ${nextState?.getName() || 'none'}`);
        this.player.setPlayerState({ isAttacking: false });
    }

    update(_time: number, _delta: number): void {
        // Check if attack duration is over
        if (Date.now() - this.startTime >= this.attackDuration) {
            // Return to appropriate state based on movement
            const body = this.player.body;
            if (Math.abs(body.velocity.x) > 0.1) {
                this.stateMachine.transitionTo("Walk");
            } else {
                this.stateMachine.transitionTo("Idle");
            }
        }
    }

    protected getAllowedTransitions(): string[] {
        return ["Idle", "Walk", "Damaged", "Dead"];
    }
}

export class Attack1State extends AttackState {
    constructor(player: Player, stateMachine: PlayerStateMachine) {
        super(player, stateMachine, 1, 300); // 300ms attack duration
    }

    getDbState(): DbPlayerState {
        return { tag: "Attack1" };
    }

    getName(): string {
        return "Attack1";
    }
}

export class Attack2State extends AttackState {
    constructor(player: Player, stateMachine: PlayerStateMachine) {
        super(player, stateMachine, 2, 600); // 600ms attack duration
    }

    getDbState(): DbPlayerState {
        return { tag: "Attack2" };
    }

    getName(): string {
        return "Attack2";
    }
}

export class Attack3State extends AttackState {
    constructor(player: Player, stateMachine: PlayerStateMachine) {
        super(player, stateMachine, 3, 450); // 450ms attack duration
    }

    getDbState(): DbPlayerState {
        return { tag: "Attack3" };
    }

    getName(): string {
        return "Attack3";
    }
}

/**
 * Damaged state - player is taking damage and has invulnerability
 */
export class DamagedState extends PlayerState {
    private damagedDuration: number = 1000; // 1 second of invulnerability
    private startTime: number = 0;

    onEnter(previousState?: PlayerState): void {
        console.log(`Player entering Damaged state from ${previousState?.getName() || 'none'}`);
        this.player.setPlayerState({ 
            isAttacking: false,
            isClimbing: false 
        });
        this.startTime = Date.now();
    }

    onExit(nextState?: PlayerState): void {
        console.log(`Player exiting Damaged state to ${nextState?.getName() || 'none'}`);
    }

    update(_time: number, _delta: number): void {
        // Check if damaged duration is over
        if (Date.now() - this.startTime >= this.damagedDuration) {
            // Return to appropriate state based on movement
            const body = this.player.body;
            if (Math.abs(body.velocity.x) > 0.1) {
                this.stateMachine.transitionTo("Walk");
            } else {
                this.stateMachine.transitionTo("Idle");
            }
        }
    }

    getDbState(): DbPlayerState {
        return { tag: "Damaged" };
    }

    getName(): string {
        return "Damaged";
    }

    protected getAllowedTransitions(): string[] {
        return ["Idle", "Walk", "Jump", "Dead"];
    }
}


/**
 * Dead state - player has died and cannot perform actions
 */
export class DeadState extends PlayerState {
    private hasLanded: boolean = false;

    onEnter(previousState?: PlayerState): void {
        console.log(`Player entering Dead state from ${previousState?.getName() || 'none'}`);
        this.player.setPlayerState({ 
            isAttacking: false,
            isClimbing: false 
        });
        // Stop horizontal movement but allow gravity
        this.player.body.setVelocityX(0);
        // Disable collision detection with enemies (but keep player collision body active for respawn positioning)
        // This prevents collision callbacks from triggering while dead
        this.hasLanded = false;
    }

    onExit(nextState?: PlayerState): void {
        console.log(`Player exiting Dead state to ${nextState?.getName() || 'none'}`);
        // Re-enable collision detection when respawning
        this.hasLanded = false;
    }

    update(time: number, _delta: number): void {
        // Only stop horizontal movement, allow gravity to work
        this.player.body.setVelocityX(0);
        
        // Check if player has landed on ground and sync position once
        if (!this.hasLanded && this.player.body.onFloor()) {
            this.hasLanded = true;
            // Force sync position when dead player hits ground
            const movementSystem = this.player.getSystem('movement') as any;
            if (movementSystem && movementSystem.syncManager) {
                const facing = this.player.flipX ? { tag: "Left" } : { tag: "Right" };
                movementSystem.syncManager.syncPositionForDead(time, facing);
            }
        }
    }

    getDbState(): DbPlayerState {
        return { tag: "Dead" };
    }

    getName(): string {
        return "Dead";
    }

    protected getAllowedTransitions(): string[] {
        // Can transition back to Idle after respawn
        return ["Idle"];
    }
}

/**
 * Main state machine class
 */
export class PlayerStateMachine {
    private player: Player;
    private states: Map<string, PlayerState> = new Map();
    private currentState: PlayerState | null = null;
    private previousState: PlayerState | null = null;

    constructor(player: Player) {
        this.player = player;
        this.initializeStates();
    }

    private initializeStates(): void {
        // Create all possible states
        this.states.set("Idle", new IdleState(this.player, this));
        this.states.set("Walk", new WalkState(this.player, this));
        this.states.set("Jump", new JumpState(this.player, this));
        this.states.set("Climbing", new ClimbingState(this.player, this));
        this.states.set("Attack1", new Attack1State(this.player, this));
        this.states.set("Attack2", new Attack2State(this.player, this));
        this.states.set("Attack3", new Attack3State(this.player, this));
        this.states.set("Damaged", new DamagedState(this.player, this));
        this.states.set("Dead", new DeadState(this.player, this));

        // Start in idle state
        this.transitionTo("Idle");
    }

    public transitionTo(stateName: string): boolean {
        const newState = this.states.get(stateName);
        if (!newState) {
            console.warn(`Unknown state: ${stateName}`);
            return false;
        }

        // Check if transition is allowed
        if (this.currentState && !this.currentState.canTransitionTo(stateName)) {
            console.warn(`Invalid transition from ${this.currentState.getName()} to ${stateName}`);
            return false;
        }

        // Exit current state
        if (this.currentState) {
            this.currentState.onExit(newState);
            this.previousState = this.currentState;
        }

        // Enter new state
        this.currentState = newState;
        this.currentState.onEnter(this.previousState || undefined);

        return true;
    }

    public update(time: number, delta: number): void {
        if (this.currentState) {
            this.currentState.update(time, delta);
        }
    }

    public getCurrentState(): PlayerState | null {
        return this.currentState;
    }

    public getCurrentStateName(): string {
        return this.currentState?.getName() || "None";
    }

    public getCurrentDbState(): DbPlayerState {
        return this.currentState?.getDbState() || { tag: "Unknown" };
    }

    public isInState(stateName: string): boolean {
        return this.currentState?.getName() === stateName;
    }

    public canTransitionTo(stateName: string): boolean {
        return this.currentState?.canTransitionTo(stateName) || false;
    }
}