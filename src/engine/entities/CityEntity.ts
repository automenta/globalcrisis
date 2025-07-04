import { BaseEntity, IEntity } from './BaseEntity';
import { PopulationComponent, IPopulationComponent } from '../components/PopulationComponent';
import { ResourceStorageComponent, IResourceStorageComponent } from '../components/ResourceStorageComponent';
import type { Location, GameState } from '../GameEngine';

export interface ICityEntity extends IEntity {
  populationComponent: IPopulationComponent;
  resourceStorageComponent: IResourceStorageComponent;
  // Add other city-specific interfaces or properties here
}

export class CityEntity extends BaseEntity implements ICityEntity {
  public readonly entityType = 'CityEntity';
  public populationComponent: IPopulationComponent;
  public resourceStorageComponent: IResourceStorageComponent;

  constructor(
    id: string,
    name: string,
    location: Location,
    factionId?: string,
    initialPopulation: number = 1000,
    initialResources?: Map<string, number>
  ) {
    super(id, name, 'CityEntity', location, factionId);

    this.populationComponent = new PopulationComponent(initialPopulation);
    this.addComponent(this.populationComponent);

    this.resourceStorageComponent = new ResourceStorageComponent(initialResources);
    this.addComponent(this.resourceStorageComponent);
  }

  // Override update if CityEntity has specific logic beyond component updates
  // public update(gameState: GameState, deltaTime: number): void {
  //   super.update(gameState, deltaTime); // Calls update on all components
  //   // City-specific update logic here, if any
  // }

  // Example city-specific method
  public getCityStats(): string {
    return `${this.name} (Pop: ${this.populationComponent.getPopulation()}, Morale: ${this.populationComponent.stats.morale})`;
  }
}
