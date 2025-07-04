import { createNoise2D } from 'simplex-noise';
import {
    THREAT_DEFINITIONS, ThreatDefinition,
    FACILITY_DEFINITIONS, PlanetaryFacilityDefinition, FacilityType
} from './definitions';

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
  activeFacilities: PlanetaryFacility[];
  globalResources: Record<string, number>; // e.g., { research: 100, credits: 1000 }
  mode: 'chaos' | 'peace' | 'neutral';
  running: boolean;
  speed: number;
}

export interface PlanetaryFacility {
  id: string;
  type: FacilityType;
  regionId: string; // ID of the region it's in
  hexagonId?: string; // Optional: specific hexagon it's on
  operational: boolean;
  constructionTimeLeft?: number; // Optional: for facilities that take time to build
  // Add any other instance-specific data, like current damage, upgrade level etc.
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
      activeFacilities: [],
      globalResources: { research: 0, credits: 1000 }, // Starting resources
      mode: 'neutral',
      running: false,
      speed: 1
    };
  }
  
  private updateFacility(facility: PlanetaryFacility, deltaTime: number, state: GameState): PlanetaryFacility {
    const newFacility = { ...facility };
    if (newFacility.constructionTimeLeft && newFacility.constructionTimeLeft > 0) {
      newFacility.constructionTimeLeft -= deltaTime * state.speed;
      if (newFacility.constructionTimeLeft <= 0) {
        newFacility.operational = true;
        newFacility.constructionTimeLeft = 0;
        console.log(`Facility ${newFacility.id} (${newFacility.type}) in region ${newFacility.regionId} is now operational.`);
        // TODO: Trigger any "on construction complete" effects or notifications
      }
      return newFacility; // Not yet operational, or just became operational
    }

    if (!newFacility.operational) {
      return newFacility; // Skip updates for non-operational facilities
    }

    // Apply facility effects
    const definition = FACILITY_DEFINITIONS[newFacility.type];
    if (definition) {
      definition.effects.forEach(effect => {
        if (effect.resourceYield) {
          for (const resourceType in effect.resourceYield) {
            state.globalResources[resourceType] = (state.globalResources[resourceType] || 0) + effect.resourceYield[resourceType] * deltaTime * state.speed;
          }
        }
        if (effect.stabilityModifier) {
          const region = state.regions.find(r => r.id === newFacility.regionId);
          if (region) {
            region.stability = Math.max(0, Math.min(100, region.stability + effect.stabilityModifier * deltaTime * state.speed));
          }
        }
        // Add more effect types here
      });
    }
    return newFacility;
  }

  updateWorld(state: GameState, deltaTime: number): GameState {
    const newState = { ...state }; // Shallow copy is important
    // Ensure deep copies for mutable parts of state if necessary, e.g., globalResources
    newState.globalResources = { ...state.globalResources };
    newState.regions = state.regions.map(r => ({...r, events: [...r.events]})); // Ensure regions and their event arrays are new
    newState.activeEvents = state.activeEvents.map(e => ({...e}));
    newState.activeFacilities = state.activeFacilities.map(f => ({...f}));


    newState.time += deltaTime * newState.speed;
    
    // Update facilities first, as they might affect regions or global stats
    newState.activeFacilities = newState.activeFacilities.map(facility => this.updateFacility(facility, deltaTime, newState));
    // TODO: Filter out destroyed facilities if that becomes a feature

    newState.regions = newState.regions.map(region => this.updateRegion(region, deltaTime * newState.speed, newState));

    // Process existing events (decay, etc.)
    let currentActiveEvents = state.activeEvents
        .map(event => this.updateEvent(event, deltaTime * newState.speed, newState))
        .filter(e => e.active);

    // Process spreading and collect newly created events
    const newlySpreadEvents = this.processEventSpreading(newState, deltaTime * newState.speed);

    currentActiveEvents.push(...newlySpreadEvents);
    
    // Assign to newState and add to relevant regions
    newState.activeEvents = currentActiveEvents;
    newlySpreadEvents.forEach(newEvent => {
      const targetRegion = newState.regions.find(r =>
        Math.abs(r.x - newEvent.x) < 0.1 && Math.abs(r.y - newEvent.y) < 0.1 // Approximate find
      );
      if (targetRegion) {
        // Ensure the event is only added if not already present from another source this tick
        if (!targetRegion.events.find(e => e.id === newEvent.id)) {
            targetRegion.events.push(newEvent);
        }
      } else {
         // If region not found based on newEvent x,y, find closest or handle error
         // For simplicity, let's find the region closest to newEvent.x, newEvent.y
         let closestRegion = newState.regions[0];
         let minDistSq = Infinity;
         newState.regions.forEach(r => {
            const distSq = (r.x - newEvent.x)**2 + (r.y - newEvent.y)**2;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closestRegion = r;
            }
         });
         if (!closestRegion.events.find(e => e.id === newEvent.id)) {
            closestRegion.events.push(newEvent);
         }
      }
    });
    // Also, ensure regions' event lists are kept in sync with activeEvents (remove inactive)
    newState.regions.forEach(region => {
        // A region's event list should only contain active events that are also in the global activeEvents list.
        // And, arguably, those events should still be considered "in" or "affecting" this region.
        // The current `applyEventToRegion` checks distance, which is good.
        // For simplicity here, we ensure that any event in a region's list is also in the master active list.
        region.events = region.events.filter(eventInRegion =>
            newState.activeEvents.some(activeGlobalEvent => activeGlobalEvent.id === eventInRegion.id)
        );
    });


    this.calculateGlobalStats(newState);
    this.spawnRandomEvents(newState); // This also adds events
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
      return newEvent; // Return early if event is no longer active
    }

    const definition = THREAT_DEFINITIONS[event.type];
    if (definition && definition.spread && newEvent.active) {
      if (Math.random() < definition.spread.chance * deltaTime) { // Chance per second
        // Attempt to spread
        const targetRegions = state.regions.filter(r => {
          // Simple distance check for spread target candidate
          const distance = Math.sqrt((r.x - event.x) ** 2 + (r.y - event.y) ** 2);
          return distance > 0.01 && distance < definition.spread.radius; // Spread to distinct regions within radius
        });

        if (targetRegions.length > 0) {
          const targetRegion = targetRegions[Math.floor(Math.random() * targetRegions.length)];

          // Create a new event for the target region
          // Spread events might be less severe or have reduced duration/spread chance
          const newSpreadEvent: RegionEvent = {
            ...event, // Inherit properties from parent event
            id: Math.random().toString(36),
            x: targetRegion.x + (Math.random() - 0.5) * 0.1, // Position within the new target region
            y: targetRegion.y + (Math.random() - 0.5) * 0.1,
            severity: event.severity * (1 - definition.spread.decay), // Decay severity
            // Optionally, reduce duration or spread capability of the new event
            // timeLeft: event.timeLeft * (1 - definition.spread.decay),
            // spread: event.spread * (1 - definition.spread.decay), // This 'spread' property on event is numeric, def.spread is object
          };

          // Check if an event of the same type already exists and is active in the target region (simple prevention of over-stacking)
          const alreadyExists = state.activeEvents.some(e => e.type === newSpreadEvent.type && e.x === newSpreadEvent.x && e.y === newSpreadEvent.y);
          // A better check would be if it's in targetRegion.events
          const alreadyInRegion = targetRegion.events.some(e => e.type === newSpreadEvent.type && e.active);

          if (!alreadyInRegion && newSpreadEvent.severity > 0.05) { // Don't spread if too weak
            // This modification of state.activeEvents from within a map is tricky.
            // It's better to collect new events and add them after the loop.
            // For now, this will be a conceptual note; direct mutation here is problematic.
            // A robust solution would queue new events.
            // To avoid direct state mutation issue in map:
            // We can't directly modify state.activeEvents here.
            // This needs to be handled in updateWorld by collecting potential new events.
            // Let's log for now, and address the actual addition in updateWorld.
            console.log(`Event ${event.type} trying to spread to ${targetRegion.name}`);
            // To properly implement, updateEvent should return an array: [updatedEvent, newSpawnedEvent_or_null]
            // Or, GameEngine's updateWorld collects these.
          }
        }
      }
    }
    
    return newEvent;
  }

  // Helper function to be called from updateWorld to handle spawning of spread events
  private processEventSpreading(state: GameState, deltaTime: number): RegionEvent[] {
    const newlySpreadEvents: RegionEvent[] = [];
    state.activeEvents.forEach(event => {
      if (!event.active) return;

      const definition = THREAT_DEFINITIONS[event.type];
      if (definition && definition.spread) {
        if (Math.random() < definition.spread.chance * deltaTime) { // Chance per second
          const candidateRegions = state.regions.filter(r => {
            const distance = Math.sqrt((r.x - event.x) ** 2 + (r.y - event.y) ** 2);
            // Ensure it's a different region and within spread radius
            return distance > 0.01 && distance < definition.spread.radius;
          });

          if (candidateRegions.length > 0) {
            const targetRegion = candidateRegions[Math.floor(Math.random() * candidateRegions.length)];
            const alreadyHasEvent = targetRegion.events.some(e => e.type === event.type && e.active);

            if (!alreadyHasEvent) {
              const newSeverity = event.severity * (1 - definition.spread.decay);
              if (newSeverity > 0.1) { // Minimum severity to spread
                const spreadEventInstance: RegionEvent = {
                  id: Math.random().toString(36),
                  type: event.type,
                  severity: newSeverity,
                  duration: definition.duration * (1 - definition.spread.decay) || event.duration * 0.8, // Decay duration too
                  timeLeft: definition.duration * (1 - definition.spread.decay) || event.duration * 0.8,
                  x: targetRegion.x + (Math.random() - 0.5) * 0.05, // Centered in target region
                  y: targetRegion.y + (Math.random() - 0.5) * 0.05,
                  spread: event.spread, // Original event's spread value, if applicable (numeric one)
                  active: true,
                };
                newlySpreadEvents.push(spreadEventInstance);
                // Also add to the region's list, this will be done when adding to activeEvents
              }
            }
          }
        }
      }
    });
    return newlySpreadEvents;
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

export interface BuildFacilityResult {
  success: boolean;
  message: string;
  newState?: GameState;
}

// ... inside GameEngine class
public buildFacility(state: GameState, facilityType: FacilityType, regionId: string, hexagonId?: string): BuildFacilityResult {
    const definition = FACILITY_DEFINITIONS[facilityType];
    if (!definition) {
      const message = `Facility definition not found for type: ${facilityType}`;
      console.warn(message);
      return { success: false, message };
    }

    const region = state.regions.find(r => r.id === regionId);
    if (!region) {
      const message = `Region not found for ID: ${regionId}`;
      console.warn(message);
      return { success: false, message };
    }

    // Check max per region
    if (definition.maxPerRegion !== undefined) {
      const countInRegion = state.activeFacilities.filter(f => f.regionId === regionId && f.type === facilityType).length;
      if (countInRegion >= definition.maxPerRegion) {
        const message = `Cannot build ${definition.name}: Max per region (${definition.maxPerRegion}) reached for ${region.name}.`;
        console.log(message);
        return { success: false, message };
      }
    }

    // Check max global
    if (definition.maxGlobal !== undefined) {
      const countGlobal = state.activeFacilities.filter(f => f.type === facilityType).length;
      if (countGlobal >= definition.maxGlobal) {
        const message = `Cannot build ${definition.name}: Max global (${definition.maxGlobal}) reached.`;
        console.log(message);
        return { success: false, message };
      }
    }

    // Check resource costs
    const costs = definition.cost || {};
    let canAfford = true;
    let missingResources = "";
    for (const resource in costs) {
      if ((state.globalResources[resource] || 0) < costs[resource]) {
        canAfford = false;
        missingResources += `${resource}: ${costs[resource]} (You have ${state.globalResources[resource] || 0}) `;
      }
    }

    if (!canAfford) {
      const message = `Cannot build ${definition.name}: Insufficient resources. Missing: ${missingResources.trim()}`;
      console.log(message);
      return { success: false, message };
    }

    // Deduct costs and prepare new state for facilities
    const newGlobalResources = { ...state.globalResources };
    for (const resource in costs) {
      newGlobalResources[resource] -= costs[resource];
    }

    // TODO: Check resource costs from definition.cost against state.globalResources
    // For now, skipping cost check. Example:
    // for (const resource in definition.cost) {
    //   if (state.globalResources[resource] < definition.cost[resource]) {
    //     console.log(`Cannot build ${facilityType}: insufficient ${resource}.`);
    //     return { success: false, message: `Insufficient ${resource}` };
    //   }
    // }
    // Deduct costs is already handled with newGlobalResources


    const newFacilityInstance: PlanetaryFacility = {
      id: Math.random().toString(36),
      type: facilityType,
      regionId: regionId,
      hexagonId: hexagonId,
      operational: false, // Starts non-operational
      // constructionTimeLeft: definition.constructionTime || 10, // Should be in definition
      constructionTimeLeft: 10, // Placeholder until constructionTime is added to definition
    };

    const updatedActiveFacilities = [...state.activeFacilities, newFacilityInstance];

    const successMessage = `${definition.name} construction started in ${region.name}.`;
    console.log(successMessage);

    return {
      success: true,
      message: successMessage,
      newState: {
        ...state,
        activeFacilities: updatedActiveFacilities,
        globalResources: newGlobalResources,
      }
    };
  }
}