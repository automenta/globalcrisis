// Content for the new GameEngine.ts
import type { IEntity } from './entities/BaseEntity';
import type { IComponent } from './components/BaseComponent';
import { CityEntity } from './entities/CityEntity'; // Import CityEntity

// Base Interfaces
interface Identifiable { id: string; name: string; }

// PHYSICS SYSTEM
export enum PhysicsLayer { Underground, Surface, Air, Orbit, Moon }
export interface Location {
  layer: PhysicsLayer;
  coordinates: { x: number, y: number, z?: number };
  regionId?: string;
  biomeId?: string;
}

// POPULATION & GEO-BIOME
export interface Biome extends Identifiable {
  climateProfile: { averageTemperature: number; averagePrecipitation: number; };
  terrainProperties: { arableLandPercentage: number; movementModifier: number; };
  naturalResources: Map<string, number>;
}
export interface PopulationStats { total: number; growthRate: number; morale: number; }

// PRODUCTION/CONSUMPTION
export interface Resource extends Identifiable { category: 'Raw' | 'Processed' | 'FinishedGood' | 'Energy'; baseValue?: number; }
export interface ProductionRecipe extends Identifiable {
  inputs: Map<string, number>; outputs: Map<string, number>;
  duration: number; energyCost: number;
}

// LEGACY WorldRegion (for initial data, UI compatibility)
export interface WorldRegion extends Identifiable {
  population: number; health: number; environment: number; stability: number;
  rareEarthElements: number; foodSupply: number; technologyLevel: number; infrastructureQuality: number;
  x: number; y: number; color: [number, number, number];
}

// FACTIONS & IDEOLOGY
export enum Ideology { DEMOCRATIC = 'Democratic', COMMUNIST = 'Communist', AUTHORITARIAN = 'Authoritarian', CORPORATIST = 'Corporatist', ENVIRONMENTALIST = 'Environmentalist', TECHNOCRATIC = 'Technocratic' }
export interface Faction extends Identifiable {
  ideology: Ideology; powerLevel: number; influence: Map<string, number>;
  relations: Map<string, number>; headquartersRegionId?: string;
}

// GAME STATE
export interface GameState {
  time: number; running: boolean; speed: number; mode: 'chaos' | 'peace' | 'neutral';
  entities: Map<string, IEntity>; factions: Map<string, Faction>;
  worldRegions: Map<string, WorldRegion>; biomes: Map<string, Biome>;
  resources: Map<string, Resource>; recipes: Map<string, ProductionRecipe>;
  globalPopulation: number; globalHealth: number; globalEnvironment: number;
  globalStability: number; globalSuffering: number; globalEconomicProsperity: number;
}

// MANAGERS
class EntityManager {
  constructor(private gameState: GameState) {}
  addEntity(entity: IEntity): void { this.gameState.entities.set(entity.id, entity); if (entity.init) entity.init(); }
  removeEntity(entityId: string): void { this.gameState.entities.delete(entityId); }
  getEntity(entityId: string): IEntity | undefined { return this.gameState.entities.get(entityId); }
  updateAll(deltaTime: number): void { this.gameState.entities.forEach(e => e.update(this.gameState, deltaTime)); }
}

// Define other managers (Physics, Economy, Population, Faction)
class PhysicsManager { constructor(private gs: GameState) {} public update(dt: number) { /* TODO: Implement physics updates for entities */ } }
class EconomyManager {
    constructor(private gameState: GameState) {}
    public update(deltaTime: number): void {
        // For now, EconomyManager doesn't need to do much if ProductionFacilityComponents
        // are updated via their parent Entity's update call (handled by EntityManager).
        // It could later handle global market prices, trade route simulations, etc.
        // Example: Iterate through entities with ProductionFacilityComponent if specific global logic needed.
        // this.gameState.entities.forEach(entity => {
        //   const prodComponent = entity.getComponent<IProductionFacilityComponent>('ProductionFacilityComponent');
        //   if (prodComponent) {
        //     // Manager-level logic related to production, if any.
        //   }
        // });
    }
}
class PopulationManager {
    constructor(private gameState: GameState) {}
    public update(deltaTime: number): void {
        // Similar to EconomyManager, if PopulationComponents update themselves via Entity.update,
        // this manager might be for more global or inter-city population effects (migration, global health events).
    }
}
class FactionManager { constructor(private gs: GameState) {} public update(dt: number) { /* TODO: Implement faction AI and diplomacy */ } }


