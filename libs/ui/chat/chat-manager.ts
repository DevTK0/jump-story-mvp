import Phaser from "phaser";
import { ChatInput } from "./chat-input";
import { SpeechBubble } from "./speech-bubble";
import { Emote } from "./emote";
import { DbConnection } from "@/spacetime/client";

export class ChatManager {
    private scene: Phaser.Scene;
    private chatInput: ChatInput;
    private dbConnection: DbConnection | null = null;
    private speechBubbles: Map<any, SpeechBubble> = new Map();
    private updateEvents: Map<any, Phaser.Time.TimerEvent> = new Map();
    private emoteUpdateEvents: Map<any, Phaser.Time.TimerEvent> = new Map();
    private peerTypingIndicators: Map<any, Emote> = new Map();
    private activeEmotes: Map<any, Emote> = new Map(); // Track active emotes per entity
    private typingIndicator: Emote | null = null;
    private typingUpdateEvent: Phaser.Time.TimerEvent | null = null;
    private lastMessageTime: number = 0;
    private messageCount: number = 0;
    private rateLimitResetTime: number = 0;
    
    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.chatInput = new ChatInput(scene);
        
        // Set up chat input callbacks
        this.chatInput.onSubmit((message) => {
            this.handleLocalMessage(message);
        });
        
        this.chatInput.onTypingStart(() => {
            this.showTypingIndicator();
        });
        
