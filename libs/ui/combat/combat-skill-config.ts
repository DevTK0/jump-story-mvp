/**
 * Combat Skill UI Configuration
 * Configuration for the combat skill bar that displays player abilities
 */

export const COMBAT_SKILL_CONFIG = {
  // Container positioning
  container: {
    margin: 20, // Distance from screen edges
    depth: 850, // Above game content but below bottom UI (900)
    padding: 8, // Padding inside the background
    backgroundColor: 0x1a1a1a, // Dark background matching bottom UI
    backgroundAlpha: 0.9, // Slight transparency
    borderColor: 0x444444, // Border color matching bottom UI
    borderWidth: 2,
    borderRadius: 4, // Rounded corners
  },

  // Grid layout
  grid: {
    rows: 1,
    cols: 3,
    spacing: 2, // Space between slots (reduced from 5)
  },

  // Individual skill slot configuration
  slot: {
    width: 45,
    height: 45,
    backgroundColor: 0xffffff, // White
    borderColor: 0x333333, // Dark grey
    borderWidth: 2,
    hoverBorderColor: 0x0066cc, // Blue on hover
    hoverBorderWidth: 3,
    disabledAlpha: 0.5, // Opacity for unavailable skills
  },

  // Hotkey label configuration
  hotkey: {
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    fontColor: '#666666', // Grey
    offsetX: 4, // From left edge
    offsetY: 4, // From top edge
  },

  // Skill name/icon placeholder
  skillContent: {
    fontSize: '10px',
    fontFamily: 'Arial, sans-serif',
    fontColor: '#333333',
  },

  // Tooltip configuration
  tooltip: {
    backgroundColor: 0x2a2a2a, // Dark grey
    borderColor: 0x444444,
    borderWidth: 1,
    padding: 10,
    maxWidth: 200,
    fontSize: '14px',
    fontFamily: 'Arial, sans-serif',
    fontColor: '#ffffff', // White text
    titleSize: '16px',
    titleColor: '#ffffff',
    fadeInDuration: 200,
    fadeOutDuration: 100,
    offsetY: -10, // Distance above slot
  },

  // Cooldown overlay
  cooldown: {
    overlayColor: 0x000000,
    overlayAlpha: 0.7,
    fontSize: '18px',
    fontColor: '#ffffff',
  },

  // Z-index/depth configuration
  depth: {
    container: 850,
    slots: 851,
    tooltip: 852,
    cooldownOverlay: 853,
  },

  // Placeholder skill slots configuration
  skills: {
    // Attack skills only
    0: { hotkey: 'X', label: 'A1', slotType: 'attack' },
    1: { hotkey: 'C', label: 'A2', slotType: 'attack' },
    2: { hotkey: 'V', label: 'A3', slotType: 'attack' },
  },
} as const;

// Type for skill slot indices
export type SkillSlotIndex = 0 | 1 | 2;