using SpacetimeDB;
using System;

public static partial class Module
{
    /// <summary>
    /// Service responsible for validating player movement and actions on the server
    /// Ensures players cannot perform invalid actions or teleport/cheat
    /// </summary>
    public static class PlayerValidator
    {
        // Movement validation constants
        private const float MAX_MOVEMENT_SPEED = 300f; // Max pixels per second
        private const float MAX_TELEPORT_DISTANCE = 500f; // Max distance for position jumps
        private const float POSITION_SYNC_TOLERANCE = 10f; // Tolerance for minor position differences
        private const float MAX_VELOCITY_Y = 600f; // Max fall/jump velocity
        
        /// <summary>
        /// Validate player movement between two positions
        /// </summary>
        public static MovementValidationResult ValidateMovement(
            ReducerContext ctx,
            float oldX, float oldY,
            float newX, float newY,
            PlayerState currentState,
            double timeDelta)
        {
            // Calculate distance moved
            var deltaX = newX - oldX;
            var deltaY = newY - oldY;
            var distance = Math.Sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // Validate time delta is reasonable (prevent timestamp manipulation)
            if (timeDelta <= 0 || timeDelta > 5.0) // Max 5 seconds between updates
            {
                return new MovementValidationResult
                {
                    IsValid = false,
                    Reason = "Invalid time delta",
                    CorrectedX = oldX,
                    CorrectedY = oldY
                };
            }
            
            // Check for teleportation (massive position jump)
            if (distance > MAX_TELEPORT_DISTANCE)
            {
                return new MovementValidationResult
                {
                    IsValid = false,
                    Reason = "Position jump too large (possible teleportation)",
                    CorrectedX = oldX,
                    CorrectedY = oldY
                };
            }
            
            // Validate movement speed is within reasonable bounds
            var speed = distance / timeDelta;
            if (speed > MAX_MOVEMENT_SPEED)
            {
                // Calculate maximum allowed movement in this time frame
                var maxDistance = MAX_MOVEMENT_SPEED * timeDelta;
                var correctionRatio = maxDistance / distance;
                
                return new MovementValidationResult
                {
                    IsValid = false,
                    Reason = $"Movement speed too high: {speed:F1} > {MAX_MOVEMENT_SPEED}",
                    CorrectedX = oldX + (float)(deltaX * correctionRatio),
                    CorrectedY = oldY + (float)(deltaY * correctionRatio)
                };
            }
            
            // Validate state-specific movement constraints
            var stateValidation = ValidateStateSpecificMovement(currentState, deltaX, deltaY, timeDelta);
            if (!stateValidation.IsValid)
            {
                return stateValidation;
            }
            
            return new MovementValidationResult
            {
                IsValid = true,
                Reason = "Movement valid",
                CorrectedX = newX,
                CorrectedY = newY
            };
        }
        
        /// <summary>
        /// Validate movement based on current player state
        /// </summary>
        private static MovementValidationResult ValidateStateSpecificMovement(
            PlayerState state, 
            float deltaX, 
            float deltaY, 
            double timeDelta)
        {
            switch (state)
            {
                case PlayerState.Dead:
                    // Dead players shouldn't move
                    if (Math.Abs(deltaX) > POSITION_SYNC_TOLERANCE || Math.Abs(deltaY) > POSITION_SYNC_TOLERANCE)
                    {
                        return new MovementValidationResult
                        {
                            IsValid = false,
                            Reason = "Dead players cannot move"
                        };
                    }
                    break;
                    
                case PlayerState.Climbing:
                    // Climbing has different movement constraints
                    var climbSpeed = Math.Abs(deltaY) / timeDelta;
                    if (climbSpeed > 150f) // Climbing is slower than running
                    {
                        return new MovementValidationResult
                        {
                            IsValid = false,
                            Reason = "Climbing speed too high"
                        };
                    }
                    break;
                    
                case PlayerState.Damaged:
                    // Players in damaged state have limited movement
                    var damageSpeed = Math.Sqrt(deltaX * deltaX + deltaY * deltaY) / timeDelta;
                    if (damageSpeed > 100f) // Reduced movement when damaged
                    {
                        return new MovementValidationResult
                        {
                            IsValid = false,
                            Reason = "Movement too fast while damaged"
                        };
                    }
                    break;
            }
            
            return new MovementValidationResult { IsValid = true };
        }
        
