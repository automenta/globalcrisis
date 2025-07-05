import { BaseEntity } from './BaseEntity';
import type { GameState, EntityLocation, MetamodelType } from '../GameEngine';

export interface IMediaOutletEntityOptions {
  reach: number; // 0-1, effectiveness of spreading information
  bias: 'pro-consortium' | 'anti-consortium' | 'neutral'; // How it leans
  credibility: number; // 0-1, how much its reports are believed
}

export class MediaOutletEntity extends BaseEntity {
  public reach: number;
  public bias: 'pro-consortium' | 'anti-consortium' | 'neutral';
  public credibility: number;

  constructor(
    id: string,
    name: string,
    initialLocation: EntityLocation, // Should be a specific HexTile
    options: IMediaOutletEntityOptions,
    factionId?: string // Could be neutral or aligned
  ) {
    super(id, 'media_outlet' as MetamodelType, initialLocation, name, factionId, 'A media organization.');
    this.reach = options.reach;
    this.bias = options.bias;
    this.credibility = options.credibility ?? 0.7; // Default credibility

    if (initialLocation.type !== 'HexTile') {
        console.warn(`MediaOutletEntity ${id} created with non-HexTile location type: ${initialLocation.type}. This is usually unexpected.`);
    }
  }

  update(gameState: Readonly<GameState>, deltaTime: number): void {
    // Media outlets are mostly static but can have ongoing effects or be targets of actions.
    // Example: Periodically try to publish news based on bias and events.
    // This would likely trigger phenomena or modify global/regional suspicion/trust.
    // console.log(`Media Outlet ${this.name} at ${this.location.hexCellId} updating.`);

    // Placeholder: If credibility is very low, it might slowly recover or further degrade.
    if (this.credibility < 0.2) {
        this.credibility = Math.min(1, this.credibility + 0.001 * deltaTime * gameState.speed);
    }
  }

  spreadPropaganda(messageType: 'pro' | 'anti', targetScope: 'region' | 'global', regionId?: string): void {
    console.log(`Media Outlet ${this.name} spreading ${messageType} propaganda with scope ${targetScope}.`);
    // This would create an IAction and dispatch it via gameEngine.dispatchAction()
    // The action's effect would depend on this.reach, this.credibility, and this.bias.
  }

  publishLeak(leakStrength: number): void {
    console.log(`Media Outlet ${this.name} publishing a leak with strength ${leakStrength}.`);
    // Similar to propaganda, this would be an action leading to suspicion increase.
  }
}
