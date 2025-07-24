using SpacetimeDB;
using System;
using System.Collections.Generic;

public static partial class Module
{
    /// <summary>
    /// Service responsible for managing player state transitions on the server
    /// Ensures valid state transitions and encapsulates state change logic
    /// </summary>
    public static class PlayerStateMachine
    {
        // Define valid transitions between states
        private static readonly Dictionary<PlayerState, HashSet<PlayerState>> ValidTransitions = new Dictionary<PlayerState, HashSet<PlayerState>>
        {
            // From Idle
            [PlayerState.Idle] = new HashSet<PlayerState> 
            { 
                PlayerState.Walk, 
                PlayerState.Attack1,
                PlayerState.Attack2,
                PlayerState.Attack3,
                PlayerState.Climbing, 
                PlayerState.Damaged,
                PlayerState.Dead 
            },
            
            // From Walk
            [PlayerState.Walk] = new HashSet<PlayerState> 
            { 
                PlayerState.Idle, 
                PlayerState.Attack1,
                PlayerState.Attack2,
                PlayerState.Attack3,
                PlayerState.Climbing, 
                PlayerState.Damaged,
                PlayerState.Dead 
            },
            
            // From Attack1
            [PlayerState.Attack1] = new HashSet<PlayerState> 
            { 
                PlayerState.Idle,
                PlayerState.Walk,
                PlayerState.Attack1,
                PlayerState.Attack2,
                PlayerState.Attack3,
                PlayerState.Damaged,
                PlayerState.Dead 
            },
            
            // From Attack2
            [PlayerState.Attack2] = new HashSet<PlayerState> 
            { 
                PlayerState.Idle,
                PlayerState.Walk,
                PlayerState.Attack1,
                PlayerState.Attack2,
                PlayerState.Attack3,
                PlayerState.Damaged,
                PlayerState.Dead 
            },
            
            // From Attack3
            [PlayerState.Attack3] = new HashSet<PlayerState> 
            { 
                PlayerState.Idle,
                PlayerState.Walk,
                PlayerState.Attack1,
                PlayerState.Attack2,
                PlayerState.Attack3,
                PlayerState.Damaged,
                PlayerState.Dead 
            },
            
            // From Climbing
            [PlayerState.Climbing] = new HashSet<PlayerState> 
            { 
                PlayerState.Idle,
                PlayerState.Walk,
                PlayerState.Damaged,
                PlayerState.Dead 
            },
            
            // From Damaged
            [PlayerState.Damaged] = new HashSet<PlayerState> 
            { 
                PlayerState.Idle,
                PlayerState.Walk,
                PlayerState.Dead 
            },
            
            // From Dead - can only respawn to Idle
            [PlayerState.Dead] = new HashSet<PlayerState> 
            { 
                PlayerState.Idle 
            },
            
            // From Unknown - can transition to any state
            [PlayerState.Unknown] = new HashSet<PlayerState> 
            { 
                PlayerState.Idle,
                PlayerState.Walk,
                PlayerState.Attack1,
                PlayerState.Attack2,
                PlayerState.Attack3,
                PlayerState.Climbing,
                PlayerState.Damaged,
                PlayerState.Dead
            }
        };
        
        /// <summary>
        /// Validate if a state transition is allowed
        /// </summary>
        public static bool IsValidTransition(PlayerState fromState, PlayerState toState)
        {
            // Same state is always valid (no transition)
            if (fromState == toState)
            {
                return true;
            }
            
            // Check if transition is valid
            if (ValidTransitions.TryGetValue(fromState, out var validStates))
            {
                return validStates.Contains(toState);
            }
            
            // Unknown from state - deny transition
            return false;
        }
        
        /// <summary>
        /// Apply state transition with validation
        /// </summary>
        public static StateTransitionResult ApplyStateTransition(
            ReducerContext ctx,
            Player player,
            PlayerState newState,
            bool forceTransition = false)
        {
            // Check if player is dead and trying to transition to non-Idle state
            if (player.state == PlayerState.Dead && newState != PlayerState.Idle && !forceTransition)
            {
                return new StateTransitionResult
                {
                    Success = false,
                    Reason = "Dead players can only transition to Idle (respawn)",
                    OldState = player.state,
                    NewState = player.state
                };
            }
            
            // Validate transition
            if (!forceTransition && !IsValidTransition(player.state, newState))
            {
                return new StateTransitionResult
                {
                    Success = false,
                    Reason = $"Invalid transition from {player.state} to {newState}",
                    OldState = player.state,
                    NewState = player.state
                };
            }
            
            // Apply additional validation based on state
            var validation = ValidateStateSpecificRequirements(player, newState);
            if (!validation.IsValid && !forceTransition)
            {
                return new StateTransitionResult
                {
                    Success = false,
                    Reason = validation.Reason,
                    OldState = player.state,
                    NewState = player.state
                };
            }
            
            // Apply the state transition
            var oldState = player.state;
            ctx.Db.Player.identity.Update(player with 
            { 
                state = newState,
                last_active = ctx.Timestamp
            });
            
            // Log significant state changes
            if (oldState != newState)
            {
                LogStateTransition(player.identity, oldState, newState);
            }
            
            return new StateTransitionResult
            {
                Success = true,
                Reason = "State transition successful",
                OldState = oldState,
                NewState = newState
            };
        }
        
