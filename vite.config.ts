import { defineConfig } from "vite";
import path from "path";
import fs from "fs";

// Simple plugin to copy map files only during build
const copyMapFilesPlugin = () => {
    return {
        name: "copy-map-files",
        buildStart() {
            // Only copy during build, not during dev
            const sourceFile = path.resolve(__dirname, "apps/playground/maps/playground.tmj");
            const destDir = path.resolve(__dirname, "public/maps");
            const destFile = path.join(destDir, "playground.tmj");

            // Create destination directory if it doesn't exist
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            // Copy the map file
            if (fs.existsSync(sourceFile)) {
                fs.copyFileSync(sourceFile, destFile);
                console.log(`✅ Copied map file for production build`);
            }
        },
    };
};

export default defineConfig(({ command }) => ({
    base: command === "build" ? "/jump-story-mvp/" : "/",
    server: {
        host: true,
        port: 4000,
    },
    build: {
        outDir: "dist",
        assetsDir: "assets",
        sourcemap: true,
    },
    publicDir: "public",
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./libs"),
        },
    },
    plugins: [copyMapFilesPlugin()],
}));
