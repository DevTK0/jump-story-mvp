/**
 * Bottom UI Bar Configuration
 * Configuration for the bottom UI bar that displays player stats, level, and menu buttons
 */

export const BOTTOM_UI_CONFIG = {
  // Container positioning
  container: {
    height: 80,
    padding: 10,
    backgroundColor: 0x1a1a1a,
    borderColor: 0x444444,
    borderWidth: 2,
  },

  // Level display configuration
  levelDisplay: {
    width: 80,
    height: 80, // Same as container height
    backgroundColor: 0x0a0a0a, // Darker black
    borderColor: 0xffa500, // Orange border
    borderWidth: 0, // No border
    fontSize: '24px',
    fontFamily: 'Arial Black, sans-serif',
    fontColor: '#ffa500', // Orange text
    labelFontSize: '12px',
    labelColor: '#ffa500', // Orange text
  },

  // Player info configuration
  playerInfo: {
    nameSize: '16px',
    jobSize: '14px',
    fontFamily: 'Arial, sans-serif',
    nameColor: '#ffffff',
    jobColor: '#cccccc',
    spacing: 15,
  },

  // Stat bars configuration
  statBars: {
    width: 150,
    height: 20,
    spacing: 5,
    borderWidth: 0.5,
    borderColor: 0x333333,
    fontSize: '14px',
    fontColor: '#ffffff',
    fontFamily: 'Helvetica, Arial, sans-serif',
    hp: {
      fillColor: 0xcc0000,
      backgroundColor: 0x330000,
      label: 'HP',
    },
    mp: {
      fillColor: 0x0066cc,
      backgroundColor: 0x001133,
      label: 'MP',
    },
    exp: {
      fillColor: 0xccaa00,
      backgroundColor: 0x332200,
      label: 'EXP',
    },
  },

  // Menu button configuration
  menuButton: {
    width: 80,
    height: 30,
    backgroundColor: 0x2a2a2a,
    hoverColor: 0x3a3a3a,
    borderColor: 0x555555,
    borderWidth: 2,
    fontSize: '14px',
    fontColor: '#ffffff',
    label: 'MENU',
  },

  // Layout configuration
  layout: {
    levelMarginLeft: 20,
    playerInfoMarginLeft: 20,
    statBarsMarginLeft: 30,
    menuButtonMarginRight: 20,
  },

  // Z-index/depth configuration
  depth: {
    background: 900,
    content: 901,
    buttons: 902,
  },
} as const;
