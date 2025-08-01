import type { Scene } from 'phaser';
import { createLogger, type ModuleLogger } from '../logger';
import { AssetResolver } from './asset-resolver';

/**
 * Defines the structure of an audio asset
 */
export interface AudioDefinition {
  path: string;
  volume?: number; // Optional volume override (0-1)
  loop?: boolean; // Whether the audio should loop
}

/**
 * Configuration structure for all audio assets
 */
export interface AudioConfig {
  audio: {
    skills?: Record<string, AudioDefinition>;
    ui?: Record<string, AudioDefinition>;
    ambient?: Record<string, AudioDefinition>;
    music?: Record<string, AudioDefinition>;
    [category: string]: Record<string, AudioDefinition> | undefined;
  };
}

/**
 * Singleton loader for audio configuration
 */
class AudioConfigLoader {
  private logger: ModuleLogger = createLogger('AudioConfigLoader');
  private config?: AudioConfig;

  /**
   * Set the audio configuration
   */
  setConfig(config: AudioConfig): void {
    this.config = config;
    this.logger.info('Audio configuration set');
  }

  /**
   * Get the current configuration
   */
  getConfig(): AudioConfig | undefined {
    return this.config;
  }

  /**
   * Load all audio assets for a specific category
   */
  loadAudioForCategory(scene: Scene, category: string): void {
    if (!this.config) {
      this.logger.warn('No audio configuration set');
      return;
    }

    const categoryAudio = this.config.audio[category];
    if (!categoryAudio) {
      this.logger.warn(`No audio found for category: ${category}`);
      return;
    }

    this.logger.info(`Loading audio for category: ${category}`);

    Object.entries(categoryAudio).forEach(([audioKey, definition]) => {
      this.loadAudio(scene, audioKey, definition);
    });
  }

  /**
   * Load a single audio asset
   */
  private loadAudio(scene: Scene, key: string, definition: AudioDefinition): void {
    const resolvedPath = AssetResolver.getAssetPath(definition.path);
    this.logger.debug(`Loading audio: ${key} from ${resolvedPath}`);
    
    // Use array format for better browser compatibility
    scene.load.audio(key, [resolvedPath]);
  }

  /**
   * Get audio definition by key
   */
  getAudioDefinition(category: string, key: string): AudioDefinition | undefined {
    if (!this.config) {
      return undefined;
    }

    const categoryAudio = this.config.audio[category];
    if (!categoryAudio) {
      return undefined;
    }

    return categoryAudio[key];
  }

  /**
   * Get all audio keys for a category
   */
  getAudioKeys(category: string): string[] {
    if (!this.config) {
      return [];
    }

    const categoryAudio = this.config.audio[category];
    if (!categoryAudio) {
      return [];
    }

    return Object.keys(categoryAudio);
  }
}

// Export singleton instance
export const audioConfigLoader = new AudioConfigLoader();