        /// <summary>
        /// Validate state-specific requirements before transitioning
        /// </summary>
        private static StateValidation ValidateStateSpecificRequirements(Player player, PlayerState newState)
        {
            switch (newState)
            {
                case PlayerState.Attack1:
                case PlayerState.Attack2:
                case PlayerState.Attack3:
                    // Can't attack while climbing
                    if (player.state == PlayerState.Climbing)
                    {
                        return new StateValidation 
                        { 
                            IsValid = false, 
                            Reason = "Cannot attack while climbing" 
                        };
                    }
                    // Can't attack while dead
                    if (player.current_hp <= 0)
                    {
                        return new StateValidation 
                        { 
                            IsValid = false, 
                            Reason = "Cannot attack while dead" 
                        };
                    }
                    break;
                    
                case PlayerState.Climbing:
                    // Can't climb while dead
                    if (player.current_hp <= 0)
                    {
                        return new StateValidation 
                        { 
                            IsValid = false, 
                            Reason = "Cannot climb while dead" 
                        };
                    }
                    break;
                    
                case PlayerState.Dead:
                    // Transitioning to dead requires HP to be 0
                    if (player.current_hp > 0)
                    {
                        return new StateValidation 
                        { 
                            IsValid = false, 
                            Reason = "Cannot transition to Dead state with positive HP" 
                        };
                    }
                    break;
                    
                case PlayerState.Idle:
                    // Transitioning from Dead to Idle (respawn) requires positive HP
                    if (player.state == PlayerState.Dead && player.current_hp <= 0)
                    {
                        return new StateValidation 
                        { 
                            IsValid = false, 
                            Reason = "Cannot respawn with 0 HP" 
                        };
                    }
                    break;
            }
            
            return new StateValidation { IsValid = true, Reason = "Valid" };
        }
        
        /// <summary>
        /// Get the next attack state in the combo chain
        /// </summary>
        public static PlayerState? GetNextAttackState(PlayerState currentState)
        {
            switch (currentState)
            {
                case PlayerState.Idle:
                case PlayerState.Walk:
                    return PlayerState.Attack1;
                case PlayerState.Attack1:
                    return PlayerState.Attack2;
                case PlayerState.Attack2:
                    return PlayerState.Attack3;
                case PlayerState.Attack3:
                    return null; // End of combo
                default:
                    return null;
            }
        }
        
        /// <summary>
        /// Check if a state is an attack state
        /// </summary>
        public static bool IsAttackState(PlayerState state)
        {
            return state == PlayerState.Attack1 || 
                   state == PlayerState.Attack2 || 
                   state == PlayerState.Attack3;
        }
        
        /// <summary>
        /// Check if a state allows movement
        /// </summary>
        public static bool CanMove(PlayerState state)
        {
            switch (state)
            {
                case PlayerState.Idle:
                case PlayerState.Walk:
                    return true;
                case PlayerState.Climbing:
                    return true; // Limited movement on ladders
                case PlayerState.Damaged:
                    return false; // Stunned during damage
                case PlayerState.Dead:
                    return false; // No movement when dead
                case PlayerState.Attack1:
                case PlayerState.Attack2:
                case PlayerState.Attack3:
                    return false; // No movement during attacks
                default:
                    return false;
            }
        }
        
        /// <summary>
        /// Get the appropriate movement state based on velocity
        /// </summary>
        public static PlayerState GetMovementState(bool isMoving, PlayerState currentState)
        {
            // Don't change state if in special states
            if (currentState == PlayerState.Dead || 
                currentState == PlayerState.Climbing ||
                currentState == PlayerState.Damaged ||
                IsAttackState(currentState))
            {
                return currentState;
            }
            
            return isMoving ? PlayerState.Walk : PlayerState.Idle;
        }
        
        /// <summary>
        /// Log state transitions for debugging
        /// </summary>
        private static void LogStateTransition(Identity playerIdentity, PlayerState oldState, PlayerState newState)
        {
            if (oldState == PlayerState.Dead && newState == PlayerState.Idle)
            {
                Log.Info($"Player {playerIdentity} respawned");
            }
            else if (newState == PlayerState.Dead)
            {
                Log.Info($"Player {playerIdentity} died");
            }
            else if (IsAttackState(newState))
            {
                Log.Debug($"Player {playerIdentity} attacking: {newState}");
            }
        }
    }
    
    // Helper structs
    public struct StateTransitionResult
    {
        public bool Success;
        public string Reason;
        public PlayerState OldState;
        public PlayerState NewState;
    }
    
    public struct StateValidation
    {
        public bool IsValid;
        public string Reason;
    }
}