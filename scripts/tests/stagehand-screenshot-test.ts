import { Stagehand } from '@browserbasehq/stagehand';
import fs from 'fs';
import path from 'path';

async function simpleScreenshotTest(): Promise<void> {
  const stagehand = new Stagehand({
    env: 'LOCAL',
    verbose: 1,
  });

  try {
    console.log('Starting simple screenshot test...');

    // Initialize the browser
    await stagehand.init();

    // Navigate to the game page
    console.log('Navigating to game...');
    await stagehand.page.goto('http://localhost:4000');

    // Wait for game initialization (same timing as the complex test)
    console.log('Waiting for game to load...');
    await stagehand.page.waitForTimeout(3000);

    // Ensure downloads directory exists
    const downloadsDir = path.join(process.cwd(), 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    // Capture a screenshot
    const screenshotPath = 'downloads/simple-screenshot.png';
    console.log('Capturing screenshot...');
    await stagehand.page.screenshot({ path: screenshotPath });

    console.log(`Screenshot captured successfully: ${screenshotPath}`);

    // Verify that the file exists (edge-case check for file system issues)
    if (!fs.existsSync(path.resolve(screenshotPath))) {
      throw new Error('Screenshot file was not created.');
    }

    console.log('✅ Simple screenshot test completed successfully!');
  } catch (error) {
    console.error('❌ Error during simple screenshot test:', error);

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
simpleScreenshotTest();
