import spriteConfig from '../apps/playground/config/sprite-config';
import { bossAttributes } from '../apps/playground/config/enemy-attributes';

export interface BossAnimationDurations {
  [bossId: string]: {
    attack1?: number;
    attack2?: number;
    attack3?: number;
  };
}

/**
 * Calculates animation durations for all boss attacks based on sprite frame data
 * @returns Object mapping boss IDs to their attack animation durations in milliseconds
 */
export function calculateBossAnimationDurations(): BossAnimationDurations {
  const durations: BossAnimationDurations = {};
  
  // Iterate through all bosses
  for (const [bossId, bossConfig] of Object.entries(bossAttributes.bosses)) {
    durations[bossId] = {};
    
    // Get the sprite key for this boss
    const spriteKey = bossConfig.sprite || bossId;
    
    // Find the sprite definition in the enemies section
    const enemySprites = spriteConfig.sprites.enemies;
    const spriteDefinition = enemySprites[spriteKey];
    
    if (!spriteDefinition || !spriteDefinition.animations) {
      console.warn(`No sprite animations found for boss: ${bossId} (sprite: ${spriteKey})`);
      // Use default durations
      durations[bossId] = {
        attack1: 1000,
        attack2: 1000,
        attack3: 1000
      };
      continue;
    }
    
    // Calculate duration for each attack
    for (let attackNum = 1; attackNum <= 3; attackNum++) {
      const attackKey = `attack${attackNum}` as keyof typeof spriteDefinition.animations;
      const attackAnim = spriteDefinition.animations[attackKey];
      
      if (attackAnim && typeof attackAnim === 'object' && 
          'start' in attackAnim && 'end' in attackAnim && 'frameRate' in attackAnim) {
        // Calculate duration: (end - start + 1) / frameRate * 1000ms
        const frameCount = attackAnim.end - attackAnim.start + 1;
        const durationMs = Math.round((frameCount / attackAnim.frameRate) * 1000);
        durations[bossId][attackKey as keyof typeof durations[typeof bossId]] = durationMs;
      } else {
        // Default duration if animation not found
        durations[bossId][attackKey as keyof typeof durations[typeof bossId]] = 1000;
      }
    }
  }
  
  return durations;
}

/**
 * Logs the calculated durations for debugging
 */
export function logBossAnimationDurations(durations: BossAnimationDurations): void {
  console.log('Boss Animation Durations:');
  for (const [bossId, attacks] of Object.entries(durations)) {
    console.log(`  ${bossId}:`);
    if (attacks.attack1) console.log(`    attack1: ${attacks.attack1}ms`);
    if (attacks.attack2) console.log(`    attack2: ${attacks.attack2}ms`);
    if (attacks.attack3) console.log(`    attack3: ${attacks.attack3}ms`);
  }
}