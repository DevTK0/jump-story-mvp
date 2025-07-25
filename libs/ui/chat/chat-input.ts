import Phaser from "phaser";
import { DbConnection } from "@/spacetime/client";

export class ChatInput {
    private scene: Phaser.Scene;
    private isTyping: boolean = false;
    private inputElement: HTMLInputElement | null = null;
    private onSubmitCallback: ((message: string) => void) | null = null;
    private onTypingStartCallback: (() => void) | null = null;
    private onTypingStopCallback: (() => void) | null = null;
    private originalKeyboardEnabled: boolean = true;
    private messageHistory: string[] = [];
    private historyIndex: number = -1;
    private currentInput: string = '';
    private dbConnection: DbConnection | null = null;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.setupKeyboardListener();
    }

    private setupKeyboardListener(): void {
        this.scene.input.keyboard?.on('keydown-ENTER', () => {
            if (!this.isTyping) {
                this.showInput();
            }
        });
    }

    private showInput(): void {
        this.isTyping = true;
        
        // Update typing status in database
        if (this.dbConnection && this.dbConnection.reducers) {
            this.dbConnection.reducers.updatePlayerTyping(true);
        }
        
        // Notify typing started
        if (this.onTypingStartCallback) {
            this.onTypingStartCallback();
        }
        
        // Create HTML input element
        this.inputElement = document.createElement('input');
        this.inputElement.type = 'text';
        this.inputElement.style.position = 'absolute';
        this.inputElement.style.bottom = '20px';
        this.inputElement.style.left = '50%';
        this.inputElement.style.transform = 'translateX(-50%)';
        this.inputElement.style.width = '400px';
        this.inputElement.style.padding = '10px';
        this.inputElement.style.fontSize = '16px';
        this.inputElement.style.fontFamily = '"Arial Rounded MT Bold", "Trebuchet MS", "Verdana", sans-serif';
        this.inputElement.style.border = '2px solid #333';
        this.inputElement.style.borderRadius = '5px';
        this.inputElement.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        this.inputElement.style.zIndex = '1000';
        this.inputElement.placeholder = 'Type your message...';
        this.inputElement.maxLength = 100; // Character limit
        
        document.body.appendChild(this.inputElement);
        this.inputElement.focus();
        
        // Reset history navigation
        this.historyIndex = -1;
        this.currentInput = '';
        
        // Handle input submission and history navigation
        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.submitMessage();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.hideInput();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(1);  // Go back in history (older messages)
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(-1); // Go forward in history (newer messages)
            }
            // Stop propagation for all keys to prevent game from receiving them
            e.stopPropagation();
        });
        
        // Track current input for history navigation
        this.inputElement.addEventListener('input', () => {
            if (this.historyIndex === -1 && this.inputElement) {
                this.currentInput = this.inputElement.value;
            }
        });
        
        // Also handle keyup to prevent game from receiving key releases
        this.inputElement.addEventListener('keyup', (e) => {
            e.stopPropagation();
        });
        
        // Disable all game input
        this.disableGameInput();
    }
    
    private disableGameInput(): void {
        // Save current keyboard state
        if (this.scene.input.keyboard) {
            this.originalKeyboardEnabled = this.scene.input.keyboard.enabled;
            this.scene.input.keyboard.enabled = false;
            
            // Disable all keyboard plugins
            this.scene.input.keyboard.disableGlobalCapture();
            
            // Clear all key states to prevent stuck keys
            this.scene.input.keyboard.clearCaptures();
            
            // Reset all keys to ensure they're not stuck in "down" state
            if (this.scene.input.keyboard.keys) {
                Object.values(this.scene.input.keyboard.keys).forEach((key: any) => {
                    if (key && key.isDown) {
                        key.isDown = false;
                        key.isUp = true;
                    }
                });
            }
        }
        
        // Disable player input if player exists
        const player = (this.scene as any).player;
        if (player) {
            // Set a flag on the player to indicate chat is active
            player.chatActive = true;
            
            // Clear cursor states
            const cursors = player.getCursors();
            if (cursors) {
                Object.values(cursors).forEach((cursor: any) => {
                    if (cursor && cursor.isDown) {
                        cursor.isDown = false;
                        cursor.isUp = true;
                    }
                });
            }
        }
    }

    private submitMessage(): void {
        if (this.inputElement) {
            const message = this.inputElement.value.trim();
            
            // If empty, just close the chat
            if (!message) {
                this.hideInput();
                return;
            }
            
            // Add to history (avoid duplicates of the most recent message)
            if (this.messageHistory.length === 0 || this.messageHistory[0] !== message) {
                this.messageHistory.unshift(message);
                // Keep only last 20 messages
                if (this.messageHistory.length > 20) {
                    this.messageHistory.pop();
                }
            }
            
            // Call the callback if set
            if (this.onSubmitCallback) {
                this.onSubmitCallback(message);
            }
            
            this.hideInput();
        }
    }
    
    private navigateHistory(direction: number): void {
        if (!this.inputElement || this.messageHistory.length === 0) return;
        
        // Calculate new index
        const newIndex = this.historyIndex + direction;
        
        // Check bounds
        if (newIndex < -1 || newIndex >= this.messageHistory.length) return;
        
        // Update index and input value
        this.historyIndex = newIndex;
        
        if (this.historyIndex === -1) {
            // Back to current input
            this.inputElement.value = this.currentInput;
        } else {
            // Show history message
            this.inputElement.value = this.messageHistory[this.historyIndex];
        }
        
        // Move cursor to end
        this.inputElement.setSelectionRange(this.inputElement.value.length, this.inputElement.value.length);
    }

    private hideInput(): void {
        if (this.inputElement) {
            this.inputElement.remove();
            this.inputElement = null;
        }
        
        this.isTyping = false;
        
        // Update typing status in database
        if (this.dbConnection && this.dbConnection.reducers) {
            this.dbConnection.reducers.updatePlayerTyping(false);
        }
        
        // Notify typing stopped
        if (this.onTypingStopCallback) {
            this.onTypingStopCallback();
        }
        
        // Re-enable game input
        this.restoreGameInput();
    }
    
    private restoreGameInput(): void {
        // Restore keyboard input
        if (this.scene.input.keyboard) {
            this.scene.input.keyboard.enabled = this.originalKeyboardEnabled;
            this.scene.input.keyboard.enableGlobalCapture();
        }
        
        // Re-enable player input
        const player = (this.scene as any).player;
        if (player) {
            player.chatActive = false;
        }
    }

    public onSubmit(callback: (message: string) => void): void {
        this.onSubmitCallback = callback;
    }
    
    public onTypingStart(callback: () => void): void {
        this.onTypingStartCallback = callback;
    }
    
    public onTypingStop(callback: () => void): void {
        this.onTypingStopCallback = callback;
    }

    public setDbConnection(connection: DbConnection): void {
        this.dbConnection = connection;
    }

    public destroy(): void {
        this.hideInput();
        this.scene.input.keyboard?.off('keydown-ENTER');
    }
}