// GAME ENGINE
// Import entities for initialization
import { FactoryEntity } from './entities/FactoryEntity';
import { ScoutUnitEntity } from './entities/ScoutUnitEntity';

export class GameEngine {
  private gameState: GameState;
  public entityManager: EntityManager;
  public physicsManager: PhysicsManager;
  public economyManager: EconomyManager;
  public populationManager: PopulationManager;
  public factionManager: FactionManager;

  constructor() {
    this.gameState = this.createInitialGameState();
    this.entityManager = new EntityManager(this.gameState);
    this.physicsManager = new PhysicsManager(this.gameState);
    this.economyManager = new EconomyManager(this.gameState);
    this.populationManager = new PopulationManager(this.gameState);
    this.factionManager = new FactionManager(this.gameState);
    this.initializeWorld();
  }

  private createInitialGameState(): GameState {
    return {
      time: 0, running: false, speed: 1, mode: 'neutral',
      entities: new Map<string, IEntity>(), factions: new Map<string, Faction>(),
      worldRegions: new Map<string, WorldRegion>(), biomes: new Map<string, Biome>(),
      resources: new Map<string, Resource>(), recipes: new Map<string, ProductionRecipe>(),
      globalPopulation: 0, globalHealth: 0, globalEnvironment: 0, globalStability: 0,
      globalSuffering: 0, globalEconomicProsperity: 0,
    };
  }

