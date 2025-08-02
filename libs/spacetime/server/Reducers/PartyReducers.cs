using SpacetimeDB;
using System;
using System.Linq;

public static partial class Module
{
    private const uint MAX_PARTY_SIZE = 4;
    private const int PARTY_INVITE_EXPIRY_MINUTES = 5;
    private const int MAX_PARTY_NAME_LENGTH = 20;

    private static string? SanitizePartyName(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return null;

        // Remove control characters and potentially dangerous characters
        var sanitized = System.Text.RegularExpressions.Regex.Replace(input, @"[\x00-\x1F\x7F]", "");
        sanitized = System.Text.RegularExpressions.Regex.Replace(sanitized, @"[<>""'`&\\]", "");
        sanitized = sanitized.Trim();

        // Enforce max length
        if (sanitized.Length > MAX_PARTY_NAME_LENGTH)
        {
            sanitized = sanitized.Substring(0, MAX_PARTY_NAME_LENGTH);
        }

        // Ensure it contains at least one alphanumeric character
        if (!System.Text.RegularExpressions.Regex.IsMatch(sanitized, @"[a-zA-Z0-9]"))
        {
            return null;
        }

        return sanitized;
    }

    [Reducer]
    public static void CreateParty(ReducerContext ctx, string partyName)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player == null)
        {
            Log.Info($"Player not found: {ctx.Sender}");
            return;
        }
        
        // Check if player is banned
        if (player.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to create party");
            return;
        }

        // Check if player is already in a party
        var existingMembership = ctx.Db.PartyMember.player_identity.Find(player.Value.identity);
        if (existingMembership != null)
        {
            Log.Warn($"Player {player.Value.name} is already in a party");
            return;
        }

        // Sanitize party name
        var sanitizedName = SanitizePartyName(partyName);
        if (sanitizedName == null)
        {
            Log.Warn($"Invalid party name provided by {player.Value.name}");
            return;
        }

        // Create the party
        var party = new Party
        {
            leader_identity = player.Value.identity,
            party_name = sanitizedName,
            created_at = ctx.Timestamp,
            member_count = 1
        };

        var insertedParty = ctx.Db.Party.Insert(party);

        // Add the leader as a member
        var member = new PartyMember
        {
            party_id = insertedParty.party_id,
            player_identity = player.Value.identity
        };

        ctx.Db.PartyMember.Insert(member);

        Log.Info($"Player {player.Value.name} created party '{sanitizedName}' with ID {insertedParty.party_id}");
    }

    [Reducer]
    public static void InviteToParty(ReducerContext ctx, string targetPlayerName)
    {
        var inviter = ctx.Db.Player.identity.Find(ctx.Sender);
        if (inviter == null)
        {
            Log.Info($"Player not found: {ctx.Sender}");
            return;
        }
        
        // Check if player is banned
        if (inviter.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to invite to party");
            return;
        }

        // Get inviter's party membership
        var inviterMembership = ctx.Db.PartyMember.player_identity.Find(inviter.Value.identity);
        Party party;
        
        if (inviterMembership == null)
        {
            // Player is not in a party, create one automatically
            Log.Info($"Player {inviter.Value.name} is not in a party, creating one");
            
            // Create the party
            party = new Party
            {
                leader_identity = inviter.Value.identity,
                party_name = $"{inviter.Value.name}'s Party",
                created_at = ctx.Timestamp,
                member_count = 1
            };

            var insertedParty = ctx.Db.Party.Insert(party);
            party = insertedParty;

            // Add the inviter as a member
            var member = new PartyMember
            {
                party_id = insertedParty.party_id,
                player_identity = inviter.Value.identity
            };

            ctx.Db.PartyMember.Insert(member);
            Log.Info($"Created party '{party.party_name}' for {inviter.Value.name}");
        }
        else
        {
            // Get the existing party
            var existingParty = ctx.Db.Party.party_id.Find(inviterMembership.Value.party_id);
            if (existingParty == null)
            {
                Log.Error($"Party {inviterMembership.Value.party_id} not found");
                return;
            }
            party = existingParty.Value;
        }

        // Check if inviter is the leader
        if (party.leader_identity != inviter.Value.identity)
        {
            Log.Warn($"Player {inviter.Value.name} is not the party leader");
            return;
        }

        // Check party size
        if (party.member_count >= MAX_PARTY_SIZE)
        {
            Log.Warn($"Party {party.party_id} is full");
            return;
        }

        // Find target player
        var targetPlayer = ctx.Db.Player.Iter().FirstOrDefault(p => p.name == targetPlayerName);
        if (targetPlayer.identity == default)
        {
            Log.Warn($"Player {targetPlayerName} not found");
            return;
        }

        // Check if target is already in a party
        var targetMembership = ctx.Db.PartyMember.player_identity.Find(targetPlayer.identity);
        if (targetMembership != null)
        {
            Log.Warn($"Player {targetPlayerName} is already in a party");
            return;
        }

        // Check if invite already exists
        var existingInvite = ctx.Db.PartyInvite.Iter()
            .FirstOrDefault(i => i.party_id == party.party_id && i.invitee_identity == targetPlayer.identity);
        if (existingInvite.invite_id != default)
        {
            Log.Warn($"Invite to {targetPlayerName} already exists");
            return;
        }

        // Create invite
        var invite = new PartyInvite
        {
            party_id = party.party_id,
            inviter_identity = inviter.Value.identity,
            invitee_identity = targetPlayer.identity,
            invited_at = ctx.Timestamp,
            expires_at = ctx.Timestamp + TimeSpan.FromMinutes(PARTY_INVITE_EXPIRY_MINUTES)
        };

        ctx.Db.PartyInvite.Insert(invite);
        Log.Info($"Player {inviter.Value.name} invited {targetPlayerName} to party '{party.party_name}'");
    }

    [Reducer]
    public static void AcceptPartyInvite(ReducerContext ctx, uint inviteId)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player == null)
        {
            Log.Info($"Player not found: {ctx.Sender}");
            return;
        }
        
        // Check if player is banned
        if (player.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to accept party invite");
            return;
        }

        // Find the invite
        var invite = ctx.Db.PartyInvite.invite_id.Find(inviteId);
        if (invite == null)
        {
            Log.Warn($"Party invite {inviteId} not found");
            return;
        }

        // Check if invite is for this player
        if (invite.Value.invitee_identity != player.Value.identity)
        {
            Log.Warn($"Party invite {inviteId} is not for player {player.Value.name}");
            return;
        }

        // Check if invite has expired
        if (ctx.Timestamp > invite.Value.expires_at)
        {
            Log.Warn($"Party invite {inviteId} has expired");
            ctx.Db.PartyInvite.invite_id.Delete(inviteId);
            return;
        }

        // Check if player is already in a party
        var existingMembership = ctx.Db.PartyMember.player_identity.Find(player.Value.identity);
        if (existingMembership != null)
        {
            Log.Warn($"Player {player.Value.name} is already in a party");
            ctx.Db.PartyInvite.invite_id.Delete(inviteId);
            return;
        }

        // Get the party
        var party = ctx.Db.Party.party_id.Find(invite.Value.party_id);
        if (party == null)
        {
            Log.Error($"Party {invite.Value.party_id} not found");
            ctx.Db.PartyInvite.invite_id.Delete(inviteId);
            return;
        }

        // Check party size again
        if (party.Value.member_count >= MAX_PARTY_SIZE)
        {
            Log.Warn($"Party {party.Value.party_id} is full");
            ctx.Db.PartyInvite.invite_id.Delete(inviteId);
            return;
        }

        // Add player to party
        var member = new PartyMember
        {
            party_id = party.Value.party_id,
            player_identity = player.Value.identity
        };
        ctx.Db.PartyMember.Insert(member);

        // Update party member count
        var updatedParty = party.Value with { member_count = party.Value.member_count + 1 };
        ctx.Db.Party.party_id.Update(updatedParty);

        // Delete the invite
        ctx.Db.PartyInvite.invite_id.Delete(inviteId);

        // Delete any other invites for this player
        foreach (var otherInvite in ctx.Db.PartyInvite.Iter().Where(i => i.invitee_identity == player.Value.identity))
        {
            ctx.Db.PartyInvite.invite_id.Delete(otherInvite.invite_id);
        }

        Log.Info($"Player {player.Value.name} joined party '{party.Value.party_name}'");
    }

    [Reducer]
    public static void LeaveParty(ReducerContext ctx)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player == null)
        {
            Log.Info($"Player not found: {ctx.Sender}");
            return;
        }
        
        // Check if player is banned
        if (player.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to leave party");
            return;
        }

        // Find player's party membership
        var membership = ctx.Db.PartyMember.player_identity.Find(player.Value.identity);
        if (membership == null)
        {
            Log.Warn($"Player {player.Value.name} is not in a party");
            return;
        }

        // Get the party
        var party = ctx.Db.Party.party_id.Find(membership.Value.party_id);
        if (party == null)
        {
            Log.Error($"Party {membership.Value.party_id} not found");
            return;
        }

        // Remove player from party
        ctx.Db.PartyMember.party_member_id.Delete(membership.Value.party_member_id);

        // Update party member count
        var newMemberCount = party.Value.member_count - 1;

        // Check if party should be disbanded (1 or 0 members left)
        if (newMemberCount <= 1)
        {
            // Disband the party
            DisbandParty(ctx, party.Value);
            Log.Info($"Player {player.Value.name} left party '{party.Value.party_name}' - party disbanded");
        }
        else
        {
            // Update member count
            var updatedParty = party.Value with { member_count = newMemberCount };

            // If the leader left, promote the next member
            if (party.Value.leader_identity == player.Value.identity)
            {
                var nextMember = ctx.Db.PartyMember.Iter()
                    .Where(m => m.party_id == party.Value.party_id)
                    .FirstOrDefault();

                if (nextMember.party_member_id != default)
                {
                    updatedParty = updatedParty with { leader_identity = nextMember.player_identity };
                    Log.Info($"Promoted player {nextMember.player_identity} to party leader");
                }
            }

            ctx.Db.Party.party_id.Update(updatedParty);
            Log.Info($"Player {player.Value.name} left party '{party.Value.party_name}'");
        }
    }

    [Reducer]
    public static void RemoveFromParty(ReducerContext ctx, string targetPlayerName)
    {
        var leader = ctx.Db.Player.identity.Find(ctx.Sender);
        if (leader == null)
        {
            Log.Info($"Player not found: {ctx.Sender}");
            return;
        }
        
        // Check if player is banned
        if (leader.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to remove from party");
            return;
        }

        // Get leader's party membership
        var leaderMembership = ctx.Db.PartyMember.player_identity.Find(leader.Value.identity);
        if (leaderMembership == null)
        {
            Log.Warn($"Player {leader.Value.name} is not in a party");
            return;
        }

        // Get the party
        var party = ctx.Db.Party.party_id.Find(leaderMembership.Value.party_id);
        if (party == null)
        {
            Log.Error($"Party {leaderMembership.Value.party_id} not found");
            return;
        }

        // Check if player is the leader
        if (party.Value.leader_identity != leader.Value.identity)
        {
            Log.Warn($"Player {leader.Value.name} is not the party leader");
            return;
        }

        // Find target player
        var targetPlayer = ctx.Db.Player.Iter().FirstOrDefault(p => p.name == targetPlayerName);
        if (targetPlayer.identity == default)
        {
            Log.Warn($"Player {targetPlayerName} not found");
            return;
        }

        // Can't remove yourself
        if (targetPlayer.identity == leader.Value.identity)
        {
            Log.Warn($"Leader cannot remove themselves from the party");
            return;
        }

        // Find target's membership
        var targetMembership = ctx.Db.PartyMember.Iter()
            .FirstOrDefault(m => m.party_id == party.Value.party_id && m.player_identity == targetPlayer.identity);

        if (targetMembership.party_member_id == default)
        {
            Log.Warn($"Player {targetPlayerName} is not in the party");
            return;
        }

        // Remove target from party
        ctx.Db.PartyMember.party_member_id.Delete(targetMembership.party_member_id);

        // Update party member count
        var newMemberCount = party.Value.member_count - 1;

        // Check if party should be disbanded
        if (newMemberCount <= 1)
        {
            DisbandParty(ctx, party.Value);
            Log.Info($"Player {targetPlayerName} was removed from party '{party.Value.party_name}' - party disbanded");
        }
        else
        {
            var updatedParty = party.Value with { member_count = newMemberCount };
            ctx.Db.Party.party_id.Update(updatedParty);
            Log.Info($"Player {targetPlayerName} was removed from party '{party.Value.party_name}'");
        }
    }

    [Reducer]
    public static void UpdatePartyName(ReducerContext ctx, string newPartyName)
    {
        var leader = ctx.Db.Player.identity.Find(ctx.Sender);
        if (leader == null)
        {
            Log.Info($"Player not found: {ctx.Sender}");
            return;
        }
        
        // Check if player is banned
        if (leader.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to update party name");
            return;
        }

        // Get leader's party membership
        var leaderMembership = ctx.Db.PartyMember.player_identity.Find(leader.Value.identity);
        if (leaderMembership == null)
        {
            Log.Warn($"Player {leader.Value.name} is not in a party");
            return;
        }

        // Get the party
        var party = ctx.Db.Party.party_id.Find(leaderMembership.Value.party_id);
        if (party == null)
        {
            Log.Error($"Party {leaderMembership.Value.party_id} not found");
            return;
        }

        // Check if player is the leader
        if (party.Value.leader_identity != leader.Value.identity)
        {
            Log.Warn($"Player {leader.Value.name} is not the party leader");
            return;
        }

        // Sanitize new party name
        var sanitizedName = SanitizePartyName(newPartyName);
        if (sanitizedName == null)
        {
            Log.Warn($"Invalid party name provided by {leader.Value.name}");
            return;
        }

        // Update party name
        var updatedParty = party.Value with { party_name = sanitizedName };
        ctx.Db.Party.party_id.Update(updatedParty);

        Log.Info($"Party name updated from '{party.Value.party_name}' to '{sanitizedName}'");
    }

    [Reducer]
    public static void CleanupExpiredPartyInvites(ReducerContext ctx, PartyInviteCleanupTimer timer)
    {
        var expiredInvites = ctx.Db.PartyInvite.Iter()
            .Where(i => ctx.Timestamp > i.expires_at)
            .ToList();

        foreach (var invite in expiredInvites)
        {
            ctx.Db.PartyInvite.invite_id.Delete(invite.invite_id);
        }

        if (expiredInvites.Count > 0)
        {
            Log.Info($"Cleaned up {expiredInvites.Count} expired party invites");
        }
    }

    private static void DisbandParty(ReducerContext ctx, Party party)
    {
        // Remove all remaining members
        foreach (var member in ctx.Db.PartyMember.Iter().Where(m => m.party_id == party.party_id))
        {
            ctx.Db.PartyMember.party_member_id.Delete(member.party_member_id);
        }

        // Delete all pending invites
        foreach (var invite in ctx.Db.PartyInvite.Iter().Where(i => i.party_id == party.party_id))
        {
            ctx.Db.PartyInvite.invite_id.Delete(invite.invite_id);
        }

        // Delete the party
        ctx.Db.Party.party_id.Delete(party.party_id);

        Log.Info($"Party '{party.party_name}' (ID: {party.party_id}) has been disbanded");
    }
}