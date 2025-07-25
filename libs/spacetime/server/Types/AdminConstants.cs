using System;

public static class AdminConstants 
{
    // Base64 encoded admin API key for protected reducers
    // This provides basic obfuscation to avoid exposing the key in plain text
    // The key is decoded at runtime for comparison
    private const string ENCODED_ADMIN_KEY = "ZjcwNWMxMWQ2MGI5ZWE2YzBlYmZjMTdmMTA2NjQzNmM4ZjFkZWJjYjU5ZmY1MTA5MmJlODQ5MmVmZWM5MDA4OA==";
    
    // Decode the key once at startup
    private static readonly string ADMIN_API_KEY = System.Text.Encoding.UTF8.GetString(
        System.Convert.FromBase64String(ENCODED_ADMIN_KEY)
    );
    
    /// <summary>
    /// Validates if the provided API key matches the admin key
    /// </summary>
    public static bool IsValidAdminKey(string providedKey)
    {
        return !string.IsNullOrEmpty(providedKey) && providedKey == ADMIN_API_KEY;
    }
}