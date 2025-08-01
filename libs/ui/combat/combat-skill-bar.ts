import Phaser from 'phaser';
import { COMBAT_SKILL_CONFIG } from './combat-skill-config';
import { CombatSkillSlot, type SkillData } from './combat-skill-slot';
import { CombatSkillTooltip } from './combat-skill-tooltip';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { UIContextService, UIEvents } from '../services/ui-context-service';
import { DbConnection } from '@/spacetime/client';
import { jobAttributes } from '../../../apps/playground/config/job-attributes';

export class CombatSkillBar {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Graphics;
  private skillSlots: CombatSkillSlot[] = [];
  private tooltip: CombatSkillTooltip;
  private logger: ModuleLogger;
  
  private dbConnection: DbConnection | null = null;
  private skillCooldowns: Map<number, { startTime: number; duration: number }> = new Map();
  
  constructor(scene: Phaser.Scene) {
    console.log('[CombatSkillBar] Constructor called');
    this.scene = scene;
    this.logger = createLogger('CombatSkillBar');
    
    // Get tooltip instance
    this.tooltip = CombatSkillTooltip.getInstance(scene);
    
    // Get database connection
    console.log('[CombatSkillBar] Getting UIContextService instance...');
    let context;
    try {
      context = UIContextService.getInstance();
      this.dbConnection = context.getDbConnection();
      console.log('[CombatSkillBar] Got connection:', !!this.dbConnection);
    } catch (error) {
      console.error('[CombatSkillBar] Error getting UIContextService:', error);
      return;
    }
    
    // Create main container
    this.createContainer();
    
    // Create skill slots
    this.createSkillSlots();
    
    // Position the container
    this.positionContainer();
    
    // Listen for resize events
    this.scene.scale.on('resize', this.onResize, this);
    
    // Subscribe to skill data updates
    context.on(UIEvents.SKILL_DATA_UPDATED, this.handleSkillDataUpdate, this);
    
    // Initialize with real skill data from player's job
    this.initializeSkillsFromJob();
    
    // Listen for player job changes
    if (this.dbConnection) {
      this.dbConnection.db.player.onUpdate((_ctx, oldPlayer, newPlayer) => {
        const identity = context.getPlayerIdentity();
        if (identity && newPlayer.identity.toHexString() === identity.toHexString()) {
          if (oldPlayer.job !== newPlayer.job) {
            this.logger.info(`Player job changed from ${oldPlayer.job} to ${newPlayer.job}`);
            this.initializeSkillsFromJob();
          }
        }
      });
    }
    
    // Listen for skill activation events from combat system
    this.scene.events.on('skill:activated', this.handleSkillActivatedEvent, this);
  }
  
  private initializeSkillsFromJob(): void {
    const skills: Map<number, SkillData> = new Map();
    
    // Get current player's job
    const context = UIContextService.getInstance();
    const identity = context.getPlayerIdentity();
    const dbConnection = context.getDbConnection();
    
    if (!identity || !dbConnection) {
      this.logger.warn('No identity or connection available, using default skills');
      this.initializeDefaultSkills();
      return;
    }
    
    // Find the current player
    let currentJob = 'soldier'; // Default fallback
    for (const player of dbConnection.db.player.iter()) {
      if (player.identity.toHexString() === identity.toHexString()) {
        currentJob = player.job;
        break;
      }
    }
    
    // Get job configuration
    const jobConfig = jobAttributes[currentJob];
    if (!jobConfig) {
      this.logger.warn(`Job configuration not found for: ${currentJob}`);
      this.initializeDefaultSkills();
      return;
    }
    
    const attacks = jobConfig.attacks;
    const attackKeys = Object.keys(attacks);
    const hotkeys = ['X', 'C', 'V'];
    
    attackKeys.forEach((key, index) => {
      if (index < 3) {
        const attack = (attacks as any)[key];
        skills.set(index, {
          id: `${key}_A${index + 1}`,
          name: attack.name,
          description: attack.description || 'No description available.',
          hotkey: hotkeys[index],
          slotType: 'attack',
          cooldown: attack.cooldown,
          currentCooldown: 0,
          icon: attack.icon
        });
      }
    });
    
    const passives = jobConfig.passives || {};
    const passiveKeys = Object.keys(passives);
    
    passiveKeys.forEach((key, index) => {
      if (index < 3) {
        const passive = (passives as any)[key];
        skills.set(index + 3, {
          id: `${key}_P${index + 1}`,
          name: passive.name,
          description: passive.description || 'No description available.',
          slotType: 'passive'
        });
      }
    });
    
    for (let i = 0; i < 3; i++) {
      if (!skills.has(i)) {
        skills.set(i, {
          id: `empty_A${i + 1}`,
          name: 'Empty',
          description: 'No skill equipped.',
          hotkey: hotkeys[i],
          slotType: 'attack'
        });
      }
    }
    
    UIContextService.getInstance().updateSkillData(skills);
    this.handleSkillDataUpdate({ skillData: skills });
  }
  
