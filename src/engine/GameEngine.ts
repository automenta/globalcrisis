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