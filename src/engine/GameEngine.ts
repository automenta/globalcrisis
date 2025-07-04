import { createNoise2D } from 'simplex-noise';

export interface WorldRegion {
  id: string;
  name: string;
  population: number;
  health: number;
  environment: number;
  stability: number;
  x: number;
  y: number;
  color: [number, number, number];
  events: RegionEvent[];
}

export interface RegionEvent {
  id: string;
  type: EventType;
  severity: number;
  duration: number;
  timeLeft: number;
  x: number;
  y: number;
  spread: number;
  active: boolean;
}

export enum EventType {
  NUCLEAR_STRIKE = 'nuclear_strike',
  BIOLOGICAL_WEAPON = 'biological_weapon',
  CHEMICAL_WEAPON = 'chemical_weapon',
  CYBER_ATTACK = 'cyber_attack',
  CLIMATE_DISASTER = 'climate_disaster',
  SOLAR_FLARE = 'solar_flare',
  ROGUE_AI = 'rogue_ai',
  DRONE_SWARM = 'drone_swarm',
  SPACE_WEAPON = 'space_weapon',
  PROPAGANDA = 'propaganda',
  ECONOMIC_COLLAPSE = 'economic_collapse',
  PANDEMIC = 'pandemic',
  NUCLEAR_MELTDOWN = 'nuclear_meltdown',
  ALIEN_CONTACT = 'alien_contact',
  INTERDIMENSIONAL = 'interdimensional',
  ELECTROMAGNETIC_PULSE = 'electromagnetic_pulse',
  GEOENGINEERING = 'geoengineering',
  HEALING = 'healing',
  ENVIRONMENTAL_RESTORATION = 'environmental_restoration',
  PEACE_TREATY = 'peace_treaty',
  // New Economic Events
  TRADE_WAR = 'trade_war',
  RESOURCE_DISCOVERY = 'resource_discovery',
  ECONOMIC_RECESSION = 'economic_recession',
  TECHNOLOGICAL_LEAP = 'technological_leap',
  GLOBAL_TRADE_DEAL = 'global_trade_deal'
}

export interface WorldRegion {
  id: string;
  name: string;
  population: number;
  health: number;
  environment: number;
  stability: number;
  // New Economic Resources for Regions
  rareEarthElements: number;
  foodSupply: number;
  technologyLevel: number;
  infrastructureQuality: number;
  x: number;
  y: number;
  color: [number, number, number];
  events: RegionEvent[];
}

export interface GameState {
  globalPopulation: number;
  globalHealth: number;
  globalEnvironment: number;
  globalStability: number;
  globalSuffering: number;
  // New Global Economic Indicators
  globalRareEarthElements: number;
  globalFoodSupply: number;
  globalTechnologyLevel: number;
  globalInfrastructureQuality: number;
  globalEconomicProsperity: number; // Composite indicator
  time: number;
  regions: WorldRegion[];
  activeEvents: RegionEvent[];
  factions: Faction[]; // New Factions array
  mode: 'chaos' | 'peace' | 'neutral';
  running: boolean;
  speed: number;
}

export enum Ideology {
  DEMOCRATIC = 'Democratic',
  COMMUNIST = 'Communist',
  AUTHORITARIAN = 'Authoritarian',
  CORPORATIST = 'Corporatist',
  ENVIRONMENTALIST = 'Environmentalist',
  TECHNOCRATIC = 'Technocratic'
}

export interface Faction {
  id: string;
  name: string;
  ideology: Ideology;
  powerLevel: number; // 0-100
  influence: Map<string, number>; // Region ID to influence level (0-100)
  relations: Map<string, number>; // Faction ID to relation level (-100 to 100)
  headquartersRegion: string; // ID of the region where their HQ is
}

export class GameEngine {
  private noise2D = createNoise2D();
  private lastUpdate = 0;
  
  constructor() {}
  
