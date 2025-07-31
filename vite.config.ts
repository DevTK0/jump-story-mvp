import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

// Plugin to copy app public directories during build
const copyAppAssetsPlugin = () => {
  return {
    name: 'copy-app-assets',
    writeBundle() {
      // Only copy during build, not during dev
      const appsDir = path.resolve(__dirname, 'apps');
      const apps = fs.readdirSync(appsDir).filter((app) => {
        const appPath = path.join(appsDir, app);
        return fs.statSync(appPath).isDirectory();
      });

      apps.forEach((app) => {
        const appPublicDir = path.join(appsDir, app, 'public');
        if (fs.existsSync(appPublicDir)) {
          const destDir = path.resolve(__dirname, 'dist');

          // Copy app public contents to dist
          copyRecursiveSync(appPublicDir, destDir);
          console.log(`✅ Copied assets for ${app} app`);
        }

        // Also copy map files if they exist
        const appMapsDir = path.join(appsDir, app, 'maps');
        if (fs.existsSync(appMapsDir)) {
          const destMapsDir = path.resolve(__dirname, 'dist/maps');
          if (!fs.existsSync(destMapsDir)) {
            fs.mkdirSync(destMapsDir, { recursive: true });
          }

          const mapFiles = fs.readdirSync(appMapsDir).filter((f) => f.endsWith('.tmj'));
          mapFiles.forEach((mapFile) => {
            const sourceFile = path.join(appMapsDir, mapFile);
            const destFile = path.join(destMapsDir, mapFile);
            fs.copyFileSync(sourceFile, destFile);
          });

          if (mapFiles.length > 0) {
            console.log(`✅ Copied ${mapFiles.length} map file(s) for ${app} app`);
          }
        }
      });
    },
  };
};

function copyRecursiveSync(src: string, dest: string) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

export default defineConfig(({ command, mode }) => ({
  base: command === 'build' && mode !== 'itch' ? '/jump-story-mvp/' : './',
  root: 'apps/playground',
  publicDir: 'public',
  server: {
    host: true,
    port: 4000,
  },
  build: {
    outDir: '../../dist',
    assetsDir: 'assets',
    sourcemap: true,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './libs'),
    },
  },
  plugins: [copyAppAssetsPlugin()],
}));
