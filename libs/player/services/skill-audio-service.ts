import type { Scene } from 'phaser';
import { onSceneEvent, offSceneEvent } from '@/core/scene/scene-events';
import { getAudioManager } from '@/core/audio';
import { createLogger, type ModuleLogger } from '@/core/logger';

/**
 * Service that handles playing audio when skills are activated
 */
export class SkillAudioService {
  private scene: Scene;
  private logger: ModuleLogger;
  private isDestroyed = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.logger = createLogger('SkillAudioService');
    
    // Listen for skill activation events
    onSceneEvent(this.scene, 'skill:activated', this.handleSkillActivated, this);
    
    this.logger.info('SkillAudioService initialized');
  }

  private handleSkillActivated = (data: { slotIndex: number; skillName: string; cooldown: number; audio?: string }): void => {
    if (this.isDestroyed) return;
    
    if (data.audio) {
      try {
        const audioManager = getAudioManager(this.scene);
        
        // For now, all skills use 'skill1' audio key
        // In the future, we could map different audio files to different skills
        audioManager.playSound('skill1', {
          volume: 0.5,
          detune: 0
        });
        
        this.logger.debug(`Playing skill audio for: ${data.skillName}`);
      } catch (error) {
        this.logger.warn('Failed to play skill audio:', error);
      }
    }
  };

  public destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    // Remove event listener
    offSceneEvent(this.scene, 'skill:activated', this.handleSkillActivated, this);
    
    this.logger.info('SkillAudioService destroyed');
  }
}