import { defineConfig } from "vite";

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
}));