  createInitialWorld(): GameState {
    const regions: WorldRegion[] = [
      { id: 'na', name: 'North America', population: 580000000, health: 78, environment: 65, stability: 75, rareEarthElements: 70, foodSupply: 80, technologyLevel: 85, infrastructureQuality: 80, x: -0.6, y: 0.3, color: [0.3, 0.6, 0.9], events: [] },
      { id: 'sa', name: 'South America', population: 430000000, health: 72, environment: 55, stability: 65, rareEarthElements: 60, foodSupply: 70, technologyLevel: 60, infrastructureQuality: 55, x: -0.4, y: -0.4, color: [0.4, 0.8, 0.3], events: [] },
      { id: 'eu', name: 'Europe', population: 750000000, health: 82, environment: 70, stability: 80, rareEarthElements: 65, foodSupply: 75, technologyLevel: 90, infrastructureQuality: 85, x: 0.1, y: 0.4, color: [0.7, 0.4, 0.9], events: [] },
      { id: 'af', name: 'Africa', population: 1400000000, health: 65, environment: 45, stability: 55, rareEarthElements: 80, foodSupply: 50, technologyLevel: 40, infrastructureQuality: 35, x: 0.2, y: -0.1, color: [0.9, 0.6, 0.2], events: [] },
      { id: 'as', name: 'Asia', population: 4600000000, health: 74, environment: 50, stability: 70, rareEarthElements: 75, foodSupply: 65, technologyLevel: 75, infrastructureQuality: 70, x: 0.6, y: 0.2, color: [0.9, 0.3, 0.4], events: [] },
      { id: 'oc', name: 'Oceania', population: 50000000, health: 85, environment: 75, stability: 85, rareEarthElements: 50, foodSupply: 85, technologyLevel: 80, infrastructureQuality: 75, x: 0.8, y: -0.5, color: [0.2, 0.9, 0.7], events: [] }
    ];
    
    const initialState: GameState = {
      globalPopulation: regions.reduce((sum, r) => sum + r.population, 0),
      globalHealth: regions.reduce((sum, r) => sum + r.health, 0) / regions.length,
      globalEnvironment: regions.reduce((sum, r) => sum + r.environment, 0) / regions.length,
      globalStability: regions.reduce((sum, r) => sum + r.stability, 0) / regions.length,
      globalSuffering: 25,
      globalRareEarthElements: regions.reduce((sum, r) => sum + r.rareEarthElements, 0) / regions.length,
      globalFoodSupply: regions.reduce((sum, r) => sum + r.foodSupply, 0) / regions.length,
      globalTechnologyLevel: regions.reduce((sum, r) => sum + r.technologyLevel, 0) / regions.length,
      globalInfrastructureQuality: regions.reduce((sum, r) => sum + r.infrastructureQuality, 0) / regions.length,
      globalEconomicProsperity: 0, // Will be calculated in updateWorld
      time: 0,
      regions,
      activeEvents: [],
      factions: this.createInitialFactions(regions),
      mode: 'neutral',
      running: false,
      speed: 1
    };
    this.calculateGlobalStats(initialState); // Initial calculation for prosperity
    return initialState;
  }

