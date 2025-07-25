/**
 * AssetResolver provides centralized asset path resolution for multi-app architecture
 * Handles both development and production asset paths
 */
export class AssetResolver {
    private static currentApp: string = 'playground';

    /**
     * Set the current app context
     */
    static setCurrentApp(appName: string): void {
        AssetResolver.currentApp = appName;
    }

    /**
     * Get the current app name
     */
    static getCurrentApp(): string {
        return AssetResolver.currentApp;
    }

    /**
     * Resolve an asset path for the current or specified app
     * @param assetPath - Relative path to the asset (e.g., "assets/spritesheet/soldier.png")
     * @param appName - Optional app name, defaults to current app
     * @returns Resolved path to the asset
     */
    static getAssetPath(assetPath: string, appName?: string): string {
        // Get the base path from Vite's configuration
        // In dev, this is '/', in production it might be '/jump-story-mvp/'
        const base = import.meta.env.BASE_URL || '/';
        
        // Ensure the path starts with the base URL
        return `${base}${assetPath}`.replace('//', '/');
    }

    /**
     * Get the base asset URL for an app
     */
    static getAppAssetBase(appName?: string): string {
        const app = appName || AssetResolver.currentApp;
        
        if (import.meta.env.DEV) {
            return `/apps/${app}/public`;
        } else {
            return '';
        }
    }

    /**
     * Resolve a map file path
     * Maps can be in either the app's maps directory or public/maps
     */
    static getMapPath(mapFile: string, appName?: string): string {
        // Get the base path from Vite's configuration
        const base = import.meta.env.BASE_URL || '/';
        
        // Maps are always in the maps directory
        return `${base}maps/${mapFile}`.replace('//', '/');
    }
}