using SpacetimeDB;

public static partial class Module
{
    /// <summary>
    /// Sends a player message (chat or command) and stores it in the PlayerMessages table
    /// </summary>
    [Reducer]
    public static void SendPlayerMessage(ReducerContext ctx, string message)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player is null)
        {
            Log.Info($"SendPlayerMessage: Player not found for {ctx.Sender}");
            return;
        }

        // Determine message type
        MessageType messageType = message.StartsWith("/") ? MessageType.Command : MessageType.Message;
        
        // Create the message record
        var playerMessage = new PlayerMessage
        {
            player_id = ctx.Sender,
            message_type = messageType,
            message = message,
            sent_dt = ctx.Timestamp
        };

        // Insert the message
        ctx.Db.PlayerMessage.Insert(playerMessage);
        
        // Log the message for debugging
        Log.Info($"Player {player.Value.name} sent {messageType}: {message}");
    }
    
    /// <summary>
    /// Updates a player's typing status
    /// </summary>
    [Reducer]
    public static void UpdatePlayerTyping(ReducerContext ctx, bool isTyping)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player is null)
        {
            Log.Info($"UpdatePlayerTyping: Player not found for {ctx.Sender}");
            return;
        }
        
        // Only update if the typing status actually changed
        if (player.Value.is_typing != isTyping)
        {
            ctx.Db.Player.identity.Update(player.Value with
            {
                is_typing = isTyping,
                last_active = ctx.Timestamp
            });
            
            Log.Info($"Player {player.Value.name} typing status: {isTyping}");
        }
    }
    
    /// <summary>
    /// Cleans up old messages that are older than 60 seconds
    /// This is called periodically to prevent the message table from growing indefinitely
    /// </summary>
    [Reducer]
    public static void CleanupOldMessages(ReducerContext ctx, MessageCleanupTimer timer)
    {
        // Messages older than this will be deleted
        const uint MESSAGE_RETENTION_SECONDS = 60;
        
        // Calculate the cutoff timestamp using TimeSpan subtraction
        var cutoffTime = ctx.Timestamp - TimeSpan.FromSeconds(MESSAGE_RETENTION_SECONDS);
        
        var messagesToDelete = new List<uint>();
        
        // Find all messages older than the cutoff time
        foreach (var message in ctx.Db.PlayerMessage.Iter())
        {
            if (message.sent_dt < cutoffTime)
            {
                messagesToDelete.Add(message.message_id);
            }
        }
        
        // Delete old messages
        foreach (var messageId in messagesToDelete)
        {
            ctx.Db.PlayerMessage.message_id.Delete(messageId);
        }
        
        if (messagesToDelete.Count > 0)
        {
            Log.Info($"CleanupOldMessages: Deleted {messagesToDelete.Count} messages older than {MESSAGE_RETENTION_SECONDS} seconds");
        }
    }
}