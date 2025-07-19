// Player configuration
export const PLAYER_CONFIG = {
    movement: {
        speed: 200,
        jumpSpeed: 450,
        scale: 3,
        hitboxWidth: 10,
        hitboxHeight: 10,
    },
    attack: {
        edgeOffset: 16,
        hitboxPositionMultiplier: 0.25,
    },
    climbing: {
        speed: 150,
        centerThreshold: 0.7, // Player must be within 70% of ladder center to climb
        snapSpeed: 300, // Speed of horizontal snapping to center
        alignmentTolerance: 2, // Pixel tolerance for center alignment
        snapFps: 60, // FPS assumption for snap velocity calculations
    },
    animations: {
        soldier: {
            idle: {
                frames: { start: 0, end: 5 },
                framerate: 8,
            },
            walk: {
                frames: { start: 0, end: 7 },
                framerate: 12,
            },
            attack: {
                framerate: 20,
            },
        },
    },
} as const;