  private initializeDefaultSkills(): void {
    const skills: Map<number, SkillData> = new Map();
    
    // Use soldier's default skills as fallback
    const defaultJob = jobAttributes['soldier'];
    if (!defaultJob) {
      this.logger.error('Default job configuration not found!');
      return;
    }
    
    const attacks = defaultJob.attacks;
    const hotkeys = ['X', 'C', 'V'];
    
    // Add default attack skills
    ['attack1', 'attack2', 'attack3'].forEach((key, index) => {
      const attack = (attacks as any)[key];
      skills.set(index, {
        id: `${key}_A${index + 1}`,
        name: attack.name,
        description: attack.description || 'No description available.',
        hotkey: hotkeys[index],
        slotType: 'attack',
        cooldown: attack.cooldown,
        currentCooldown: 0,
        icon: attack.icon
      });
    });
    
    // Add default passive only if it exists
    if (defaultJob.passives && defaultJob.passives.passive1) {
      const passive = defaultJob.passives.passive1;
      skills.set(3, {
        id: 'passive1_P1',
        name: passive.name,
        description: passive.description || 'No description available.',
        slotType: 'passive'
      });
    }
    
    // Don't fill remaining passive slots - let them be empty
    
    UIContextService.getInstance().updateSkillData(skills);
    this.handleSkillDataUpdate({ skillData: skills });
  }
  
  private createContainer(): void {
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(COMBAT_SKILL_CONFIG.depth.container);
    this.container.setScrollFactor(0); // Fix to camera
    
    // Create background graphics
    this.background = this.scene.add.graphics();
    this.container.add(this.background);
  }
  
  private createSkillSlots(): void {
    const config = COMBAT_SKILL_CONFIG;
    const slotWidth = config.slot.width;
    const slotHeight = config.slot.height;
    const spacing = config.grid.spacing;
    const padding = config.container.padding;
    
    // Calculate total container size
    const containerWidth = (slotWidth * config.grid.cols) + 
                          (spacing * (config.grid.cols - 1)) + 
                          (padding * 2);
    const containerHeight = (slotHeight * config.grid.rows) + 
                           (spacing * (config.grid.rows - 1)) + 
                           (padding * 2);
    
    // Draw background
    this.background.clear();
    this.background.fillStyle(config.container.backgroundColor, config.container.backgroundAlpha);
    this.background.fillRoundedRect(0, 0, containerWidth, containerHeight, config.container.borderRadius);
    this.background.lineStyle(config.container.borderWidth, config.container.borderColor);
    this.background.strokeRoundedRect(0, 0, containerWidth, containerHeight, config.container.borderRadius);
    
    let slotIndex = 0;
    
    for (let row = config.grid.rows - 1; row >= 0; row--) {
      for (let col = 0; col < config.grid.cols; col++) {
        const x = padding + col * (slotWidth + spacing);
        const y = padding + row * (slotHeight + spacing);
        
        const slot = new CombatSkillSlot(this.scene, slotIndex, x, y);
        
        slot.onHover((hoveredSlot, skillData) => {
          if (skillData) {
            const worldPos = hoveredSlot.getWorldPosition();
            const containerPos = this.container.getWorldTransformMatrix();
            this.tooltip.show(
              containerPos.tx + worldPos.x + slotWidth / 2,
              containerPos.ty + worldPos.y,
              skillData
            );
          }
        });
        
        slot.onHoverEnd(() => {
          this.tooltip.hide();
        });
        
        slot.onClick((clickedSlot, skillData) => {
          this.handleSkillActivation(clickedSlot, skillData);
        });
        
        this.skillSlots.push(slot);
        this.container.add(slot.getContainer());
        
        slotIndex++;
      }
    }
  }
  
