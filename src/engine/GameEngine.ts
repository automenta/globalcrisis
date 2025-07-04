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
  PEACE_TREATY = 'peace_treaty'
}

export interface GameState {
  globalPopulation: number;
  globalHealth: number;
  globalEnvironment: number;
  globalStability: number;
  globalSuffering: number;
  time: number;
  regions: WorldRegion[];
  activeEvents: RegionEvent[];
  mode: 'chaos' | 'peace' | 'neutral';
  running: boolean;
  speed: number;
}

export class GameEngine {
  private noise2D = createNoise2D();
  private lastUpdate = 0;
  
  constructor() {}
  
  createInitialWorld(): GameState {
    const regions: WorldRegion[] = [
      { id: 'na', name: 'North America', population: 580000000, health: 78, environment: 65, stability: 75, x: -0.6, y: 0.3, color: [0.3, 0.6, 0.9], events: [] },
      { id: 'sa', name: 'South America', population: 430000000, health: 72, environment: 55, stability: 65, x: -0.4, y: -0.4, color: [0.4, 0.8, 0.3], events: [] },
      { id: 'eu', name: 'Europe', population: 750000000, health: 82, environment: 70, stability: 80, x: 0.1, y: 0.4, color: [0.7, 0.4, 0.9], events: [] },
      { id: 'af', name: 'Africa', population: 1400000000, health: 65, environment: 45, stability: 55, x: 0.2, y: -0.1, color: [0.9, 0.6, 0.2], events: [] },
      { id: 'as', name: 'Asia', population: 4600000000, health: 74, environment: 50, stability: 70, x: 0.6, y: 0.2, color: [0.9, 0.3, 0.4], events: [] },
      { id: 'oc', name: 'Oceania', population: 50000000, health: 85, environment: 75, stability: 85, x: 0.8, y: -0.5, color: [0.2, 0.9, 0.7], events: [] }
    ];
    
    return {
      globalPopulation: regions.reduce((sum, r) => sum + r.population, 0),
      globalHealth: regions.reduce((sum, r) => sum + r.health, 0) / regions.length,
      globalEnvironment: regions.reduce((sum, r) => sum + r.environment, 0) / regions.length,
      globalStability: regions.reduce((sum, r) => sum + r.stability, 0) / regions.length,
      globalSuffering: 25,
      time: 0,
      regions,
      activeEvents: [],
      mode: 'neutral',
      running: false,
      speed: 1
    };
  }
  
  updateWorld(state: GameState, deltaTime: number): GameState {
    const newState = { ...state };
    newState.time += deltaTime * newState.speed;
    
    newState.regions = state.regions.map(region => this.updateRegion(region, deltaTime * newState.speed, newState));
    newState.activeEvents = state.activeEvents.map(event => this.updateEvent(event, deltaTime * newState.speed, newState)).filter(e => e.active);
    
    this.calculateGlobalStats(newState);
    this.spawnRandomEvents(newState);
    this.applyModeEffects(newState);
    
    return newState;
  }
  
