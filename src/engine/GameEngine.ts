// Content for the new GameEngine.ts
import type { IEntity } from './entities/BaseEntity';
import type { IComponent } from './components/BaseComponent';
import { CityEntity } from './entities/CityEntity'; // Import CityEntity
import type { IResourceStorageComponent } from './components/ResourceStorageComponent';
import type { IProductionFacilityComponent } from './components/ProductionFacilityComponent';
import type { IPopulationComponent } from './components/PopulationComponent';
import type { ITradeHubComponent } from './components/TradeHubComponent';
import { InfantryUnitEntity } from './entities/InfantryUnitEntity';
import { CombatStats } from './components/CombatComponent';

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
  climateProfile: {
    averageTemperature: number; // Celsius
    averagePrecipitation: number; // mm per year
    temperatureVariance: number; // +/- degrees Celsius
    precipitationVariance: number; // +/- percentage of average
  };
  terrainProperties: { arableLandPercentage: number; movementModifier: number; };
  naturalResources: Map<string, number>;
  currentWeather?: WeatherCondition;
  controllingFactionId?: string;
  factionInfluence?: Map<string, number>;
}

export interface WeatherCondition {
  temperature: number;
  precipitation: number;
  windSpeed: number;
  description: string;
}
export interface PopulationStats {
  total: number;
  growthRate: number;
  morale: number;
  healthScore: number;
  unrest: number;
}

// PRODUCTION/CONSUMPTION
export interface Resource extends Identifiable {
  category: 'Raw' | 'Processed' | 'FinishedGood' | 'Energy';
  baseValue: number;
  currentPrice?: number;
}
export interface ProductionRecipe extends Identifiable {
  inputs: Map<string, number>; outputs: Map<string, number>;
  duration: number; energyCost: number;
}

// LEGACY WorldRegion
export interface WorldRegion extends Identifiable {
  population: number; health: number; environment: number; stability: number;
  rareEarthElements: number; foodSupply: number; technologyLevel: number; infrastructureQuality: number;
  x: number; y: number; color: [number, number, number];
}

// FACTIONS & IDEOLOGY
export enum Ideology { DEMOCRATIC = 'Democratic', COMMUNIST = 'Communist', AUTHORITARIAN = 'Authoritarian', CORPORATIST = 'Corporatist', ENVIRONMENTALIST = 'Environmentalist', TECHNOCRATIC = 'Technocratic' }
export enum FactionGoal { EconomicGrowth, MilitaryExpansion, TechnologicalSupremacy, CulturalDominance, Survival }
export interface FactionStrategy {
    primaryGoal: FactionGoal;
    targetFaction?: string;
    expansionTargetBiome?: string;
    desiredTech?: string;
}

export interface Faction extends Identifiable {
  ideology: Ideology; powerLevel: number; influence: Map<string, number>;
  relations: Map<string, number>; headquartersRegionId?: string;
  balance?: number;
  currentStrategy?: FactionStrategy;
  aiState?: {
    lastDecisionTime: number;
    decisionInterval: number;
  };
  researchPoints?: number;
  researchRate?: number;
  unlockedTechnologies?: string[];
  currentResearchProjectId?: string;
  techBonuses?: Map<string, number>;
}

// TECHNOLOGIES
export interface TechnologyEffect {
  type: 'unlock_unit' | 'unlock_building' | 'improve_production_efficiency' | 'improve_research_rate' | 'modify_unit_stats';
  unitId?: string;
  buildingId?: string;
  resourceCategory?: 'Raw' | 'Processed' | 'FinishedGood' | 'Energy' | 'All';
  resourceId?: string; // Added for specific resource efficiency
  statModifier?: { stat: string, amount: number, isPercentage?: boolean };
  bonus?: number;
}
export interface Technology extends Identifiable {
  description: string;
  researchCost: number;
  prerequisites: string[];
  effects: TechnologyEffect[];
}

// GAME STATE
export interface GameState {
  time: number; running: boolean; speed: number;
  entities: Map<string, IEntity>; factions: Map<string, Faction>;
  availableTechnologies: Map<string, Technology>;
  worldRegions: Map<string, WorldRegion>; biomes: Map<string, Biome>;
  resources: Map<string, Resource>; recipes: Map<string, ProductionRecipe>;
  globalPopulation: number; globalHealth: number; globalEnvironment: number;
  globalStability: number; globalSuffering: number; globalEconomicProsperity: number;
  activeDisasters: NaturalDisaster[];
}

