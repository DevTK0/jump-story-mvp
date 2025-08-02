import Phaser from 'phaser';
import { COMBAT_SKILL_CONFIG } from './combat-skill-config';
import { createLogger, type ModuleLogger } from '@/core/logger';

export interface SkillData {
  id: string;
  name: string;
  description: string;
  hotkey?: string;
  cooldown?: number;
  currentCooldown?: number;
  icon?: string;
  slotType: 'attack';
}

export class CombatSkillSlot {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private border: Phaser.GameObjects.Rectangle;
  // private hotkeyText: Phaser.GameObjects.Text; // Hidden - hotkeys shown in tooltip only
  private skillLabel: Phaser.GameObjects.Text;
  private skillIcon?: Phaser.GameObjects.Sprite;
  private cooldownOverlay?: Phaser.GameObjects.Rectangle;
  
  private logger: ModuleLogger;
  private slotIndex: number;
  private skillData?: SkillData;
  private isDisabled: boolean = false;
  
  // Callbacks
  private onHoverCallback?: (slot: CombatSkillSlot, skillData?: SkillData) => void;
  private onHoverEndCallback?: (slot: CombatSkillSlot) => void;
  private onClickCallback?: (slot: CombatSkillSlot, skillData?: SkillData) => void;

  constructor(
    scene: Phaser.Scene, 
    slotIndex: number,
    x: number, 
    y: number
  ) {
    this.scene = scene;
    this.slotIndex = slotIndex;
    this.logger = createLogger(`CombatSkillSlot-${slotIndex}`);
    
    // Create container
    this.container = this.scene.add.container(x, y);
    this.container.setSize(COMBAT_SKILL_CONFIG.slot.width, COMBAT_SKILL_CONFIG.slot.height);
    this.container.setDepth(COMBAT_SKILL_CONFIG.depth.slots);
    
    const config = COMBAT_SKILL_CONFIG.slot;
    this.background = this.scene.add.rectangle(
      0, 0,
      config.width,
      config.height,
      config.backgroundColor
    );
    this.background.setOrigin(0, 0);
    
    this.border = this.scene.add.rectangle(
      0, 0,
      config.width,
      config.height
    );
    this.border.setOrigin(0, 0);
    this.border.setStrokeStyle(config.borderWidth, config.borderColor);
    this.border.setFillStyle(0, 0);
    
    // Hotkey text creation removed - hotkeys shown in tooltip only
    // this.hotkeyText = this.scene.add.text(...);
    
    this.skillLabel = this.scene.add.text(
      config.width / 2,
      config.height / 2,
      '',
      {
        fontSize: COMBAT_SKILL_CONFIG.skillContent.fontSize,
        fontFamily: COMBAT_SKILL_CONFIG.skillContent.fontFamily,
        color: COMBAT_SKILL_CONFIG.skillContent.fontColor,
      }
    );
    this.skillLabel.setOrigin(0.5, 0.5);
    this.skillLabel.setDepth(1000);
    
    this.container.add([
      this.background,
      this.border,
      // this.hotkeyText, // Hidden - hotkey shown in tooltip only
      this.skillLabel
    ]);
    
    this.background.setInteractive({ useHandCursor: true });
    this.setupInteraction();
    
    this.setPlaceholderData();
  }
  
  private setupInteraction(): void {
    this.background.on('pointerover', () => {
      if (this.isDisabled) return;
      
      this.border.setStrokeStyle(
        COMBAT_SKILL_CONFIG.slot.hoverBorderWidth,
        COMBAT_SKILL_CONFIG.slot.hoverBorderColor
      );
      
      if (this.onHoverCallback) {
        this.onHoverCallback(this, this.skillData);
      }
    });
    
    this.background.on('pointerout', () => {
      this.border.setStrokeStyle(
        COMBAT_SKILL_CONFIG.slot.borderWidth,
        COMBAT_SKILL_CONFIG.slot.borderColor
      );
      
      if (this.onHoverEndCallback) {
        this.onHoverEndCallback(this);
      }
    });
    
    this.background.on('pointerdown', () => {
      if (this.isDisabled || !this.skillData) return;
      
      this.logger.info(`Skill slot ${this.slotIndex} clicked`);
      
      if (this.onClickCallback) {
        this.onClickCallback(this, this.skillData);
      }
    });
  }
  
  private setPlaceholderData(): void {
    const placeholderConfig = COMBAT_SKILL_CONFIG.skills[this.slotIndex as keyof typeof COMBAT_SKILL_CONFIG.skills];
    if (placeholderConfig) {
      // this.hotkeyText.setText(placeholderConfig.hotkey); // Hidden - hotkey shown in tooltip only
      // Only show label for attack slots, not passive slots
      if (placeholderConfig.slotType === 'attack') {
        this.skillLabel.setText(placeholderConfig.label);
      } else {
        this.skillLabel.setText('');
      }
      
      this.skillData = {
        id: `skill_${placeholderConfig.label}`,
        name: `Skill ${placeholderConfig.label}`,
        description: `This is a placeholder description for ${placeholderConfig.label}`,
        hotkey: placeholderConfig.hotkey,
        slotType: placeholderConfig.slotType as 'attack',
      };
    }
  }
  
