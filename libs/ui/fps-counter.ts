import Phaser from 'phaser';

export interface FPSCounterConfig {
    x?: number;
    y?: number;
    fontSize?: string;
    color?: string;
    backgroundColor?: string;
    padding?: number;
    alpha?: number;
}

export class FPSCounter {
    private fpsText: Phaser.GameObjects.Text;
    private background: Phaser.GameObjects.Rectangle;
    private container: Phaser.GameObjects.Container;
    
    // Performance tracking
    private frameCount: number = 0;
    private lastTime: number = 0;
    private fps: number = 0;
    private updateInterval: number = 250; // Update 4 times per second
    
    // Stats tracking
    private minFps: number = Infinity;
    private maxFps: number = 0;
    private avgFps: number = 0;
    private fpsHistory: number[] = [];
    private maxHistorySize: number = 60; // Keep last 60 samples (15 seconds at 4 updates/sec)

    constructor(scene: Phaser.Scene, config?: FPSCounterConfig) {
        
        // Default configuration
        const x = config?.x ?? 10;
        const y = config?.y ?? 10;
        const fontSize = config?.fontSize ?? '16px';
        const color = config?.color ?? '#00ff00';
        const backgroundColor = config?.backgroundColor ?? '#000000';
        const padding = config?.padding ?? 10;
        const alpha = config?.alpha ?? 0.8;
        
        // Create container
        this.container = scene.add.container(x, y);
        this.container.setScrollFactor(0); // Keep it fixed on screen
        this.container.setDepth(1000); // Render on top
        
        // Create background
        this.background = scene.add.rectangle(0, 0, 120, 80, 
            parseInt(backgroundColor.replace('#', '0x')));
        this.background.setOrigin(0, 0);
        this.background.setAlpha(alpha);
        
        // Create FPS text
        this.fpsText = scene.add.text(padding, padding, 'FPS: 0', {
            fontSize: fontSize,
            color: color,
            fontFamily: 'monospace'
        });
        
        // Add to container
        this.container.add([this.background, this.fpsText]);
        
        // Initialize timing
        this.lastTime = performance.now();
    }
    
    public update(_time: number, _delta: number): void {
        this.frameCount++;
        
        const currentTime = performance.now();
        const elapsed = currentTime - this.lastTime;
        
        // Update FPS calculation every updateInterval ms
        if (elapsed >= this.updateInterval) {
            // Calculate FPS
            this.fps = Math.round((this.frameCount * 1000) / elapsed);
            
            // Update stats
            this.updateStats(this.fps);
            
            // Update display
            this.updateDisplay();
            
            // Reset counters
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
    }
    
    private updateStats(currentFps: number): void {
        // Update min/max
        this.minFps = Math.min(this.minFps, currentFps);
        this.maxFps = Math.max(this.maxFps, currentFps);
        
        // Update history
        this.fpsHistory.push(currentFps);
        if (this.fpsHistory.length > this.maxHistorySize) {
            this.fpsHistory.shift();
        }
        
        // Calculate average
        if (this.fpsHistory.length > 0) {
            const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
            this.avgFps = Math.round(sum / this.fpsHistory.length);
        }
    }
    
    private updateDisplay(): void {
        // Color code based on performance
        let color = '#00ff00'; // Green for good
        if (this.fps < 30) {
            color = '#ff0000'; // Red for bad
        } else if (this.fps < 50) {
            color = '#ffff00'; // Yellow for okay
        }
        
        // Update text
        this.fpsText.setColor(color);
        this.fpsText.setText(
            `FPS: ${this.fps}\n` +
            `Min: ${this.minFps === Infinity ? '-' : this.minFps}\n` +
            `Max: ${this.maxFps}\n` +
            `Avg: ${this.avgFps}`
        );
        
        // Adjust background size based on text
        const bounds = this.fpsText.getBounds();
        this.background.width = bounds.width + 20;
        this.background.height = bounds.height + 20;
    }
    
    public setVisible(visible: boolean): void {
        this.container.setVisible(visible);
    }
    
    public toggle(): void {
        this.container.setVisible(!this.container.visible);
    }
    
    public reset(): void {
        this.minFps = Infinity;
        this.maxFps = 0;
        this.avgFps = 0;
        this.fpsHistory = [];
    }
    
    public getStats(): { current: number; min: number; max: number; avg: number } {
        return {
            current: this.fps,
            min: this.minFps === Infinity ? 0 : this.minFps,
            max: this.maxFps,
            avg: this.avgFps
        };
    }
    
    public destroy(): void {
        this.container.destroy();
    }
}