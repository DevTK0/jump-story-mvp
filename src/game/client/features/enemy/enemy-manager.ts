import Phaser from 'phaser';
import { Enemy, type EnemyConfig, DEFAULT_ENEMY_CONFIG } from './enemy';
import { ENEMY_MAX_COUNT, ENEMY_SPAWN_INTERVAL, ENEMY_SPAWN_MARGIN, ENEMY_INITIAL_SPAWN_COUNT, ENEMY_INITIAL_SPAWN_DELAY } from './constants';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_HEIGHT } from '../stage/constants';

export interface EnemySpawnConfig {
  maxEnemies: number;
  spawnIntervalMs: number;
  spawnMargin: number;
  enemyConfig: EnemyConfig;
}

export class EnemyManager {
  private scene: Phaser.Scene;
  private spawnConfig: EnemySpawnConfig;
  private target: Phaser.GameObjects.GameObject & { x: number; y: number };
  
  private enemies: Enemy[] = [];
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private initialSpawnTimers: Phaser.Time.TimerEvent[] = [];

  constructor(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject & { x: number; y: number }, spawnConfig?: Partial<EnemySpawnConfig>) {
    this.scene = scene;
    this.target = target;
    this.spawnConfig = {
      maxEnemies: ENEMY_MAX_COUNT,
      spawnIntervalMs: ENEMY_SPAWN_INTERVAL,
      spawnMargin: ENEMY_SPAWN_MARGIN,
      enemyConfig: DEFAULT_ENEMY_CONFIG,
      ...spawnConfig
    };
    
    this.setupEnemyGroup();
    this.startSpawning();
  }

  private setupEnemyGroup(): void {
    this.enemyGroup = this.scene.physics.add.group({
      classType: Enemy,
      maxSize: this.spawnConfig.maxEnemies * 2,
      runChildUpdate: false
    });
  }

  private startSpawning(): void {
    this.spawnTimer = this.scene.time.addEvent({
      delay: this.spawnConfig.spawnIntervalMs,
      callback: this.trySpawnEnemy,
      callbackScope: this,
      loop: true
    });
    
    this.spawnInitialEnemies();
  }

  private spawnInitialEnemies(): void {
    for (let i = 0; i < Math.min(ENEMY_INITIAL_SPAWN_COUNT, this.spawnConfig.maxEnemies); i++) {
      const timer = this.scene.time.delayedCall(i * ENEMY_INITIAL_SPAWN_DELAY, () => {
        this.trySpawnEnemy();
      });
      this.initialSpawnTimers.push(timer);
    }
  }

  private trySpawnEnemy(): void {
    if (this.enemies.length >= this.spawnConfig.maxEnemies) {
      return;
    }

    const spawnPosition = this.getRandomSpawnPosition();
    this.spawnEnemy(spawnPosition.x, spawnPosition.y);
  }

  private getRandomSpawnPosition(): { x: number, y: number } {
    const gameWidth = GAME_WIDTH;
    const gameHeight = GAME_HEIGHT;
    const margin = this.spawnConfig.spawnMargin;
    const groundY = gameHeight - GROUND_HEIGHT;
    const maxSpawnY = groundY - GROUND_HEIGHT;
    
    const side = Phaser.Math.Between(0, 2); // Only use top, left, right (no bottom spawning)
    
    switch (side) {
      case 0: // Top
        return {
          x: Phaser.Math.Between(margin, gameWidth - margin),
          y: margin
        };
      case 1: // Right
        return {
          x: gameWidth - margin,
          y: Phaser.Math.Between(margin, maxSpawnY)
        };
      case 2: // Left
      default:
        return {
          x: margin,
          y: Phaser.Math.Between(margin, maxSpawnY)
        };
    }
  }

  private spawnEnemy(x: number, y: number): Enemy {
    const enemy = new Enemy(this.scene, x, y, this.spawnConfig.enemyConfig, this.target);
    
    this.enemies.push(enemy);
    this.enemyGroup.add(enemy);
    
    return enemy;
  }

  public update(): void {
    this.enemies = this.enemies.filter(enemy => {
      if (!enemy.isAlive()) {
        this.enemyGroup.remove(enemy);
        return false;
      }
      enemy.update();
      return true;
    });
  }

  public destroyEnemy(enemy: Enemy): void {
    const index = this.enemies.indexOf(enemy);
    if (index !== -1) {
      this.enemies.splice(index, 1);
      this.enemyGroup.remove(enemy);
      enemy.destroy();
    }
  }

  public destroyAllEnemies(): void {
    this.enemies.forEach(enemy => {
      this.enemyGroup.remove(enemy);
      enemy.destroy();
    });
    this.enemies = [];
  }

  public getEnemies(): Enemy[] {
    return [...this.enemies];
  }

  public getEnemyGroup(): Phaser.Physics.Arcade.Group {
    return this.enemyGroup;
  }

  public getEnemyCount(): number {
    return this.enemies.length;
  }

  public destroy(): void {
    if (this.spawnTimer) {
      this.spawnTimer.destroy();
      this.spawnTimer = null;
    }
    
    this.initialSpawnTimers.forEach(timer => {
      if (timer) {
        timer.destroy();
      }
    });
    this.initialSpawnTimers = [];
    
    this.destroyAllEnemies();
    this.enemyGroup.destroy();
  }
}

export const DEFAULT_SPAWN_CONFIG: EnemySpawnConfig = {
  maxEnemies: ENEMY_MAX_COUNT,
  spawnIntervalMs: ENEMY_SPAWN_INTERVAL,
  spawnMargin: ENEMY_SPAWN_MARGIN,
  enemyConfig: DEFAULT_ENEMY_CONFIG
};