// NATURAL DISASTERS
export enum DisasterType { Earthquake, Storm, Drought, Flood, Wildfire } // Added Wildfire
export interface NaturalDisasterEffect {
  type: 'damage_entities' | 'reduce_population' | 'modify_biome_resources' | 'change_terrain';
  magnitude: number; // General magnitude. For damage, it's points. For pop reduction, percentage. For resource mod, amount or multiplier.
  resourceId?: string; // e.g., 'wood', 'food'
  affectedEntityType?: string; // e.g., 'CityEntity', 'FactoryEntity'
  durationOfEffect?: number; // For effects that last longer than the disaster itself or DOTs
}
export interface NaturalDisaster extends Identifiable {
  type: DisasterType;
  location: Location;
  radius: number;
  startTime: number;
  duration: number;
  effects: NaturalDisasterEffect[];
  isActive: boolean;
  description: string;
}

// MANAGERS
class EntityManager {
  constructor(private gameState: GameState) {}
  addEntity(entity: IEntity): void { this.gameState.entities.set(entity.id, entity); if (entity.init) entity.init(); }
  removeEntity(entityId: string): void { this.gameState.entities.delete(entityId); }
  getEntity(entityId: string): IEntity | undefined { return this.gameState.entities.get(entityId); }
  updateAll(deltaTime: number): void { this.gameState.entities.forEach(e => e.update(this.gameState, deltaTime)); }
}

import { WeatherManager } from './WeatherManager';
import { DisasterManager } from './DisasterManager';
import { TechManager } from './TechManager';
import { TerritoryManager } from './TerritoryManager';
import { GeoBiomeManager } from './GeoBiomeManager'; // Import GeoBiomeManager
class PhysicsManager { constructor(private gs: GameState) {} public update(dt: number) { /* TODO: Implement physics updates for entities */ } }

class EconomyManager {
    private lastPriceUpdate: number = 0;
    private priceUpdateInterval: number = 100;

    constructor(private gameState: GameState) {}

    public update(deltaTime: number): void {
        this.lastPriceUpdate += deltaTime * this.gameState.speed;
        if (this.lastPriceUpdate >= this.priceUpdateInterval) {
            this.updateResourcePrices();
            this.lastPriceUpdate = 0;
        }
    }

    private updateResourcePrices(): void {
        const globalSupply = new Map<string, number>();
        const globalDemand = new Map<string, number>();

        this.gameState.entities.forEach(entity => {
            const storage = entity.getComponent<IResourceStorageComponent>('ResourceStorageComponent');
            if (storage) {
                storage.resources.forEach((amount, resourceId) => {
                    globalSupply.set(resourceId, (globalSupply.get(resourceId) || 0) + amount);
                });
            }
        });

        this.gameState.entities.forEach(entity => {
            if (entity.entityType === 'FactoryEntity') {
                const prodFacility = entity.getComponent<IProductionFacilityComponent>('ProductionFacilityComponent');
                if (prodFacility && prodFacility.isActive && prodFacility.recipeId) {
                    const recipe = this.gameState.recipes.get(prodFacility.recipeId);
                    if (recipe) {
                        recipe.inputs.forEach((amount, resourceId) => {
                            const demandPerSecond = amount / recipe.duration;
                            globalDemand.set(resourceId, (globalDemand.get(resourceId) || 0) + demandPerSecond * this.priceUpdateInterval);
                        });
                    }
                }
            }
        });

        this.gameState.entities.forEach(entity => {
            if (entity.entityType === 'CityEntity') {
                const popComp = entity.getComponent<IPopulationComponent>('PopulationComponent');
                if (popComp) {
                    const population = popComp.stats.total;
                    const foodDemand = population * 0.01;
                    globalDemand.set('food', (globalDemand.get('food') || 0) + foodDemand);
                }
            }
        });

        this.gameState.resources.forEach(resource => {
            const supply = globalSupply.get(resource.id) || 1;
            const demand = globalDemand.get(resource.id) || resource.baseValue * 0.1;
            let priceMultiplier = demand / Math.max(1, supply);
            priceMultiplier = Math.max(0.1, Math.min(priceMultiplier, 10));
            resource.currentPrice = parseFloat((resource.baseValue * priceMultiplier).toFixed(2));
        });
        this.facilitateTrades();
    }

    private facilitateTrades(): void {
        const tradeHubs: ITradeHubComponent[] = [];
        this.gameState.entities.forEach(entity => {
            const hub = entity.getComponent<ITradeHubComponent>('TradeHubComponent');
            if (hub) {
                tradeHubs.push(hub);
            }
        });

        if (tradeHubs.length < 2) return;

        tradeHubs.forEach(importerHub => {
            const importerEntity = this.gameState.entities.get(importerHub.entityId);
            if (!importerEntity) return;

            importerHub.activeImportRequests.forEach((importRequest, resourceId) => {
                if (importRequest.amount <= 0) return;

                for (const exporterHub of tradeHubs) {
                    if (importerHub.entityId === exporterHub.entityId) continue;
                    const exporterEntity = this.gameState.entities.get(exporterHub.entityId);
                    if (!exporterEntity) continue;

                    const exportOffer = exporterHub.activeExportOffers.get(resourceId);
                    if (exportOffer && exportOffer.amount > 0 && exportOffer.pricePerUnit <= importRequest.pricePerUnit) {
                        if (importerHub.processTrade(this.gameState, exporterHub, exportOffer)) {
                            if (importRequest.amount <= 0 || importerHub.activeImportRequests.get(resourceId)?.amount <=0) {
                                break;
                            }
                        }
                    }
                }
            });
        });
    }
}
class PopulationManager {
    constructor(private gameState: GameState) {}
    public update(deltaTime: number): void {}
}

