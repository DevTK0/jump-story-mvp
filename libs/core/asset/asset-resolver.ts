/**
 * AssetResolver provides centralized asset path resolution
 * Handles both development and production asset paths using Vite's configuration
 */
export class AssetResolver {
  /**
   * Resolve an asset path
   * @param assetPath - Relative path to the asset (e.g., "assets/spritesheet/soldier.png")
   * @returns Resolved path to the asset
   */
  static getAssetPath(assetPath: string): string {
    // Get the base path from Vite's configuration
    // In dev, this is '/', in production it might be '/jump-story-mvp/'
    const base = import.meta.env.BASE_URL || '/';

    // Ensure the path starts with the base URL
    return `${base}${assetPath}`.replace('//', '/');
  }

  /**
   * Resolve a map file path
   * @param mapFile - Map filename (e.g., "playground.tmj")
   * @returns Resolved path to the map file
   */
  static getMapPath(mapFile: string): string {
    // Get the base path from Vite's configuration
    const base = import.meta.env.BASE_URL || '/';

    // Maps are always in the maps directory
    return `${base}maps/${mapFile}`.replace('//', '/');
  }
}
