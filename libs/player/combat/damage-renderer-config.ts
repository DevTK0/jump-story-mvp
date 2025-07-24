/**
 * Unified configuration for all damage number renderers
 * Shared styles and settings for both enemy and player damage displays
 */

import { DamageType } from "@/spacetime/client";

/**
 * Base style configuration for damage numbers
 */
interface DamageStyleBase {
    fontSize: string;
    fontFamily: string;
    strokeThickness: number;
    fontStyle: string;
    shadow: {
        offsetX: number;
        offsetY: number;
        color: string;
        blur: number;
        stroke: boolean;
        fill: boolean;
    };
}

/**
 * Style configuration with color/gradient options
 */
interface DamageStyle extends DamageStyleBase {
    color: string; // Fallback color
    stroke: string;
    useGradient: boolean;
    gradientColors: readonly string[];
}

/**
 * Color themes for different damage sources
 */
export const DAMAGE_COLOR_THEMES = {
    // Enemy damage colors (yellow/gold theme)
    enemy: {
        Normal: {
            color: "#FFD700", // Gold
            gradientColors: ["#ff0000ff", "#ebf804ff"], // Orange to yellow
        },
        Crit: {
            color: "#FF0000", // Bright red
            gradientColors: ["#ff0000ff", "#ff04f2ff"], // Orange-red to bright yellow
        },
        Weak: {
            color: "#ff8800", // Orange
            gradientColors: ["#ff8800", "#ffff00"], // Orange to yellow - softer version of normal
        },
        Strong: {
            color: "#ff0080", // Pink-red
            gradientColors: ["#ff0080", "#8000ff"], // Pink-red to purple - stronger version of crit
        },
        Immune: {
            color: "#C0C0C0", // Silver
            gradientColors: [], // No gradient
        },
    },
    // Player damage colors (red theme)
    player: {
        Normal: {
            color: "#FF6666", // Light red
            gradientColors: ["#6600ffff", "#ff04f2ff"], // Light red to red
        },
        Crit: {
            color: "#FF0000", // Bright red
            gradientColors: ["#6600ffff", "#07b6f0ff"], // Red to dark red
        },
        Weak: {
            color: "#8080ff", // Light purple
            gradientColors: ["#8080ff", "#ff80ff"], // Light purple to light pink - softer version of normal
        },
        Strong: {
            color: "#4000ff", // Deep purple
            gradientColors: ["#4000ff", "#0080ff"], // Deep purple to blue - stronger version of crit
        },
        Immune: {
            color: "#C0C0C0", // Silver
            gradientColors: [], // No gradient
        },
    },
} as const;

/**
 * Base styles for all damage types (without colors)
 */
const BASE_DAMAGE_STYLES: Record<string, DamageStyleBase> = {
    Normal: {
        fontSize: "28px",
        fontFamily: "Impact, Arial Black, sans-serif",
        strokeThickness: 6,
        fontStyle: "bold",
        shadow: {
            offsetX: 3,
            offsetY: 3,
            color: "#000000",
            blur: 4,
            stroke: true,
            fill: true,
        },
    },
    Crit: {
        fontSize: "28px",
        fontFamily: "Impact, Arial Black, sans-serif",
        strokeThickness: 6,
        fontStyle: "bold",
        shadow: {
            offsetX: 3,
            offsetY: 3,
            color: "#000000",
            blur: 4,
            stroke: true,
            fill: true,
        },
    },
    Weak: {
        fontSize: "28px",
        fontFamily: "Impact, Arial Black, sans-serif",
        strokeThickness: 6,
        fontStyle: "bold",
        shadow: {
            offsetX: 3,
            offsetY: 3,
            color: "#000000",
            blur: 4,
            stroke: true,
            fill: true,
        },
    },
    Strong: {
        fontSize: "28px",
        fontFamily: "Impact, Arial Black, sans-serif",
        strokeThickness: 6,
        fontStyle: "bold",
        shadow: {
            offsetX: 3,
            offsetY: 3,
            color: "#000000",
            blur: 4,
            stroke: true,
            fill: true,
        },
    },
    Immune: {
        fontSize: "28px",
        fontFamily: "Impact, Arial Black, sans-serif",
        strokeThickness: 6,
        fontStyle: "italic",
        shadow: {
            offsetX: 3,
            offsetY: 3,
            color: "#000000",
            blur: 4,
            stroke: true,
            fill: true,
        },
    },
};

/**
 * Get complete style configuration for a damage type and source
 */
export function getDamageStyle(
    damageType: keyof typeof BASE_DAMAGE_STYLES,
    source: keyof typeof DAMAGE_COLOR_THEMES
): DamageStyle {
    const baseStyle = BASE_DAMAGE_STYLES[damageType];
    const colorTheme =
        DAMAGE_COLOR_THEMES[source][
            damageType as keyof (typeof DAMAGE_COLOR_THEMES)[typeof source]
        ];

    return {
        ...baseStyle,
        color: colorTheme.color,
        stroke: "#000000", // Always black stroke
        useGradient: colorTheme.gradientColors.length > 0,
        gradientColors: colorTheme.gradientColors,
    };
}

/**
 * Shared configuration for damage number behavior
 */
export const DAMAGE_RENDERER_CONFIG = {
    /**
     * Animation timing and movement
     */
    animations: {
        duration: 1500, // Total animation time in ms
        fadeInDuration: 200, // Time to fade in
        fadeOutDuration: 300, // Time to fade out
        riseDistance: 80, // Pixels to rise upward
        spreadRadius: 15, // Random horizontal spread
        easingCurve: "Power2.easeOut",
        // Player damage specific overrides
        player: {
            duration: 2000, // Longer duration for player damage
            fadeOutDuration: 400,
            riseDistance: 100, // Rise higher for visibility
            spreadRadius: 20,
        },
    },

    /**
     * Stacking behavior for multiple hits
     */
    stacking: {
        verticalOffset: 25, // Pixels between stacked numbers
        horizontalJitter: 10, // Random horizontal offset
        maxStackHeight: 5, // Maximum numbers per enemy
        batchWindowMs: 100, // Milliseconds to batch rapid hits
    },

    /**
     * Display and rendering settings
     */
    display: {
        enemy: {
            baseDepth: 100, // Higher than all game objects
            stackDepthIncrement: 1, // Depth increase per stacked number
            baseYOffset: -60, // Pixels above enemy sprite
        },
        player: {
            baseDepth: 200, // Higher than enemy damage numbers
            baseYOffset: -80, // Position above player sprite
        },
    },

    /**
     * Performance settings
     */
    performance: {
        poolSize: 50, // Initial pool size
        maxPoolSize: 100, // Maximum pool size
        maxConcurrentNumbers: 30, // Maximum active numbers
        staleEventThresholdMs: 5000, // Ignore events older than this
        // Player specific limits
        player: {
            maxConcurrentNumbers: 10, // Less for player since only one player
        },
    },
} as const;

/**
 * Get damage type from SpacetimeDB enum
 */
export function getDamageTypeKey(
    damageType: DamageType
): keyof typeof BASE_DAMAGE_STYLES {
    switch (damageType.tag) {
        case "Normal":
            return "Normal";
        case "Crit":
            return "Crit";
        case "Weak":
            return "Weak";
        case "Strong":
            return "Strong";
        case "Immune":
            return "Immune";
        default:
            return "Normal";
    }
}

/**
 * Get display text for damage numbers
 */
export function getDamageDisplayText(
    damageAmount: number,
    damageType: DamageType
): string {
    if (damageType.tag === "Immune") {
        return "IMMUNE";
    }
    return Math.round(damageAmount).toString();
}
