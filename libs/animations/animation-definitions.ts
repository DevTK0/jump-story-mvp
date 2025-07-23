import type { SpriteAnimationSet } from "./animation-factory";

/**
 * Centralized animation definitions for all sprite types in the game
 *
 * This file contains all animation frame configurations, allowing for:
 * - Easy modification of animation parameters
 * - Consistent frame ranges across the codebase
 * - Single source of truth for animation definitions
 * - Type safety for animation configurations
 */

export const ANIMATION_DEFINITIONS = {
    /**
     * Player soldier sprite animations
     */
    soldier: {
        idle: { start: 0, end: 5, frameRate: 8 },
        walk: { start: 9, end: 16, frameRate: 12 },
        attack1: { start: 18, end: 23, frameRate: 20 },
        attack2: { start: 27, end: 32, frameRate: 20 },
        attack3: { start: 36, end: 45, frameRate: 20 },
        damaged: { start: 45, end: 49, frameRate: 15 },
    } satisfies SpriteAnimationSet,

    /**
     * Enemy orc sprite animations
     */
    orc: {
        idle: { start: 0, end: 5, frameRate: 8 },
        walk: { start: 9, end: 16, frameRate: 10 },
        hit: { start: 32, end: 35, frameRate: 15 },
        death: { start: 40, end: 43, frameRate: 12 },
    } satisfies SpriteAnimationSet,
} as const;

/**
 * Animation timing constants for consistent durations across the game
 */
export const ANIMATION_TIMINGS = {
    // Attack animation durations (in milliseconds)
    ATTACK_DURATIONS: {
        attack1: 300, // Quick slash
        attack2: 600, // Heavy strike
        attack3: 450, // Combo attack
    },

    // State animation durations
    DAMAGED_DURATION: 400,
    INVULNERABILITY_DURATION: 1000,
    FLASH_INTERVAL: 100,
    MAX_FLASHES: 10,

    // Frame rates for different animation types
    DEFAULT_FRAME_RATES: {
        idle: 8,
        walk: 10,
        run: 15,
        attack: 20,
        damaged: 15,
        death: 12,
    },
} as const;

/**
 * Animation behavior configurations
 */
export const ANIMATION_BEHAVIORS = {
    // Which animations should loop
    LOOPING_ANIMATIONS: ["idle", "walk", "run"] as const,

    // Which animations should play once
    ONE_SHOT_ANIMATIONS: [
        "attack1",
        "attack2",
        "attack3",
        "damaged",
        "hit",
        "death",
    ] as const,

    // Which animations can be interrupted
    INTERRUPTIBLE_ANIMATIONS: ["idle", "walk", "run"] as const,

    // Which animations cannot be interrupted
    NON_INTERRUPTIBLE_ANIMATIONS: [
        "attack1",
        "attack2",
        "attack3",
        "damaged",
        "death",
    ] as const,

    // Animation priorities (higher number = higher priority)
    ANIMATION_PRIORITIES: {
        idle: 1,
        walk: 2,
        run: 3,
        attack1: 10,
        attack2: 10,
        attack3: 10,
        hurt: 15,
        death: 20,
    } as const,
} as const;

/**
 * Helper function to get animation definition for a sprite
 */
export function getAnimationDefinition(
    spriteKey: string
): SpriteAnimationSet | undefined {
    return ANIMATION_DEFINITIONS[
        spriteKey as keyof typeof ANIMATION_DEFINITIONS
    ];
}

/**
 * Helper function to check if an animation should loop
 */
export function shouldAnimationLoop(animationType: string): boolean {
    return ANIMATION_BEHAVIORS.LOOPING_ANIMATIONS.includes(
        animationType as any
    );
}

/**
 * Helper function to check if an animation can be interrupted
 */
export function canAnimationBeInterrupted(animationType: string): boolean {
    return ANIMATION_BEHAVIORS.INTERRUPTIBLE_ANIMATIONS.includes(
        animationType as any
    );
}

/**
 * Helper function to get animation priority
 */
export function getAnimationPriority(animationType: string): number {
    return (
        ANIMATION_BEHAVIORS.ANIMATION_PRIORITIES[
            animationType as keyof typeof ANIMATION_BEHAVIORS.ANIMATION_PRIORITIES
        ] ?? 1
    );
}