  createInitialFactions(regions: WorldRegion[]): Faction[] {
    const initialFactions: Faction[] = [
      {
        id: 'global_democrats',
        name: 'Global Democratic Alliance',
        ideology: Ideology.DEMOCRATIC,
        powerLevel: 60,
        influence: new Map(regions.map(r => [r.id, r.id === 'na' || r.id === 'eu' ? 70 : 30])),
        relations: new Map([['technocrats_union', 20], ['corp_conglomerate', -10]]),
        headquartersRegion: 'eu'
      },
      {
        id: 'technocrats_union',
        name: 'Technocratic Union',
        ideology: Ideology.TECHNOCRATIC,
        powerLevel: 50,
        influence: new Map(regions.map(r => [r.id, r.id === 'as' ? 75 : 40])),
        relations: new Map([['global_democrats', 20], ['eco_guardians', 10]]),
        headquartersRegion: 'as'
      },
      {
        id: 'corp_conglomerate',
        name: 'MegaCorp Conglomerate',
        ideology: Ideology.CORPORATIST,
        powerLevel: 70,
        influence: new Map(regions.map(r => [r.id, r.id === 'na' || r.id ==='as' ? 65 : 35])),
        relations: new Map([['global_democrats', -10], ['authoritarian_pact', 30]]),
        headquartersRegion: 'na'
      },
      {
        id: 'eco_guardians',
        name: 'Eco Guardians',
        ideology: Ideology.ENVIRONMENTALIST,
        powerLevel: 40,
        influence: new Map(regions.map(r => [r.id, r.id === 'sa' || r.id === 'oc' ? 60 : 25])),
        relations: new Map([['technocrats_union', 10], ['corp_conglomerate', -20]]),
        headquartersRegion: 'sa'
      },
      {
        id: 'authoritarian_pact',
        name: 'Authoritarian Pact',
        ideology: Ideology.AUTHORITARIAN,
        powerLevel: 45,
        influence: new Map(regions.map(r => [r.id, Math.random() * 40 + 10])), // More varied initial influence
        relations: new Map([['corp_conglomerate', 30], ['global_democrats', -40]]),
        headquartersRegion: regions[Math.floor(Math.random() * regions.length)].id // Random HQ for this one
      }
    ];
    // Ensure all factions have mutual relations initialized
    initialFactions.forEach(f1 => {
      initialFactions.forEach(f2 => {
        if (f1.id !== f2.id) {
          if (!f1.relations.has(f2.id)) f1.relations.set(f2.id, 0);
          if (!f2.relations.has(f1.id)) f2.relations.set(f1.id, 0);
        }
      });
    });
    return initialFactions;
  }
  
  updateWorld(state: GameState, deltaTime: number): GameState {
    const newState = { ...state };
    newState.time += deltaTime * newState.speed;
    
    newState.regions = state.regions.map(region => this.updateRegion(region, deltaTime * newState.speed, newState));
    newState.activeEvents = state.activeEvents.map(event => this.updateEvent(event, deltaTime * newState.speed, newState)).filter(e => e.active);
    newState.factions = state.factions.map(faction => this.updateFaction(faction, deltaTime * newState.speed, newState));
    
    this.calculateGlobalStats(newState);
    this.spawnRandomEvents(newState);
    this.applyModeEffects(newState);
    
    return newState;
  }

  private updateFaction(faction: Faction, deltaTime: number, state: GameState): Faction {
    const newFaction = { ...faction };
    let powerChange = 0;

    // Influence change based on regional stability and alignment with ideology
    newFaction.influence.forEach((influence, regionId) => {
      const region = state.regions.find(r => r.id === regionId);
      if (region) {
        let alignmentFactor = 0;
        // Simplified alignment: e.g., democracies benefit from high stability, authoritarians from low.
        // Environmentalists from high environment, Corporatists from high infra/tech.
        switch (newFaction.ideology) {
          case Ideology.DEMOCRATIC:
            alignmentFactor = (region.stability / 100 - 0.5) * 0.1;
            break;
          case Ideology.AUTHORITARIAN:
            alignmentFactor = (0.5 - region.stability / 100) * 0.1;
            break;
          case Ideology.ENVIRONMENTALIST:
            alignmentFactor = (region.environment / 100 - 0.5) * 0.1;
            break;
          case Ideology.CORPORATIST:
            alignmentFactor = (region.infrastructureQuality / 100 + region.technologyLevel / 100 - 1.0) * 0.05;
            break;
          case Ideology.TECHNOCRATIC:
            alignmentFactor = (region.technologyLevel / 100 - 0.6) * 0.1;
            break;
        }
        const currentInfluence = newFaction.influence.get(regionId) || 0;
        const influenceChange = alignmentFactor * deltaTime;
        newFaction.influence.set(regionId, Math.max(0, Math.min(100, currentInfluence + influenceChange)));
        powerChange += influenceChange * 0.1; // Regional influence changes contribute to overall power
      }
    });

    // Power level changes based on HQ region's status
    const hqRegion = state.regions.find(r => r.id === newFaction.headquartersRegion);
    if (hqRegion) {
      powerChange += (hqRegion.stability / 100 - 0.5) * 0.05 * deltaTime;
      if (newFaction.ideology === Ideology.ENVIRONMENTALIST) {
        powerChange += (hqRegion.environment / 100 - 0.5) * 0.05 * deltaTime;
      }
    }

    // Simulate interactions with other factions (simplified)
    newFaction.relations.forEach((relationValue, otherFactionId) => {
      const otherFaction = state.factions.find(f => f.id === otherFactionId);
      if (otherFaction) {
        // Power level influenced by relations and power of other factions
        // If relation is positive, their success helps you a bit, and vice versa
        powerChange += (relationValue / 100) * (otherFaction.powerLevel / 100 - 0.5) * 0.001 * deltaTime;
      }
    });

    newFaction.powerLevel = Math.max(0, Math.min(100, newFaction.powerLevel + powerChange));

    // TODO: Faction-specific events or actions could be triggered here based on powerLevel, influence, relations etc.

    return newFaction;
  }
  
