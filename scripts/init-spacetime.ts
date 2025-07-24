#!/usr/bin/env bun
/**
 * Initialize SpaceTime Database Script
 *
 * Reads the playground.tmj tilemap file and calls the InitializeEnemyRoutes reducer
 * to populate the EnemyRoute table with spawn zone definitions including spawn intervals.
 *
 * Usage:
 *   pnpm run init:local          # Initialize local deployment
 *   pnpm run init:cloud          # Initialize cloud deployment
 *
 * This script sets up:
 * - Enemy spawn areas with configurable spawn intervals
 * - Route-specific enemy types and max counts
 * - Per-route timing configuration from tilemap data
 */

import { readFileSync } from "fs";
import { join } from "path";
import { DbConnection, type ErrorContext } from "../libs/spacetime/client";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function initializeSpacetime() {
    let connection: DbConnection | null = null;

    try {
        // Get deployment target from command line argument
        const target = process.argv[2] || "local";
        const isCloud = target === "cloud";

        // Determine the URI based on target
        const uri = isCloud
            ? "wss://maincloud.spacetimedb.com"
            : "ws://localhost:3000";

        console.log(`🚀 Initializing SpaceTimeDB (${target} deployment)...`);
        console.log(`   URI: ${uri}`);

        // Get admin API key from environment
        const adminApiKey = process.env.SPACETIME_ADMIN_API_KEY;
        if (!adminApiKey) {
            throw new Error(
                "SPACETIME_ADMIN_API_KEY not found in environment variables. Please check your .env file."
            );
        }
        console.log("Admin API key loaded successfully.");

        console.log("Reading tilemap file...");

        // Read the tilemap JSON file
        const tilemapPath = join(
            process.cwd(),
            "apps/playground/maps/playground.tmj"
        );
        const tilemapContent = readFileSync(tilemapPath, "utf8");

        // Parse and display spawn configuration info
        console.log("Parsing spawn configuration...");
        const tilemap = JSON.parse(tilemapContent);
        let routeCount = 0;
        let intervalInfo: string[] = [];

        // Extract spawn information for logging
        for (const layer of tilemap.layers) {
            if (layer.name === "Enemies" && layer.objects) {
                for (const obj of layer.objects) {
                    if (obj.properties) {
                        let enemyType = "";
                        let maxEnemies = 1;
                        let spawnInterval = 60; // Default

                        let behavior = "patrol"; // Default
                        for (const prop of obj.properties) {
                            if (prop.name === "enemy") enemyType = prop.value;
                            if (prop.name === "number")
                                maxEnemies = parseInt(prop.value);
                            if (prop.name === "spawn_interval")
                                spawnInterval = parseInt(prop.value);
                            if (prop.name === "behavior") behavior = prop.value;
                        }

                        if (enemyType) {
                            routeCount++;
                            intervalInfo.push(
                                `  Route ${routeCount}: ${enemyType} (max: ${maxEnemies}, interval: ${spawnInterval}s, behavior: ${behavior})`
                            );
                        }
                    }
                }
            }
        }

        console.log(`Found ${routeCount} enemy routes with spawn intervals:`);
        intervalInfo.forEach((info) => console.log(info));

        console.log("\nConnecting to SpaceTimeDB...");

        // Connect to SpaceTimeDB using the proper pattern
        await new Promise<void>((resolve, reject) => {
            const onConnect = (
                conn: DbConnection,
                identity: Identity,
                token: string
            ) => {
                connection = conn;
                console.log(
                    "✅ Connected to SpaceTimeDB with identity:",
                    identity.toHexString()
                );
                resolve();
            };

            const onConnectError = (_ctx: ErrorContext, err: Error) => {
                console.error("Connection error:", err);
                reject(err);
            };

            DbConnection.builder()
                .withUri(uri)
                .withModuleName("jump-story")
                .onConnect(onConnect)
                .onConnectError(onConnectError)
                .build();
        });

        if (!connection) {
            throw new Error("Failed to establish connection");
        }

        console.log("Populating enemy configurations...");

        // Read and populate enemy config from JSON
        const enemyAttributesPath = join(
            process.cwd(),
            "apps/playground/enemy_attributes.json"
        );
        const enemyConfigContent = readFileSync(enemyAttributesPath, "utf8");
        await connection.reducers.populateEnemyConfig(
            adminApiKey,
            enemyConfigContent
        );

        console.log("✅ Enemy configurations populated!");

        console.log("Populating player leveling curve...");

        // Read and populate player leveling curve from JSON
        const playerLevelingPath = join(
            process.cwd(),
            "apps/playground/player_leveling_curve.json"
        );
        const levelingCurveContent = readFileSync(playerLevelingPath, "utf8");
        await connection.reducers.populatePlayerLevelingConfig(
            adminApiKey,
            levelingCurveContent
        );

        console.log("✅ Player leveling curve populated!");

        console.log("Initializing enemy routes with spawn intervals...");

        // Call the reducer using the proper connection
        await connection.reducers.initializeEnemyRoutes(
            adminApiKey,
            tilemapContent
        );

        console.log("✅ Enemy routes initialized successfully!");
        console.log("🐺 Spawning initial enemies for all routes...");

        // Spawn initial enemies to populate the world
        await connection.reducers.spawnAllEnemies(adminApiKey);

        // Give extra time for all operations to complete
        await new Promise((resolve) => setTimeout(resolve, 3000));

        console.log("✅ SpaceTime database initialized successfully!");
        console.log(
            "✅ Enemy routes with per-route spawn intervals configured!"
        );
        console.log(
            `✅ ${routeCount} spawn areas ready with individual timing!`
        );
        console.log("🐺 Initial enemy population spawned!");
    } catch (error) {
        console.error(
            "❌ Failed to initialize SpaceTime database:",
            (error as Error).message
        );
        process.exit(1);
    } finally {
        if (connection) {
            connection.disconnect();
        }
    }
}

// Run the script
initializeSpacetime();
