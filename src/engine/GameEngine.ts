import { createNoise2D } from 'simplex-noise';
import {
    THREAT_DEFINITIONS, ThreatDefinition,
    FACILITY_DEFINITIONS, PlanetaryFacilityDefinition, FacilityType, StrategicResourceType
} from './definitions';
import { TECH_TREE } from './Technology'; // Import TECH_TREE

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
  gdp: number; // Gross Domestic Product
  resourceDemand: Record<StrategicResourceType, number>;
  resourceProduction: Record<StrategicResourceType, number>;
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
  originatingPlayerId?: string; // Optional: ID of the player who triggered the event
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
  globalPopulation: number; // Remains global for overall world state
  globalHealth: number; // Remains global
  globalEnvironment: number; // Remains global
  globalStability: number; // Remains global
  globalSuffering: number; // Remains global
  time: number;
  regions: WorldRegion[]; // Regions are global, facilities on them can be player-owned
  activeEvents: RegionEvent[]; // Events are global, may affect all or target specific player assets
  hexagonStrategicResources: Record<string, StrategicResourceType | null >; // Hex resources are global

  players: Record<string, PlayerState>; // Player-specific states

  mode: 'chaos' | 'peace' | 'neutral';
  running: boolean;
  speed: number;
}

export interface PlayerState {
  id: string;
  name: string;
  isHuman: boolean;
  activeFacilities: PlanetaryFacility[];
  globalResources: Record<string, number>; // Player's own resources
  unlockedTechs: string[];
  currentResearch?: {
    techId: string;
    progress: number;
  };
  scannedHexes: Set<string>; // Hexes scanned by this player
  // Potentially add player-specific scores, objectives, relationships etc. later
}

export interface PlanetaryFacility {
  id: string;
  ownerPlayerId: string; // ID of the player who owns this facility
  type: FacilityType;
  regionId: string; // ID of the region it's in
  hexagonId?: string; // Optional: specific hexagon it's on
  operational: boolean;
  constructionTimeLeft?: number;
}

// Import StrategicResourceType correctly at the top with other imports from definitions
// This will be done in a subsequent step by editing the main import line.
// For now, focus on removing the duplicate class and constructor.
import { AIPlayer } from './AIPlayer'; // Import AIPlayer

export class GameEngine {
  private noise2D = createNoise2D();
  private lastUpdate = 0;
  public aiPlayers: AIPlayer[] = []; // Manage AI players

