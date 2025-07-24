using System;

public static class AdminConstants 
{
    // Admin API key for protected reducers
    // This should match the SPACETIME_ADMIN_API_KEY environment variable
    // In production, this would be loaded from environment variables
    public const string ADMIN_API_KEY = "8dd01432c6f172ae550f033fd52110cecbaabb956a6562cfbed680052de10028";
    
    /// <summary>
    /// Validates if the provided API key matches the admin key
    /// </summary>
    public static bool IsValidAdminKey(string providedKey)
    {
        return !string.IsNullOrEmpty(providedKey) && providedKey == ADMIN_API_KEY;
    }
}