  private initializeWorld(): void {
    // Define Resources
    const resources: Resource[] = [
      { id: 'food', name: 'Food', category: 'FinishedGood', baseValue: 5 },
      { id: 'water', name: 'Water', category: 'Raw', baseValue: 1 },
      { id: 'wood', name: 'Wood', category: 'Raw', baseValue: 3 },
      { id: 'stone', name: 'Stone', category: 'Raw', baseValue: 2 },
      { id: 'iron_ore', name: 'Iron Ore', category: 'Raw', baseValue: 10 },
      { id: 'coal', name: 'Coal', category: 'Raw', baseValue: 8 },
      { id: 'steel', name: 'Steel', category: 'Processed', baseValue: 30 },
      { id: 'tools', name: 'Tools', category: 'FinishedGood', baseValue: 50 },
      { id: 'electricity', name: 'Electricity', category: 'Energy', baseValue: 20 },
      { id: 'housing_units', name: 'Housing Units', category: 'FinishedGood', baseValue: 100 } // Abstract representation
    ];
    resources.forEach(r => this.gameState.resources.set(r.id, r));

    // Define Production Recipes
    const recipes: ProductionRecipe[] = [
      {
        id: 'steel_recipe', name: 'Steel Production',
        inputs: new Map([['iron_ore', 2], ['coal', 1], ['electricity', 5]]),
        outputs: new Map([['steel', 1]]),
        duration: 10, energyCost: 0 // energyCost here could mean direct electricity if not listed in inputs
      },
      {
        id: 'tools_recipe', name: 'Tool Production',
        inputs: new Map([['steel', 1], ['wood', 2], ['electricity', 3]]),
        outputs: new Map([['tools', 1]]),
        duration: 15, energyCost: 0
      },
      {
        id: 'lumber_mill_recipe', name: 'Lumber Mill', // Process wood
        inputs: new Map([['wood', 5], ['electricity', 2]]), // Raw wood
        outputs: new Map([['processed_wood', 5]]), // e.g. planks, for construction
        duration: 8, energyCost: 0
      },
      {
        id: 'power_plant_coal_recipe', name: 'Coal Power Plant',
        inputs: new Map([['coal', 1]]),
        outputs: new Map([['electricity', 10]]), // Generates 10 units of electricity
        duration: 5, energyCost: 0 // The process itself might consume some of its own output implicitly
      }
    ];
    recipes.forEach(r => this.gameState.recipes.set(r.id, r));
    // Add "processed_wood" to resources if used in a recipe
    if (!this.gameState.resources.has('processed_wood')) {
        this.gameState.resources.set('processed_wood', {id: 'processed_wood', name: 'Processed Wood', category: 'Processed', baseValue: 6});
    }


    // Define Biomes
    const temperateForest: Biome = {
      id: 'temperate_forest_1', name: 'Temperate Forest',
      climateProfile: { averageTemperature: 15, averagePrecipitation: 800 },
      terrainProperties: { arableLandPercentage: 0.4, movementModifier: 0.9 },
      naturalResources: new Map([['wood', 200], ['food', 100], ['water', 150], ['stone', 50], ['coal', 30]])
    };
    const mountainRange: Biome = {
        id: 'mountain_range_1', name: 'Mountain Range',
        climateProfile: { averageTemperature: 5, averagePrecipitation: 1200 },
        terrainProperties: { arableLandPercentage: 0.05, movementModifier: 0.5 },
        naturalResources: new Map([['iron_ore', 150], ['stone', 200], ['coal', 80], ['water', 50]])
    };
    this.gameState.biomes.set(temperateForest.id, temperateForest);
    this.gameState.biomes.set(mountainRange.id, mountainRange);
    
    // Define Factions
    const factionA: Faction = {
      id: 'faction_a', name: 'The Pioneers', ideology: Ideology.TECHNOCRATIC,
      powerLevel: 70, influence: new Map(), relations: new Map(), headquartersRegionId: 'na'
    };
    this.gameState.factions.set(factionA.id, factionA);

    // Create a sample City Entity
    const firstCityLocation: Location = {
        layer: PhysicsLayer.Surface,
        coordinates: { x: -0.5, y: 0.25 }, // Example coordinates
        biomeId: temperateForest.id,
        regionId: 'na' // Assuming 'na' is a WorldRegion id
    };
    const firstCity = new CityEntity('city_01', 'Pioneer Town', firstCityLocation, factionA.id, 5000);
    firstCity.resourceStorageComponent.addResource('food', 100);
    this.entityManager.addEntity(firstCity);

    // Create a sample Factory Entity
    const factoryLocation: Location = {
        layer: PhysicsLayer.Surface,
        coordinates: { x: -0.45, y: 0.20 }, // Near the city
        biomeId: temperateForest.id,
        regionId: 'na'
    };
    // Ensure 'steel_recipe' is defined in this.gameState.recipes
    const steelRecipe = this.gameState.recipes.get('steel_recipe');
    if (!steelRecipe) {
        // Define it if it wasn't (should be defined earlier, but as a fallback)
        const newSteelRecipe: ProductionRecipe = {
            id: 'steel_recipe', name: 'Steel Production',
            inputs: new Map([['iron_ore', 2]]),
            outputs: new Map([['steel', 1]]),
            duration: 10, energyCost: 5
          };
        this.gameState.recipes.set(newSteelRecipe.id, newSteelRecipe);
        console.log("Dynamically added steel_recipe in initializeWorld");
    }
    
    const firstFactory = new FactoryEntity('factory_01', 'Steel Mill', factoryLocation, factionA.id, 'steel_recipe');
    // Pre-stock the factory with some iron ore
    firstFactory.resourceStorageComponent.addResource('iron_ore', 20);
    this.entityManager.addEntity(firstFactory);
    // Call initEntity to ensure recipe is loaded if it relies on gameState
    if (firstFactory.initEntity) {
        firstFactory.initEntity(this.gameState);
    }

    // Create a sample Scout Unit Entity
    const scoutStartLocation: Location = {
        layer: PhysicsLayer.Surface,
        coordinates: { x: -0.3, y: 0.15 },
        biomeId: temperateForest.id, // Assuming temperateForest is defined
        regionId: 'na'
    };
    const firstScout = new ScoutUnitEntity('scout_01', 'Recon Alpha', scoutStartLocation, factionA.id, 0.2);
    this.entityManager.addEntity(firstScout);
    // Example: Make the scout move
    // In a real scenario, this would be triggered by player input or AI
    // firstScout.setMoveTarget(-0.2, 0.1);


    this.createInitialWorldRegions_Legacy(); // For UI compatibility
    this.calculateGlobalStats();
  }
  