  constructor(numAIPlayers: number = 1) {
    // AI players will be initialized when a new game is created / initial world is set up.
    // The constructor can set up the number of AIs, but their instances tied to a game state
    // might be better handled in createInitialWorld or a dedicated setup method.
  }
  private static generateHexagonIds(count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(`hex_${i}`);
    }
    return ids;
  }

  private static assignStrategicResourcesToHexagons(hexagonIds: string[]): Record<string, StrategicResourceType | null> {
    const assignments: Record<string, StrategicResourceType | null> = {};
    const resourceTypes = Object.values(StrategicResourceType);
    const numResourceTypes = resourceTypes.length;
    const chanceOfResource = 0.1; // 10% chance any given hex has a strategic resource

    hexagonIds.forEach(hexId => {
      if (Math.random() < chanceOfResource) {
        assignments[hexId] = resourceTypes[Math.floor(Math.random() * numResourceTypes)];
      } else {
        assignments[hexId] = null;
      }
    });
    // console.log("Strategic resource assignments:", assignments); // Less console noise
    return assignments;
  }

  createInitialWorld(numAI: number = 1): GameState {
    const initialResourceValues = () => {
      const resources: Record<StrategicResourceType, number> = {} as Record<StrategicResourceType, number>;
      for (const resType of Object.values(StrategicResourceType)) {
        resources[resType] = Math.random() * 10 + 5; // Base demand/production between 5-15
      }
      return resources;
    };

    const regions: WorldRegion[] = [
      // Same region definitions as before
      { id: 'na', name: 'North America', population: 580000000, health: 78, environment: 65, stability: 75, x: -0.6, y: 0.3, color: [0.3, 0.6, 0.9], events: [], gdp: 25000, resourceDemand: initialResourceValues(), resourceProduction: initialResourceValues() },
      { id: 'sa', name: 'South America', population: 430000000, health: 72, environment: 55, stability: 65, x: -0.4, y: -0.4, color: [0.4, 0.8, 0.3], events: [], gdp: 10000, resourceDemand: initialResourceValues(), resourceProduction: initialResourceValues() },
      { id: 'eu', name: 'Europe', population: 750000000, health: 82, environment: 70, stability: 80, x: 0.1, y: 0.4, color: [0.7, 0.4, 0.9], events: [], gdp: 22000, resourceDemand: initialResourceValues(), resourceProduction: initialResourceValues() },
      { id: 'af', name: 'Africa', population: 1400000000, health: 65, environment: 45, stability: 55, x: 0.2, y: -0.1, color: [0.9, 0.6, 0.2], events: [], gdp: 5000, resourceDemand: initialResourceValues(), resourceProduction: initialResourceValues() },
      { id: 'as', name: 'Asia', population: 4600000000, health: 74, environment: 50, stability: 70, x: 0.6, y: 0.2, color: [0.9, 0.3, 0.4], events: [], gdp: 30000, resourceDemand: initialResourceValues(), resourceProduction: initialResourceValues() },
      { id: 'oc', name: 'Oceania', population: 50000000, health: 85, environment: 75, stability: 85, x: 0.8, y: -0.5, color: [0.2, 0.9, 0.7], events: [], gdp: 3000, resourceDemand: initialResourceValues(), resourceProduction: initialResourceValues() }
    ];

    const numberOfHexagons = 256;
    const allHexagonIds = GameEngine.generateHexagonIds(numberOfHexagons);
    const hexagonStrategicResources = GameEngine.assignStrategicResourcesToHexagons(allHexagonIds);

    const players: Record<string, PlayerState> = {};
    const humanPlayerId = 'player_human';
    players[humanPlayerId] = {
      id: humanPlayerId,
      name: 'Human Player',
      isHuman: true,
      activeFacilities: [],
      globalResources: { research: 10, credits: 1000, energy: 500, defense: 100, ...this.initializeStrategicResourceCounts() }, // Initial values
      unlockedTechs: [],
      currentResearch: undefined,
      scannedHexes: new Set<string>(),
    };

    this.aiPlayers = []; // Clear previous AI players
    for (let i = 0; i < numAI; i++) {
      const aiPlayerId = `player_ai_${i}`;
      players[aiPlayerId] = {
        id: aiPlayerId,
        name: `AI Player ${i + 1}`,
        isHuman: false,
        activeFacilities: [],
        globalResources: { research: 5, credits: 800, energy: 400, defense: 80, ...this.initializeStrategicResourceCounts() }, // Initial values for AI
        unlockedTechs: [],
        currentResearch: undefined,
        scannedHexes: new Set<string>(),
      };
      this.aiPlayers.push(new AIPlayer(aiPlayerId, this));
    }
    
    return {
      globalPopulation: regions.reduce((sum, r) => sum + r.population, 0),
      globalHealth: regions.reduce((sum, r) => sum + r.health, 0) / regions.length,
      globalEnvironment: regions.reduce((sum, r) => sum + r.environment, 0) / regions.length,
      globalStability: regions.reduce((sum, r) => sum + r.stability, 0) / regions.length,
      globalSuffering: 25,
      time: 0,
      regions,
      activeEvents: [],
      hexagonStrategicResources,
      players,
      mode: 'neutral',
      running: false,
      speed: 1
    };
  }

  private initializeStrategicResourceCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    Object.values(StrategicResourceType).forEach(resType => {
        counts[resType] = 0;
    });
    return counts;
  }

  public performGeoScan(currentState: GameState, satelliteId: string, targetHexagonId: string, playerId: string): { success: boolean, message: string, newState?: GameState, revealedResource?: StrategicResourceType | null } {
    const playerState = currentState.players[playerId];
    if (!playerState) {
        return { success: false, message: `Player ${playerId} not found.` };
    }

    const resource = currentState.hexagonStrategicResources[targetHexagonId];
    if (resource === undefined) {
        return { success: false, message: `Hexagon ${targetHexagonId} is not a valid target.` };
    }

    const newPlayerState = { ...playerState, scannedHexes: new Set(playerState.scannedHexes) };
    newPlayerState.scannedHexes.add(targetHexagonId);

    const newGameState = {
        ...currentState,
        players: {
            ...currentState.players,
            [playerId]: newPlayerState
        }
    };

    console.log(`GeoScan by ${satelliteId} (Player ${playerId}) on ${targetHexagonId} reveals: ${resource || 'nothing'}.`);
    return {
        success: true,
        message: `Scan complete on ${targetHexagonId}. Resource: ${resource || 'None'}`,
        newState: newGameState,
        revealedResource: resource
    };
  }

  public fireEmpPulse(currentState: GameState, satelliteId: string, targetRegionId: string, playerId: string): { success: boolean, message: string, newState?: GameState } {
    const playerState = currentState.players[playerId];
    if (!playerState) {
        return { success: false, message: `Player ${playerId} not found.` };
    }
    // EMP is a global event, not directly tied to player state modification beyond triggering it.
    // However, its effects might disproportionately affect other players' assets.
    // For now, the event itself is global.

    const targetRegion = currentState.regions.find(r => r.id === targetRegionId);
    if (!targetRegion) {
      return { success: false, message: `Region ${targetRegionId} not found.` };
    }

    let updatedState = this.triggerEvent(currentState, EventType.ELECTROMAGNETIC_PULSE, targetRegionId, playerId); // Pass playerId as originator

    console.log(`EMP Pulse by ${satelliteId} (Player ${playerId}) fired on region ${targetRegion.name}.`);
    return {
        success: true,
        message: `EMP Pulse fired on ${targetRegion.name}.`,
        newState: updatedState
    };
  }

  public startResearch(state: GameState, techId: string, playerId: string): { success: boolean, message: string, newState?: GameState } {
    const playerState = state.players[playerId];
    if (!playerState) {
      return { success: false, message: `Player ${playerId} not found.` };
    }

    if (playerState.currentResearch && playerState.currentResearch.techId === techId) {
      return { success: false, message: `Player ${playerId} already researching ${techId}.` };
    }
    if (playerState.unlockedTechs.includes(techId)) {
      return { success: false, message: `Player ${playerId} - Technology ${techId} is already unlocked.` };
    }

    const techDefinition = TECH_TREE[techId];
    if (!techDefinition) {
      return { success: false, message: `Technology ${techId} not found.` };
    }

    const prerequisitesMet = techDefinition.prerequisites.every(prereqId => playerState.unlockedTechs.includes(prereqId));
    if (!prerequisitesMet) {
      return { success: false, message: `Player ${playerId} - Missing prerequisites for ${techId}. Required: ${techDefinition.prerequisites.join(', ')}` };
    }

    const newPlayerState = { ...playerState };
    newPlayerState.currentResearch = { techId, progress: 0 };
    newPlayerState.globalResources = { ...playerState.globalResources };


    const newState = {
        ...state,
        players: {
            ...state.players,
            [playerId]: newPlayerState
        }
    };

    // console.log(`Player ${playerId} started research on ${techId}.`); // Less verbose for AI
    return { success: true, message: `Research started on ${techDefinition.name} for player ${playerId}.`, newState };
  }

  private updateResearchProgress(state: GameState, deltaTime: number, playerId: string): GameState {
    const playerState = state.players[playerId];
    if (!playerState || !playerState.currentResearch) {
      return state; // Return original state if no player or no research
    }

    const techId = playerState.currentResearch.techId;
    const techDefinition = TECH_TREE[techId];
    if (!techDefinition) {
      console.warn(`Player ${playerId} currently researching unknown tech: ${techId}`);
      // Create a new playerState object before modifying it
      const newPlayerStateOnError = { ...playerState, currentResearch: undefined };
      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: newPlayerStateOnError
        }
      };
    }

    // Assuming playerState.globalResources.research is the *rate* of research point generation
    const researchPointsGeneratedThisTick = (playerState.globalResources.research || 0) * deltaTime * state.speed;

    // Create new objects for modification to maintain immutability
    const newCurrentResearch = { ...playerState.currentResearch };
    newCurrentResearch.progress += researchPointsGeneratedThisTick;

    let newUnlockedTechs = playerState.unlockedTechs;
    let researchCompleted = false;

    if (newCurrentResearch.progress >= techDefinition.cost.research) {
      console.log(`Player ${playerId} unlocked Technology ${techId}!`);
      newUnlockedTechs = [...new Set([...playerState.unlockedTechs, techId])];
      researchCompleted = true;
    }

    const newPlayerState = {
      ...playerState,
      currentResearch: researchCompleted ? undefined : newCurrentResearch,
      unlockedTechs: newUnlockedTechs,
    };

    // Apply tech effects if research was just completed
    if (researchCompleted) {
      this.applyTechEffectsToPlayer(newPlayerState, techId, state); // Pass the newPlayerState that has the tech unlocked
    }

    return {
      ...state,
      players: {
        ...state.players,
        [playerId]: newPlayerState
      }
    };
  }


  private applyTechEffectsToPlayer(playerState: PlayerState, techId: string, gameState: GameState) {
    const techDefinition = TECH_TREE[techId];
    if (!techDefinition || !techDefinition.effects) return;

    techDefinition.effects.forEach(effect => {
      if (effect.unlockFacility) {
        // console.log(`Tech ${techId} unlocked facility: ${effect.unlockFacility} for player ${playerState.id}`); // Less verbose
      }
      if (effect.globalResourceModifier && playerState.globalResources[effect.globalResourceModifier.resource] !== undefined) {
        // This needs refinement. For now, log.
        // console.log(`Tech ${techId} provides global resource modifier for ${effect.globalResourceModifier.resource} for player ${playerState.id}. (Effect application needs refinement)`);
      }
      if (effect.eventResistance) {
        // console.log(`Tech ${techId} provides resistance to ${effect.eventResistance.eventType} for player ${playerState.id}.`); // Less verbose
      }
    });
  }
  
  private updateFacility(facility: PlanetaryFacility, deltaTime: number, state: GameState, allHexagonIds: string[]): PlanetaryFacility {
    const playerState = state.players[facility.ownerPlayerId];
    if (!playerState) {
        // console.warn(`Facility ${facility.id} has no owner or owner ${facility.ownerPlayerId} not found.`);
        return facility;
    }

    const newFacility = { ...facility }; // Operate on a copy
    if (newFacility.constructionTimeLeft && newFacility.constructionTimeLeft > 0) {
      newFacility.constructionTimeLeft -= deltaTime * state.speed;
      if (newFacility.constructionTimeLeft <= 0) {
        newFacility.operational = true;
        newFacility.constructionTimeLeft = 0;
        console.log(`Facility ${newFacility.id} (${newFacility.type}) for player ${facility.ownerPlayerId} in region ${newFacility.regionId} is now operational.`);
      }
      return newFacility; // Return the modified copy
    }

    if (!newFacility.operational) {
      return newFacility; // Return the copy
    }

    const definition = FACILITY_DEFINITIONS[newFacility.type];
    if (definition) {
      // Ensure playerState.globalResources is copied before modification if this function is expected to be pure regarding playerState
      // However, updateFacility is usually called within a loop that reconstructs playerState or gameState, so direct mutation might be acceptable in that context.
      // For safety, if playerState might be shared or re-used without deep copy, copy globalResources here.
      // const modifiablePlayerResources = { ...playerState.globalResources };

      if (newFacility.type === FacilityType.STRATEGIC_RESOURCE_NODE && newFacility.hexagonId) {
        const resourceOnHex = state.hexagonStrategicResources[newFacility.hexagonId];
        if (resourceOnHex) {
          const yieldAmount = 0.02 * deltaTime * state.speed;
          playerState.globalResources[resourceOnHex] = (playerState.globalResources[resourceOnHex] || 0) + yieldAmount;
        }
      } else {
        definition.effects.forEach(effect => {
          let yieldMultiplier = 1;
          if (newFacility.type === FacilityType.RESEARCH_OUTPOST && newFacility.hexagonId && effect.resourceYield?.research) {
            const adjacencies = this.getHexagonAdjacencies(newFacility.hexagonId, allHexagonIds);
            let adjacentResearchOutposts = 0;
            playerState.activeFacilities.forEach(f => {
                if (f.hexagonId && adjacencies.includes(f.hexagonId) && f.type === FacilityType.RESEARCH_OUTPOST && f.operational && f.ownerPlayerId === facility.ownerPlayerId) {
                    adjacentResearchOutposts++;
                }
            });
            if (adjacentResearchOutposts > 0) {
              yieldMultiplier += adjacentResearchOutposts * 0.1;
            }
          }

          if (effect.resourceYield) {
            for (const resourceType in effect.resourceYield) {
              const baseYield = effect.resourceYield[resourceType];
              playerState.globalResources[resourceType] = (playerState.globalResources[resourceType] || 0) + baseYield * yieldMultiplier * deltaTime * state.speed;
            }
          }
          if (effect.stabilityModifier) {
            const region = state.regions.find(r => r.id === newFacility.regionId);
            if (region) {
              region.stability = Math.max(0, Math.min(100, region.stability + effect.stabilityModifier * deltaTime * state.speed));
            }
          }
        });

        // Apply economic impacts to the region
        if (definition.economicImpact) {
          const region = state.regions.find(r => r.id === newFacility.regionId);
          if (region) {
            const tickDelta = deltaTime * state.speed;
            if (definition.economicImpact.gdpBoost) {
              region.gdp += definition.economicImpact.gdpBoost * tickDelta;
            }
            if (definition.economicImpact.gdpMultiplier) {
              region.gdp *= (1 + (definition.economicImpact.gdpMultiplier - 1) * tickDelta);
            }
            region.gdp = Math.max(1, region.gdp);

            if (definition.economicImpact.productionModifier) {
              for (const resTypeStr in definition.economicImpact.productionModifier) {
                const resType = resTypeStr as StrategicResourceType;
                const modifier = definition.economicImpact.productionModifier[resType];
                if (modifier && region.resourceProduction[resType] !== undefined) {
                  region.resourceProduction[resType] *= (1 + (modifier - 1) * tickDelta);
                }
              }
            }
            if (definition.economicImpact.demandModifier) {
              for (const resTypeStr in definition.economicImpact.demandModifier) {
                const resType = resTypeStr as StrategicResourceType;
                const modifier = definition.economicImpact.demandModifier[resType];
                if (modifier && region.resourceDemand[resType] !== undefined) {
                  region.resourceDemand[resType] *= (1 + (modifier - 1) * tickDelta);
                  region.resourceDemand[resType] = Math.max(0.1, region.resourceDemand[resType]); // Demand shouldn't be zero
                }
              }
            }
          }
        }
      }
    }
    return newFacility; // Return the modified copy
  }

  // Placeholder for fetching hexagon adjacencies - remains the same.
  private getHexagonAdjacencies(hexagonId: string, allHexagonIds: string[]): string[] {
    const MOCK_ADJACENCY_COUNT = 6;
    const foundAdjacencies: string[] = [];
    const currentIndex = allHexagonIds.indexOf(hexagonId);
    if (currentIndex === -1) return [];
    for (let i = 1; i <= MOCK_ADJACENCY_COUNT / 2; i++) {
        if (currentIndex - i >= 0) foundAdjacencies.push(allHexagonIds[currentIndex - i]);
        if (currentIndex + i < allHexagonIds.length) foundAdjacencies.push(allHexagonIds[currentIndex + i]);
    }
    return foundAdjacencies.slice(0, MOCK_ADJACENCY_COUNT);
  }

  updateWorld(currentState: GameState, deltaTime: number): GameState {
    let newState = { ...currentState }; // Start with a shallow copy

    // Deep copy mutable parts of the state
    newState.regions = currentState.regions.map(r => ({...r, events: [...r.events]})); // Events within regions also copied
    newState.activeEvents = currentState.activeEvents.map(e => ({...e}));

    newState.players = { ...currentState.players };
    for (const playerId in newState.players) {
        const player = newState.players[playerId];
        newState.players[playerId] = {
            ...player,
            activeFacilities: player.activeFacilities.map(f => ({...f})),
            globalResources: { ...player.globalResources },
            unlockedTechs: [...player.unlockedTechs],
            currentResearch: player.currentResearch ? { ...player.currentResearch } : undefined,
            scannedHexes: new Set(player.scannedHexes),
        };
    }

    newState.time += deltaTime * newState.speed;
    
    const allHexIds = GameEngine.generateHexagonIds(256); // Assuming fixed number for now

    // Update facilities for each player
    for (const playerId in newState.players) {
        const playerState = newState.players[playerId];
        // updateFacility modifies playerState.globalResources directly for yields.
        // It returns a new facility object, so map is appropriate here.
        playerState.activeFacilities = playerState.activeFacilities.map(facility =>
            this.updateFacility(facility, deltaTime, newState, allHexIds)
        );
    }

    // Update regions (global effects like population change based on stats)
    newState.regions = newState.regions.map(region => this.updateRegion(region, deltaTime * newState.speed, newState));

    // Process existing global events (decay, facility counters, interactions)
    let processedEvents = newState.activeEvents.map(event => {
        let modifiedEvent = { ...event };
        const definition = THREAT_DEFINITIONS[modifiedEvent.type];

        // Facility counters: Iterate all players' facilities in the affected region
        if (definition?.counteredByFacilities) {
            const regionOfEvent = this.findRegionForEvent(modifiedEvent, newState.regions);
            if (regionOfEvent) {
                for (const playerId in newState.players) {
                    newState.players[playerId].activeFacilities.forEach(facility => {
                        if (facility.operational && facility.regionId === regionOfEvent.id) {
                            definition.counteredByFacilities?.forEach(counter => {
                                if (counter.type === facility.type) {
                                    // Event modification logic
                                    if (counter.severityReduction) modifiedEvent.severity *= (1 - counter.severityReduction);
                                    if (counter.durationReduction) {
                                        modifiedEvent.duration *= (1 - counter.durationReduction);
                                        modifiedEvent.timeLeft *= (1 - counter.durationReduction);
                                    }
                                    if (counter.preventsSpread && definition.spread) {
                                        if (modifiedEvent.spread) modifiedEvent.spread *= 0.1;
                                    }
                                }
                            });
                        }
                    });
                }
            }
        }
        return this.updateEvent(modifiedEvent, deltaTime * newState.speed, newState); // updateEvent itself returns a new event object
    });

    // Event interactions (synergies, conflicts) - still global
    const eventsToPotentiallyAdd: RegionEvent[] = [];
    newState.regions.forEach(region => {
        const activeEventsInRegion = processedEvents.filter(e => e.active && this.isEventInRegion(e, region));
        for (let i = 0; i < activeEventsInRegion.length; i++) {
            for (let j = i + 1; j < activeEventsInRegion.length; j++) {
                const eventA = activeEventsInRegion[i];
                const eventB = activeEventsInRegion[j];
                const defA = THREAT_DEFINITIONS[eventA.type];
                if (!defA) continue;

                defA.synergiesWith?.forEach(syn => {
                    if (syn.type === eventB.type) this.applySynergy(eventA, eventB, syn, region); // applySynergy modifies region directly (part of newState.regions)
                });
                defA.conflictsWithEvents?.forEach(con => { // applyConflict modifies events in processedEvents list
                    if (con.type === eventB.type) this.applyConflict(eventA, eventB, con, processedEvents);
                });
            }
        }
    });

    let currentActiveEvents = processedEvents.filter(e => e.active);
    const newlySpreadEvents = this.processEventSpreading(newState, deltaTime * newState.speed, currentActiveEvents); // Returns new event objects
    currentActiveEvents.push(...newlySpreadEvents, ...eventsToPotentiallyAdd); // Add new event objects

    // Process follow-up events - still global
    processedEvents.filter(e => !e.active && e.timeLeft <=0).forEach(endedEvent => {
        const definition = THREAT_DEFINITIONS[endedEvent.type];
        definition?.followUpEvents?.forEach(followUp => {
            if (Math.random() < followUp.chance) {
                let conditionsMet = true;
                if (conditionsMet) { /* ... event spawning logic ... */ }
            }
        });
    }); // This part for follow-up events was simplified in the diff, ensure it correctly adds to currentActiveEvents

    newState.activeEvents = currentActiveEvents.filter(e => e.active);
    newState.regions.forEach(region => { // Re-assign events to regions
        region.events = newState.activeEvents.filter(event => this.isEventInRegion(event, region));
    });

    // Update research progress for each player
    for (const playerId in newState.players) {
        // updateResearchProgress returns a new GameState with the specific player's research updated
        newState = this.updateResearchProgress(newState, deltaTime, playerId);
    }

    this.calculateGlobalStats(newState); // Modifies newState global stats directly
    this.spawnRandomEvents(newState);    // Modifies newState.activeEvents and region.events directly
    this.applyModeEffects(newState);     // Modifies newState.regions directly

    // AI Player decisions
    if (newState.running) {
        this.aiPlayers.forEach(aiPlayer => {
            // Each AI decision returns a completely new GameState object
            newState = aiPlayer.makeDecisions(newState);
        });
    }
    
    return newState; // Return the fully updated new state
  }

  private findRegionForEvent(event: RegionEvent, regions: WorldRegion[]): WorldRegion | undefined {
    // Find the region that is closest to the event's coordinates
    // This can be more sophisticated, e.g. if events have an explicit regionId
    let closestRegion: WorldRegion | undefined = undefined;
    let minDistSq = Infinity;
    regions.forEach(r => {
        const distSq = (r.x - event.x)**2 + (r.y - event.y)**2;
        // A threshold could be used to determine if the event is "in" the region
        if (distSq < minDistSq && distSq < 0.25) { // Assuming 0.5 is max effect radius
            minDistSq = distSq;
            closestRegion = r;
        }
    });
    return closestRegion;
  }

  private isEventInRegion(event: RegionEvent, region: WorldRegion, threshold = 0.5): boolean {
    // Check if an event is considered to be "in" or "affecting" a region
    // Based on distance, similar to applyEventToRegion's maxEffectRadius
    const distance = Math.sqrt((region.x - event.x) ** 2 + (region.y - event.y) ** 2);
    return distance < threshold;
}

  private applySynergy(eventA: RegionEvent, eventB: RegionEvent, synergyDef: NonNullable<ThreatDefinition['synergiesWith']>[0], region: WorldRegion) {
    console.log(`Synergy between ${eventA.type} and ${eventB.type} in ${region.name}`);
    if (synergyDef.effectModifier) {
        // Apply direct effect modifiers to the region. This is a simple interpretation.
        // A more complex one might modify the events themselves or create a temporary buff.
        if (synergyDef.effectModifier.health) region.health += synergyDef.effectModifier.health;
        if (synergyDef.effectModifier.environment) region.environment += synergyDef.effectModifier.environment;
        if (synergyDef.effectModifier.stability) region.stability += synergyDef.effectModifier.stability;
        // Clamp values
        region.health = Math.max(0, Math.min(100, region.health));
        region.environment = Math.max(0, Math.min(100, region.environment));
        region.stability = Math.max(0, Math.min(100, region.stability));
    }
    if (synergyDef.durationModifier) {
        eventA.duration *= synergyDef.durationModifier;
        eventA.timeLeft *= synergyDef.durationModifier;
        eventB.duration *= synergyDef.durationModifier; // Or apply only to one
        eventB.timeLeft *= synergyDef.durationModifier;
    }
    if (synergyDef.newEffect) {
        // Apply newEffect directly to the region. This is a one-time application per synergy check.
        // This might need to be timed or applied differently based on design.
        if (synergyDef.newEffect.health) region.health += synergyDef.newEffect.health;
        if (synergyDef.newEffect.environment) region.environment += synergyDef.newEffect.environment;
        if (synergyDef.newEffect.stability) region.stability += synergyDef.newEffect.stability;
        if (synergyDef.newEffect.populationMultiplier && region.population) region.population *= synergyDef.newEffect.populationMultiplier;
        if (synergyDef.newEffect.population) region.population += synergyDef.newEffect.population;
    }
    // TODO: Consider if synergies should spawn a new, combined event, or just modify existing ones/region.
}

