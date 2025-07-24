import { DbConnection } from '@/spacetime/client';

/**
 * Service for querying player data from SpacetimeDB
 * Centralizes common player lookup patterns to reduce code duplication
 */
export class PlayerQueryService {
    private dbConnection: DbConnection;

    constructor(dbConnection: DbConnection) {
        this.dbConnection = dbConnection;
    }

    /**
     * Find the current player's data from the server
     * @returns Server player data or null if not found
     */
    public findCurrentPlayer(): any | null {
        if (!this.dbConnection?.db?.player || !this.dbConnection.identity) {
            return null;
        }

        for (const serverPlayer of this.dbConnection.db.player.iter()) {
            if (serverPlayer.identity.toHexString() === this.dbConnection.identity.toHexString()) {
                return serverPlayer;
            }
        }

        return null;
    }

    /**
     * Check if the current player is dead based on server state
     * @returns true if player is dead (HP <= 0 or state is 'Dead')
     */
    public isCurrentPlayerDead(): boolean {
        const player = this.findCurrentPlayer();
        if (!player) return false;

        return player.currentHp <= 0 || player.state.tag === 'Dead';
    }

    /**
     * Get current player's HP from server
     * @returns Current HP or null if player not found
     */
    public getCurrentPlayerHp(): number | null {
        const player = this.findCurrentPlayer();
        return player ? player.currentHp : null;
    }

    /**
     * Get current player's state from server
     * @returns Player state tag or null if player not found
     */
    public getCurrentPlayerState(): string | null {
        const player = this.findCurrentPlayer();
        return player ? player.state.tag : null;
    }

    /**
     * Get current player's position from server
     * @returns Position object {x, y} or null if player not found
     */
    public getCurrentPlayerPosition(): { x: number; y: number } | null {
        const player = this.findCurrentPlayer();
        return player?.position ? { x: player.position.x, y: player.position.y } : null;
    }
}