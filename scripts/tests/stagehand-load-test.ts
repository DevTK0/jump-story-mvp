import { Stagehand } from "@browserbasehq/stagehand";
import fs from "fs";
import path from "path";

async function singleInstanceTest(instanceId: number): Promise<void> {
    const stagehand = new Stagehand({
        env: "LOCAL",
        verbose: 1,
    });

    try {
        console.log(
            `[Instance ${instanceId}] Starting 5-minute movement test...`
        );

        // Initialize the browser
        await stagehand.init();

        // Navigate to the game page
        console.log(`[Instance ${instanceId}] Navigating to game...`);
        await stagehand.page.goto("http://localhost:4000");

        // Wait for game initialization
        console.log(`[Instance ${instanceId}] Waiting for game to load...`);
        await stagehand.page.waitForTimeout(3000);

        // Hold spacebar for jumping throughout the test
        console.log(
            `[Instance ${instanceId}] Starting spacebar hold for jumping...`
        );
        await stagehand.page.keyboard.down("Space");

        const testDuration = 200 * 10000; // 3 minutes in milliseconds
        const startTime = Date.now();
        let direction = "left"; // Start with left movement

        console.log(
            `[Instance ${instanceId}] Starting 3-minute left/right movement loop...`
        );

        while (Date.now() - startTime < testDuration) {
            if (direction === "left") {
                await stagehand.page.keyboard.down("ArrowLeft");
                await stagehand.page.waitForTimeout(5000); // Move left for 5 seconds
                await stagehand.page.keyboard.up("ArrowLeft");
                direction = "right";
            } else {
                await stagehand.page.keyboard.down("ArrowRight");
                await stagehand.page.waitForTimeout(5000); // Move right for 5 seconds
                await stagehand.page.keyboard.up("ArrowRight");
                direction = "left";
            }

            // Small pause between direction changes
            await stagehand.page.waitForTimeout(100);
        }

        // Release spacebar at the end
        await stagehand.page.keyboard.up("Space");

        console.log(
            `[Instance ${instanceId}] ✅ 3-minute movement test completed successfully!`
        );
    } catch (error) {
        console.error(
            `[Instance ${instanceId}] ❌ Error during movement test:`,
            error
        );

        // Log specific error types for debugging
        if (error instanceof Error) {
            if (error.message.includes("net::ERR_CONNECTION_REFUSED")) {
                console.error(
                    "🔧 Make sure the game server is running on http://localhost:4000"
                );
            } else if (
                error.message.includes("ENOENT") ||
                error.message.includes("permission")
            ) {
                console.error(
                    "🔧 File system error - check downloads directory permissions"
                );
            } else if (error.message.includes("browser")) {
                console.error(
                    "🔧 Browser initialization failed - check Stagehand setup"
                );
            }
        }
    } finally {
        // Always close Stagehand to free resources
        console.log(`[Instance ${instanceId}] Closing browser...`);
        await stagehand.close();
    }
}

async function runLoadTest(): Promise<void> {
    const numInstances = 200;
    console.log(
        `🚀 Starting load test with ${numInstances} browser instances...`
    );

    const promises: Promise<void>[] = [];

    // Create all instances
    for (let i = 1; i <= numInstances; i++) {
        promises.push(singleInstanceTest(i));

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
        console.error("❌ Error in load test:", error);
    }
}

// Run the load test
runLoadTest();