  private updateRegion(region: WorldRegion, deltaTime: number, state: GameState): WorldRegion {
    const newRegion = { ...region };
    
    const noise = this.noise2D(region.x * 5, state.time * 0.0001) * 0.1;
    
    newRegion.health = Math.max(0, Math.min(100, newRegion.health + noise));
    newRegion.environment = Math.max(0, Math.min(100, newRegion.environment + noise * 0.8));
    
    // Region stability is now also influenced by the dominant faction's power in that region
    let totalInfluence = 0;
    let stabilityFromFactions = 0;
    state.factions.forEach(faction => {
      const influenceInRegion = faction.influence.get(region.id) || 0;
      totalInfluence += influenceInRegion;
      // Faction power and ideology contribute to stability. E.g. high power democratic might boost it.
      // This is a simplified model.
      let factionStabilityEffect = (faction.powerLevel / 100 - 0.5);
      if (faction.ideology === Ideology.AUTHORITARIAN && faction.powerLevel > 60) {
        factionStabilityEffect += 0.1; // Strong authoritarian might enforce stability
      } else if (faction.ideology === Ideology.DEMOCRATIC && faction.powerLevel < 40) {
        factionStabilityEffect -= 0.1; // Weak democratic might lead to instability
      }
      stabilityFromFactions += influenceInRegion * factionStabilityEffect;
    });

    const avgFactionStabilityEffect = totalInfluence > 0 ? stabilityFromFactions / totalInfluence : 0;
    newRegion.stability = Math.max(0, Math.min(100, newRegion.stability + noise * 1.2 + avgFactionStabilityEffect * 0.05 * deltaTime));

    // Resource generation/consumption logic
    // Base regeneration/degradation rates
    newRegion.foodSupply += (newRegion.environment / 100 - 0.4) * 0.05 * deltaTime; // Higher environment = more food
    newRegion.rareEarthElements -= 0.005 * deltaTime; // Gradual depletion
    newRegion.technologyLevel += (newRegion.stability / 100) * (newRegion.infrastructureQuality / 100) * 0.01 * deltaTime;
    newRegion.infrastructureQuality += (newRegion.stability / 100 - 0.5) * 0.02 * deltaTime;

    // Consumption based on population
    newRegion.foodSupply -= (newRegion.population / 1000000000) * 0.1 * deltaTime;

    // Clamp resource values
    newRegion.foodSupply = Math.max(0, Math.min(100, newRegion.foodSupply));
    newRegion.rareEarthElements = Math.max(0, Math.min(100, newRegion.rareEarthElements));
    newRegion.technologyLevel = Math.max(0, Math.min(100, newRegion.technologyLevel));
    newRegion.infrastructureQuality = Math.max(0, Math.min(100, newRegion.infrastructureQuality));

    region.events.forEach(event => {
      if (event.active) {
        this.applyEventToRegion(newRegion, event);
      }
    });
    
    const populationChangeFactor = (newRegion.health / 100) * (newRegion.foodSupply / 100) * (newRegion.stability / 100) - 0.5;
    newRegion.population = Math.max(0, newRegion.population * (1 + populationChangeFactor * 0.001 * deltaTime));
    
    return newRegion;
  }
  
