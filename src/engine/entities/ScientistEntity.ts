import { BaseEntity } from './BaseEntity';
import type { GameState, EntityLocation, MetamodelType } from '../GameEngine';

export interface IScientistEntityOptions {
  expertise: number; // 0-1
  allegiance: 'consortium' | 'rogue'; // Or link to FactionId
}

export class ScientistEntity extends BaseEntity {
  public expertise: number;
  public allegiance: 'consortium' | 'rogue';

  constructor(
    id: string,
    name: string,
    initialLocation: EntityLocation,
    options: IScientistEntityOptions,
    factionId?: string
  ) {
    super(id, 'scientist' as MetamodelType, initialLocation, name, factionId, 'A research scientist.');
    this.expertise = options.expertise;
    this.allegiance = options.allegiance;
  }

  update(gameState: Readonly<GameState>, deltaTime: number): void {
    // TODO: Implement scientist-specific update logic
    // - Movement if path is set
    // - Autonomous behavior (e.g., if rogue, try to leak info)
    // console.log(`Scientist ${this.name} at ${this.location.hexCellId} updating.`);

    // Example: If a scientist is rogue and has high expertise, they might try to move or act.
    if (this.allegiance === 'rogue' && this.expertise > 0.7) {
      // Placeholder for rogue scientist behavior
    }
  }

  // Example of a scientist-specific action method (could also be handled by ActionManager)
  deployExperiment(targetHexId: string, parameters: any): void {
    console.log(`Scientist ${this.name} deploying experiment at ${targetHexId} with params:`, parameters);
    // This would typically create an IAction and dispatch it via gameEngine.dispatchAction()
  }
}
