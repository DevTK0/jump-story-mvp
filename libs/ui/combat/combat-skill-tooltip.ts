import Phaser from 'phaser';
import { COMBAT_SKILL_CONFIG } from './combat-skill-config';
import { createLogger, type ModuleLogger } from '@/core/logger';
import type { SkillData } from './combat-skill-slot';

export class CombatSkillTooltip {
  private static instance: CombatSkillTooltip | null = null;
  
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private descriptionText: Phaser.GameObjects.Text;
  private hotkeyText: Phaser.GameObjects.Text;
  private logger: ModuleLogger;
  
  private currentTween?: Phaser.Tweens.Tween;
  private isVisible: boolean = false;

  private constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.logger = createLogger('CombatSkillTooltip');
    
    // Create container
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(COMBAT_SKILL_CONFIG.depth.tooltip);
    this.container.setVisible(false);
    this.container.setScrollFactor(0); // Fix to camera
    
    // Create background graphics (will be drawn later)
    this.background = this.scene.add.graphics();
    
    // Create text elements
    const config = COMBAT_SKILL_CONFIG.tooltip;
    
    this.titleText = this.scene.add.text(
      config.padding,
      config.padding,
      '',
      {
        fontSize: config.titleSize,
        fontFamily: config.fontFamily,
        color: config.titleColor,
        fontStyle: 'bold',
      }
    );
    
    this.descriptionText = this.scene.add.text(
      config.padding,
      config.padding + 25,
      '',
      {
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
        color: config.fontColor,
        wordWrap: { width: config.maxWidth - (config.padding * 2) },
      }
    );
    
    this.hotkeyText = this.scene.add.text(
      config.padding,
      0, // Y position will be set dynamically
      '',
      {
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
        color: '#cccccc',
        fontStyle: 'italic',
      }
    );
    
    // Add all elements to container
    this.container.add([
      this.background,
      this.titleText,
      this.descriptionText,
      this.hotkeyText
    ]);
  }
  
  public static getInstance(scene: Phaser.Scene): CombatSkillTooltip {
    if (!CombatSkillTooltip.instance || CombatSkillTooltip.instance.scene !== scene) {
      CombatSkillTooltip.instance = new CombatSkillTooltip(scene);
    }
    return CombatSkillTooltip.instance;
  }
  
  public show(x: number, y: number, skillData: SkillData): void {
    if (!skillData) return;
    
    this.logger.debug(`Showing tooltip for skill: ${skillData.name}`);
    
    // Update text content
    this.titleText.setText(skillData.name);
    this.descriptionText.setText(skillData.description);
    this.hotkeyText.setText(skillData.hotkey ? `Hotkey: ${skillData.hotkey}` : '');
    
    // Calculate dimensions
    const config = COMBAT_SKILL_CONFIG.tooltip;
    const titleHeight = this.titleText.height;
    const descHeight = this.descriptionText.height;
    const hotkeyHeight = skillData.hotkey ? this.hotkeyText.height : 0;
    
    const contentHeight = titleHeight + descHeight + hotkeyHeight + config.padding * 2;
    if (skillData.hotkey) {
      contentHeight + 10; // Extra spacing for hotkey
    }
    
    const width = config.maxWidth;
    const height = contentHeight + config.padding;
    
    // Position hotkey text at bottom
    if (skillData.hotkey) {
      this.hotkeyText.setY(config.padding + titleHeight + descHeight + 10);
      this.hotkeyText.setVisible(true);
    } else {
      this.hotkeyText.setVisible(false);
    }
    
    // Draw background
    this.background.clear();
    this.background.fillStyle(config.backgroundColor, 1);
    this.background.fillRoundedRect(0, 0, width, height, 4);
    this.background.lineStyle(config.borderWidth, config.borderColor);
    this.background.strokeRoundedRect(0, 0, width, height, 4);
    
    // Position tooltip above the slot
    const tooltipX = x - width / 2;
    const tooltipY = y - height + config.offsetY;
    
    // Keep tooltip within screen bounds
    const camera = this.scene.cameras.main;
    const adjustedX = Math.max(10, Math.min(tooltipX, camera.width - width - 10));
    const adjustedY = Math.max(10, tooltipY);
    
    this.container.setPosition(adjustedX, adjustedY);
    
    // Show with fade in
    if (this.currentTween) {
      this.currentTween.stop();
    }
    
    this.container.setAlpha(0);
    this.container.setVisible(true);
    this.isVisible = true;
    
    this.currentTween = this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: config.fadeInDuration,
      ease: 'Power2',
    });
  }
  
  public hide(): void {
    if (!this.isVisible) return;
    
    this.logger.debug('Hiding tooltip');
    
    const config = COMBAT_SKILL_CONFIG.tooltip;
    
    if (this.currentTween) {
      this.currentTween.stop();
    }
    
    this.currentTween = this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: config.fadeOutDuration,
      ease: 'Power2',
      onComplete: () => {
        this.container.setVisible(false);
        this.isVisible = false;
      },
    });
  }
  
  public isShowing(): boolean {
    return this.isVisible;
  }
  
  public destroy(): void {
    if (this.currentTween) {
      this.currentTween.stop();
    }
    this.container.destroy();
    CombatSkillTooltip.instance = null;
  }
}