  private positionContainer(): void {
    const camera = this.scene.cameras.main;
    const config = COMBAT_SKILL_CONFIG;
    
    // Calculate container dimensions (including padding)
    const containerWidth = (config.slot.width * config.grid.cols) + 
                          (config.grid.spacing * (config.grid.cols - 1)) + 
                          (config.container.padding * 2);
    const containerHeight = (config.slot.height * config.grid.rows) + 
                           (config.grid.spacing * (config.grid.rows - 1)) + 
                           (config.container.padding * 2);
    
    // Position in bottom-right corner
    const bottomUIHeight = 80; // From BOTTOM_UI_CONFIG
    const x = camera.width - containerWidth - config.container.margin;
    const y = camera.height - bottomUIHeight - containerHeight - config.container.margin;
    
    this.container.setPosition(x, y);
  }
  
  private handleSkillActivation(slot: CombatSkillSlot, skillData?: SkillData): void {
    if (!skillData) return;
    
    const slotIndex = this.skillSlots.indexOf(slot);
    if (slotIndex === -1 || slotIndex >= 3) return;
    
    const cooldownInfo = this.skillCooldowns.get(slotIndex);
    if (cooldownInfo) {
      const currentTime = Date.now();
      const remainingTime = (cooldownInfo.startTime + cooldownInfo.duration) - currentTime;
      if (remainingTime > 0) {
        this.logger.debug(`Skill ${skillData.name} still on cooldown: ${remainingTime}ms remaining`);
        return;
      }
    }
    
    this.logger.info(`UI: Skill slot ${slotIndex} clicked`);
  }
  
  private handleSkillActivatedEvent(data: { slotIndex: number; skillName: string; cooldown: number }): void {
    if (data.cooldown > 0) {
      this.skillCooldowns.set(data.slotIndex, {
        startTime: Date.now(),
        duration: data.cooldown * 1000
      });
    }
  }
  
  private handleSkillDataUpdate(data: { skillData: Map<number, SkillData> }): void {
    // Update all skill slots - either with data or clear them
    this.skillSlots.forEach((slot, index) => {
      const skillData = data.skillData.get(index);
      if (skillData) {
        slot.setSkillData(skillData);
      } else {
        // Clear the slot if no skill data exists for this index
        slot.setSkillData(undefined);
      }
    });
  }
  
  private onResize(_gameSize: Phaser.Structs.Size): void {
    // Reposition container on screen resize
    this.positionContainer();
  }
  
  
  public updateSkillCooldown(slotIndex: number, currentCooldown: number, maxCooldown: number): void {
    if (this.skillSlots[slotIndex]) {
      this.skillSlots[slotIndex].updateCooldown(currentCooldown, maxCooldown);
    }
  }
  
  public update(): void {
    // Update cooldown visuals for each attack skill
    const currentTime = Date.now();
    
    // Only update attack slots (0-2)
    for (let i = 0; i < 3; i++) {
      const cooldownInfo = this.skillCooldowns.get(i);
      
      if (cooldownInfo) {
        const remainingTime = Math.max(0, (cooldownInfo.startTime + cooldownInfo.duration) - currentTime);
        
        if (remainingTime > 0) {
          // Update the visual for this skill slot
          this.updateSkillCooldown(i, remainingTime, cooldownInfo.duration);
        } else {
          // Cooldown finished, clear it
          this.skillCooldowns.delete(i);
          this.updateSkillCooldown(i, 0, 1);
        }
      } else {
        // No cooldown, ensure slot is clear
        this.updateSkillCooldown(i, 0, 1);
      }
    }
  }
  
  public setVisible(visible: boolean): void {
    this.container.setVisible(visible);
    if (!visible) {
      this.tooltip.hide();
    }
  }
  
  public destroy(): void {
    // Remove resize listener
    this.scene.scale.off('resize', this.onResize, this);
    
    // Remove context event listeners
    const context = UIContextService.getInstance();
    context.off(UIEvents.SKILL_DATA_UPDATED, this.handleSkillDataUpdate, this);
    
    // Remove skill activation listener
    this.scene.events.off('skill:activated', this.handleSkillActivatedEvent, this);
    
    // Clear cooldowns
    this.skillCooldowns.clear();
    
    // Destroy all skill slots
    this.skillSlots.forEach(slot => slot.destroy());
    this.skillSlots = [];
    
    // Destroy container
    this.container.destroy();
    
    this.logger.info('CombatSkillBar destroyed');
  }
}