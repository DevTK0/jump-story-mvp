import spriteConfig from '../../../apps/playground/config/sprite-config';
import { PLAYER_ANIMATION_TIMINGS } from './config';

/**
 * Gets the duration for a specific attack animation
 * @param jobKey The job/sprite key (e.g., 'soldier', 'wizard')
 * @param attackType The attack number (1, 2, or 3)
 * @returns Duration in milliseconds
 */
export function getAttackAnimationDuration(jobKey: string, attackType: number): number {
  const jobSprites = spriteConfig.sprites.jobs;
  
  if (!jobSprites || !jobSprites[jobKey]) {
    console.warn(`Job sprite not found: ${jobKey}`);
    return PLAYER_ANIMATION_TIMINGS.DEFAULT_ATTACK_DURATION;
  }

  const animations = jobSprites[jobKey].animations;
  const attackKey = `attack${attackType}` as keyof typeof animations;
  const attackAnim = animations[attackKey];

  if (!attackAnim || typeof attackAnim !== 'object') {
    console.warn(`Attack animation not found for ${jobKey}.${attackKey}`);
    // Fallback to config durations
    const fallbackKey = attackKey as keyof typeof PLAYER_ANIMATION_TIMINGS.ATTACK_DURATIONS;
    return PLAYER_ANIMATION_TIMINGS.ATTACK_DURATIONS[fallbackKey] || 
           PLAYER_ANIMATION_TIMINGS.DEFAULT_ATTACK_DURATION;
  }

  // Calculate duration from frame data: (end - start + 1) / frameRate * 1000ms
  const frameCount = attackAnim.end - attackAnim.start + 1;
  const durationMs = Math.round((frameCount / attackAnim.frameRate) * 1000);
  
  return durationMs;
}