import { BaseComponent, IComponent } from './BaseComponent';
import type { GameState, Resource } from '../GameEngine'; // Assuming Resource is in GameEngine for now

export interface IResourceStorageComponent extends IComponent {
  resources: Map<string, number>; // resourceId to quantity
  getCapacity?(resourceId: string): number | undefined; // Optional: if there are limits
  hasResource(resourceId: string, amount: number): boolean;
  addResource(resourceId: string, amount: number): boolean;
  removeResource(resourceId: string, amount: number): boolean;
  getResourceAmount(resourceId: string): number;
}

export class ResourceStorageComponent extends BaseComponent implements IResourceStorageComponent {
  public readonly type = 'ResourceStorageComponent';
  public resources: Map<string, number>;
  // Optional: Define capacities, e.g., per resource type or total volume/weight
  // public capacities: Map<string, number>;

  constructor(initialResources?: Map<string, number>) {
    super();
    this.resources = initialResources || new Map<string, number>();
    // this.capacities = new Map<string, number>();
  }

  public hasResource(resourceId: string, amount: number): boolean {
    if (amount <= 0) return true; // Technically asking for zero or negative is always possible
    return (this.resources.get(resourceId) || 0) >= amount;
  }

  public addResource(resourceId: string, amount: number): boolean {
    if (amount <= 0) return false; // Cannot add zero or negative

    // Optional: Check against capacity if implemented
    // const currentAmount = this.resources.get(resourceId) || 0;
    // const capacity = this.getCapacity(resourceId);
    // if (capacity !== undefined && currentAmount + amount > capacity) {
    //   console.warn(`Entity ${this.entityId}: Cannot add ${amount} of ${resourceId}, exceeds capacity.`);
    //   return false;
    // }

    this.resources.set(resourceId, (this.resources.get(resourceId) || 0) + amount);
    // console.log(`Entity ${this.entityId}: Added ${amount} of ${resourceId}. Total: ${this.resources.get(resourceId)}`);
    return true;
  }

  public removeResource(resourceId: string, amount: number): boolean {
    if (amount <= 0) return false; // Cannot remove zero or negative
    if (!this.hasResource(resourceId, amount)) {
    //   console.warn(`Entity ${this.entityId}: Not enough ${resourceId} to remove ${amount}. Has: ${this.getResourceAmount(resourceId)}`);
      return false;
    }
    this.resources.set(resourceId, (this.resources.get(resourceId) || 0) - amount);
    // console.log(`Entity ${this.entityId}: Removed ${amount} of ${resourceId}. Remaining: ${this.resources.get(resourceId)}`);
    return true;
  }

  public getResourceAmount(resourceId: string): number {
    return this.resources.get(resourceId) || 0;
  }

  // public getCapacity(resourceId: string): number | undefined {
  //   return this.capacities.get(resourceId);
  // }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public update(gameState: GameState, deltaTime: number): void {
    // Resource storage typically doesn't update on its own per frame
    // unless there's decay or other passive logic.
  }
}
