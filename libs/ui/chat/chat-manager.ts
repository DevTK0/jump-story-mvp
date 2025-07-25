import Phaser from "phaser";
import { ChatInput } from "./chat-input";
import { SpeechBubble } from "./speech-bubble";

export class ChatManager {
    private scene: Phaser.Scene;
    private chatInput: ChatInput;
    private speechBubbles: Map<any, SpeechBubble> = new Map();
    private updateEvents: Map<any, Phaser.Time.TimerEvent> = new Map();
    private lastMessageTime: number = 0;
    private messageCount: number = 0;
    private rateLimitResetTime: number = 0;
    
    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.chatInput = new ChatInput(scene);
        
        // Set up chat input callback
        this.chatInput.onSubmit((message) => {
            this.handleLocalMessage(message);
        });
    }
    
    private handleLocalMessage(message: string): void {
        // Check rate limit
        if (!this.checkRateLimit()) {
            // Show rate limit warning
            this.showSystemMessage("You're sending messages too quickly! Please wait a moment.");
            return;
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
        // Extract command and arguments
        const parts = command.slice(1).split(' ');
        const commandName = parts[0].toLowerCase();
        // const args = parts.slice(1); // Uncomment when adding commands that need arguments
        
        // Handle different commands
        switch (commandName) {
            // Add emote commands here in the future
            // case 'wave':
            //     this.playEmote('wave');
            //     break;
            // case 'dance':
            //     this.playEmote('dance');
            //     break;
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
    
    public destroy(): void {
        this.chatInput.destroy();
        
        // Clean up all speech bubbles
        this.speechBubbles.forEach(bubble => bubble.destroy());
        this.speechBubbles.clear();
        
        // Clean up all update events
        this.updateEvents.forEach(event => event.remove());
        this.updateEvents.clear();
    }
}