class FactionManager {
    constructor(
        private gameState: GameState,
        private entityManager: EntityManager,
        private techManager: TechManager
    ) {}

    public update(deltaTime: number): void {
        const gameSpeedAdjustedDeltaTime = deltaTime * this.gameState.speed;

        this.gameState.factions.forEach(faction => {
            // Basic income for factions (e.g., from taxes)
            const factionCities = Array.from(this.gameState.entities.values()).filter(
                e => e.factionId === faction.id && e.entityType === 'CityEntity'
            );
            const incomePerCityPerSecond = 1; // Small placeholder income
            const rawIncome = factionCities.length * incomePerCityPerSecond * gameSpeedAdjustedDeltaTime;
            faction.balance = (faction.balance || 0) + rawIncome;

            if (!faction.aiState || !faction.currentStrategy) return;

            faction.aiState.lastDecisionTime += gameSpeedAdjustedDeltaTime;
            if (faction.aiState.lastDecisionTime >= faction.aiState.decisionInterval) {
                this.makeStrategicDecision(faction);
                this.updateDiplomacy(faction);
                faction.aiState.lastDecisionTime = 0;
            }
        });
    }

    private makeStrategicDecision(faction: Faction): void {
        if (!faction.currentStrategy) return;

        switch (faction.currentStrategy.primaryGoal) {
            case FactionGoal.EconomicGrowth:
                this.pursueEconomicGrowth(faction);
                break;
            case FactionGoal.MilitaryExpansion:
                this.pursueMilitaryExpansion(faction);
                break;
            case FactionGoal.TechnologicalSupremacy:
                this.pursueTechnologicalSupremacy(faction);
                break;
            default:
                if (!faction.currentResearchProjectId) {
                    this.selectAndStartRandomResearch(faction);
                }
                break;
        }
    }

    private pursueTechnologicalSupremacy(faction: Faction): void {
        if (!faction.currentResearchProjectId) {
            let techToResearch: string | undefined = faction.currentStrategy?.desiredTech;
            if (techToResearch && this.techManager.canResearch(faction, techToResearch)) {
                this.techManager.startResearch(faction, techToResearch);
            } else {
                this.selectAndStartRandomResearch(faction);
            }
        }
    }

    private selectAndStartRandomResearch(faction: Faction): void {
        const availableToResearch: Technology[] = [];
        this.gameState.availableTechnologies.forEach(tech => {
            if (this.techManager.canResearch(faction, tech.id)) {
                availableToResearch.push(tech);
            }
        });

        if (availableToResearch.length > 0) {
            availableToResearch.sort((a, b) => a.researchCost - b.researchCost);
            const techToStart = availableToResearch[0];
            this.techManager.startResearch(faction, techToStart.id);
        }
    }

    private pursueMilitaryExpansion(faction: Faction): void {
        const unitCost = 1000;
        if ((faction.balance || 0) < unitCost) return;

        const factionCities = Array.from(this.gameState.entities.values()).filter(
            e => e.factionId === faction.id && e.entityType === 'CityEntity'
        );
        if (factionCities.length === 0) return;

        const spawnCity = factionCities[Math.floor(Math.random() * factionCities.length)];
        const unitId = `inf_${faction.id}_${this.gameState.time.toFixed(0)}`;

        const unitLocation: Location = {
            ...spawnCity.location,
            coordinates: {
                x: spawnCity.location.coordinates.x + (Math.random() - 0.5) * 0.02,
                y: spawnCity.location.coordinates.y + (Math.random() - 0.5) * 0.02,
            }
        };

        const infantryStats: CombatStats = { attackPower: 10, attackRange: 0.15, attackSpeed: 1 };
        const newUnit = new InfantryUnitEntity(unitId, `${faction.name} Trooper`, unitLocation, faction.id, infantryStats);

        this.entityManager.addEntity(newUnit);
        faction.balance = (faction.balance || 0) - unitCost;
        console.log(`Faction ${faction.name} recruited new unit ${unitId}. Balance: ${faction.balance}`);
    }

