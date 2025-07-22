import { defineConfig } from "vite";
import path from "path";

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
}));
