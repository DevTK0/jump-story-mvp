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
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.logger = createLogger('CombatSkillBar');
    
    // Get tooltip instance
    this.tooltip = CombatSkillTooltip.getInstance(scene);
    
    // Get database connection
    const context = UIContextService.getInstance();
    this.dbConnection = context.getDbConnection();
    
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
    
    // Map attacks to skill slots (bottom row)
    const attacks = jobConfig.attacks;
    const attackKeys = Object.keys(attacks);
    const hotkeys = ['X', 'C', 'V'];
    
    // Add attack skills (slots 0-2)
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
          currentCooldown: 0
        });
      }
    });
    
    // Add passive skills (slots 3-5) - only add if they exist
    const passives = jobConfig.passives || {};
    const passiveKeys = Object.keys(passives);
    
    // Add existing passives
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
    
    // Don't fill empty passive slots - let them remain empty
    // Only fill empty attack slots if needed
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
    
    // Update UI context service with skill data
    UIContextService.getInstance().updateSkillData(skills);
    
    // Manually trigger update for initial display
    this.handleSkillDataUpdate({ skillData: skills });
    
    this.logger.info(`Initialized skills for job: ${currentJob}`);
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
        currentCooldown: 0
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
    
    // Create slots in grid layout (bottom row first for attacks)
    for (let row = config.grid.rows - 1; row >= 0; row--) {
      for (let col = 0; col < config.grid.cols; col++) {
        const x = padding + col * (slotWidth + spacing);
        const y = padding + row * (slotHeight + spacing);
        
        const slot = new CombatSkillSlot(this.scene, slotIndex, x, y);
        
        // Set up callbacks
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
    
    this.logger.info(`Created ${this.skillSlots.length} skill slots`);
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
  
  private handleSkillActivation(_slot: CombatSkillSlot, skillData?: SkillData): void {
    if (!skillData || !this.dbConnection) return;
    
    this.logger.info(`Activating skill: ${skillData.name}`);
    
    // TODO: Call appropriate reducer based on skill type
    // For now, just log
    if (skillData.slotType === 'attack') {
      this.logger.info(`Would call attack reducer for skill: ${skillData.id}`);
      // Example: this.dbConnection.reducers.useSkill(skillData.id);
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
    
    // Destroy all skill slots
    this.skillSlots.forEach(slot => slot.destroy());
    this.skillSlots = [];
    
    // Destroy container
    this.container.destroy();
    
    this.logger.info('CombatSkillBar destroyed');
  }
}