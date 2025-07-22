import Phaser from "phaser";
import { Peer } from "./peer";
import type { Player as PlayerData, EventContext } from "../../module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";

export class PeerManager {
    private scene: Phaser.Scene;
    private peers: Map<string, Peer> = new Map();
    private localPlayerIdentity: Identity | null = null;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public setLocalPlayerIdentity(identity: Identity): void {
        this.localPlayerIdentity = identity;
    }

    public onPlayerInsert = (ctx: EventContext, playerData: PlayerData): void => {
        // Don't create peer for local player
        if (this.localPlayerIdentity && playerData.identity.isEqual(this.localPlayerIdentity)) {
            return;
        }

        const identityString = playerData.identity.toHexString();
        
        // Don't create duplicate peers
        if (this.peers.has(identityString)) {
            return;
        }

        // Create new peer
        const peer = new Peer({ scene: this.scene, playerData });
        this.peers.set(identityString, peer);
        
        console.log(`Created peer for player: ${playerData.name} (${identityString})`);
    };

    public onPlayerUpdate = (ctx: EventContext, oldPlayerData: PlayerData, newPlayerData: PlayerData): void => {
        // Don't update local player
        if (this.localPlayerIdentity && newPlayerData.identity.isEqual(this.localPlayerIdentity)) {
            return;
        }

        const identityString = newPlayerData.identity.toHexString();
        const peer = this.peers.get(identityString);
        
        if (peer) {
            peer.updateFromData(newPlayerData);
        }
    };

    public onPlayerDelete = (ctx: EventContext, playerData: PlayerData): void => {
        const identityString = playerData.identity.toHexString();
        const peer = this.peers.get(identityString);
        
        if (peer) {
            peer.destroy();
            this.peers.delete(identityString);
            console.log(`Removed peer for player: ${playerData.name} (${identityString})`);
        }
    };

    public getPeerCount(): number {
        return this.peers.size;
    }

    public getAllPeers(): Peer[] {
        return Array.from(this.peers.values());
    }
    
    public update(): void {
        // Update all peers for smooth interpolation
        for (const peer of this.peers.values()) {
            peer.update();
        }
    }

    public cleanup(): void {
        // Clean up all peers
        for (const peer of this.peers.values()) {
            peer.destroy();
        }
        this.peers.clear();
    }

    public destroy(): void {
        this.cleanup();
    }
}