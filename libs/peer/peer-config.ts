/**
 * Centralized configuration for peer system
 * Eliminates magic numbers and provides single source of truth
 */

export const PEER_CONFIG = {
    /**
     * Visual display settings
     */
    display: {
        depth: 8, // Above enemies but below main player
        alpha: 0.9, // Slight transparency
        tint: 0xbbbbbb, // Grayish tint to distinguish from main player
        nameLabel: {
            offsetY: -60,
            fontSize: "12px",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 2,
            depth: 11,
        },
    },

    /**
     * Interpolation settings for smooth movement
     */
    interpolation: {
        speed: 0.25, // Lerp speed for position updates (increased for smoother movement)
        teleportDistance: 300, // Distance threshold for instant teleport
        minMoveDistance: 0.5, // Minimum distance to update target position
    },

    /**
     * Health bar configuration
     */
    healthBar: {
        width: 32, // Health bar width in pixels
        height: 4, // Health bar height in pixels
        offsetY: -50, // Offset above peer sprite (between sprite and name)
        backgroundColor: 0x000000, // Black background
        borderColor: 0xffffff, // White border
        healthColor: 0x00ff00, // Green health (distinguishes from enemies)
        damageColor: 0x00aa00, // Darker green for damaged health
        borderWidth: 1, // Border thickness
        cornerRadius: 1, // Rounded corners
        alpha: 0.9, // Slight transparency
        showDuration: 30000, // Show for 30 seconds after damage
    },
} as const;
