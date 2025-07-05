import { BaseEntity } from './BaseEntity';
import type { GameState, EntityLocation, MetamodelType } from '../GameEngine';

export interface IDroneEntityOptions {
  capacity?: number; // e.g., mRNA doses, surveillance equipment units
  currentPayload?: any[]; // What the drone is carrying
  operationalRange?: number; // In hex tiles or km
}

export class DroneEntity extends BaseEntity {
  public capacity: number;
  public currentPayload: any[];
  public operationalRange: number;
  public currentTargetHexId?: string; // For movement

  constructor(
    id: string,
    name: string,
    initialLocation: EntityLocation,
    options: IDroneEntityOptions,
    factionId?: string
  ) {
    super(id, 'drone' as MetamodelType, initialLocation, name, factionId, 'An unmanned aerial or ground vehicle.');
    this.capacity = options.capacity ?? 10; // Default capacity
    this.currentPayload = options.currentPayload ?? [];
    this.operationalRange = options.operationalRange ?? 10; // Default range in hex tiles
  }

  update(gameState: Readonly<GameState>, deltaTime: number): void {
    // TODO: Implement drone-specific update logic
    // - Movement towards currentTargetHexId
    // - Payload delivery logic
    // - Surveillance actions
    // console.log(`Drone ${this.name} at ${this.location.hexCellId} updating.`);

    if (this.currentTargetHexId && this.currentTargetHexId !== this.location.hexCellId) {
      // Placeholder for movement logic
      // console.log(`Drone ${this.name} moving towards ${this.currentTargetHexId}`);
    }
  }

  deliverPayload(targetHexId: string): boolean {
    if (this.currentPayload.length > 0) {
      console.log(`Drone ${this.name} delivering payload to ${targetHexId}.`);
      // Actual payload effect would be an Action dispatched to the GameEngine
      this.currentPayload.pop(); // Example: deliver one unit
      return true;
    }
    return false;
  }

  startScouting(targetHexId: string): void {
    this.currentTargetHexId = targetHexId;
    console.log(`Drone ${this.name} starts scouting towards ${targetHexId}.`);
  }
}