  private updateRegion(region: WorldRegion, deltaTime: number, state: GameState): WorldRegion {
    const newRegion = { ...region };
    
    const noise = this.noise2D(region.x * 5, state.time * 0.0001) * 0.1;
    
    newRegion.health = Math.max(0, Math.min(100, newRegion.health + noise));
    newRegion.environment = Math.max(0, Math.min(100, newRegion.environment + noise * 0.8));
    newRegion.stability = Math.max(0, Math.min(100, newRegion.stability + noise * 1.2));
    
    region.events.forEach(event => {
      if (event.active) {
        this.applyEventToRegion(newRegion, event);
      }
    });
    
    const populationChange = (newRegion.health / 100) * (newRegion.environment / 100) * (newRegion.stability / 100) - 0.5;
    newRegion.population = Math.max(0, newRegion.population * (1 + populationChange * 0.001));
    
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
    // Impact falloff: full impact within 0.1 distance units, then linear falloff up to 0.5 distance units.
    // The previous calculation `1 - distance / 0.5` meant that at distance 0, impact was 1, but at distance 0.25 (halfway), impact was 0.5.
    // A more common falloff model might be a sharper drop. Let's make it so that impact is full if very close.
    // Max distance for any effect will be `maxEffectRadius`.
    const maxEffectRadius = 0.5; // Region "radius" for effect spread.
    let normalizedDistance = distance / maxEffectRadius; // distance normalized to [0, N] where 1 is edge of radius.
    
    // Calculate base impact factor based on distance and event severity
    // Example: Full impact if distance is 0, linearly decreases to 0 at maxEffectRadius.
    const impactFactor = Math.max(0, (1 - normalizedDistance) * event.severity);

    if (impactFactor <= 0) { // No impact if too far or severity is zero
      return;
    }

    const definition = THREAT_DEFINITIONS[event.type];
    if (!definition) {
      console.warn(`No definition found for event type: ${event.type}`);
      return;
    }

    const effects = definition.effects;

    if (effects.health) {
      region.health += effects.health * impactFactor;
    }
    if (effects.environment) {
      region.environment += effects.environment * impactFactor;
    }
    if (effects.stability) {
      region.stability += effects.stability * impactFactor;
    }
    if (effects.population) { // Absolute population change
      region.population += effects.population * impactFactor;
    }
    if (effects.populationMultiplier) { // Multiplicative change
      // Apply multiplier less harshly at distance:
      // Full effect (e.g., 0.7x) at point blank, no effect (1.0x) at max distance.
      // Lerp between 1 and the multiplier based on impactFactor.
      const effectiveMultiplier = 1 + (effects.populationMultiplier - 1) * impactFactor;
      region.population *= effectiveMultiplier;
    }
    
    region.health = Math.max(0, Math.min(100, region.health));
    region.environment = Math.max(0, Math.min(100, region.environment));
    region.stability = Math.max(0, Math.min(100, region.stability));
  }
  
  private calculateGlobalStats(state: GameState) {
    state.globalPopulation = state.regions.reduce((sum, r) => sum + r.population, 0);
    state.globalHealth = state.regions.reduce((sum, r) => sum + r.health, 0) / state.regions.length;
    state.globalEnvironment = state.regions.reduce((sum, r) => sum + r.environment, 0) / state.regions.length;
    state.globalStability = state.regions.reduce((sum, r) => sum + r.stability, 0) / state.regions.length;
    
    const avgWellbeing = (state.globalHealth + state.globalEnvironment + state.globalStability) / 3;
    state.globalSuffering = Math.max(0, Math.min(100, 100 - avgWellbeing));
  }
  
  private spawnRandomEvents(state: GameState) {
    if (Math.random() < 0.005) {
      const eventTypes = Object.values(EventType);
      const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const region = state.regions[Math.floor(Math.random() * state.regions.length)];
      
      const definition = THREAT_DEFINITIONS[randomType];
      if (!definition) {
        // Should not happen if all EventTypes are in THREAT_DEFINITIONS
        console.warn(`No definition for random event type: ${randomType}`);
        return;
      }

      const event: RegionEvent = {
        id: Math.random().toString(36),
        type: randomType,
        severity: Math.random() * 0.8 + 0.2, // Keep severity random for spawned events
        duration: definition.duration,
        timeLeft: definition.duration,
        x: region.x + (Math.random() - 0.5) * 0.2, // Position within the region
        y: region.y + (Math.random() - 0.5) * 0.2,
        spread: Math.random() * 0.3, // Keep spread random
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
    
    const definition = THREAT_DEFINITIONS[eventType];
    if (!definition) {
      console.warn(`No definition found for event type: ${eventType} in triggerEvent`);
      return state; // or throw error
    }

    const event: RegionEvent = {
      id: Math.random().toString(36),
      type: eventType,
      severity: 0.8 + Math.random() * 0.2, // Keep severity somewhat random for now
      duration: definition.duration,
      timeLeft: definition.duration,
      x: region.x + (Math.random() - 0.5) * 0.1, // Slight random offset from region center
      y: region.y + (Math.random() - 0.5) * 0.1,
      spread: Math.random() * 0.2, // Keep spread random for now
      active: true
    };
    
    const newState = { ...state };
    newState.activeEvents.push(event);
    region.events.push(event);
    
    return newState;
  }

  public getThreatDefinition(eventType: EventType): ThreatDefinition | undefined {
    return THREAT_DEFINITIONS[eventType];
  }
}