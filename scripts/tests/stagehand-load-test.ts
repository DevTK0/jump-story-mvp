import { Stagehand } from '@browserbasehq/stagehand';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function singleInstanceTest(instanceId: number, gameUrl: string): Promise<void> {
  const stagehand = new Stagehand({
    env: 'LOCAL',
    verbose: 1,
  });

  try {
    console.log(`[Instance ${instanceId}] Starting 3-minute movement + action test...`);

    // Initialize the browser
    await stagehand.init();

    // Navigate to the game page
    console.log(`[Instance ${instanceId}] Navigating to game at ${gameUrl}...`);
    await stagehand.page.goto(gameUrl);

    // Wait for game initialization
    console.log(`[Instance ${instanceId}] Waiting for game to load...`);
    await stagehand.page.waitForTimeout(3000);

    const testDuration = 200 * 10000; // 3 minutes in milliseconds
    const startTime = Date.now();
    let direction = 'left'; // Start with left movement
    const attackKeys = ['KeyX', 'KeyC', 'KeyV']; // Attack1, Attack2, Attack3
    const actionOptions = [...attackKeys, 'Space']; // Attack1, Attack2, Attack3, or Jump

    console.log(`[Instance ${instanceId}] Starting 3-minute movement + action loop...`);

    while (Date.now() - startTime < testDuration) {
      if (direction === 'left') {
        await stagehand.page.keyboard.down('ArrowLeft');

        // Perform random actions (attacks or jumps) while moving left
        for (let i = 0; i < 10; i++) {
          // 10 actions over 5 seconds
          const randomAction = actionOptions[Math.floor(Math.random() * actionOptions.length)];
          await stagehand.page.keyboard.down(randomAction);
          await stagehand.page.waitForTimeout(500); // Wait 0.5 seconds between actions
          await stagehand.page.keyboard.up(randomAction);
        }

        await stagehand.page.keyboard.up('ArrowLeft');

        // Press R for respawn after changing direction
        await stagehand.page.keyboard.down('KeyR');
        await stagehand.page.waitForTimeout(100);
        await stagehand.page.keyboard.up('KeyR');

        direction = 'right';
      } else {
        await stagehand.page.keyboard.down('ArrowRight');

        // Perform random actions (attacks or jumps) while moving right
        for (let i = 0; i < 10; i++) {
          // 10 actions over 5 seconds
          const randomAction = actionOptions[Math.floor(Math.random() * actionOptions.length)];
          await stagehand.page.keyboard.down(randomAction);
          await stagehand.page.waitForTimeout(500); // Wait 0.5 seconds between actions
          await stagehand.page.keyboard.up(randomAction);
        }

        await stagehand.page.keyboard.up('ArrowRight');

        // Press R for respawn after changing direction
        await stagehand.page.keyboard.down('KeyR');
        await stagehand.page.waitForTimeout(100);
        await stagehand.page.keyboard.up('KeyR');

        direction = 'left';
      }

      // Small pause between direction changes
      await stagehand.page.waitForTimeout(100);
    }

    console.log(
      `[Instance ${instanceId}] ✅ 3-minute movement + action test completed successfully!`
    );
  } catch (error) {
    console.error(`[Instance ${instanceId}] ❌ Error during movement + action test:`, error);

    // Log specific error types for debugging
    if (error instanceof Error) {
      if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
        console.error(`🔧 Make sure the game server is running on ${gameUrl}`);
      } else if (error.message.includes('ENOENT') || error.message.includes('permission')) {
        console.error('🔧 File system error - check downloads directory permissions');
      } else if (error.message.includes('browser')) {
        console.error('🔧 Browser initialization failed - check Stagehand setup');
      }
    }
  } finally {
    // Always close Stagehand to free resources
    console.log(`[Instance ${instanceId}] Closing browser...`);
    await stagehand.close();
  }
}

async function runLoadTest(): Promise<void> {
  // Determine game URL based on deployment target
  const target = process.env.VITE_SPACETIME_TARGET || 'local';
  const gameUrl =
    target === 'cloud' ? 'https://devtk0.github.io/jump-story-mvp/' : 'http://localhost:4000';

  console.log(`🎮 Running ${target} load test`);
  console.log(`🎮 Game URL: ${gameUrl}`);

  const numInstances = 200;
  console.log(`🚀 Starting load test with ${numInstances} browser instances...`);

  const promises: Promise<void>[] = [];

  // Create all instances
  for (let i = 1; i <= numInstances; i++) {
    promises.push(singleInstanceTest(i, gameUrl));

    // Add 10 second delay between each browser instance startup
    if (i < numInstances) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  try {
    // Wait for all instances to complete
    await Promise.allSettled(promises);
    console.log(`🎉 Load test with ${numInstances} instances completed!`);
  } catch (error) {
    console.error('❌ Error in load test:', error);
  }
}

// Run the load test
runLoadTest();