    private updateDiplomacy(faction: Faction): void {
        if (this.gameState.factions.size < 2) return;

        this.gameState.factions.forEach(otherFaction => {
            if (faction.id === otherFaction.id) return;
            let currentRelation = faction.relations.get(otherFaction.id) || 0;
            if (faction.ideology === otherFaction.ideology) {
                currentRelation += 0.1;
            } else {
                const conflictingIdeologies = [
                    [Ideology.CORPORATIST, Ideology.ENVIRONMENTALIST],
                    [Ideology.AUTHORITARIAN, Ideology.DEMOCRATIC]
                ];
                if (conflictingIdeologies.some(pair =>
                    (pair[0] === faction.ideology && pair[1] === otherFaction.ideology) ||
                    (pair[1] === faction.ideology && pair[0] === otherFaction.ideology)
                )) {
                    currentRelation -= 0.05;
                }
            }
            currentRelation = Math.max(-100, Math.min(100, currentRelation));
            faction.relations.set(otherFaction.id, parseFloat(currentRelation.toFixed(2)));
            otherFaction.relations.set(faction.id, parseFloat(currentRelation.toFixed(2)));
        });
    }

    private pursueEconomicGrowth(faction: Faction): void {
        const factionEntities = Array.from(this.gameState.entities.values()).filter(e => e.factionId === faction.id);
        const cities = factionEntities.filter(e => e.entityType === 'CityEntity');
        const factories = factionEntities.filter(e => e.entityType === 'FactoryEntity');
        const newFactoryCost = 5000;
        const newCityCost = 20000;

        if ((faction.balance || 0) > newFactoryCost && factories.length < cities.length * 2) {
            const availableRecipes = Array.from(this.gameState.recipes.values());
            if (availableRecipes.length === 0) return;
            let bestRecipeId: string | undefined = undefined;
            const nonEnergyRecipes = availableRecipes.filter(r => !r.outputs.has("electricity"));
            if (nonEnergyRecipes.length > 0) {
                bestRecipeId = nonEnergyRecipes[Math.floor(Math.random() * nonEnergyRecipes.length)].id;
            } else if (availableRecipes.length > 0) {
                bestRecipeId = availableRecipes[Math.floor(Math.random() * availableRecipes.length)].id;
            }

            if (bestRecipeId) {
                const newFactoryLocation = this.findSuitableLocationNearCity(faction, cities, faction.currentStrategy?.expansionTargetBiome);
                if (newFactoryLocation) {
                    const factoryId = `factory_${faction.id}_${this.gameState.time.toFixed(0)}_${factories.length}`;
                    const newFactory = new FactoryEntity(factoryId, `${faction.name} Factory`, newFactoryLocation, faction.id, bestRecipeId);
                    this.entityManager.addEntity(newFactory);
                    faction.balance = (faction.balance || 0) - newFactoryCost;
                    console.log(`Faction ${faction.name} built new factory ${factoryId} for recipe ${bestRecipeId}. Balance: ${faction.balance}`);
                    return;
                }
            }
        }

        if ((faction.balance || 0) > newCityCost && cities.length < 3) {
            const newCityLocation = this.findSuitableLocationNearCity(faction, cities, faction.currentStrategy?.expansionTargetBiome, true);
            if (newCityLocation) {
                const cityId = `city_${faction.id}_${this.gameState.time.toFixed(0)}_${cities.length}`;
                const newCity = new CityEntity(cityId, `${faction.name} Outpost`, newCityLocation, faction.id, 100);
                this.entityManager.addEntity(newCity);
                faction.balance = (faction.balance || 0) - newCityCost;
                console.log(`Faction ${faction.name} founded new city ${cityId}. Balance: ${faction.balance}`);
                return;
            }
        }
    }

    private findSuitableLocationNearCity(faction: Faction, cities: IEntity[], targetBiomeId?: string, forCity: boolean = false): Location | undefined {
        if (cities.length === 0 && !targetBiomeId) {
            const suitableBiomes: Biome[] = [];
            this.gameState.biomes.forEach(biome => {
                if (!biome.controllingFactionId || biome.controllingFactionId === faction.id) {
                    suitableBiomes.push(biome);
                } else {
                    const relationToController = faction.relations.get(biome.controllingFactionId);
                    if (relationToController === undefined || relationToController >= -20) {
                        suitableBiomes.push(biome);
                    }
                }
            });

            if (suitableBiomes.length > 0) {
                targetBiomeId = suitableBiomes[Math.floor(Math.random() * suitableBiomes.length)].id;
            } else {
                const allBiomes = Array.from(this.gameState.biomes.values());
                if (allBiomes.length > 0) targetBiomeId = allBiomes[Math.floor(Math.random() * allBiomes.length)].id;
                else return undefined;
            }
        }

        let baseLocation: Location | undefined;
        if (cities.length > 0) {
            const citiesInTargetBiome = cities.filter(c => c.location.biomeId === targetBiomeId);
            if (citiesInTargetBiome.length > 0) {
                baseLocation = citiesInTargetBiome[Math.floor(Math.random() * citiesInTargetBiome.length)].location;
            } else {
                baseLocation = cities[Math.floor(Math.random() * cities.length)].location;
            }
        } else if (targetBiomeId) {
            const biome = this.gameState.biomes.get(targetBiomeId);
            if (biome) {
                baseLocation = {
                    layer: PhysicsLayer.Surface,
                    coordinates: { x: Math.random() * 1.8 - 0.9, y: Math.random() * 1.8 - 0.9 },
                    biomeId: targetBiomeId,
                };
            } else { return undefined; }
        } else { return undefined; }

        const offsetScale = forCity ? 0.3 : 0.05;
        return {
            layer: PhysicsLayer.Surface,
            coordinates: {
                x: baseLocation.coordinates.x + (Math.random() - 0.5) * offsetScale,
                y: baseLocation.coordinates.y + (Math.random() - 0.5) * offsetScale,
            },
            biomeId: baseLocation.biomeId || targetBiomeId,
            regionId: baseLocation.regionId,
        };
    }
}