  private updateEvent(event: RegionEvent, deltaTime: number, state: GameState): RegionEvent {
    const newEvent = { ...event };
    newEvent.timeLeft -= deltaTime;
    
    if (newEvent.timeLeft <= 0) {
      newEvent.active = false;
    }
    
    if (newEvent.spread > 0 && Math.random() < 0.01) {
      // Event spreading logic
      newEvent.spread *= 0.99;
    }
    
    return newEvent;
  }
  
  private applyEventToRegion(region: WorldRegion, event: RegionEvent) {
    const distance = Math.sqrt((region.x - event.x) ** 2 + (region.y - event.y) ** 2);
    const impact = Math.max(0, 1 - distance / 0.5) * event.severity;
    
    switch (event.type) {
      case EventType.NUCLEAR_STRIKE:
        region.health -= impact * 50;
        region.environment -= impact * 40;
        region.population *= (1 - impact * 0.3);
        break;
      case EventType.BIOLOGICAL_WEAPON:
        region.health -= impact * 40;
        region.population *= (1 - impact * 0.2);
        break;
      case EventType.CYBER_ATTACK:
        region.stability -= impact * 30;
        break;
      case EventType.CLIMATE_DISASTER:
        region.environment -= impact * 35;
        region.population *= (1 - impact * 0.1);
        break;
      case EventType.ROGUE_AI:
        region.stability -= impact * 45;
        region.health -= impact * 25;
        break;
      case EventType.HEALING:
        region.health = Math.min(100, region.health + impact * 20);
        break;
      case EventType.ENVIRONMENTAL_RESTORATION:
        region.environment = Math.min(100, region.environment + impact * 25);
        break;
      // New Economic Event Effects
      case EventType.TRADE_WAR:
        region.stability -= impact * 20;
        region.infrastructureQuality -= impact * 10;
        // Affect relations between factions involved in the region
        state.factions.forEach(f => {
          if ((f.influence.get(region.id) || 0) > 30) { // Faction has significant influence
            state.factions.forEach(other_f => {
              if (f.id !== other_f.id && (other_f.influence.get(region.id) || 0) > 30) {
                const currentRelation = f.relations.get(other_f.id) || 0;
                f.relations.set(other_f.id, Math.max(-100, currentRelation - impact * 10));
              }
            });
          }
        });
        break;
      case EventType.RESOURCE_DISCOVERY:
        region.rareEarthElements = Math.min(100, region.rareEarthElements + impact * 30);
        region.environment -= impact * 5; // Discovery might have slight env cost
        break;
      case EventType.ECONOMIC_RECESSION:
        region.stability -= impact * 25;
        region.infrastructureQuality -= impact * 15;
        region.foodSupply -= impact * 10;
        region.population *= (1 - impact * 0.05);
        break;
      case EventType.TECHNOLOGICAL_LEAP:
        region.technologyLevel = Math.min(100, region.technologyLevel + impact * 35);
        region.stability += impact * 5;
        break;
      case EventType.GLOBAL_TRADE_DEAL: // This might be better as a global event, or affect multiple regions
        region.stability += impact * 10;
        region.infrastructureQuality += impact * 5;
        region.foodSupply += impact * 5;
        break;
    }
    
    region.health = Math.max(0, Math.min(100, region.health));
    region.environment = Math.max(0, Math.min(100, region.environment));
    region.stability = Math.max(0, Math.min(100, region.stability));
    region.rareEarthElements = Math.max(0, Math.min(100, region.rareEarthElements));
    region.foodSupply = Math.max(0, Math.min(100, region.foodSupply));
    region.technologyLevel = Math.max(0, Math.min(100, region.technologyLevel));
    region.infrastructureQuality = Math.max(0, Math.min(100, region.infrastructureQuality));
  }
  