        /// <summary>
        /// Validate player action based on current state and cooldowns
        /// </summary>
        public static ActionValidationResult ValidateAction(
            ReducerContext ctx,
            Identity playerIdentity,
            string actionType,
            Timestamp lastActionTime)
        {
            var player = ctx.Db.Player.identity.Find(playerIdentity);
            if (player == null)
            {
                return new ActionValidationResult
                {
                    IsValid = false,
                    Reason = "Player not found"
                };
            }
            
            // Dead players can't perform actions
            if (player.Value.state == PlayerState.Dead)
            {
                return new ActionValidationResult
                {
                    IsValid = false,
                    Reason = "Dead players cannot perform actions"
                };
            }
            
            // Validate action-specific constraints
            switch (actionType.ToLower())
            {
                case "attack":
                    return ValidateAttackAction(ctx, player.Value, lastActionTime);
                case "jump":
                    return ValidateJumpAction(player.Value);
                case "climb":
                    return ValidateClimbAction(player.Value);
                default:
                    return new ActionValidationResult
                    {
                        IsValid = true,
                        Reason = "Unknown action type, allowing"
                    };
            }
        }
        
        private static ActionValidationResult ValidateAttackAction(ReducerContext ctx, Player player, Timestamp lastActionTime)
        {
            // For now, we'll use a simplified cooldown check
            // In production, you'd want to track milliseconds since last attack differently
            // SpacetimeDB doesn't expose timestamp arithmetic directly
            
            // Can't attack while climbing
            if (player.state == PlayerState.Climbing)
            {
                return new ActionValidationResult
                {
                    IsValid = false,
                    Reason = "Cannot attack while climbing"
                };
            }
            
            return new ActionValidationResult { IsValid = true };
        }
        
        private static ActionValidationResult ValidateJumpAction(Player player)
        {
            // Can't jump while dead or climbing
            if (player.state == PlayerState.Dead || player.state == PlayerState.Climbing)
            {
                return new ActionValidationResult
                {
                    IsValid = false,
                    Reason = $"Cannot jump while in {player.state} state"
                };
            }
            
            return new ActionValidationResult { IsValid = true };
        }
        
        private static ActionValidationResult ValidateClimbAction(Player player)
        {
            // Can't start climbing while dead
            if (player.state == PlayerState.Dead)
            {
                return new ActionValidationResult
                {
                    IsValid = false,
                    Reason = "Cannot climb while dead"
                };
            }
            
            return new ActionValidationResult { IsValid = true };
        }
        
        /// <summary>
        /// Validate HP/mana values to prevent cheating
        /// </summary>
        public static bool ValidateHealthMana(float hp, float maxHp, float mana, float maxMana)
        {
            return hp >= 0 && hp <= maxHp && mana >= 0 && mana <= maxMana;
        }
        
        /// <summary>
        /// Validate level and experience values
        /// </summary>
        public static bool ValidatePlayerProgress(uint level, uint experience)
        {
            // Level must be at least 1
            if (level < 1) return false;
            
            // Experience can't be negative
            // (Additional logic could check if experience matches level requirements)
            return true;
        }
    }
    
    // Helper structs for validation results
    public struct MovementValidationResult
    {
        public bool IsValid;
        public string Reason;
        public float? CorrectedX;
        public float? CorrectedY;
    }
    
    public struct ActionValidationResult
    {
        public bool IsValid;
        public string Reason;
    }
}