  private createInitialWorldRegions_Legacy(): void {
    const regionsData: Array<WorldRegion> = [
        { id: 'na', name: 'North America', population: 0, health: 78, environment: 65, stability: 75, rareEarthElements: 70, foodSupply: 80, technologyLevel: 85, infrastructureQuality: 80, x: -0.6, y: 0.3, color: [0.3, 0.6, 0.9] as [number,number,number] },
    ];
    // Populate legacy regions, but population might be derived from entities later
    regionsData.forEach(data => {
        let regionPopulation = 0;
        this.gameState.entities.forEach(entity => {
            if (entity.entityType === 'CityEntity' && entity.location.regionId === data.id) {
                const popComp = entity.getComponent<import('../components/PopulationComponent').IPopulationComponent>('PopulationComponent');
                if (popComp) {
                    regionPopulation += popComp.stats.total;
                }
            }
        });
        data.population = Math.floor(regionPopulation);
        this.gameState.worldRegions.set(data.id, data);
    });
  }

  public updateWorld(deltaTime: number): GameState {
    if (!this.gameState.running) return this.gameState;
    const scaledDeltaTime = deltaTime * this.gameState.speed;
    this.gameState.time += scaledDeltaTime;

    this.physicsManager.update(scaledDeltaTime);
    this.populationManager.update(scaledDeltaTime); // Could update global pop effects
    this.economyManager.update(scaledDeltaTime);    // Could update global market effects
    this.entityManager.updateAll(scaledDeltaTime);  // This updates all entities and their components
    this.factionManager.update(scaledDeltaTime);

    this.calculateGlobalStats();
    return this.gameState;
  }

  private calculateGlobalStats(): void {
    let totalPopulation = 0;
    this.gameState.entities.forEach(entity => {
        if (entity.entityType === 'CityEntity' && entity.hasComponent('PopulationComponent')) {
            // @ts-ignore
            totalPopulation += entity.getComponent('PopulationComponent').stats.total;
        }
    });
    this.gameState.globalPopulation = Math.floor(totalPopulation);

    // For other global stats, still rely on legacy regions for simplicity FOR NOW
    if (this.gameState.worldRegions.size > 0) {
        let totalHealth = 0, count = 0;
        this.gameState.worldRegions.forEach(r => {
            totalHealth += r.health; // Assuming health is still a static property of legacy region
            count++;
        });
        this.gameState.globalHealth = count > 0 ? totalHealth / count : 50;
        // ... other stats like environment, stability can be averaged similarly if needed
    } else {
        this.gameState.globalHealth = 50; // Default if no regions
    }
    // Simplified suffering and prosperity
    this.gameState.globalSuffering = Math.max(0, 100 - this.gameState.globalHealth);
    this.gameState.globalEconomicProsperity = 50; // Placeholder
  }

  public setRunning(running: boolean): void { this.gameState.running = running; }
  public setSpeed(speed: number): void { this.gameState.speed = Math.max(0.1, speed); }
  public getGameState(): Readonly<GameState> { return this.gameState; }
}