// GAME ENGINE
// Import entities for initialization
import { FactoryEntity } from './entities/FactoryEntity';
import { ScoutUnitEntity } from './entities/ScoutUnitEntity';
import { SoundManager } from './SoundManager'; // Import SoundManager

export class GameEngine {
  private gameState: GameState;
  public entityManager: EntityManager;
  public physicsManager: PhysicsManager;
  public economyManager: EconomyManager;
  public populationManager: PopulationManager;
  public factionManager: FactionManager;
  public weatherManager: WeatherManager;
  public disasterManager: DisasterManager;
  public techManager: TechManager;
  public territoryManager: TerritoryManager;
  public soundManager: SoundManager; // Add SoundManager instance

  private activeAmbientSounds: Set<string> = new Set(); // To track current global ambient sounds

  constructor() {
    this.gameState = this.createInitialGameState();
    this.soundManager = new SoundManager(); // Initialize SoundManager
    this.entityManager = new EntityManager(this.gameState);
    this.physicsManager = new PhysicsManager(this.gameState);
    this.economyManager = new EconomyManager(this.gameState);
    this.populationManager = new PopulationManager(this.gameState);
    this.techManager = new TechManager(this.gameState);
    this.factionManager = new FactionManager(this.gameState, this.entityManager, this.techManager);
    this.weatherManager = new WeatherManager(this.gameState);
    // Pass SoundManager to DisasterManager if it needs to trigger sounds directly
    this.disasterManager = new DisasterManager(this.gameState, this.soundManager);
    this.territoryManager = new TerritoryManager(this.gameState);
    this.initializeWorld();
    this.soundManager.setMusic('main_theme_peaceful'); // Start with peaceful music
  }

  private createInitialGameState(): GameState {
    return {
      time: 0, running: false, speed: 1,
      entities: new Map<string, IEntity>(), factions: new Map<string, Faction>(),
      worldRegions: new Map<string, WorldRegion>(), biomes: new Map<string, Biome>(),
      resources: new Map<string, Resource>(), recipes: new Map<string, ProductionRecipe>(),
      globalPopulation: 0, globalHealth: 0, globalEnvironment: 0, globalStability: 0,
      globalSuffering: 0, globalEconomicProsperity: 0,
      activeDisasters: [],
      availableTechnologies: new Map<string, Technology>(),
    };
  }

