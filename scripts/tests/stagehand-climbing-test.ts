import { Stagehand } from '@browserbasehq/stagehand';
import fs from 'fs';
import path from 'path';

async function climbingTest(): Promise<void> {
  const stagehand = new Stagehand({
    env: 'LOCAL',
    verbose: 1,
  });

  try {
    console.log('Starting climbing test...');

    // Initialize the browser
    await stagehand.init();

    // Navigate to the game page
    console.log('Navigating to game...');
    await stagehand.page.goto('http://localhost:4000');

    // Wait for game initialization
    console.log('Waiting for game to load...');
    await stagehand.page.waitForTimeout(3000);

    // Walk right to reach the climbeable area
    console.log('Walking right to reach climbeable area...');
    await stagehand.page.keyboard.down('ArrowLeft');
    await stagehand.page.waitForTimeout(1000);
    await stagehand.page.keyboard.up('ArrowLeft');

    // Use up arrow keys to climb the ladder
    console.log('Climbing ladder with up arrow keys...');
    await stagehand.page.keyboard.down('ArrowUp');
    await stagehand.page.waitForTimeout(1000);
    await stagehand.page.keyboard.up('ArrowUp');

    // Wait a moment for climbing animation
    await stagehand.page.waitForTimeout(500);

    // Ensure downloads directory exists
    const downloadsDir = path.join(process.cwd(), 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    // Capture a screenshot to verify climbing
    const screenshotPath = 'downloads/climbing-test-screenshot.png';
    console.log('Capturing screenshot to verify climbing...');
    await stagehand.page.screenshot({ path: screenshotPath });

    console.log(`Screenshot captured successfully: ${screenshotPath}`);

    // Verify that the file exists
    if (!fs.existsSync(path.resolve(screenshotPath))) {
      throw new Error('Screenshot file was not created.');
    }

    console.log('✅ Climbing test completed successfully!');
  } catch (error) {
    console.error('❌ Error during climbing test:', error);

    // Log specific error types for debugging
    if (error instanceof Error) {
      if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
        console.error('🔧 Make sure the game server is running on http://localhost:4000');
      } else if (error.message.includes('ENOENT') || error.message.includes('permission')) {
        console.error('🔧 File system error - check downloads directory permissions');
      } else if (error.message.includes('browser')) {
        console.error('🔧 Browser initialization failed - check Stagehand setup');
      }
    }
  } finally {
    // Always close Stagehand to free resources
    console.log('Closing browser...');
    await stagehand.close();
  }
}

// Run the test
climbingTest();
