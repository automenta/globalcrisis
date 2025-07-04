import { BaseComponent, IComponent } from './BaseComponent';
import type { GameState, ProductionRecipe, Resource } from '../GameEngine';
import type { IResourceStorageComponent } from './ResourceStorageComponent';

export interface IProductionFacilityComponent extends IComponent {
  recipeId?: string;
  productionProgress: number;
  isActive: boolean;
  setRecipe(recipeId: string | undefined): void;
  toggleActive(active?: boolean): void;
  getEfficiency(): number; // Placeholder for future factors like tech, morale, pollution
}

export class ProductionFacilityComponent extends BaseComponent implements IProductionFacilityComponent {
  public readonly type = 'ProductionFacilityComponent';
  public recipeId?: string;
  public productionProgress: number;
  public isActive: boolean;
  private currentRecipe?: ProductionRecipe;
  private efficiency: number; // Base efficiency 0.0 to 1.0+

  constructor(recipeId?: string, isActive: boolean = true, efficiency: number = 1.0) {
    super();
    this.productionProgress = 0;
    this.isActive = isActive;
    this.efficiency = efficiency;
    // Note: The actual recipe object is fetched from GameState in the update or setRecipe
    // to avoid stale data if recipes are dynamic.
    if (recipeId) {
        this.setRecipe(recipeId); // Initial recipe set (will be validated in setRecipe)
    }
  }

  public init() {
    // If a recipeId was provided at construction, try to load it.
    // This requires gameState to be available, which it isn't in the constructor.
    // This is a bit tricky. For now, setRecipe should be called after entity is in manager.
    // Or, GameState needs to be passed to constructor, or recipe object itself.
    // Let's assume recipe is loaded in first update or when setRecipe is explicitly called.
  }


  public setRecipe(recipeId: string | undefined, gameState?: GameState): void {
    this.recipeId = recipeId;
    this.productionProgress = 0; // Reset progress when recipe changes
    if (recipeId && gameState) { // gameState is needed to look up the recipe
      this.currentRecipe = gameState.recipes.get(recipeId);
      if (!this.currentRecipe) {
        console.warn(`Entity ${this.entityId}: Recipe ${recipeId} not found.`);
        this.recipeId = undefined; // Clear invalid recipe
      }
    } else if (recipeId && !gameState) {
        // If gameState is not provided here, currentRecipe will be fetched on first update.
        this.currentRecipe = undefined;
    } else {
      this.currentRecipe = undefined;
    }
  }

  public toggleActive(active?: boolean): void {
    this.isActive = active !== undefined ? active : !this.isActive;
    if (!this.isActive) {
      // Optional: Consider if progress should reset or pause when deactivated.
      // this.productionProgress = 0;
    }
  }

  public getEfficiency(): number {
      // TODO: Implement dynamic efficiency based on tech, morale, pollution, etc.
      return this.efficiency;
  }

  public update(gameState: GameState, deltaTime: number): void {
    if (!this.isActive || !this.recipeId) {
      return;
    }

    // Fetch recipe from gameState if not already fetched (e.g., if set without gameState)
    if (this.recipeId && !this.currentRecipe) {
        this.currentRecipe = gameState.recipes.get(this.recipeId);
        if (!this.currentRecipe) {
            console.warn(`Entity ${this.entityId} (ProductionComponent): Recipe ${this.recipeId} not found during update. Deactivating.`);
            this.isActive = false;
            this.recipeId = undefined;
            return;
        }
    }

    if (!this.currentRecipe) return;


    const storage = gameState.entities.get(this.entityId)?.getComponent<IResourceStorageComponent>('ResourceStorageComponent');
    if (!storage) {
      console.warn(`Entity ${this.entityId} (ProductionComponent): Needs a ResourceStorageComponent.`);
      this.isActive = false; // Cannot produce without storage
      return;
    }

    // Check if inputs are available (only if progress is 0, meaning we are starting a new cycle)
    if (this.productionProgress === 0) {
      let canProduce = true;
      for (const [resourceId, requiredAmount] of this.currentRecipe.inputs) {
        if (!storage.hasResource(resourceId, requiredAmount)) {
          canProduce = false;
          // console.log(`Entity ${this.entityId} (ProductionComponent): Insufficient ${resourceId} for recipe ${this.recipeId}. Needs ${requiredAmount}, has ${storage.getResourceAmount(resourceId)}`);
          break;
        }
      }
      if (!canProduce) {
        return; // Wait for resources
      }

      // Consume inputs if starting production
      for (const [resourceId, requiredAmount] of this.currentRecipe.inputs) {
        storage.removeResource(resourceId, requiredAmount);
      }
    }

    // Increment progress
    // deltaTime is in seconds. recipe.duration is in abstract time units.
    // Assume 1 recipe duration unit = 1 second of game time for now.
    // Efficiency scales the effective deltaTime.
    this.productionProgress += (deltaTime * gameState.speed * this.getEfficiency());

    if (this.productionProgress >= this.currentRecipe.duration) {
      // Produce outputs
      for (const [resourceId, producedAmount] of this.currentRecipe.outputs) {
        storage.addResource(resourceId, producedAmount);
      }
      // console.log(`Entity ${this.entityId} (ProductionComponent): Produced recipe ${this.recipeId}.`);
      this.productionProgress = 0; // Reset for next cycle
    }
  }
}