        this.chatInput.onTypingStop(() => {
            this.hideTypingIndicator();
        });
    }
    
    private handleLocalMessage(message: string): void {
        // Check rate limit
        if (!this.checkRateLimit()) {
            // Show rate limit warning
            this.showSystemMessage("You're sending messages too quickly! Please wait a moment.");
            return;
        }
        
        // Send message to backend if connection exists
        if (this.dbConnection && this.dbConnection.reducers) {
            this.dbConnection.reducers.sendPlayerMessage(message);
        }
        
        // Check if it's a command
        if (message.startsWith('/')) {
            this.handleCommand(message);
            return;
        }
        
        // Enforce character limit (just in case)
        const maxLength = 100;
        const truncatedMessage = message.length > maxLength 
            ? message.substring(0, maxLength) + '...' 
            : message;
        
        // For regular messages, show the speech bubble above the local player
        const player = (this.scene as any).player;
        
        if (player) {
            this.showSpeechBubble(player, truncatedMessage);
        }
    }
    
    private checkRateLimit(): boolean {
        const now = Date.now();
        const RATE_LIMIT_WINDOW = 10000; // 10 seconds
        const MAX_MESSAGES = 5; // 5 messages per 10 seconds
        const MIN_MESSAGE_INTERVAL = 1000; // 1 second between messages
        
        // Check minimum interval between messages
        if (now - this.lastMessageTime < MIN_MESSAGE_INTERVAL) {
            return false;
        }
        
        // Reset counter if window has passed
        if (now > this.rateLimitResetTime) {
            this.messageCount = 0;
            this.rateLimitResetTime = now + RATE_LIMIT_WINDOW;
        }
        
        // Check if under the limit
        if (this.messageCount >= MAX_MESSAGES) {
            return false;
        }
        
        // Update counters
        this.messageCount++;
        this.lastMessageTime = now;
        return true;
    }
    
    private showSystemMessage(message: string): void {
        const player = (this.scene as any).player;
        if (player) {
            // Show system message with different styling
            const bubble = new SpeechBubble(this.scene, {
                x: player.x,
                y: player.y - 40,
                message: message,
                duration: 3000,
                maxWidth: 200,
                backgroundColor: 0xffcccc, // Light red for warnings
                textColor: '#990000' // Dark red text
            });
            
            // Don't track system messages in the regular bubble map
            bubble.setDepth(101); // Above regular bubbles
        }
    }
    
    private handleCommand(command: string): void {
        // Handle special multi-character emote commands first
        const commandWithoutSlash = command.slice(1);
        
        // Check for exact matches with special characters
        if (commandWithoutSlash === '!?') {
            this.playEmote('question_exclamation');
            return;
        }
        if (commandWithoutSlash === '??') {
            this.playEmote('question');
            return;
        }
        if (commandWithoutSlash === '!!') {
            this.playEmote('exclamation');
            return;
        }
        
        // For other commands, extract and process normally
        const parts = commandWithoutSlash.split(' ');
        const commandName = parts[0].toLowerCase();
        // const args = parts.slice(1); // Uncomment when adding commands that need arguments
        
        // Handle different commands
        switch (commandName) {
            case 'blush':
                this.playEmote('blush');
                break;
            case 'heart':
                this.playEmote('heart');
                break;
            case 'sad':
                this.playEmote('sad');
                break;
            case 'sparkle':
                this.playEmote('sparkle');
                break;
            case 'sweat':
                this.playEmote('sweat');
                break;
            case 'teardrop':
                this.playEmote('teardrop');
                break;
            case 'whistle':
                this.playEmote('whistle');
                break;
            case 'wow':
                this.playEmote('wow');
                break;
            case 'wtf':
                this.playEmote('wtf');
                break;
            case 'zzz':
                this.playEmote('zzz');
                break;
            default:
                // Unknown command - you could show an error message or just ignore
                console.log(`Unknown command: ${commandName}`);
                break;
        }
    }
    
    public showSpeechBubble(entity: any, message: string): void {
        // Remove existing bubble and update event for this entity if any
        if (this.speechBubbles.has(entity)) {
            const oldBubble = this.speechBubbles.get(entity);
            if (oldBubble) {
                oldBubble.destroy();
            }
            this.speechBubbles.delete(entity);
        }
        
        // Remove old update event if exists
        if (this.updateEvents.has(entity)) {
            const oldEvent = this.updateEvents.get(entity);
            if (oldEvent) {
                oldEvent.remove();
            }
            this.updateEvents.delete(entity);
        }
        
        // Hide typing indicator for this entity if it exists
        const typingKey = `${entity}_typing`;
        this.clearTypingIndicatorForPeer(typingKey);
        
        // Create new speech bubble above the entity
        // Adjust Y position based on entity height (assuming ~32 pixel tall character)
        const bubbleOffsetY = 40; // Distance above character's head
        const bubble = new SpeechBubble(this.scene, {
            x: entity.x,
            y: entity.y - bubbleOffsetY,
            message: message,
            duration: 5000,
            maxWidth: 200 // Cap the width for readability
        });
        
        this.speechBubbles.set(entity, bubble);
        
        // Update bubble position to follow entity
        const updateEvent = this.scene.time.addEvent({
            delay: 16, // ~60fps
            callback: () => {
                if (bubble && bubble.scene) {
                    bubble.updatePosition(entity.x, entity.y - bubbleOffsetY);
                } else {
                    updateEvent.remove();
                    this.speechBubbles.delete(entity);
                    this.updateEvents.delete(entity);
                }
            },
            loop: true
        });
        
        this.updateEvents.set(entity, updateEvent);
    }
    
    private showTypingIndicator(): void {
        const player = (this.scene as any).player;
        if (!player) return;
        
        // Remove existing speech bubble and emote
        this.clearBubblesForEntity(player);
        
        // Create typing indicator without bubble (just the animation)
        const indicatorOffsetY = 40;
        this.typingIndicator = new Emote(this.scene, {
            x: player.x,
            y: player.y - indicatorOffsetY,
            texture: 'typing_emote',
            scale: 0.15,
            duration: 999999, // Don't auto-destroy
            frameRate: 8 // Slower for typing animation
        });
        
        // Update position to follow player
        this.typingUpdateEvent = this.scene.time.addEvent({
            delay: 16,
            callback: () => {
                if (this.typingIndicator && this.typingIndicator.scene) {
                    this.typingIndicator.updatePosition(player.x, player.y - indicatorOffsetY);
                } else {
                    if (this.typingUpdateEvent) {
                        this.typingUpdateEvent.remove();
                        this.typingUpdateEvent = null;
                    }
                    this.typingIndicator = null;
                }
            },
            loop: true
        });
    }
    
    private hideTypingIndicator(): void {
        // Clear the typing indicator
        if (this.typingIndicator) {
            this.typingIndicator.destroy();
            this.typingIndicator = null;
        }
        
        if (this.typingUpdateEvent) {
            this.typingUpdateEvent.remove();
            this.typingUpdateEvent = null;
        }
    }
    
    private clearBubblesForEntity(entity: any): void {
        // Remove existing speech bubble
        if (this.speechBubbles.has(entity)) {
            const oldBubble = this.speechBubbles.get(entity);
            if (oldBubble) {
                oldBubble.destroy();
            }
            this.speechBubbles.delete(entity);
        }
        
        // Remove active emote
        if (this.activeEmotes.has(entity)) {
            const oldEmote = this.activeEmotes.get(entity);
            if (oldEmote && oldEmote.destroy) {
                oldEmote.destroy();
            }
            this.activeEmotes.delete(entity);
        }
        
        // Remove update events
        if (this.updateEvents.has(entity)) {
            const oldEvent = this.updateEvents.get(entity);
            if (oldEvent) {
                oldEvent.remove();
            }
            this.updateEvents.delete(entity);
        }
        
        if (this.emoteUpdateEvents.has(entity)) {
            const oldEvent = this.emoteUpdateEvents.get(entity);
            if (oldEvent) {
                oldEvent.remove();
            }
            this.emoteUpdateEvents.delete(entity);
        }
    }
    
    private playEmote(emoteName: string): void {
        const player = (this.scene as any).player;
        if (!player) return;
        
        // Clear any existing bubbles
        this.clearBubblesForEntity(player);
        
        // Map emote names to textures
        const emoteTextures: { [key: string]: string } = {
            'exclamation': 'exclamation_emote',
            'question_exclamation': 'question_exclamation_emote',
            'question': 'question_emote',
            'blush': 'blush_emote',
            'heart': 'heart_emote',
            'sad': 'sad_emote',
            'sparkle': 'sparkle_emote',
            'sweat': 'sweat_emote',
            'teardrop': 'teardrop_emote',
            'whistle': 'whistle_emote',
            'wow': 'wow_emote',
            'wtf': 'wtf_emote',
            'zzz': 'zzz_emote'
        };
        
        const texture = emoteTextures[emoteName];
        if (!texture) {
            console.log(`Unknown emote: ${emoteName}`);
            return;
        }
        
        // Create emote without bubble (just the animation)
        const emoteOffsetY = 40;
        const emote = new Emote(this.scene, {
            x: player.x,
            y: player.y - emoteOffsetY,
            texture: texture,
            scale: 0.2, // Slightly larger since no bubble
            duration: 2000,
            frameRate: 12
        });
        
        // Store in a temporary variable for the update event
        const emoteSprite = emote;
        
        // Update emote position to follow player
        const updateEvent = this.scene.time.addEvent({
            delay: 16, // ~60fps
            callback: () => {
                if (emoteSprite && emoteSprite.scene) {
                    emoteSprite.updatePosition(player.x, player.y - emoteOffsetY);
                } else {
                    updateEvent.remove();
                    this.emoteUpdateEvents.delete(player);
                }
            },
            loop: true
        });
        
        this.emoteUpdateEvents.set(player, updateEvent);
    }
    
    public showPeerCommand(peer: any, command: string): void {
        // Hide typing indicator for this peer if it exists
        const typingKey = `${peer}_typing`;
        this.clearTypingIndicatorForPeer(typingKey);
        
        // Handle special multi-character emote commands first
        const commandWithoutSlash = command.slice(1);
        let emoteName: string | null = null;
        
        // Check for exact matches with special characters
        if (commandWithoutSlash === '!?') {
            emoteName = 'question_exclamation';
        } else if (commandWithoutSlash === '??') {
            emoteName = 'question';
        } else if (commandWithoutSlash === '!!') {
            emoteName = 'exclamation';
        } else {
            // For other commands, extract normally
            const parts = commandWithoutSlash.split(' ');
            const commandName = parts[0].toLowerCase();
            
            // Map command names to emote names
            const commandToEmote: { [key: string]: string } = {
                'blush': 'blush',
                'heart': 'heart',
                'sad': 'sad',
                'sparkle': 'sparkle',
                'sweat': 'sweat',
                'teardrop': 'teardrop',
                'whistle': 'whistle',
                'wow': 'wow',
                'wtf': 'wtf',
                'zzz': 'zzz'
            };
            
            emoteName = commandToEmote[commandName] || null;
        }
        
        // If we found a valid emote, play it for the peer
        if (emoteName) {
            this.playEmoteForEntity(peer, emoteName);
        }
    }
    
    private playEmoteForEntity(entity: any, emoteName: string): void {
        // Clear any existing bubbles for this entity
        this.clearBubblesForEntity(entity);
        
        // Map emote names to textures
        const emoteTextures: { [key: string]: string } = {
            'exclamation': 'exclamation_emote',
            'question_exclamation': 'question_exclamation_emote',
            'question': 'question_emote',
            'blush': 'blush_emote',
            'heart': 'heart_emote',
            'sad': 'sad_emote',
            'sparkle': 'sparkle_emote',
            'sweat': 'sweat_emote',
            'teardrop': 'teardrop_emote',
            'whistle': 'whistle_emote',
            'wow': 'wow_emote',
            'wtf': 'wtf_emote',
            'zzz': 'zzz_emote'
        };
        
        const texture = emoteTextures[emoteName];
        if (!texture) {
            console.log(`Unknown emote: ${emoteName}`);
            return;
        }
        
        // Create emote without bubble (just the animation)
        const emoteOffsetY = 40;
        const emote = new Emote(this.scene, {
            x: entity.x,
            y: entity.y - emoteOffsetY,
            texture: texture,
            scale: 0.2,
            duration: 2000,
            frameRate: 12
        });
        
        // Store the active emote for this entity
        this.activeEmotes.set(entity, emote);
        
        // Store in a temporary variable for the update event
        const emoteSprite = emote;
        
        // Update emote position to follow entity
        const updateEvent = this.scene.time.addEvent({
            delay: 16, // ~60fps
            callback: () => {
                if (emoteSprite && emoteSprite.scene && entity && entity.x !== undefined) {
                    emoteSprite.updatePosition(entity.x, entity.y - emoteOffsetY);
                } else {
                    updateEvent.remove();
                    this.emoteUpdateEvents.delete(entity);
                    this.activeEmotes.delete(entity);
                }
            },
            loop: true
        });
        
        this.emoteUpdateEvents.set(entity, updateEvent);
    }
    
    public setDbConnection(connection: DbConnection): void {
        this.dbConnection = connection;
        // Pass connection to chat input for typing status
        this.chatInput.setDbConnection(connection);
    }
    
    public showPeerTyping(peer: any): void {
        // Check if there's any active speech bubble or emote for this peer
        let hasActiveBubbleOrEmote = false;
        
        // Check if peer has a speech bubble
        if (this.speechBubbles.has(peer)) {
            hasActiveBubbleOrEmote = true;
        }
        
        // Check if peer has an active emote
        if (this.activeEmotes.has(peer)) {
            hasActiveBubbleOrEmote = true;
        }
        
        if (hasActiveBubbleOrEmote) {
            // Don't show typing indicator if there's an active speech bubble or emote
            return;
        }
        
        // Use a special key for typing indicators
        const typingKey = `${peer}_typing`;
        
        // Remove any existing typing indicator for this peer
        this.clearTypingIndicatorForPeer(typingKey);
        
        // Show typing indicator without bubble
        const indicatorOffsetY = 40;
        const typingIndicator = new Emote(this.scene, {
            x: peer.x,
            y: peer.y - indicatorOffsetY,
            texture: 'typing_emote',
            scale: 0.15,
            duration: 999999, // Don't auto-destroy
            frameRate: 8
        });
        
        // Store the typing indicator
        this.peerTypingIndicators.set(typingKey, typingIndicator);
        
        // Update position to follow peer
        const updateEvent = this.scene.time.addEvent({
            delay: 16,
            callback: () => {
                if (typingIndicator && typingIndicator.scene && peer && peer.x !== undefined) {
                    typingIndicator.updatePosition(peer.x, peer.y - indicatorOffsetY);
                } else {
                    updateEvent.remove();
                    this.updateEvents.delete(typingKey);
                    this.peerTypingIndicators.delete(typingKey);
                }
            },
            loop: true
        });
        
        this.updateEvents.set(typingKey, updateEvent);
    }
    
    public hidePeerTyping(peer: any): void {
        const typingKey = `${peer}_typing`;
        this.clearTypingIndicatorForPeer(typingKey);
    }
    
    private clearTypingIndicatorForPeer(typingKey: any): void {
        // Remove typing indicator emote
        const typingIndicator = this.peerTypingIndicators.get(typingKey);
        if (typingIndicator && typingIndicator.destroy) {
            typingIndicator.destroy();
        }
        this.peerTypingIndicators.delete(typingKey);
        
        // Remove update event
        const updateEvent = this.updateEvents.get(typingKey);
        if (updateEvent) {
            updateEvent.remove();
        }
        this.updateEvents.delete(typingKey);
    }
    
    public clearAllForEntity(entity: any): void {
        // Clear speech bubbles
        const bubble = this.speechBubbles.get(entity);
        if (bubble) {
            bubble.destroy();
            this.speechBubbles.delete(entity);
        }
        
        // Clear update events
        const updateEvent = this.updateEvents.get(entity);
        if (updateEvent) {
            updateEvent.remove();
            this.updateEvents.delete(entity);
        }
        
        // Clear emote update events
        const emoteEvent = this.emoteUpdateEvents.get(entity);
        if (emoteEvent) {
            emoteEvent.remove();
            this.emoteUpdateEvents.delete(entity);
        }
        
        // Clear typing indicator
        const typingKey = `${entity}_typing`;
        this.clearTypingIndicatorForPeer(typingKey);
        
        // Clear any other entity-specific UI elements
        this.clearBubblesForEntity(entity);
    }
    
    public destroy(): void {
        this.chatInput.destroy();
        
        // Clean up all speech bubbles
        this.speechBubbles.forEach(bubble => bubble.destroy());
        this.speechBubbles.clear();
        
        // Clean up all update events
        this.updateEvents.forEach(event => event.remove());
        this.updateEvents.clear();
        
        
        // Clean up all emote update events
        this.emoteUpdateEvents.forEach(event => event.remove());
        this.emoteUpdateEvents.clear();
        
        // Clean up all peer typing indicators
        this.peerTypingIndicators.forEach(indicator => indicator.destroy());
        this.peerTypingIndicators.clear();
        
        // Clean up all active emotes
        this.activeEmotes.forEach(emote => emote.destroy());
        this.activeEmotes.clear();
    }
}