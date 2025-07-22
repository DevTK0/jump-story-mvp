#!/usr/bin/env bun
/**
 * Initialize Enemy Routes Script
 *
 * Reads the playground.tmj tilemap file and calls the InitializeEnemyRoutes reducer
 * to populate the EnemyRoute table with spawn zone definitions.
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
    DbConnection,
    type ErrorContext,
} from "../libs/spacetime/client";
import { Identity } from "@clockworklabs/spacetimedb-sdk";

async function initializeEnemyRoutes() {
    let connection: DbConnection | null = null;

    try {
        console.log("Reading tilemap file...");

        // Read the tilemap JSON file
        const tilemapPath = join(
            process.cwd(),
            "apps/playground/maps/playground.tmj"
        );
        const tilemapContent = readFileSync(tilemapPath, "utf8");

        console.log("Connecting to SpaceTimeDB...");

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
                .withUri("ws://localhost:3000")
                .withModuleName("jump-story")
                .onConnect(onConnect)
                .onConnectError(onConnectError)
                .build();
        });

        if (!connection) {
            throw new Error("Failed to establish connection");
        }

        console.log("Tilemap loaded, calling InitializeEnemyRoutes reducer...");

        // Call the reducer using the proper connection
        connection.reducers.initializeEnemyRoutes(tilemapContent);

        console.log("✅ Enemy routes initialized successfully!");
    } catch (error) {
        console.error(
            "❌ Failed to initialize enemy routes:",
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
initializeEnemyRoutes();
