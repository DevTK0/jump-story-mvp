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
}