private applyConflict(eventA: RegionEvent, eventB: RegionEvent, conflictDef: NonNullable<ThreatDefinition['conflictsWithEvents']>[0], allActiveEvents: RegionEvent[]) {
    // Event A is defined to conflict with Event B.
    // We modify Event B based on Event A's conflict definition.
    console.log(`Conflict: ${eventA.type} vs ${eventB.type}. ${eventA.type} is conflicting.`);

    let targetEventToModify = allActiveEvents.find(e => e.id === eventB.id); // Get the actual event from the list
    if (!targetEventToModify) return;

    if (conflictDef.severityReduction) {
        targetEventToModify.severity *= (1 - conflictDef.severityReduction);
    }
    if (conflictDef.durationReduction) {
        targetEventToModify.duration *= (1 - conflictDef.durationReduction);
        targetEventToModify.timeLeft *= (1 - conflictDef.durationReduction);
    }
    if (conflictDef.cancels) {
        targetEventToModify.active = false;
        targetEventToModify.timeLeft = 0;
        console.log(`Event ${eventB.type} (ID: ${eventB.id}) cancelled by ${eventA.type}`);
    }
    if (conflictDef.newEffect) {
        // This effect applies to the region where the conflict is happening.
        // Find the region. This is a simplification.
        // const region = this.findRegionForEvent(eventA, state.regions) ?? this.findRegionForEvent(eventB, state.regions);
        // For now, this part is complex as applyConflict doesn't have direct region context like applySynergy.
        // This would be better handled if events directly modified regions during their application phase,
        // and conflicts adjusted those modifications.
        // Simplified: if a newEffect is defined, it implies a general impact not tied to a specific region stat change here.
        // This needs more thought on how to apply region-specific effects from conflicts globally or find the target.
        console.warn(`Conflict newEffect for ${eventA.type} vs ${eventB.type} not fully implemented for regional changes.`);
    }
}
  
  private updateRegion(region: WorldRegion, deltaTime: number, state: GameState): WorldRegion {
    const newRegion = { ...region };
    
    const noise = this.noise2D(region.x * 5, state.time * 0.0001) * 0.05; // Reduced noise impact slightly
    const tickDelta = deltaTime; // deltaTime already incorporates game speed from updateWorld

    newRegion.health = Math.max(0, Math.min(100, newRegion.health + noise * tickDelta * 10));
    newRegion.environment = Math.max(0, Math.min(100, newRegion.environment + noise * 0.8 * tickDelta * 10));
    newRegion.stability = Math.max(0, Math.min(100, newRegion.stability + noise * 1.2 * tickDelta * 10));

    // Economic Updates
    const baseGdpGrowthFactor = 0.001; // Small base growth per tick
    const stabilityFactor = newRegion.stability / 100;
    const healthFactor = newRegion.health / 100;
    newRegion.gdp += newRegion.gdp * (baseGdpGrowthFactor + (stabilityFactor - 0.5) * 0.01 + (healthFactor - 0.5) * 0.005) * tickDelta;
    newRegion.gdp = Math.max(1, newRegion.gdp); // GDP should not go to zero or negative

    let overallResourceBalanceScore = 0;
    const numStrategicResources = Object.keys(StrategicResourceType).length;

    for (const resType of Object.values(StrategicResourceType)) {
        // Demand increases with population (very simplified)
        newRegion.resourceDemand[resType] = Math.max(1, (newRegion.population / 100000000) * 5 * tickDelta + (newRegion.resourceDemand[resType] || 0) * (1 - tickDelta*0.1) ); // demand decays slowly if not replenished by pop change

        // Production slightly tied to environment and stability (very simplified)
        const productionFluctuation = (newRegion.environment / 100 - 0.5) * 0.1 + (newRegion.stability / 100 - 0.5) * 0.05;
        newRegion.resourceProduction[resType] = Math.max(0, (newRegion.resourceProduction[resType] || 0) * (1 + productionFluctuation * tickDelta));

        const balance = (newRegion.resourceProduction[resType] || 0) - (newRegion.resourceDemand[resType] || 0);
        if (balance < 0) {
            overallResourceBalanceScore -= 1;
        } else {
            overallResourceBalanceScore += 0.5; // Surplus is less impactful than deficit for stability adjustment
        }
    }

    // Adjust stability based on overall resource balance
    if (overallResourceBalanceScore < -numStrategicResources / 2) { // If more than half resources are in deficit
        newRegion.stability -= 0.05 * tickDelta * 60; // Scaled to be per second like
    } else if (overallResourceBalanceScore > numStrategicResources / 3) { // If more than a third are in surplus
        newRegion.stability += 0.02 * tickDelta * 60;
    }
    newRegion.stability = Math.max(0, Math.min(100, newRegion.stability));
    
    // Apply effects of active events in this region
    state.activeEvents.forEach(event => {
        if (event.active && this.isEventInRegion(event, newRegion)) {
            this.applyEventToRegion(newRegion, event); // applyEventToRegion uses event.severity directly, not deltaTime scaled
        }
    });
    
    // Population change based on health, environment, stability
    // More sensitive population change model
    const growthRate = (newRegion.health / 100 - 0.3) + (newRegion.environment / 100 - 0.4) + (newRegion.stability / 100 - 0.3); // Base at 0.3 + 0.4 + 0.3 = 1.0
    const populationChangeFactor = growthRate * 0.0005 * tickDelta * 60; // Scaled to be per second like
    newRegion.population = Math.max(0, newRegion.population * (1 + populationChangeFactor));
    
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
  private processEventSpreading(state: GameState, deltaTime: number, currentActiveEvents: RegionEvent[]): RegionEvent[] {
    const newlySpreadEvents: RegionEvent[] = [];
    currentActiveEvents.forEach(event => { // Use currentActiveEvents which might have been modified by conflicts/synergies
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
        spread: Math.random() * 0.3,
        active: true,
        originatingPlayerId: undefined // Random events have no specific player origin
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
  
  triggerEvent(state: GameState, eventType: EventType, targetRegionId?: string, originatingPlayerId?: string): GameState {
    const region = targetRegionId
      ? state.regions.find(r => r.id === targetRegionId)
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
      severity: 0.8 + Math.random() * 0.2,
      duration: definition.duration,
      timeLeft: definition.duration,
      x: region.x + (Math.random() - 0.5) * 0.1,
      y: region.y + (Math.random() - 0.5) * 0.1,
      spread: Math.random() * 0.2,
      active: true,
      originatingPlayerId: originatingPlayerId // Store the originating player
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
public buildFacility(state: GameState, facilityType: FacilityType, regionId: string, playerId: string, hexagonId?: string): BuildFacilityResult {
    const playerState = state.players[playerId];
    if (!playerState) {
      return { success: false, message: `Player ${playerId} not found.` };
    }

    const definition = FACILITY_DEFINITIONS[facilityType];
    if (!definition) {
      return { success: false, message: `Facility definition not found for type: ${facilityType}` };
    }

    const region = state.regions.find(r => r.id === regionId);
    if (!region) {
      return { success: false, message: `Region not found for ID: ${regionId}` };
    }

    // Specific checks for STRATEGIC_RESOURCE_NODE
    if (facilityType === FacilityType.STRATEGIC_RESOURCE_NODE) {
      if (!hexagonId) {
        return { success: false, message: "Strategic Resource Node must be built on a specific hexagon." };
      }
      if (!state.hexagonStrategicResources[hexagonId]) {
        return { success: false, message: `Hexagon ${hexagonId} does not contain a strategic resource.` };
      }
      // Check if a strategic node (owned by anyone) already exists on this hexagon
      let existingNodeOnHex = null;
      for (const pId in state.players) {
          existingNodeOnHex = state.players[pId].activeFacilities.find(f => f.hexagonId === hexagonId && f.type === FacilityType.STRATEGIC_RESOURCE_NODE);
          if (existingNodeOnHex) break;
      }
      if (existingNodeOnHex) {
        return { success: false, message: `Hexagon ${hexagonId} already has a Strategic Resource Node (owned by ${existingNodeOnHex.ownerPlayerId}).` };
      }
    }

    // Check max per region (for this player)
    if (definition.maxPerRegion !== undefined) {
      const countInRegion = playerState.activeFacilities.filter(f => f.regionId === regionId && f.type === facilityType).length;
      if (countInRegion >= definition.maxPerRegion) {
        return { success: false, message: `Cannot build ${definition.name} for player ${playerId}: Max per region (${definition.maxPerRegion}) reached in ${region.name}.` };
      }
    }

    // Check max global (for this player - if definition implies per-player global limit)
    // Or check across all players if it's a true global limit. Assuming true global for now.
    if (definition.maxGlobal !== undefined) {
      let countGlobal = 0;
      for (const pId in state.players) {
        countGlobal += state.players[pId].activeFacilities.filter(f => f.type === facilityType).length;
      }
      if (countGlobal >= definition.maxGlobal) {
        return { success: false, message: `Cannot build ${definition.name}: Max global (${definition.maxGlobal}) reached across all players.` };
      }
    }

    // Check resource costs from player's resources
    const costs = definition.cost || {};
    let canAfford = true;
    let missingResources = "";
    const currentPlayerResources = playerState.globalResources;
    for (const resource in costs) {
      if ((currentPlayerResources[resource] || 0) < costs[resource]) {
        canAfford = false;
        missingResources += `${resource}: ${costs[resource]} (Player ${playerId} has ${currentPlayerResources[resource] || 0}) `;
      }
    }

    if (!canAfford) {
      return { success: false, message: `Player ${playerId} cannot build ${definition.name}: Insufficient resources. Missing: ${missingResources.trim()}` };
    }

    // Deduct costs from player's resources
    const newPlayerResources = { ...currentPlayerResources };
    for (const resource in costs) {
      newPlayerResources[resource] -= costs[resource];
    }

    const newFacilityInstance: PlanetaryFacility = {
      id: Math.random().toString(36),
      ownerPlayerId: playerId, // Assign owner
      type: facilityType,
      regionId: regionId,
      hexagonId: hexagonId,
      operational: false,
      constructionTimeLeft: definition.constructionTime || 10,
    };

    const newPlayerActiveFacilities = [...playerState.activeFacilities, newFacilityInstance];
    const updatedPlayerState: PlayerState = {
      ...playerState,
      activeFacilities: newPlayerActiveFacilities,
      globalResources: newPlayerResources,
    };

    const successMessage = `${definition.name} construction started for player ${playerId} in ${region.name}.`;
    // console.log(successMessage); // Less verbose for AI

    return {
      success: true,
      message: successMessage,
      newState: {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayerState,
        }
      }
    };
  }

  public upgradeFacility(state: GameState, facilityId: string, toFacilityType: FacilityType, playerId: string): { success: boolean, message: string, newState?: GameState } {
    const playerState = state.players[playerId];
    if (!playerState) {
      return { success: false, message: `Player ${playerId} not found.` };
    }

    const facilityToUpgrade = playerState.activeFacilities.find(f => f.id === facilityId && f.ownerPlayerId === playerId);
    if (!facilityToUpgrade) {
      return { success: false, message: `Facility with ID ${facilityId} not found or not owned by player ${playerId}.` };
    }

    if (!facilityToUpgrade.operational) {
        return { success: false, message: `Facility ${facilityToUpgrade.type} (ID: ${facilityId}) must be operational to upgrade.`};
    }

    const currentFacilityDef = FACILITY_DEFINITIONS[facilityToUpgrade.type];
    if (!currentFacilityDef || !currentFacilityDef.upgrades) {
      return { success: false, message: `Facility type ${facilityToUpgrade.type} cannot be upgraded or has no defined upgrades.` };
    }

    const upgradePath = currentFacilityDef.upgrades.find(u => u.toFacilityType === toFacilityType);
    if (!upgradePath) {
      return { success: false, message: `Cannot upgrade ${facilityToUpgrade.type} to ${toFacilityType}. No valid upgrade path defined.` };
    }

    const targetFacilityDef = FACILITY_DEFINITIONS[toFacilityType];
    if (!targetFacilityDef) {
        return { success: false, message: `Target facility type ${toFacilityType} not found in definitions.` };
    }

    // Check tech prerequisites from player's unlocked techs
    if (upgradePath.techRequired && !playerState.unlockedTechs.includes(upgradePath.techRequired)) {
      const techDef = TECH_TREE[upgradePath.techRequired];
      return { success: false, message: `Player ${playerId} - Upgrade requires technology: ${techDef?.name || upgradePath.techRequired}.` };
    }

    // Check resource costs for the upgrade from player's resources
    const costs = upgradePath.cost || {};
    let canAfford = true;
    let missingResources = "";
    const currentPlayerResources = playerState.globalResources;
    for (const resource in costs) {
      if ((currentPlayerResources[resource] || 0) < costs[resource]) {
        canAfford = false;
        missingResources += `${resource}: ${costs[resource]} (Player ${playerId} has: ${currentPlayerResources[resource] || 0}) `;
      }
    }
    if (!canAfford) {
      return { success: false, message: `Player ${playerId} - Insufficient resources for upgrade. Missing: ${missingResources.trim()}` };
    }

    // Deduct costs from player's resources
    const newPlayerResources = { ...currentPlayerResources };
    for (const resource in costs) {
      newPlayerResources[resource] -= costs[resource];
    }

    const upgradedFacility: PlanetaryFacility = {
      ...facilityToUpgrade,
      type: toFacilityType,
      operational: !(upgradePath.constructionTime && upgradePath.constructionTime > 0), // Operational if no construction time
      constructionTimeLeft: upgradePath.constructionTime || 0,
    };

    const updatedPlayerActiveFacilities = playerState.activeFacilities.map(f =>
      f.id === facilityId ? upgradedFacility : f
    );

    const updatedPlayerState: PlayerState = {
        ...playerState,
        activeFacilities: updatedPlayerActiveFacilities,
        globalResources: newPlayerResources,
    };

    const message = `${currentFacilityDef.name} (ID: ${facilityId}) upgraded to ${targetFacilityDef.name} for player ${playerId}.`;
    // console.log(message); // Less verbose for AI

    return {
      success: true,
      message,
      newState: {
        ...state,
        players: {
            ...state.players,
            [playerId]: updatedPlayerState,
        }
      }
    };
  }
}