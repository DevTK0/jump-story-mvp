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
export const CLIMB_TOP_Y = 340;
export const CLIMB_BOTTOM_Y = 534;
export const CLIMB_X_POSITION = 600;
export const CLIMB_WIDTH = 40;
export const CLIMB_SPEED = 150;
export const CLIMB_TOP_BOUNDARY_OFFSET = 30;
export const CLIMB_BOTTOM_BOUNDARY_OFFSET = 20;
export const CLIMB_BOUNDARY_OFFSET = 10;
export const CLIMB_KNOT_SPACING = 20;
export const CLIMB_KNOT_WIDTH = 6;
export const CLIMB_KNOT_HEIGHT = 4;
export const CLIMB_GROUND_LEVEL_THRESHOLD = 400;
export const CLIMB_EXIT_PLAYER_OFFSET = 16;

// Player animation constants
export const ANIMATION_SOLDIER_IDLE_FRAMES = { start: 0, end: 5 };
export const ANIMATION_SOLDIER_WALK_FRAMES = { start: 0, end: 7 };
export const ANIMATION_SOLDIER_IDLE_FRAMERATE = 8;
export const ANIMATION_SOLDIER_WALK_FRAMERATE = 12;
export const ANIMATION_SOLDIER_ATTACK_FRAMERATE = 20;