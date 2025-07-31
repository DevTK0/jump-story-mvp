import { spriteConfigLoader } from '@/core/asset/sprite-config-loader';

/**
 * Gets the duration for a specific boss attack animation
 * This should match the calculation used in the init script
 * @param bossKey The boss/sprite key (e.g., 'orc-rider')
 * @param attackType The attack number (1, 2, or 3)
 * @returns Duration in milliseconds
 */
export function getBossAttackAnimationDuration(bossKey: string, attackType: number): number {
  const DEFAULT_BOSS_ATTACK_DURATION = 1000; // 1 second default
  
  // Get sprite definition from the loaded config
  const bossSprite = spriteConfigLoader.getSpriteDefinition('enemies', bossKey);
  
  if (!bossSprite) {
    console.warn(`Boss sprite not found: ${bossKey}`);
    return DEFAULT_BOSS_ATTACK_DURATION;
  }

  const animations = bossSprite.animations;
  if (!animations) {
    console.warn(`No animations found for boss: ${bossKey}`);
    return DEFAULT_BOSS_ATTACK_DURATION;
  }

  const attackKey = `attack${attackType}` as keyof typeof animations;
  const attackAnim = animations[attackKey];

  if (!attackAnim || typeof attackAnim !== 'object') {
    console.warn(`Attack animation not found for ${bossKey}.${attackKey}`);
    return DEFAULT_BOSS_ATTACK_DURATION;
  }

  // Ensure all required properties exist
  if (typeof attackAnim.start !== 'number' || typeof attackAnim.end !== 'number' || typeof attackAnim.frameRate !== 'number') {
    console.error(`Invalid animation data for ${bossKey}.${attackKey}:`, attackAnim);
    return DEFAULT_BOSS_ATTACK_DURATION;
  }

  // Calculate duration from frame data: (end - start + 1) / frameRate * 1000ms
  // This matches the calculation in calculate-boss-animation-durations.ts
  const frameCount = attackAnim.end - attackAnim.start + 1;
  const durationMs = Math.round((frameCount / attackAnim.frameRate) * 1000);
  
  return durationMs;
}