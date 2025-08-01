import type { Scene } from 'phaser';
import { createLogger, type ModuleLogger } from '../logger';

/**
 * AudioManager handles loading and playing game audio
 */
export class AudioManager {
  private scene: Scene;
  private logger: ModuleLogger;
  private loadedSounds: Set<string> = new Set();
  private soundInstances: Map<string, Phaser.Sound.BaseSound> = new Map();

  constructor(scene: Scene) {
    this.scene = scene;
    this.logger = createLogger('AudioManager');
  }

  /**
   * Load an audio file
   */
  public loadAudio(key: string, path: string): void {
    if (this.loadedSounds.has(key)) {
      this.logger.debug(`Audio '${key}' already loaded`);
      return;
    }

    try {
      this.scene.load.audio(key, path);
      this.loadedSounds.add(key);
      this.logger.debug(`Loading audio: ${key} from ${path}`);
    } catch (error) {
      this.logger.error(`Failed to load audio '${key}':`, error);
    }
  }

  /**
   * Play an audio file
   */
  public playSound(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
    if (!this.scene.cache.audio.exists(key)) {
      this.logger.warn(`Audio '${key}' not found in cache`);
      return;
    }

    try {
      // Check if WebAudio context needs to be resumed (browser autoplay policy)
      const soundManager = this.scene.sound as any;
      if (soundManager.context && soundManager.context.state === 'suspended') {
        this.logger.debug('Audio context is suspended, attempting to resume...');
        soundManager.context.resume()
          .then(() => {
            this.playAudioInternal(key, config);
          })
          .catch((error: any) => {
            this.logger.warn('Failed to resume audio context:', error);
          });
      } else {
        this.playAudioInternal(key, config);
      }
    } catch (error) {
      this.logger.error(`Failed to play sound '${key}':`, error);
    }
  }

  private playAudioInternal(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
    try {
      const sound = this.scene.sound.add(key, config);
      const playResult = sound.play();
      
      // Check if play() returned false (couldn't play)
      if (playResult === false) {
        this.logger.error(`Sound play() returned false for key: ${key}`);
        return;
      }
      
      // Store reference for cleanup
      const existingSound = this.soundInstances.get(key);
      if (existingSound && existingSound.isPlaying) {
        existingSound.stop();
      }
      this.soundInstances.set(key, sound);
      
      // Clean up after sound completes
      sound.once('complete', () => {
        this.soundInstances.delete(key);
      });

      this.logger.debug(`Playing sound: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to play sound '${key}':`, error);
    }
  }

  /**
   * Stop a specific sound
   */
  public stopSound(key: string): void {
    const sound = this.soundInstances.get(key);
    if (sound) {
      sound.stop();
      this.soundInstances.delete(key);
      this.logger.debug(`Stopped sound: ${key}`);
    }
  }

  /**
   * Stop all sounds
   */
  public stopAllSounds(): void {
    this.soundInstances.forEach((sound, key) => {
      sound.stop();
      this.logger.debug(`Stopped sound: ${key}`);
    });
    this.soundInstances.clear();
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.stopAllSounds();
    this.loadedSounds.clear();
    this.logger.info('AudioManager destroyed');
  }
}

// Singleton instance per scene
const audioManagers = new WeakMap<Scene, AudioManager>();

/**
 * Get or create AudioManager for a scene
 */
export function getAudioManager(scene: Scene): AudioManager {
  let manager = audioManagers.get(scene);
  if (!manager) {
    manager = new AudioManager(scene);
    audioManagers.set(scene, manager);
  }
  return manager;
}