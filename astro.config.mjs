import { defineConfig } from "astro/config";

import starlight from "@astrojs/starlight";
import starlightThemeBlack from "starlight-theme-black";
import starlightAutoSidebar from "starlight-auto-sidebar";
import d2 from "astro-d2";

export default defineConfig({
    site: "https://devtk0.github.io",
    base: process.env.NODE_ENV === "production" ? "/jump-story-mvp/docs" : "/",
    srcDir: "./docs",
    // your configuration options here...
    integrations: [
        starlight({
            plugins: [
                starlightThemeBlack({
                    navLinks: [],
                }),
                starlightAutoSidebar(),
            ],
            sidebar: [
                {
                    label: "Home",
                    link: "/",
                },
                {
                    label: "AI",
                    autogenerate: { directory: "ai" },
                },
                {
                    label: "Player",
                    autogenerate: { directory: "player" },
                },
                {
                    label: "Peer",
                    autogenerate: { directory: "peer" },
                },
                {
                    label: "Enemy",
                    autogenerate: { directory: "enemy" },
                },
                {
                    label: "Quest",
                    autogenerate: { directory: "quest" },
                },
                {
                    label: "Item",
                    autogenerate: { directory: "item" },
                },
                {
                    label: "Stage",
                    autogenerate: { directory: "stage" },
                },
                {
                    label: "Debug",
                    autogenerate: { directory: "debug" },
                },
            ],
            title: "Jump Story",
        }),
        d2(),
    ],
});
