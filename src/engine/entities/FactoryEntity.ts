import { BaseEntity, IEntity } from './BaseEntity';
import { ProductionFacilityComponent, IProductionFacilityComponent } from '../components/ProductionFacilityComponent';
import { ResourceStorageComponent, IResourceStorageComponent } from '../components/ResourceStorageComponent';
import { HealthComponent, IHealthComponent } from '../components/HealthComponent'; // Factories can be damaged
import type { Location, GameState } from '../GameEngine';

export interface IFactoryEntity extends IEntity {
  productionFacilityComponent: IProductionFacilityComponent;
  resourceStorageComponent: IResourceStorageComponent;
  healthComponent: IHealthComponent;
  // Add other factory-specific interfaces or properties here
}

export class FactoryEntity extends BaseEntity implements IFactoryEntity {
  public readonly entityType = 'FactoryEntity'; // Important for type checking
  public productionFacilityComponent: IProductionFacilityComponent;
  public resourceStorageComponent: IResourceStorageComponent;
  public healthComponent: IHealthComponent;

  constructor(
    id: string,
    name: string,
    location: Location,
    factionId?: string,
    recipeId?: string, // Initial recipe for the factory
    initialResources?: Map<string, number>,
    initialMaxHp: number = 100
  ) {
    super(id, name, 'FactoryEntity', location, factionId);

    this.resourceStorageComponent = new ResourceStorageComponent(initialResources);
    this.addComponent(this.resourceStorageComponent);

    this.productionFacilityComponent = new ProductionFacilityComponent(recipeId);
    this.addComponent(this.productionFacilityComponent);

    this.healthComponent = new HealthComponent(initialMaxHp);
    this.addComponent(this.healthComponent);
  }

  // Optional: Override init to ensure recipe is loaded after entity is added to manager if needed
  public initEntity(gameState: GameState): void { // Renamed to avoid conflict with component.init
    // Ensure the recipe is properly loaded with access to gameState after construction
    if (this.productionFacilityComponent.recipeId && !this.productionFacilityComponent['currentRecipe']) {
       this.productionFacilityComponent.setRecipe(this.productionFacilityComponent.recipeId, gameState);
    }
  }


  // Example factory-specific method
  public getFactoryStatus(): string {
    const recipeInfo = this.productionFacilityComponent.recipeId
      ? `Recipe: ${this.productionFacilityComponent.recipeId} (Progress: ${this.productionFacilityComponent.productionProgress.toFixed(2)})`
      : "No recipe assigned";
    return `${this.name} [HP: ${this.healthComponent.currentHp}/${this.healthComponent.maxHp}] - ${recipeInfo} - Active: ${this.productionFacilityComponent.isActive}`;
  }

  // Ensure BaseEntity's init method (if it exists) is called if super.init() is intended.
  // For now, BaseEntity.init is optional and not implemented.
}
