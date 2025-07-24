import Phaser from 'phaser';
import { DbMetricsTracker } from './db-metrics-tracker';

export interface PerformanceMetricsConfig {
    x?: number;
    y?: number;
    fontSize?: string;
    color?: string;
    backgroundColor?: string;
    padding?: number;
    alpha?: number;
}

export class PerformanceMetrics {
    private scene: Phaser.Scene;
    private metricsText: Phaser.GameObjects.Text;
    private background: Phaser.GameObjects.Rectangle;
    private container: Phaser.GameObjects.Container;
    
    // Update tracking
    private updateInterval: number = 500; // Update every 500ms
    private lastUpdateTime: number = 0;
    
    constructor(scene: Phaser.Scene, config?: PerformanceMetricsConfig) {
        this.scene = scene;
        
        // Default configuration
        const x = config?.x ?? 10;
        const y = config?.y ?? 100;
        const fontSize = config?.fontSize ?? '14px';
        const color = config?.color ?? '#00ff00';
        const backgroundColor = config?.backgroundColor ?? '#000000';
        const padding = config?.padding ?? 10;
        const alpha = config?.alpha ?? 0.8;
        
        // Create container
        this.container = scene.add.container(x, y);
        this.container.setScrollFactor(0);
        this.container.setDepth(1000);
        
        // Create background
        this.background = scene.add.rectangle(0, 0, 200, 120, 
            parseInt(backgroundColor.replace('#', '0x')));
        this.background.setOrigin(0, 0);
        this.background.setAlpha(alpha);
        
        // Create metrics text
        this.metricsText = scene.add.text(padding, padding, '', {
            fontSize: fontSize,
            color: color,
            fontFamily: 'monospace'
        });
        
        // Add to container
        this.container.add([this.background, this.metricsText]);
        
        // Initialize timing
        this.lastUpdateTime = performance.now();
    }
    
    public update(_time: number, _delta: number): void {
        const currentTime = performance.now();
        const elapsed = currentTime - this.lastUpdateTime;
        
        // Update metrics every updateInterval ms
        if (elapsed >= this.updateInterval) {
            this.updateMetrics();
            this.lastUpdateTime = currentTime;
        }
    }
    
    private updateMetrics(): void {
        // Get entity counts
        const spriteCount = this.countSprites();
        const enemyCount = this.getEnemyCount();
        const peerCount = this.getPeerCount();
        
        // Get physics info
        const dynamicBodies = this.scene.physics.world.bodies.entries.length;
        const staticBodies = this.scene.physics.world.staticBodies.entries.length;
        
        // Get network info from SpacetimeDB connection
        const networkStats = this.getNetworkStats();
        
        // Update text
        this.metricsText.setText(
            `Entities: ${spriteCount}\n` +
            `  Enemies: ${enemyCount}\n` +
            `  Peers: ${peerCount}\n` +
            `Physics Bodies: ${dynamicBodies + staticBodies}\n` +
            `  Dynamic: ${dynamicBodies}\n` +
            `  Static: ${staticBodies}\n` +
            `Network: ${networkStats}`
        );
        
        // Adjust background size
        const bounds = this.metricsText.getBounds();
        this.background.width = bounds.width + 20;
        this.background.height = bounds.height + 20;
    }
    
    private countSprites(): number {
        let count = 0;
        this.scene.children.list.forEach(child => {
            if (child instanceof Phaser.GameObjects.Sprite) {
                count++;
            }
        });
        return count;
    }
    
    private getEnemyCount(): number {
        // Get from enemy manager if available
        const enemyManager = (this.scene as any).enemyManager;
        if (enemyManager && enemyManager.getEnemyGroup) {
            return enemyManager.getEnemyGroup().children.entries.length;
        }
        return 0;
    }
    
    private getPeerCount(): number {
        // Get from peer manager if available
        const peerManager = (this.scene as any).peerManager;
        if (peerManager && peerManager.getPeerCount) {
            return peerManager.getPeerCount();
        }
        return 0;
    }
    
    private getNetworkStats(): string {
        const tracker = DbMetricsTracker.getInstance();
        
        if (tracker.isConnected()) {
            return `Connected (${tracker.getNetworkSummary()})`;
        }
        
        return 'Disconnected';
    }
    
    public setVisible(visible: boolean): void {
        this.container.setVisible(visible);
    }
    
    public toggle(): void {
        this.container.setVisible(!this.container.visible);
    }
    
    public destroy(): void {
        this.container.destroy();
    }
}