  public setSkillData(skillData?: SkillData): void {
    this.skillData = skillData;
    
    if (skillData) {
      // this.hotkeyText.setText(skillData.hotkey || ''); // Hidden - hotkey shown in tooltip only
      
      // Show icon if available, otherwise show label
      if (skillData.icon) {
        // Show the hotkey for it as well
        this.skillLabel.setVisible(true);
        this.skillLabel.setText(skillData.hotkey ?? '');
        
        // Remove existing icon if any
        if (this.skillIcon) {
          this.skillIcon.destroy();
        }
        
        // Create new icon sprite
        this.skillIcon = this.scene.add.sprite(
          COMBAT_SKILL_CONFIG.slot.width / 2,
          COMBAT_SKILL_CONFIG.slot.height / 2,
          skillData.icon
        );
        this.skillIcon.setOrigin(0.5, 0.5);
        
        // Scale icon to fit nicely in the slot (leaving some padding)
        // Since the icon is 16x16 and we want it bigger, let's scale it up more
        const iconScale = (COMBAT_SKILL_CONFIG.slot.width - 8) / 16; // 16x16 icon size with less padding
        this.skillIcon.setScale(iconScale);
        
        this.container.add(this.skillIcon);
      } else {
        // No icon, show text label
        const label = skillData.id.split('_').pop() || '';
        this.skillLabel.setText(label);
        this.skillLabel.setVisible(true);
        
        if (this.skillIcon) {
          this.skillIcon.destroy();
          this.skillIcon = undefined;
        }
      }
      
      this.setDisabled(false);
    } else {
      // No skill data, show placeholder
      const placeholderConfig = COMBAT_SKILL_CONFIG.skills[this.slotIndex as keyof typeof COMBAT_SKILL_CONFIG.skills];
      if (placeholderConfig) {
        // this.hotkeyText.setText(placeholderConfig.hotkey); // Hidden - hotkey shown in tooltip only
        // Only show label for attack slots, not passive slots
        if (placeholderConfig.slotType === 'attack') {
          this.skillLabel.setText(placeholderConfig.label);
        } else {
          this.skillLabel.setText('');
        }
        this.skillLabel.setVisible(true);
      } else {
        // this.hotkeyText.setText(''); // Hidden - hotkey shown in tooltip only
        this.skillLabel.setText('');
        this.skillLabel.setVisible(true);
      }
      
      // Remove icon if any
      if (this.skillIcon) {
        this.skillIcon.destroy();
        this.skillIcon = undefined;
      }
      
      this.setDisabled(true);
    }
  }
  
  public setDisabled(disabled: boolean): void {
    this.isDisabled = disabled;
    this.container.setAlpha(disabled ? COMBAT_SKILL_CONFIG.slot.disabledAlpha : 1);
    this.background.setInteractive({ useHandCursor: !disabled });
  }
  
  public updateCooldown(currentCooldown: number, maxCooldown: number): void {
    if (currentCooldown <= 0) {
      if (this.cooldownOverlay) {
        this.cooldownOverlay.destroy();
        this.cooldownOverlay = undefined;
      }
      return;
    }
    
    if (!this.cooldownOverlay) {
      this.cooldownOverlay = this.scene.add.rectangle(
        0, 0,
        COMBAT_SKILL_CONFIG.slot.width,
        COMBAT_SKILL_CONFIG.slot.height,
        COMBAT_SKILL_CONFIG.cooldown.overlayColor,
        COMBAT_SKILL_CONFIG.cooldown.overlayAlpha
      );
      this.cooldownOverlay.setOrigin(0, 1);
      this.cooldownOverlay.setDepth(COMBAT_SKILL_CONFIG.depth.cooldownOverlay);
      this.container.add(this.cooldownOverlay);
    }
    
    const progress = currentCooldown / maxCooldown;
    const overlayHeight = COMBAT_SKILL_CONFIG.slot.height * progress;
    
    this.cooldownOverlay.setSize(
      COMBAT_SKILL_CONFIG.slot.width,
      overlayHeight
    );
    
    this.cooldownOverlay.setPosition(0, COMBAT_SKILL_CONFIG.slot.height);
  }
  
  // Callback setters
  public onHover(callback: (slot: CombatSkillSlot, skillData?: SkillData) => void): void {
    this.onHoverCallback = callback;
  }
  
  public onHoverEnd(callback: (slot: CombatSkillSlot) => void): void {
    this.onHoverEndCallback = callback;
  }
  
  public onClick(callback: (slot: CombatSkillSlot, skillData?: SkillData) => void): void {
    this.onClickCallback = callback;
  }
  
  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
  
  public getWorldPosition(): { x: number; y: number } {
    return {
      x: this.container.x,
      y: this.container.y
    };
  }
  
  public destroy(): void {
    this.background.removeAllListeners();
    if (this.skillIcon) {
      this.skillIcon.destroy();
    }
    this.container.destroy();
  }
}