# Jump Story MVP

A multiplayer 2D platformer with real-time synchronization built with Phaser.js, TypeScript, SpacetimeDB, and Vite.

## Project Structure

```
apps/
  playground/          # Main game application
    scenes/            # Phaser scenes
    main.ts            # App entry point
    index.html         # App HTML
    public/            # App-specific assets
      assets/          # Sprites, textures, etc.
      maps/            # Tiled map files
libs/
  animations/          # Animation system
  core/                # Core utilities & asset management
  enemy/               # Enemy AI system
  networking/          # SpacetimeDB integration
  peer/                # Multiplayer peer system
  physics/             # Physics configuration
  player/              # Player controller & systems
  spacetime/           # SpacetimeDB client/server code
  stage/               # Map/level management
  ui/                  # UI components
package.json           # Dependencies and scripts
tsconfig.json          # TypeScript configuration
vite.config.ts         # Vite build configuration
```

## Development

### Prerequisites
- [pnpm](https://pnpm.io/) installed globally
- [SpacetimeDB CLI](https://spacetimedb.com) (optional, for multiplayer)

### Install Dependencies
```bash
pnpm install
```

### Run Development Server
```bash
pnpm dev
```
Open http://localhost:4000 in your browser.

### Build for Production
```bash
pnpm build
```

### Preview Production Build
```bash
pnpm preview
```


## Features

- **Multiplayer Support**: Real-time synchronization via SpacetimeDB
- **Modular Architecture**: Monorepo structure with shared libraries
- **Per-App Assets**: Each app manages its own assets independently
- **Advanced Physics**: Arcade physics with climbing mechanics
- **Enemy AI**: State machine-based enemy behavior
- **Chat System**: In-game chat with emotes
- **Player Stats**: Level system with XP and health
- **Debug Tools**: Built-in debug overlay and performance metrics
- **Error Boundaries**: Graceful error handling and recovery
- **Asset Management**: Centralized asset resolver for multi-app support

## Tech Stack

- **Phaser 3**: Game engine
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool with multi-app support
- **SpacetimeDB**: Real-time multiplayer database
- **pnpm**: Fast package manager
- **Stagehand MCP**: Computer use agents for automation

## Asset Management

The project uses a per-app asset management system where each application manages its own assets:

### Asset Structure
```
apps/playground/
  public/
    assets/
      spritesheet/     # Character and enemy sprites
      textures/        # Tileset textures
      emotes/          # Chat emote sprites
    maps/              # Tiled map files (.tmj)
```

### Adding New Assets
1. Place assets in `apps/[app-name]/public/assets/`
2. Reference them in code using standard paths: `assets/category/file.png`
3. The AssetResolver handles environment-specific path resolution automatically

### Asset Loading
Assets are loaded using the centralized AssetResolver:
- **Development**: Served directly from `apps/[app]/public/`
- **Production**: Copied to `dist/` and served with proper base path
- **GitHub Pages**: Automatically handles subdirectory deployment

### GitHub Pages Deployment
```bash
# Build for GitHub Pages
pnpm build

# The build will use the base path from vite.config.ts
# Assets will be served from /jump-story-mvp/assets/...
# Deploy the dist/ folder to GitHub Pages
```

## SpacetimeDB Integration

### Local Development
```bash
# Start SpacetimeDB
spacetime start

# Initialize the database (first time only)
pnpm run init:local

# Set environment to local
# Edit .env: VITE_SPACETIME_TARGET=local
```

### Cloud Deployment
```bash
# First, publish the SpacetimeDB module
cd libs/spacetime/server
spacetime publish -s maincloud <app-name> -c

# Then initialize the database with data
cd ../../..
pnpm run init:cloud
```

### Connecting to Different Backends
```bash
# To run locally but connect to cloud backend:
# Edit .env: VITE_SPACETIME_TARGET=cloud

# To run locally and connect to local backend:
# Edit .env: VITE_SPACETIME_TARGET=local
```

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

## Creating a New App

To add a new application to the monorepo:

1. **Create the app structure**:
   ```bash
   mkdir -p apps/my-app/public/assets
   mkdir -p apps/my-app/scenes
   ```

2. **Create `apps/my-app/index.html`**:
   ```html
   <!DOCTYPE html>
   <html>
   <head>
       <title>My App</title>
   </head>
   <body>
       <div id="game-container"></div>
       <script type="module" src="./main.ts"></script>
   </body>
   </html>
   ```

3. **Create `apps/my-app/main.ts`**:
   ```typescript
   import Phaser from "phaser";
   import { MyScene } from "./scenes/my-scene";
   
   const game = new Phaser.Game({
       type: Phaser.AUTO,
       width: window.innerWidth,
       height: window.innerHeight,
       scene: MyScene,
       parent: "game-container",
   });
   ```

4. **Update `vite.config.ts`** to point to your app:
   ```typescript
   root: "apps/my-app",  // Change from "apps/playground"
   ```

5. **Add your assets** to `apps/my-app/public/assets/`

6. **Run your app**: `pnpm dev`

Each app is completely independent with its own assets, scenes, and configuration!