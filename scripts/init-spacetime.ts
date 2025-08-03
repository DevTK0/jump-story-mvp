#!/usr/bin/env bun
/**
 * Initialize SpaceTime Database Script
 *
 * Reads the playground.tmj tilemap file and calls the InitializeEnemyRoutes reducer
 * to populate the SpawnRoute table with spawn zone definitions including spawn intervals.
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

import { readFileSync } from 'fs';
import { join } from 'path';
import { DbConnection, type ErrorContext } from '../libs/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import * as dotenv from 'dotenv';
import { jobAttributes } from '../apps/playground/config/job-attributes';
import { playerLevelingCurve } from '../apps/playground/config/player-level';
import { enemyAttributes, bossAttributes } from '../apps/playground/config/enemy-attributes';
import { calculateBossAnimationDurations, logBossAnimationDurations } from './calculate-boss-animation-durations';

// Load environment variables
dotenv.config();

// Helper function to log with timestamp
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

async function initializeSpacetime() {
  let connection: DbConnection | null = null;
  let isIntentionalDisconnect = false;

  try {
    // Get deployment target from command line argument
    const target = process.argv[2] || 'local';
    const isCloud = target === 'cloud';

    // Determine the URI based on target
    const uri = isCloud ? 'wss://maincloud.spacetimedb.com' : 'ws://localhost:3000';

    console.log(`🚀 Initializing SpaceTimeDB (${target} deployment)...`);
    console.log(`   URI: ${uri}`);

    // Get admin API key from environment
    const adminApiKey = process.env.SPACETIME_ADMIN_API_KEY;
    if (!adminApiKey) {
      throw new Error(
        'SPACETIME_ADMIN_API_KEY not found in environment variables. Please check your .env file.'
      );
    }
    console.log('Admin API key loaded successfully.');

    console.log('Reading tilemap file...');

    // Read the tilemap JSON file
    const tilemapPath = join(process.cwd(), 'apps/playground/maps/playground.tmj');
    const tilemapContent = readFileSync(tilemapPath, 'utf8');

    // Parse and display spawn configuration info
    console.log('Parsing spawn configuration...');
    const tilemap = JSON.parse(tilemapContent);
    let routeCount = 0;
    let intervalInfo: string[] = [];

    // Extract spawn information for logging
    for (const layer of tilemap.layers) {
      if (layer.name === 'Enemies' && layer.objects) {
        for (const obj of layer.objects) {
          if (obj.properties) {
            let enemyType = '';
            let maxEnemies = 1;
            let spawnInterval = 60; // Default

            let behavior = 'patrol'; // Default
            for (const prop of obj.properties) {
              if (prop.name === 'enemy') enemyType = prop.value;
              if (prop.name === 'number') maxEnemies = parseInt(prop.value);
              if (prop.name === 'spawn_interval') spawnInterval = parseInt(prop.value);
              if (prop.name === 'behavior') behavior = prop.value;
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

    console.log('\nConnecting to SpaceTimeDB...');

    // Connect to SpaceTimeDB using the proper pattern
    await new Promise<void>((resolve, reject) => {
      const onConnect = (conn: DbConnection, identity: Identity, _token: string) => {
        connection = conn;
        console.log('✅ Connected to SpaceTimeDB with identity:', identity.toHexString());
        resolve();
      };

      const onConnectError = (_ctx: ErrorContext, err: Error) => {
        // Only log error if it's not an intentional disconnect
        if (!isIntentionalDisconnect) {
          console.error('Connection error:', err);
          reject(err);
        }
      };
      
      const onDisconnect = (_conn: DbConnection, closeEvent: CloseEvent) => {
        if (!isIntentionalDisconnect) {
          console.log('⚠️  Unexpected disconnect during initialization:', closeEvent.reason || 'No reason provided');
          console.log('   Close code:', closeEvent.code);
        }
      };

      DbConnection.builder()
        .withUri(uri)
        .withModuleName('jump-story')
        .onConnect(onConnect)
        .onConnectError(onConnectError)
        .onDisconnect(onDisconnect)
        .build();
    });

    if (!connection) {
      throw new Error('Failed to establish connection');
    }

    console.log('Populating enemy configurations...');

    // Populate enemy config from TypeScript config
    const enemyConfigContent = JSON.stringify(enemyAttributes);
    await connection.reducers.populateEnemy(adminApiKey, enemyConfigContent);

    console.log('✅ Enemy configurations populated!');
    
    console.log('Populating boss configurations...');
    
    // List all boss types being configured
    const bossTypes = Object.keys(bossAttributes.bosses);
    console.log(`  Configuring ${bossTypes.length} boss types:`);
    bossTypes.forEach((bossId, index) => {
      const boss = bossAttributes.bosses[bossId];
      console.log(`    ${index + 1}. ${bossId} - "${boss.name}" (Level ${boss.level})`);
    });
    
    // Calculate animation durations for all boss attacks
    const bossAnimationDurations = calculateBossAnimationDurations();
    logBossAnimationDurations(bossAnimationDurations);
    
    // Create a modified boss config that includes animation durations
    const bossConfigWithDurations = JSON.parse(JSON.stringify(bossAttributes));
    
    // Add animation durations to each boss attack
    for (const [bossId, durations] of Object.entries(bossAnimationDurations)) {
      if (bossConfigWithDurations.bosses[bossId]?.attacks) {
        const attacks = bossConfigWithDurations.bosses[bossId].attacks;
        if (attacks.attack1 && durations.attack1) {
          attacks.attack1.animationDuration = durations.attack1;
        }
        if (attacks.attack2 && durations.attack2) {
          attacks.attack2.animationDuration = durations.attack2;
        }
        if (attacks.attack3 && durations.attack3) {
          attacks.attack3.animationDuration = durations.attack3;
        }
      }
    }
    
    // Populate boss config with calculated animation durations
    const bossConfigContent = JSON.stringify(bossConfigWithDurations);
    await connection.reducers.populateBoss(adminApiKey, bossConfigContent);
    
    console.log('✅ Boss configurations populated with calculated animation durations!');

    console.log('Populating player leveling curve...');

    // Populate player leveling curve from TypeScript config
    const levelingCurveContent = JSON.stringify(playerLevelingCurve);
    await connection.reducers.populatePlayerLevel(adminApiKey, levelingCurveContent);

    console.log('✅ Player leveling curve populated!');

    console.log('Initializing enemy routes with spawn intervals...');

    // Call the reducer using the proper connection
    await connection.reducers.initializeEnemyRoutes(adminApiKey, tilemapContent);

    console.log('✅ Enemy routes initialized successfully!');
    
    console.log('Initializing boss routes...');
    
    // Extract boss route information for logging
    let bossRouteCount = 0;
    let bossRouteInfo: string[] = [];
    
    for (const layer of tilemap.layers) {
      if (layer.name === 'Bosses' && layer.objects) {
        for (const obj of layer.objects) {
          if (obj.properties) {
            let bossType = '';
            let isBoss = false;
            
            for (const prop of obj.properties) {
              if (prop.name === 'enemy') bossType = prop.value;
              if (prop.name === 'type' && prop.value === 'boss') isBoss = true;
            }
            
            if (isBoss && bossType) {
              bossRouteCount++;
              bossRouteInfo.push(
                `  Boss Route ${bossRouteCount}: ${bossType} at (${obj.x}, ${obj.y}) - Area: ${obj.width}x${obj.height}`
              );
            }
          }
        }
      }
    }
    
    if (bossRouteCount > 0) {
      console.log(`Found ${bossRouteCount} boss spawn locations:`);
      bossRouteInfo.forEach((info) => console.log(info));
    } else {
      console.log('  No boss routes found in tilemap.');
    }
    
    // Initialize boss routes from tilemap
    await connection.reducers.initializeBossRoutes(adminApiKey, tilemapContent);
    
    log('✅ Boss routes initialized successfully!');
    
    log('Populating boss triggers from config...');
    
    // Extract boss trigger information for logging
    let bossTriggerCount = 0;
    let bossTriggerInfo: string[] = [];
    
    for (const [enemyType, enemyData] of Object.entries(enemyAttributes.enemies)) {
      if (enemyData.boss_trigger) {
        bossTriggerCount++;
        bossTriggerInfo.push(
          `  Trigger ${bossTriggerCount}: Kill ${enemyData.boss_trigger.required_kills} ${enemyType} → Spawn ${enemyData.boss_trigger.boss_to_spawn} boss`
        );
      }
    }
    
    if (bossTriggerCount > 0) {
      console.log(`  Found ${bossTriggerCount} boss triggers:`);
      bossTriggerInfo.forEach((info) => console.log(info));
    }
    
    try {
      // Populate boss triggers from enemy config
      await connection.reducers.populateBossTriggers(adminApiKey, enemyConfigContent);
      
      log('✅ Boss triggers populated successfully!');
      
      // Give extra time for boss trigger operations to complete on cloud
      log('   Waiting for boss trigger operations to sync...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('❌ Failed to populate boss triggers:', (error as Error).message);
      // Don't throw - continue with other initialization
    }
    
    console.log('🐺 Spawning initial enemies for all routes...');

    // Spawn initial enemies to populate the world
    await connection.reducers.spawnAllEnemies(adminApiKey);

    // Give extra time for all operations to complete
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log('🎮 Initializing job configurations...');

    // Clear existing job data for clean initialization
    console.log('  Clearing existing job data...');
    await connection.reducers.clearAllJobData(adminApiKey);

    // Initialize each job
    let jobCount = 0;
    for (const [jobKey, jobConfig] of Object.entries(jobAttributes)) {
      console.log(`  Initializing job: ${jobKey} (${jobConfig.displayName})`);
      jobCount++;
      
      try {
        // Initialize the job with base stats
        console.log(`    Sending jobKey: "${jobKey}", adminKey: "${adminApiKey}"`);
        await connection.reducers.initializeJob(
          adminApiKey,
          jobKey,
          jobConfig.displayName,
          jobConfig.baseStats.health,
          jobConfig.baseStats.moveSpeed,
          jobConfig.baseStats.mana,
          jobConfig.baseStats.hpRecovery,
          jobConfig.baseStats.manaRecovery,
          jobConfig.unlockLevel
        );
        console.log(`    ✅ Job ${jobKey} initialized`);
      } catch (error) {
        console.error(`    ❌ Failed to initialize job ${jobKey}:`, (error as Error).message);
      }

      // Initialize attacks for this job
      let attackSlot = 1;
      const attacks = jobConfig.attacks as Record<string, any>;
      for (const [_attackKey, attack] of Object.entries(attacks)) {
        console.log(`    Adding attack: ${attack.name} (slot: ${attackSlot}, type: ${attack.attackType})`);
        
        // Prepare optional fields based on attack type
        let projectile: string | null = null;
        let skillEffect: string | null = null;
        let areaRadius: number | null = null;

        if (attack.attackType === 'projectile') {
          projectile = attack.projectile || null;
        } else if (attack.attackType === 'area') {
          areaRadius = attack.radius || null;
        }
        
        // Skill effect can be used with any attack type
        skillEffect = attack.skillEffect || null;

        try {
          await connection.reducers.initializeJobAttack(
            adminApiKey,
            jobKey,
            attackSlot,
            attack.attackType,
            attack.name,
            attack.damage,
            attack.cooldown,
            attack.critChance,
            attack.knockback,
            attack.range,
            attack.hits,
            attack.targets,
            attack.manaCost,
            attack.manaLeech || 0, // Default to 0 if not specified
            attack.hpLeech || 0, // Default to 0 if not specified
            projectile,
            skillEffect,
            areaRadius
          );
          console.log(`    ✅ Attack ${attack.name} added`);
        } catch (error) {
          console.error(`    ❌ Failed to add attack ${attack.name}:`, (error as Error).message);
        }
        
        attackSlot++;
      }

      // Passives have been removed from the game
    }

    console.log(`✅ Job configurations initialized successfully! (${jobCount} jobs)`);

    console.log('🌟 Initializing teleport locations...');

    // Extract teleport locations from tilemap
    let teleportCount = 0;
    const teleportLocations: Array<{ name: string; x: number; y: number, order: number }> = [];

    for (const layer of tilemap.layers) {
      if (layer.name === 'Teleport' && layer.objects) {
        for (const obj of layer.objects) {
          if (obj.properties) {
            let isTeleport = false;
            let order: string = '';
            for (const prop of obj.properties) {
              if (prop.name === 'type' && prop.value === 'teleport') {
                isTeleport = true;
              }
              if (prop.name === 'order' && prop.type === 'string') {
                order = prop.value;
              }
            }

            if (isTeleport && obj.name) {
              teleportLocations.push({
                name: obj.name,
                x: obj.x,
                y: obj.y,
                order: parseInt(order)
              });
              teleportCount++;
              console.log(`  Found teleport: [${order}] ${obj.name} at (${obj.x}, ${obj.y})`);
            }
          }
        }
      }
    }

    if (teleportCount > 0) {
      // Create InitializeTeleports reducer call
      console.log(`  Populating ${teleportCount} teleport locations...`);
      
      // Create JSON content for teleport locations
      const teleportContent = JSON.stringify(teleportLocations.sort(
        (t1, t2) => t1.order - t2.order
      ));
      
      try {
        await connection.reducers.initializeTeleports(adminApiKey, teleportContent);
        console.log(`✅ Teleport locations initialized successfully! (${teleportCount} teleports)`);
      } catch (error) {
        console.error('❌ Failed to initialize teleport locations:', (error as Error).message);
      }
    } else {
      console.log('  No teleport locations found in tilemap.');
    }

    // Give extra time for all operations to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('✅ SpaceTime database initialized successfully!');
    console.log('✅ Enemy routes with per-route spawn intervals configured!');
    console.log(`✅ ${routeCount} spawn areas ready with individual timing!`);
    console.log('🐺 Initial enemy population spawned!');
    console.log('👹 Boss system initialized:');
    console.log(`   - ${bossTypes.length} boss types configured`);
    console.log(`   - ${bossRouteCount} boss spawn locations in tilemap`);
    console.log(`   - ${bossTriggerCount} boss triggers configured`);
    console.log(`🎮 Job configurations populated! (${jobCount} jobs)`);
    if (teleportCount > 0) {
      console.log(`🌟 Teleport locations initialized! (${teleportCount} teleports)`);
    }
  } catch (error) {
    console.error('❌ Failed to initialize SpaceTime database:', (error as Error).message);
    process.exit(1);
  } finally {
    if (connection) {
      isIntentionalDisconnect = true;
      // Give a moment for pending operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      connection.disconnect();
      console.log('🔌 Disconnected from SpaceTimeDB');
    }
  }
}

// Run the script
initializeSpacetime();