  private initializeWorld(): void {
    this.initializeTechnologies();

    const resources: Resource[] = [
      { id: 'food', name: 'Food', category: 'FinishedGood', baseValue: 5, currentPrice: 5 },
      { id: 'water', name: 'Water', category: 'Raw', baseValue: 1, currentPrice: 1 },
      { id: 'wood', name: 'Wood', category: 'Raw', baseValue: 3, currentPrice: 3 },
      { id: 'stone', name: 'Stone', category: 'Raw', baseValue: 2, currentPrice: 2 },
      { id: 'iron_ore', name: 'Iron Ore', category: 'Raw', baseValue: 10, currentPrice: 10 },
      { id: 'coal', name: 'Coal', category: 'Raw', baseValue: 8, currentPrice: 8 },
      { id: 'steel', name: 'Steel', category: 'Processed', baseValue: 30, currentPrice: 30 },
      { id: 'tools', name: 'Tools', category: 'FinishedGood', baseValue: 50, currentPrice: 50 },
      { id: 'electricity', name: 'Electricity', category: 'Energy', baseValue: 20, currentPrice: 20 },
      { id: 'housing_units', name: 'Housing Units', category: 'FinishedGood', baseValue: 100, currentPrice: 100 },
      { id: 'machine_parts', name: 'Machine Parts', category: 'Processed', baseValue: 70, currentPrice: 70 },
      { id: 'advanced_machinery', name: 'Advanced Machinery', category: 'FinishedGood', baseValue: 250, currentPrice: 250 }
    ];
    resources.forEach(r => {
        if (r.currentPrice === undefined) r.currentPrice = r.baseValue;
        this.gameState.resources.set(r.id, r);
    });

    const recipes: ProductionRecipe[] = [
      { id: 'steel_recipe', name: 'Steel Production', inputs: new Map([['iron_ore', 2], ['coal', 1], ['electricity', 5]]), outputs: new Map([['steel', 1]]), duration: 10, energyCost: 0 },
      { id: 'tools_recipe', name: 'Tool Production', inputs: new Map([['steel', 1], ['wood', 2], ['electricity', 3]]), outputs: new Map([['tools', 1]]), duration: 15, energyCost: 0 },
      { id: 'lumber_mill_recipe', name: 'Lumber Mill', inputs: new Map([['wood', 5], ['electricity', 2]]), outputs: new Map([['processed_wood', 5]]), duration: 8, energyCost: 0 },
      { id: 'power_plant_coal_recipe', name: 'Coal Power Plant', inputs: new Map([['coal', 1]]), outputs: new Map([['electricity', 10]]), duration: 5, energyCost: 0 },
      { id: 'machine_parts_recipe', name: 'Machine Parts Production', inputs: new Map([['steel', 2], ['electricity', 10]]), outputs: new Map([['machine_parts', 1]]), duration: 20, energyCost: 0 },
      { id: 'advanced_machinery_recipe', name: 'Advanced Machinery Production', inputs: new Map([['machine_parts', 1], ['tools', 3], ['electricity', 15]]), outputs: new Map([['advanced_machinery', 1]]), duration: 30, energyCost: 0 }
    ];
    recipes.forEach(r => this.gameState.recipes.set(r.id, r));
    if (!this.gameState.resources.has('processed_wood')) {
        this.gameState.resources.set('processed_wood', { id: 'processed_wood', name: 'Processed Wood', category: 'Processed', baseValue: 6, currentPrice: 6 });
    }

    const temperateForest: Biome = {
      id: 'temperate_forest_1', name: 'Temperate Forest',
      climateProfile: { averageTemperature: 15, averagePrecipitation: 800, temperatureVariance: 5, precipitationVariance: 0.2 },
      terrainProperties: { arableLandPercentage: 0.4, movementModifier: 0.9 },
      naturalResources: new Map([['wood', 200], ['food', 100], ['water', 150], ['stone', 50], ['coal', 30]]),
      currentWeather: { temperature: 15, precipitation: 0, windSpeed: 10, description: "Clear" },
      factionInfluence: new Map(), controllingFactionId: undefined
    };
    const mountainRange: Biome = {
        id: 'mountain_range_1', name: 'Mountain Range',
        climateProfile: { averageTemperature: 5, averagePrecipitation: 1200, temperatureVariance: 8, precipitationVariance: 0.3 },
        terrainProperties: { arableLandPercentage: 0.05, movementModifier: 0.5 },
        naturalResources: new Map([['iron_ore', 150], ['stone', 200], ['coal', 80], ['water', 50]]),
        currentWeather: { temperature: 5, precipitation: 0, windSpeed: 15, description: "Clear" },
        factionInfluence: new Map(), controllingFactionId: undefined
    };
    this.gameState.biomes.set(temperateForest.id, temperateForest);
    this.gameState.biomes.set(mountainRange.id, mountainRange);
    
    const factionA: Faction = {
      id: 'faction_a', name: 'The Pioneers', ideology: Ideology.TECHNOCRATIC,
      powerLevel: 70, influence: new Map(), relations: new Map(), headquartersRegionId: 'na',
      balance: 20000, currentStrategy: { primaryGoal: FactionGoal.TechnologicalSupremacy, desiredTech: 'basic_rocketry' },
      aiState: { lastDecisionTime: 0, decisionInterval: 60 * 5 },
      researchPoints: 0, researchRate: 5, unlockedTechnologies: [], currentResearchProjectId: undefined,
    };
    const factionB: Faction = {
      id: 'faction_b', name: 'The Marauders', ideology: Ideology.AUTHORITARIAN,
      powerLevel: 60, influence: new Map(), relations: new Map(), headquartersRegionId: 'na',
      balance: 15000, currentStrategy: { primaryGoal: FactionGoal.MilitaryExpansion },
      aiState: { lastDecisionTime: 0, decisionInterval: 60 * 4 },
      researchPoints: 0, researchRate: 2, unlockedTechnologies: [], currentResearchProjectId: undefined,
    };
    this.gameState.factions.set(factionA.id, factionA);
    this.gameState.factions.set(factionB.id, factionB);
    factionA.relations.set(factionB.id, -50);
    factionB.relations.set(factionA.id, -50);

    const firstCityLocation: Location = { layer: PhysicsLayer.Surface, coordinates: { x: -0.5, y: 0.25 }, biomeId: temperateForest.id, regionId: 'na' };
    const firstCity = new CityEntity('city_01', 'Pioneer Town', firstCityLocation, factionA.id, 5000);
    firstCity.resourceStorageComponent.addResource('food', 100);
    this.entityManager.addEntity(firstCity);

    const secondCityLocation: Location = { layer: PhysicsLayer.Surface, coordinates: { x: 0.5, y: -0.25 }, biomeId: mountainRange.id, regionId: 'na' };
    const secondCity = new CityEntity('city_02', 'Marauder Keep', secondCityLocation, factionB.id, 3000);
    secondCity.resourceStorageComponent.addResource('food', 50);
    this.entityManager.addEntity(secondCity);

    const factoryLocation: Location = { layer: PhysicsLayer.Surface, coordinates: { x: -0.45, y: 0.20 }, biomeId: temperateForest.id, regionId: 'na' };
    const steelRecipe = this.gameState.recipes.get('steel_recipe');
    if (!steelRecipe) {
        const newSteelRecipe: ProductionRecipe = { id: 'steel_recipe', name: 'Steel Production', inputs: new Map([['iron_ore', 2]]), outputs: new Map([['steel', 1]]), duration: 10, energyCost: 5 };
        this.gameState.recipes.set(newSteelRecipe.id, newSteelRecipe);
    }
    const firstFactory = new FactoryEntity('factory_01', 'Steel Mill', factoryLocation, factionA.id, 'steel_recipe');
    firstFactory.resourceStorageComponent.addResource('iron_ore', 20);
    this.entityManager.addEntity(firstFactory);
    if (firstFactory.initEntity) { firstFactory.initEntity(this.gameState); }

    const scoutStartLocation: Location = { layer: PhysicsLayer.Surface, coordinates: { x: -0.3, y: 0.15 }, biomeId: temperateForest.id, regionId: 'na' };
    const firstScout = new ScoutUnitEntity('scout_01', 'Recon Alpha', scoutStartLocation, factionA.id, 0.2);
    this.entityManager.addEntity(firstScout);

    const infantryStats: CombatStats = { attackPower: 10, attackRange: 0.15, attackSpeed: 1 };
    const factionAInfantryLocation: Location = { layer: PhysicsLayer.Surface, coordinates: { x: -0.4, y: 0.20 }, biomeId: temperateForest.id, regionId: 'na' };
    const factionAInfantry = new InfantryUnitEntity('inf_a_01', 'Pioneer Guard', factionAInfantryLocation, factionA.id, infantryStats);
    this.entityManager.addEntity(factionAInfantry);

    const factionBInfantryLocation: Location = { layer: PhysicsLayer.Surface, coordinates: { x: 0.4, y: -0.20 }, biomeId: mountainRange.id, regionId: 'na' };
    const factionBInfantry = new InfantryUnitEntity('inf_b_01', 'Marauder Thug', factionBInfantryLocation, factionB.id, {...infantryStats, attackPower: 12});
    this.entityManager.addEntity(factionBInfantry);

    this.createInitialWorldRegions_Legacy();
    this.calculateGlobalStats();
  }