  private calculateGlobalStats(state: GameState) {
    state.globalPopulation = state.regions.reduce((sum, r) => sum + r.population, 0);
    state.globalHealth = state.regions.reduce((sum, r) => sum + r.health, 0) / state.regions.length;
    state.globalEnvironment = state.regions.reduce((sum, r) => sum + r.environment, 0) / state.regions.length;
    state.globalStability = state.regions.reduce((sum, r) => sum + r.stability, 0) / state.regions.length;
    
    state.globalRareEarthElements = state.regions.reduce((sum, r) => sum + r.rareEarthElements, 0) / state.regions.length;
    state.globalFoodSupply = state.regions.reduce((sum, r) => sum + r.foodSupply, 0) / state.regions.length;
    state.globalTechnologyLevel = state.regions.reduce((sum, r) => sum + r.technologyLevel, 0) / state.regions.length;
    state.globalInfrastructureQuality = state.regions.reduce((sum, r) => sum + r.infrastructureQuality, 0) / state.regions.length;

    const avgWellbeing = (state.globalHealth + state.globalEnvironment + state.globalStability) / 3;
    state.globalSuffering = Math.max(0, Math.min(100, 100 - avgWellbeing));

    // Calculate Global Economic Prosperity as a composite score
    const economicFactors = (
      state.globalFoodSupply +
      state.globalTechnologyLevel +
      state.globalInfrastructureQuality +
      (100 - state.globalSuffering) + // Lower suffering = higher prosperity
      state.globalStability
    ) / 5;
    state.globalEconomicProsperity = Math.max(0, Math.min(100, economicFactors));
  }
  
  private spawnRandomEvents(state: GameState) {
    if (Math.random() < 0.005) {
      const eventTypes = Object.values(EventType);
      const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const region = state.regions[Math.floor(Math.random() * state.regions.length)];
      
      const event: RegionEvent = {
        id: Math.random().toString(36),
        type: randomType,
        severity: Math.random() * 0.8 + 0.2,
        duration: 5000 + Math.random() * 15000,
        timeLeft: 5000 + Math.random() * 15000,
        x: region.x + (Math.random() - 0.5) * 0.2,
        y: region.y + (Math.random() - 0.5) * 0.2,
        spread: Math.random() * 0.3,
        active: true
      };
      
      state.activeEvents.push(event);
      region.events.push(event);
    }
  }
  
  private applyModeEffects(state: GameState) {
    switch (state.mode) {
      case 'chaos':
        if (Math.random() < 0.02) {
          this.spawnRandomEvents(state);
        }
        break;
      case 'peace':
        state.regions.forEach(region => {
          region.health = Math.min(100, region.health + 0.1);
          region.environment = Math.min(100, region.environment + 0.05);
          region.stability = Math.min(100, region.stability + 0.08);
        });
        break;
    }
  }
  
  triggerEvent(state: GameState, eventType: EventType, targetRegion?: string): GameState {
    const region = targetRegion 
      ? state.regions.find(r => r.id === targetRegion) 
      : state.regions[Math.floor(Math.random() * state.regions.length)];
    
    if (!region) return state;
    
    const event: RegionEvent = {
      id: Math.random().toString(36),
      type: eventType,
      severity: 0.8 + Math.random() * 0.2,
      duration: 8000,
      timeLeft: 8000,
      x: region.x + (Math.random() - 0.5) * 0.1,
      y: region.y + (Math.random() - 0.5) * 0.1,
      spread: Math.random() * 0.2,
      active: true
    };
    
    const newState = { ...state };
    newState.activeEvents.push(event);
    region.events.push(event);
    
    return newState;
  }
}