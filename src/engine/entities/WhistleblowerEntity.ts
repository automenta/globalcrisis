import { BaseEntity } from './BaseEntity';
import type { GameState, EntityLocation, MetamodelType } from '../GameEngine';

export interface IWhistleblowerEntityOptions {
  credibility: number; // 0-1
  exposureRisk: number; // 0-1, chance of being caught/neutralized
  informationValue: number; // Arbitrary units, how impactful their leak is
}

export class WhistleblowerEntity extends BaseEntity {
  public credibility: number;
  public exposureRisk: number;
  public informationValue: number;
  public currentTargetMediaOutletId?: string; // If moving towards a media outlet

  constructor(
    id: string,
    name: string, // Could be anonymous like "WB-1042"
    initialLocation: EntityLocation, // Usually a specific HexTile where they spawn
    options: IWhistleblowerEntityOptions,
    factionId?: string // Typically 'rogue' or unaligned from player consortium
  ) {
    super(id, 'whistleblower' as MetamodelType, initialLocation, name, factionId ?? 'rogue', 'An individual attempting to expose covert activities.');
    this.credibility = options.credibility;
    this.exposureRisk = options.exposureRisk;
    this.informationValue = options.informationValue;
  }

  update(gameState: Readonly<GameState>, deltaTime: number): void {
    // Whistleblowers attempt to move to media-rich tiles or specific media outlets
    // and then attempt to leak information.
    // console.log(`Whistleblower ${this.name} at ${this.location.hexCellId} updating.`);

    // Placeholder: Increase exposure risk over time or per action
    this.exposureRisk = Math.min(1, this.exposureRisk + 0.001 * deltaTime * gameState.speed);

    if (!this.currentTargetMediaOutletId) {
      // TODO: Implement logic to find a suitable media outlet to move towards.
      // This could involve scanning nearby hex tiles for MediaOutletEntity.
    } else {
      // TODO: Implement movement towards currentTargetMediaOutletId.
      // If arrived, attempt to leak.
    }
  }

  attemptLeak(mediaOutlet: BaseEntity /* specifically MediaOutletEntity */): void {
    console.log(`Whistleblower ${this.name} attempting to leak info (value: ${this.informationValue}) to ${mediaOutlet.name}.`);
    // This would create an IAction.
    // Success depends on whistleblower's credibility, media outlet's bias/credibility, and exposure risk.
    // If successful, triggers a "WhistleblowerLeak" phenomenon.
    // If caught, this entity might be removed or its state changed.
  }

  // Called if the player successfully deploys a counter-op against this whistleblower
  neutralize(): void {
    console.log(`Whistleblower ${this.name} has been neutralized.`);
    // This entity should be removed from the game or marked as inactive.
    // gameEngine.entityManager.removeEntity(this.id);
  }
}