  private initializeTechnologies(): void {
    const techs: Technology[] = [
      { id: 'basic_construction', name: 'Basic Construction', description: 'Improves understanding of basic building techniques.', researchCost: 100, prerequisites: [], effects: [{ type: 'improve_production_efficiency', resourceCategory: 'Raw', bonus: 0.05 }] },
      { id: 'improved_agriculture', name: 'Improved Agriculture', description: 'Advanced farming techniques increase food output.', researchCost: 150, prerequisites: ['basic_construction'], effects: [{ type: 'improve_production_efficiency', resourceId: 'food', bonus: 0.1 }] },
      { id: 'basic_rocketry', name: 'Basic Rocketry', description: 'Unlocks Scout Units for exploration.', researchCost: 200, prerequisites: ['basic_construction'], effects: [{ type: 'unlock_unit', unitId: 'ScoutUnitEntity' }] },
      { id: 'advanced_manufacturing', name: 'Advanced Manufacturing', description: 'Streamlines production of complex goods like Machine Parts.', researchCost: 300, prerequisites: ['basic_construction'], effects: [ { type: 'improve_production_efficiency', resourceId: 'machine_parts', bonus: 0.15 }, { type: 'improve_production_efficiency', resourceId: 'tools', bonus: 0.10 } ] },
    ];
    techs.forEach(t => this.gameState.availableTechnologies.set(t.id, t));
  }
  
