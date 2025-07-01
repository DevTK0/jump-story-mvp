# Simple Phaser Platformer

A basic 2D platformer with arrow key movement built with Phaser.js, TypeScript, and Vite.

## Project Structure

```
src/
  config/
    GameConfig.ts      # Game configuration
  scenes/
    GameScene.ts       # Main game scene
  main.ts              # Entry point
public/
  assets/              # Game assets (sprites, sounds, etc.)
package.json           # Dependencies and scripts
tsconfig.json          # TypeScript configuration
vite.config.ts         # Vite build configuration
```

## Development

### Prerequisites
- [pnpm](https://pnpm.io/) installed globally

### Install Dependencies
```bash
pnpm install
```

### Run Development Server
```bash
pnpm dev
```
Open http://localhost:3000 in your browser.

### Build for Production
```bash
pnpm build
```

### Preview Production Build
```bash
pnpm preview
```

## Controls

- **Arrow Keys** or **WASD**: Move left/right
- **Up Arrow** or **Space** or **W**: Jump

## Features

- TypeScript for type safety
- Hot module replacement with Vite
- Modern ES modules
- Conventional Phaser project structure
- Simple movement without physics engine
- Basic gravity and jumping
- Platform collision (visual only)
- Bright green player square with black border

## Tech Stack

- **Phaser 3**: Game engine
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **pnpm**: Fast package manager
- **Stagehand MCP**: Computer use agents for automation

## MCP (Model Context Protocol) Integration

This project includes Stagehand MCP server for AI-powered browser automation and computer use capabilities.

### MCP Setup

1. **Configure API Keys** (optional for basic usage):
   Edit `.mcp.json` and add your API keys:
   ```json
   {
     "mcpServers": {
       "stagehand": {
         "command": "npx",
         "args": ["@browserbasehq/mcp-stagehand"],
         "env": {
           "BROWSERBASE_API_KEY": "your_key_here",
           "BROWSERBASE_PROJECT_ID": "your_project_id",
           "OPENAI_API_KEY": "your_openai_key"
         }
       }
     }
   }
   ```

2. **Test MCP Server**:
   ```bash
   pnpm run mcp:stagehand
   ```

### MCP Use Cases

- **Automated Game Testing**: AI agents can play the game and test functionality
- **Development Workflow**: Automate browser-based testing and interactions
- **Quality Assurance**: Automated regression testing of web-based game features
- **Performance Monitoring**: Automated performance testing in browsers

### Security Note

The `.mcp.json` file is included in the repository for team collaboration. API keys should be set per developer and not committed to version control.