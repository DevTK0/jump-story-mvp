// Player movement constants
export const PLAYER_SPEED = 200;
export const PLAYER_JUMP_SPEED = 450;
export const PLAYER_SCALE = 3;
export const PLAYER_HITBOX_WIDTH = 10;
export const PLAYER_HITBOX_HEIGHT = 10;

// Attack constants
export const ATTACK_EDGE_OFFSET = 16;
export const ATTACK_HITBOX_POSITION_MULTIPLIER = 0.25;

// Climbing constants
export const CLIMB_SPEED = 150;
export const CLIMB_CENTER_THRESHOLD = 0.7; // Player must be within 70% of ladder center to climb
export const CLIMB_SNAP_SPEED = 300; // Speed of horizontal snapping to center
export const CLIMB_ALIGNMENT_TOLERANCE = 2; // Pixel tolerance for center alignment
export const CLIMB_SNAP_FPS = 60; // FPS assumption for snap velocity calculations

// Player animation constants
export const ANIMATION_SOLDIER_IDLE_FRAMES = { start: 0, end: 5 };
export const ANIMATION_SOLDIER_WALK_FRAMES = { start: 0, end: 7 };
export const ANIMATION_SOLDIER_IDLE_FRAMERATE = 8;
export const ANIMATION_SOLDIER_WALK_FRAMERATE = 12;
export const ANIMATION_SOLDIER_ATTACK_FRAMERATE = 20;