  private createInitialWorldRegions_Legacy(): void {
    const regionsData: Array<WorldRegion> = [ { id: 'na', name: 'North America', population: 0, health: 78, environment: 65, stability: 75, rareEarthElements: 70, foodSupply: 80, technologyLevel: 85, infrastructureQuality: 80, x: -0.6, y: 0.3, color: [0.3, 0.6, 0.9] as [number,number,number] }, ];
    regionsData.forEach(data => {
        let regionPopulation = 0;
        this.gameState.entities.forEach(entity => {
            if (entity.entityType === 'CityEntity' && entity.location.regionId === data.id) {
                const popComp = entity.getComponent<IPopulationComponent>('PopulationComponent');
                if (popComp) { regionPopulation += popComp.stats.total; }
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
    this.populationManager.update(scaledDeltaTime);
    this.economyManager.update(scaledDeltaTime);
    this.weatherManager.update(scaledDeltaTime);
    this.disasterManager.update(scaledDeltaTime);
    this.techManager.update(scaledDeltaTime);
    this.territoryManager.update(scaledDeltaTime);
    this.entityManager.updateAll(scaledDeltaTime);
    this.factionManager.update(scaledDeltaTime);

    this.updateGlobalAmbientSounds(); // New method for ambient sounds
    this.calculateGlobalStats();
    return this.gameState;
  }

  private updateGlobalAmbientSounds(): void {
    let totalPrecipitation = 0;
    let totalWindSpeed = 0;
    let biomesCount = 0;
    let isSnowingSomewhere = false;

    this.gameState.biomes.forEach(biome => {
        if (biome.currentWeather) {
            totalPrecipitation += biome.currentWeather.precipitation;
            totalWindSpeed += biome.currentWeather.windSpeed;
            if (biome.currentWeather.precipitation > 0.1 && biome.currentWeather.temperature <= 0) {
                isSnowingSomewhere = true;
            }
            biomesCount++;
        }
    });

    const avgPrecip = biomesCount > 0 ? totalPrecipitation / biomesCount : 0;
    const avgWind = biomesCount > 0 ? totalWindSpeed / biomesCount : 0;

    // Manage rain sounds
    if (avgPrecip > 2.0 && !isSnowingSomewhere) { // Heavy rain
        this.startAmbient('rain_heavy');
        this.stopAmbient('rain_light');
    } else if (avgPrecip > 0.2 && !isSnowingSomewhere) { // Light rain
        this.startAmbient('rain_light');
        this.stopAmbient('rain_heavy');
    } else {
        this.stopAmbient('rain_light');
        this.stopAmbient('rain_heavy');
    }

    // Manage snow (visuals are global, so ambient sound can be too for now)
    // If specific biome sounds were implemented, this would be different.
    // For now, if it's snowing visually (driven by avg temp in Earth3D), play a generic snow/wind.
    // This part is a bit tricky as Earth3D handles visuals based on averages.
    // Let's assume if avgPrecip > 0.2 AND avgTemp <= 0 (from Earth3D logic), it's "snowing globally".
    // Actual snow ambient sound might be part of 'wind_strong' or a dedicated 'snow_storm' sound.
    // For now, focusing on rain and wind based on engine data.

    // Manage wind sounds
    if (avgWind > 25) { // Strong wind
        this.startAmbient('wind_strong');
        this.stopAmbient('wind_calm');
    } else if (avgWind > 5) { // Calm wind
        this.startAmbient('wind_calm');
        this.stopAmbient('wind_strong');
    } else { // Very little wind
        this.stopAmbient('wind_calm');
        this.stopAmbient('wind_strong');
    }
  }

  private startAmbient(soundName: any): void { // Type should be AmbientSound, but any for now due to string literal types
    if (!this.activeAmbientSounds.has(soundName)) {
        this.soundManager.playAmbientSound(soundName);
        this.activeAmbientSounds.add(soundName);
    }
  }

  private stopAmbient(soundName: any): void { // Type should be AmbientSound
      if (this.activeAmbientSounds.has(soundName)) {
          this.soundManager.stopAmbientSound(soundName);
          this.activeAmbientSounds.delete(soundName);
      }
  }

  private calculateGlobalStats(): void {
    let totalPopulation = 0;
    this.gameState.entities.forEach(entity => {
        if (entity.entityType === 'CityEntity' && entity.hasComponent('PopulationComponent')) {
            totalPopulation += (entity.getComponent('PopulationComponent') as IPopulationComponent).stats.total;
        }
    });
    this.gameState.globalPopulation = Math.floor(totalPopulation);

    if (this.gameState.worldRegions.size > 0) {
        let totalHealth = 0, count = 0;
        this.gameState.worldRegions.forEach(r => { totalHealth += r.health; count++; });
        this.gameState.globalHealth = count > 0 ? totalHealth / count : 50;
    } else {
        this.gameState.globalHealth = 50;
    }
    this.gameState.globalSuffering = Math.max(0, 100 - this.gameState.globalHealth);
    this.gameState.globalEconomicProsperity = 50;
  }

  public setRunning(running: boolean): void { this.gameState.running = running; }
  public setSpeed(speed: number): void { this.gameState.speed = Math.max(0.1, speed); }
  public getGameState(): Readonly<GameState> { return this.gameState; }
}