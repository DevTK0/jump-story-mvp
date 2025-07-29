import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { DbConnection } from '@/spacetime/client';
import { UIContextService } from '../services/ui-context-service';

export class NameChangeDialog {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Rectangle;
  private logger: ModuleLogger = createLogger('NameChangeDialog');
  
  private isVisible: boolean = false;
  private _dbConnection: DbConnection | null = null;
  private inputElement: HTMLInputElement | null = null;
  private errorText: Phaser.GameObjects.Text | null = null;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Get data from context service
    const context = UIContextService.getInstance();
    this._dbConnection = context.getDbConnection();
    
    this.createUI();
    this.hide(); // Start hidden
    
    // Setup escape key to close
    this.scene.input.keyboard?.on('keydown-ESC', () => {
      if (this.isVisible) {
        this.hide();
      }
    });
  }
  
  private createUI(): void {
    // Create main container
    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(2000); // High depth to appear above everything
    
    const camera = this.scene.cameras.main;
    const centerX = camera.width / 2;
    const centerY = camera.height / 2;
    
    // Create semi-transparent background overlay
    const overlay = this.scene.add.rectangle(
      centerX,
      centerY,
      camera.width,
      camera.height,
      0x000000,
      0.7
    );
    overlay.setInteractive(); // Block clicks from going through
    
    // Create menu background
    const menuWidth = 400;
    const menuHeight = 250;
    this.background = this.scene.add.rectangle(centerX, centerY, menuWidth, menuHeight, 0x2a2a2a);
    this.background.setStrokeStyle(2, 0x4a4a4a);
    
    // Create title
    const title = this.scene.add.text(centerX, centerY - menuHeight / 2 + 40, 'Choose Your Name', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0.5);
    
    // Create instruction text
    const instruction = this.scene.add.text(centerX, centerY - 30, 'Enter a name (1-20 characters):', {
      fontSize: '16px',
      color: '#cccccc',
    });
    instruction.setOrigin(0.5, 0.5);
    
    // Create close button
    const closeButton = this.scene.add.text(
      centerX + menuWidth / 2 - 20,
      centerY - menuHeight / 2 + 20,
      'X',
      {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      }
    );
    closeButton.setOrigin(0.5, 0.5);
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on('pointerover', () => closeButton.setColor('#ff6666'));
    closeButton.on('pointerout', () => closeButton.setColor('#ffffff'));
    closeButton.on('pointerdown', () => this.hide());
    
    // Create submit button
    const submitButton = this.scene.add.rectangle(centerX, centerY + 60, 120, 40, 0x4a4a4a);
    submitButton.setInteractive({ useHandCursor: true });
    submitButton.setStrokeStyle(2, 0x6a6a6a);
    
    const submitText = this.scene.add.text(centerX, centerY + 60, 'Submit', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    submitText.setOrigin(0.5, 0.5);
    
    // Hover effects for submit button
    submitButton.on('pointerover', () => {
      submitButton.setFillStyle(0x5a5a5a);
    });
    submitButton.on('pointerout', () => {
      submitButton.setFillStyle(0x4a4a4a);
    });
    submitButton.on('pointerdown', () => {
      this.submitName();
    });
    
    // Create error text (hidden by default)
    this.errorText = this.scene.add.text(centerX, centerY + 100, '', {
      fontSize: '14px',
      color: '#ff6666',
    });
    this.errorText.setOrigin(0.5, 0.5);
    this.errorText.setVisible(false);
    
    // Add all to container
    this.container.add([
      overlay, 
      this.background, 
      title, 
      instruction,
      closeButton,
      submitButton,
      submitText,
      this.errorText
    ]);
  }
  
  public show(): void {
    this.container.setVisible(true);
    this.isVisible = true;
    
    // Create HTML input element
    this.createInputElement();
    
    // Focus on the input
    setTimeout(() => {
      this.inputElement?.focus();
    }, 100);
  }
  
  private createInputElement(): void {
    if (this.inputElement) {
      this.inputElement.remove();
    }
    
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    this.inputElement.style.position = 'absolute';
    
    // Position the input in the center of the dialog
    const camera = this.scene.cameras.main;
    const centerX = camera.width / 2;
    const centerY = camera.height / 2;
    
    this.inputElement.style.left = '50%';
    this.inputElement.style.top = `${centerY}px`;
    this.inputElement.style.transform = 'translate(-50%, -50%)';
    this.inputElement.style.width = '300px';
    this.inputElement.style.padding = '10px';
    this.inputElement.style.fontSize = '18px';
    this.inputElement.style.fontFamily = '"Arial Rounded MT Bold", "Trebuchet MS", "Verdana", sans-serif';
    this.inputElement.style.border = '2px solid #4a4a4a';
    this.inputElement.style.borderRadius = '5px';
    this.inputElement.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    this.inputElement.style.textAlign = 'center';
    this.inputElement.style.zIndex = '2001';
    this.inputElement.placeholder = 'Enter your name...';
    this.inputElement.maxLength = 20;
    
    document.body.appendChild(this.inputElement);
    
    // Handle enter key
    this.inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitName();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      }
      e.stopPropagation();
    });
    
    // Prevent game from receiving input
    this.inputElement.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });
    
    // Disable game keyboard input
    if (this.scene.input.keyboard) {
      this.scene.input.keyboard.enabled = false;
    }
  }
  
  private submitName(): void {
    if (!this.inputElement) return;
    
    const newName = this.inputElement.value.trim();
    
    // Validate name
    if (!newName) {
      this.showError('Name cannot be empty');
      return;
    }
    
    if (newName.length > 20) {
      this.showError('Name must be 20 characters or less');
      return;
    }
    
    // Check if name contains invalid characters
    const sanitizedName = newName.replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, ' ');
    if (sanitizedName !== newName) {
      this.showError('Name contains invalid characters');
      return;
    }
    
    // Get current name and check connection
    if (this._dbConnection) {
      const myIdentity = UIContextService.getInstance().getPlayerIdentity();
      if (!myIdentity) {
        this.showError('Connection error. Please try again.');
        return;
      }
      
      // Get current player name
      let currentName = '';
      for (const player of this._dbConnection.db.player.iter()) {
        if (player.identity.toHexString() === myIdentity.toHexString()) {
          currentName = player.name;
          break;
        }
      }
      
      // Check if trying to set the same name
      if (currentName === newName) {
        this.hide(); // Just close if it's the same name
        return;
      }
      
      // Disable submit button to prevent multiple submissions
      const submitButton = this.container.list.find(obj => 
        obj instanceof Phaser.GameObjects.Rectangle && 
        obj.y === this.scene.cameras.main.height / 2 + 60
      ) as Phaser.GameObjects.Rectangle;
      
      if (submitButton) {
        submitButton.disableInteractive();
        submitButton.setFillStyle(0x3a3a3a);
      }
      
      // Submit the name change
      this._dbConnection.reducers.setName(newName);
      this.logger.info(`Submitted name change request: ${newName}`);
      
      // Wait for the server to process and check if the name changed
      setTimeout(() => {
        let nameChanged = false;
        
        if (myIdentity && this._dbConnection) {
          for (const player of this._dbConnection.db.player.iter()) {
            if (player.identity.toHexString() === myIdentity.toHexString()) {
              if (player.name === newName) {
                nameChanged = true;
              }
              break;
            }
          }
        }
        
        if (nameChanged) {
          this.logger.info(`Name successfully changed to: ${newName}`);
          this.hide();
        } else {
          this.showError('Name already taken or invalid');
          // Re-enable submit button
          if (submitButton) {
            submitButton.setInteractive({ useHandCursor: true });
            submitButton.setFillStyle(0x4a4a4a);
          }
        }
      }, 1000); // Wait 1 second for server processing
    } else {
      this.showError('Connection error. Please try again.');
    }
  }
  
  private showError(message: string): void {
    if (this.errorText) {
      this.errorText.setText(message);
      this.errorText.setVisible(true);
      
      // Hide error after 3 seconds
      this.scene.time.delayedCall(3000, () => {
        if (this.errorText) {
          this.errorText.setVisible(false);
        }
      });
    }
  }
  
  public hide(): void {
    this.container.setVisible(false);
    this.isVisible = false;
    
    // Remove input element
    if (this.inputElement) {
      this.inputElement.remove();
      this.inputElement = null;
    }
    
    // Re-enable game keyboard input
    if (this.scene.input.keyboard) {
      this.scene.input.keyboard.enabled = true;
    }
    
    // Hide error text
    if (this.errorText) {
      this.errorText.setVisible(false);
    }
  }
  
  public destroy(): void {
    this.hide();
    this.container.destroy();
  }
}