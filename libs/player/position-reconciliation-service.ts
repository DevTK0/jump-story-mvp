import { Player } from './player';
import { PLAYER_CONFIG } from './config';

/**
 * Configuration for position reconciliation
 */
export interface PositionReconciliationConfig {
    /** Distance threshold in pixels before reconciliation triggers */
    reconciliationThreshold: number;
}

/**
 * Service for handling client-server position reconciliation
 * Ensures client position stays in sync with authoritative server position
 */
export class PositionReconciliationService {
    private player: Player;
    private config: PositionReconciliationConfig;

    // Default configuration from centralized config
    private static readonly DEFAULT_CONFIG: PositionReconciliationConfig = {
        reconciliationThreshold: PLAYER_CONFIG.position.reconciliationThreshold
    };

    constructor(player: Player, config?: Partial<PositionReconciliationConfig>) {
        this.player = player;
        this.config = {
            ...PositionReconciliationService.DEFAULT_CONFIG,
            ...config
        };
    }

    /**
     * Calculate distance between two positions
     * @param pos1 First position {x, y}
     * @param pos2 Second position {x, y}
     * @returns Distance in pixels
     */
    private calculateDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
        return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2);
    }

    /**
     * Check if positions are too far apart and need reconciliation
     * @param clientPos Client position {x, y}
     * @param serverPos Server position {x, y}
     * @returns true if reconciliation is needed
     */
    public shouldReconcile(clientPos: { x: number; y: number }, serverPos: { x: number; y: number }): boolean {
        const distance = this.calculateDistance(clientPos, serverPos);
        return distance > this.config.reconciliationThreshold;
    }

    /**
     * Perform position reconciliation - teleport client to server position
     * @param serverPos Server position {x, y}
     * @param onReconciled Optional callback when reconciliation completes
     */
    public reconcilePosition(serverPos: { x: number; y: number }, onReconciled?: (serverPos: { x: number; y: number }) => void): void {
        const clientPos = { x: this.player.x, y: this.player.y };
        
        if (this.shouldReconcile(clientPos, serverPos)) {
            const distance = this.calculateDistance(clientPos, serverPos);
            
            console.log(`🔄 Server reconciliation: Client at (${clientPos.x}, ${clientPos.y}), Server at (${serverPos.x}, ${serverPos.y}), Distance: ${distance.toFixed(1)}`);
            console.log(`🚀 Teleporting client to server position`);
            
            // Teleport player to server position
            this.player.setPosition(serverPos.x, serverPos.y);
            
            // Notify callback if provided
            if (onReconciled) {
                onReconciled(serverPos);
            }
        }
    }

    /**
     * Check if reconciliation is needed and perform it if necessary
     * @param serverPos Server position {x, y}  
     * @param onReconciled Optional callback when reconciliation completes
     * @returns true if reconciliation was performed
     */
    public checkAndReconcile(serverPos: { x: number; y: number }, onReconciled?: (serverPos: { x: number; y: number }) => void): boolean {
        const clientPos = { x: this.player.x, y: this.player.y };
        
        if (this.shouldReconcile(clientPos, serverPos)) {
            this.reconcilePosition(serverPos, onReconciled);
            return true;
        }
        
        return false;
    }

    /**
     * Get current reconciliation configuration
     * @returns Readonly copy of current config
     */
    public getConfig(): Readonly<PositionReconciliationConfig> {
        return { ...this.config };
    }

    /**
     * Update reconciliation configuration
     * @param newConfig Partial config to merge with current config
     */
    public updateConfig(newConfig: Partial<PositionReconciliationConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
}