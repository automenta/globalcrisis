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
  hexagonStrategicResources: Record<string, StrategicResourceType | null >; // Key: hexagonId, Value: StrategicResourceType or null

  // Technology related state
  unlockedTechs: string[]; // Using string[] which can be converted to Set<TechId> when used. TechId is string.
  currentResearch?: {
    techId: string; // TechId is string
    progress: number;
  };
  scannedHexes?: string[]; // Set<string> of known hex IDs from GeoScan (optional, if we want to track this)


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

// Import StrategicResourceType correctly at the top with other imports from definitions
// This will be done in a subsequent step by editing the main import line.
// For now, focus on removing the duplicate class and constructor.

export class GameEngine {
  private noise2D = createNoise2D();
  private lastUpdate = 0;
  
  constructor() {}

  // This method would ideally get actual hex IDs from a map generation process
  // shared with or provided by Earth3D. For now, we simulate.
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
    console.log("Strategic resource assignments:", assignments);
    return assignments;
  }
  
  createInitialWorld(): GameState {
    const regions: WorldRegion[] = [
      { id: 'na', name: 'North America', population: 580000000, health: 78, environment: 65, stability: 75, x: -0.6, y: 0.3, color: [0.3, 0.6, 0.9], events: [] },
      { id: 'sa', name: 'South America', population: 430000000, health: 72, environment: 55, stability: 65, x: -0.4, y: -0.4, color: [0.4, 0.8, 0.3], events: [] },
      { id: 'eu', name: 'Europe', population: 750000000, health: 82, environment: 70, stability: 80, x: 0.1, y: 0.4, color: [0.7, 0.4, 0.9], events: [] },
      { id: 'af', name: 'Africa', population: 1400000000, health: 65, environment: 45, stability: 55, x: 0.2, y: -0.1, color: [0.9, 0.6, 0.2], events: [] },
      { id: 'as', name: 'Asia', population: 4600000000, health: 74, environment: 50, stability: 70, x: 0.6, y: 0.2, color: [0.9, 0.3, 0.4], events: [] },
      { id: 'oc', name: 'Oceania', population: 50000000, health: 85, environment: 75, stability: 85, x: 0.8, y: -0.5, color: [0.2, 0.9, 0.7], events: [] }
    ];

    // Simulate hexagon ID generation for initial setup.
    // In a full implementation, these IDs would come from the map data/Earth3D generation.
    const numberOfHexagons = 256; // Example: Corresponds to Icosahedron subdivide level 3 (12*4^3 = 768 faces, means 256 vertices if using that way)
                                 // or a fixed number for simulation.
    const allHexagonIds = GameEngine.generateHexagonIds(numberOfHexagons);
    const hexagonStrategicResources = GameEngine.assignStrategicResourcesToHexagons(allHexagonIds);
    
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
      globalResources: { research: 0, credits: 1000, ...this.initializeStrategicResourceCounts(hexagonStrategicResources) },
      hexagonStrategicResources,
      unlockedTechs: [], // Start with no technologies unlocked
      currentResearch: undefined, // No research active initially
      // scannedHexes: [], // Initialize if using this feature
      mode: 'neutral',
      running: false,
      speed: 1
    };
  }

  private initializeStrategicResourceCounts(assignments: Record<string, StrategicResourceType | null>): Record<string, number> {
    const counts: Record<string, number> = {};
    // Ensure all defined strategic resources are initialized in the player's globalResources
    Object.values(StrategicResourceType).forEach(resType => {
        counts[resType] = counts[resType] || 0;
    });
    return counts;
  }

  public performGeoScan(currentState: GameState, satelliteId: string, targetHexagonId: string): { success: boolean, message: string, newState?: GameState, revealedResource?: StrategicResourceType | null } {
    // In a real game, satellite might have range, cooldown, or require line of sight.
    // For now, assume it can scan any hex.
    // This action doesn't change the actual resource on the hex, only reveals it to the player.
    // The 'revealedResource' would be used by UI to show the player.
    // Actual resource data is already in `currentState.hexagonStrategicResources`.
    // We might add a 'scannedHexes' field to GameState if we want to track what player knows.

    const resource = currentState.hexagonStrategicResources[targetHexagonId];
    if (resource === undefined) { // Undefined means the hex ID itself is invalid or not part of the map.
        return { success: false, message: `Hexagon ${targetHexagonId} is not a valid target.` };
    }

    // Add to a list of known/scanned hexes in GameState if not already there
    const newGameState = { ...currentState };
    if (!newGameState.scannedHexes) { // Assuming GameState will be extended with scannedHexes: Set<string>
        // This change to GameState interface would be needed.
        // newGameState.scannedHexes = new Set<string>();
    }
    // newGameState.scannedHexes.add(targetHexagonId);

    console.log(`GeoScan by ${satelliteId} on ${targetHexagonId} reveals: ${resource || 'nothing'}.`);
    return {
        success: true,
        message: `Scan complete on ${targetHexagonId}. Resource: ${resource || 'None'}`,
        newState: newGameState, // Potentially with updated scannedHexes
        revealedResource: resource
    };
  }

  public fireEmpPulse(currentState: GameState, satelliteId: string, targetRegionId: string): { success: boolean, message: string, newState?: GameState } {
    const targetRegion = currentState.regions.find(r => r.id === targetRegionId);
    if (!targetRegion) {
      return { success: false, message: `Region ${targetRegionId} not found.` };
    }

    // Create an EMP event in the target region
    // The triggerEvent method can be used or adapted.
    // For simplicity, we'll call triggerEvent directly.

    let updatedState = this.triggerEvent(currentState, EventType.ELECTROMAGNETIC_PULSE, targetRegionId);

    // EMP might also temporarily disable facilities in the region or affect satellites passing over.
    // This would require more detailed logic in updateFacility or a dedicated EMP effect handler.
    // For now, the standard EMP event effects from THREAT_DEFINITIONS will apply.

    console.log(`EMP Pulse by ${satelliteId} fired on region ${targetRegion.name}.`);
    return {
        success: true,
        message: `EMP Pulse fired on ${targetRegion.name}.`,
        newState: updatedState
    };
  }

  public startResearch(state: GameState, techId: string): { success: boolean, message: string, newState?: GameState } {
    if (state.currentResearch && state.currentResearch.techId === techId) {
      return { success: false, message: `Already researching ${techId}.` };
    }
    if (state.unlockedTechs.includes(techId)) {
      return { success: false, message: `Technology ${techId} is already unlocked.` };
    }

    const techDefinition = TECH_TREE[techId]; // Assuming TECH_TREE is imported from Technology.ts
    if (!techDefinition) {
      return { success: false, message: `Technology ${techId} not found.` };
    }

    // Check prerequisites
    const prerequisitesMet = techDefinition.prerequisites.every(prereqId => state.unlockedTechs.includes(prereqId));
    if (!prerequisitesMet) {
      return { success: false, message: `Missing prerequisites for ${techId}. Required: ${techDefinition.prerequisites.join(', ')}` };
    }

    // Check costs (only research points for now, as per TechNode definition)
    if (state.globalResources.research < (techDefinition.cost.researchRequired || techDefinition.cost.research)) {
        // Using researchRequired if available, else research. Modify TechNode if needed.
        // For now, assume techDefinition.cost.research is the primary research point cost.
    }
    // For simplicity, we'll assume research points are consumed over time, not upfront.
    // If there were upfront resource costs (credits, materials), they'd be deducted here.

    const newState = { ...state };
    newState.currentResearch = { techId, progress: 0 };

    console.log(`Started research on ${techId}.`);
    return { success: true, message: `Research started on ${techDefinition.name}.`, newState };
  }

  private updateResearchProgress(state: GameState, deltaTime: number): GameState {
    if (!state.currentResearch) {
      return state;
    }

    const techId = state.currentResearch.techId;
    const techDefinition = TECH_TREE[techId];
    if (!techDefinition) {
      console.warn(`Currently researching unknown tech: ${techId}`);
      state.currentResearch = undefined; // Clear invalid research
      return state;
    }

    // Research points generated per second (this could be a global stat modified by facilities, techs)
    // For now, let's assume 'research' in globalResources is the "pool" and also represents "generation rate" implicitly
    // or that facilities directly contribute to progress.
    // Simplified: Assume research points are consumed from the global pool to make progress.
    // A more robust system would have research generation rate separate from the pool.

    const researchPointsAvailableThisTick = (state.globalResources.research || 0) * deltaTime * state.speed;
    // This interpretation is flawed: state.globalResources.research is a pool, not a rate.
    // Let's assume Research Outposts generate research points that are directly applied to progress.
    // For now, let's use a placeholder research rate.
    const effectiveResearchRate = 0.5; // Placeholder: 0.5 research progress units per second per active research point generation.
                                      // This should be tied to actual research point generation from facilities.
                                      // Let's assume `state.globalResources.research` is the current *rate* of research point generation.

    const progressThisTick = (state.globalResources.research || 0) * effectiveResearchRate * deltaTime * state.speed;


    state.currentResearch.progress += progressThisTick;
    // state.globalResources.research = Math.max(0, (state.globalResources.research || 0) - progressThisTick); // Consume research points if they are a pool being spent

    if (state.currentResearch.progress >= techDefinition.cost.research) {
      console.log(`Technology ${techId} unlocked!`);
      state.unlockedTechs = [...new Set([...state.unlockedTechs, techId])]; // Add to unlocked, ensure unique
      this.applyTechEffects(state, techId);
      state.currentResearch = undefined; // Clear current research
    }
    return state;
  }

  private applyTechEffects(state: GameState, techId: string) {
    const techDefinition = TECH_TREE[techId];
    if (!techDefinition || !techDefinition.effects) return;

    techDefinition.effects.forEach(effect => {
      if (effect.unlockFacility) {
        // This doesn't directly change state here, but enables building it.
        // UI would check unlockedTechs to show available facilities.
        console.log(`Tech ${techId} unlocked facility: ${effect.unlockFacility}`);
      }
      if (effect.globalResourceModifier && state.globalResources[effect.globalResourceModifier.resource] !== undefined) {
        // This is tricky. Modifying a rate usually means changing how facilities produce.
        // For simplicity, let's assume it's a one-time bonus or a multiplier to a global "base" rate if we had one.
        // A better way: techs could modify facility definitions' output.
        // For now, let's log it. A real implementation needs to adjust actual production rates.
        console.log(`Tech ${techId} provides global resource modifier for ${effect.globalResourceModifier.resource} by ${effect.globalResourceModifier.modifier}. (Effect application needs refinement)`);
        // Example: if it was a direct boost to current resource stock (less likely for a rate modifier)
        // state.globalResources[effect.globalResourceModifier.resource] *= effect.globalResourceModifier.modifier;
      }
      if (effect.eventResistance) {
        // Event resistance would typically be checked when an event occurs or is applied.
        // This might mean storing these resistances in GameState or checking unlockedTechs during event processing.
        console.log(`Tech ${techId} provides resistance to ${effect.eventResistance.eventType}. (Effect applied during event resolution)`);
      }
      // Add more effect applications here
    });
  }
  
  private updateFacility(facility: PlanetaryFacility, deltaTime: number, state: GameState, allHexagonIds: string[]): PlanetaryFacility {
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
      if (newFacility.type === FacilityType.STRATEGIC_RESOURCE_NODE && newFacility.hexagonId) {
        const resourceOnHex = state.hexagonStrategicResources[newFacility.hexagonId];
        if (resourceOnHex) {
          // Example: Yield 0.02 units of the specific strategic resource per second (scaled by deltaTime * speed)
          const yieldAmount = 0.02 * deltaTime * state.speed;
          state.globalResources[resourceOnHex] = (state.globalResources[resourceOnHex] || 0) + yieldAmount;
          // console.log(`Facility ${newFacility.id} on ${newFacility.hexagonId} yielded ${yieldAmount} of ${resourceOnHex}`);
        } else {
          // This case should ideally be prevented by buildFacility checks
          // console.warn(`Strategic Resource Node ${newFacility.id} is on hex ${newFacility.hexagonId} which has no strategic resource.`);
        }
      } else {
        // Standard effects for other facilities
        definition.effects.forEach(effect => {
          let yieldMultiplier = 1; // Base multiplier

          // Adjacency bonus example for RESEARCH_OUTPOST
          if (newFacility.type === FacilityType.RESEARCH_OUTPOST && newFacility.hexagonId && effect.resourceYield?.research) {
            const adjacencies = this.getHexagonAdjacencies(newFacility.hexagonId, allHexagonIds);
            let adjacentResearchOutposts = 0;
            adjacencies.forEach(adjHexId => {
              const adjFacility = state.activeFacilities.find(f => f.hexagonId === adjHexId && f.type === FacilityType.RESEARCH_OUTPOST && f.operational);
              if (adjFacility) {
                adjacentResearchOutposts++;
              }
            });
            if (adjacentResearchOutposts > 0) {
              yieldMultiplier += adjacentResearchOutposts * 0.1; // 10% bonus per adjacent research outpost
              // console.log(`Research outpost ${newFacility.id} gets ${yieldMultiplier-1} bonus from ${adjacentResearchOutposts} neighbors.`);
            }
          }

          if (effect.resourceYield) {
            for (const resourceType in effect.resourceYield) {
              const baseYield = effect.resourceYield[resourceType];
              state.globalResources[resourceType] = (state.globalResources[resourceType] || 0) + baseYield * yieldMultiplier * deltaTime * state.speed;
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
    }
    return newFacility;
  }

  // Placeholder for fetching hexagon adjacencies.
  // In a real system, this would come from map data.
  private getHexagonAdjacencies(hexagonId: string, allHexagonIds: string[]): string[] {
    // This is a very naive mock. A real implementation would use geometric calculations
    // or precomputed adjacency lists based on the sphere tiling algorithm.
    const MOCK_ADJACENCY_COUNT = 6; // Assume hex grid
    const foundAdjacencies: string[] = [];
    const currentIndex = allHexagonIds.indexOf(hexagonId);

    if (currentIndex === -1) return [];

    // Simple mock: get a few neighbors if they exist in the list
    // This doesn't represent true geographic adjacency.
    for (let i = 1; i <= MOCK_ADJACENCY_COUNT / 2; i++) {
        if (currentIndex - i >= 0) foundAdjacencies.push(allHexagonIds[currentIndex - i]);
        if (currentIndex + i < allHexagonIds.length) foundAdjacencies.push(allHexagonIds[currentIndex + i]);
    }
    return foundAdjacencies.slice(0, MOCK_ADJACENCY_COUNT); // Cap at mock count
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
    // NOTE: To use getHexagonAdjacencies, we need allHexagonIds.
    // This should be part of the GameState or passed around if dynamic,
    // but for now, let's assume it's accessible or we re-generate it (not ideal).
    // For a cleaner approach, GameState should probably store allHexagonIds if they are fixed at world creation.
    // Let's assume `GameEngine.generateHexagonIds(256)` is the consistent list for now.
    const allHexIds = GameEngine.generateHexagonIds(256); // Temp: assuming fixed number of hexes

    newState.activeFacilities = newState.activeFacilities.map(facility => this.updateFacility(facility, deltaTime, newState, allHexIds));
    // TODO: Filter out destroyed facilities if that becomes a feature

    newState.regions = newState.regions.map(region => this.updateRegion(region, deltaTime * newState.speed, newState));

    // Process existing events (decay, facility counters, interactions)
    let processedEvents = newState.activeEvents.map(event => {
        let modifiedEvent = { ...event };
        // Apply facility counters
        const definition = THREAT_DEFINITIONS[modifiedEvent.type];
        if (definition?.counteredByFacilities) {
            const regionOfEvent = this.findRegionForEvent(modifiedEvent, newState.regions);
            if (regionOfEvent) {
                newState.activeFacilities.forEach(facility => {
                    if (facility.operational && facility.regionId === regionOfEvent.id) {
                        definition.counteredByFacilities?.forEach(counter => {
                            if (counter.type === facility.type) {
                                if (counter.severityReduction) modifiedEvent.severity *= (1 - counter.severityReduction);
                                if (counter.durationReduction) {
                                    modifiedEvent.duration *= (1 - counter.durationReduction);
                                    modifiedEvent.timeLeft *= (1 - counter.durationReduction);
                                }
                                if (counter.preventsSpread && definition.spread) {
                                    // This is tricky. We might need a flag on the event or modify its spread chance.
                                    // For now, let's reduce spread chance significantly.
                                    if (modifiedEvent.spread) modifiedEvent.spread *= 0.1; // Reduce numeric spread value
                                    // Or if definition.spread.chance is used directly:
                                    // This requires modifying the definition instance or handling in processEventSpreading
                                }
                            }
                        });
                    }
                });
            }
        }
        return this.updateEvent(modifiedEvent, deltaTime * newState.speed, newState);
    });

    // Process event interactions (synergies, conflicts)
    // This is a simplified O(n^2) check for interactions within the same region.
    // More complex global interactions or interactions between events in different regions would need a different approach.
    const eventsToPotentiallyAdd: RegionEvent[] = [];
    newState.regions.forEach(region => {
        const activeEventsInRegion = processedEvents.filter(e => e.active && this.isEventInRegion(e, region));

        for (let i = 0; i < activeEventsInRegion.length; i++) {
            for (let j = i + 1; j < activeEventsInRegion.length; j++) {
                const eventA = activeEventsInRegion[i];
                const eventB = activeEventsInRegion[j];
                const defA = THREAT_DEFINITIONS[eventA.type];
                const defB = THREAT_DEFINITIONS[eventB.type];

                // Check A's synergies/conflicts with B
                defA.synergiesWith?.forEach(syn => {
                    if (syn.type === eventB.type) this.applySynergy(eventA, eventB, syn, region);
                });
                defA.conflictsWithEvents?.forEach(con => {
                    if (con.type === eventB.type) this.applyConflict(eventA, eventB, con, processedEvents);
                });

                // Check B's synergies/conflicts with A (avoid double processing if symmetric)
                // Assuming conflicts/synergies are defined on one side is enough.
                // If they can be asymmetric, both checks are needed, but be careful with effects.
                // For now, let's assume definitions handle this (e.g., A conflicts with B, B doesn't need to define it again)
            }
        }
    });

    // Filter out deactivated events (e.g. by conflicts) before spreading and finalizing lists
    let currentActiveEvents = processedEvents.filter(e => e.active);

    // Process spreading and collect newly created events
    const newlySpreadEvents = this.processEventSpreading(newState, deltaTime * newState.speed, currentActiveEvents); // Pass currentActiveEvents

    currentActiveEvents.push(...newlySpreadEvents);
    currentActiveEvents.push(...eventsToPotentiallyAdd); // Add events from synergies, etc. (if any)

    // Process follow-up events for events that just ended
    processedEvents.filter(e => !e.active && e.timeLeft <=0).forEach(endedEvent => { // Check timeLeft to ensure it ended this tick
        const definition = THREAT_DEFINITIONS[endedEvent.type];
        definition?.followUpEvents?.forEach(followUp => {
            if (Math.random() < followUp.chance) {
                // Check conditions if any
                let conditionsMet = true;
                if (followUp.conditions) {
                    const regionOfEndedEvent = this.findRegionForEvent(endedEvent, newState.regions);
                    if (followUp.conditions.minSeverity && endedEvent.severity < followUp.conditions.minSeverity) conditionsMet = false;
                    if (followUp.conditions.environmentBelow && regionOfEndedEvent && regionOfEndedEvent.environment >= followUp.conditions.environmentBelow) conditionsMet = false;
                    // Add more condition checks here
                }

                if (conditionsMet) {
                    const regionForNewEvent = this.findRegionForEvent(endedEvent, newState.regions) || newState.regions[Math.floor(Math.random() * newState.regions.length)];
                    const newFollowUpEventDef = THREAT_DEFINITIONS[followUp.type];
                    if (newFollowUpEventDef) {
                        const eventInstance: RegionEvent = {
                            id: Math.random().toString(36),
                            type: followUp.type,
                            severity: (Math.random() * 0.5 + 0.5) * (endedEvent.severity || 0.7), // Inherit some severity
                            duration: newFollowUpEventDef.duration,
                            timeLeft: newFollowUpEventDef.duration,
                            x: regionForNewEvent.x + (Math.random() - 0.5) * 0.1,
                            y: regionForNewEvent.y + (Math.random() - 0.5) * 0.1,
                            spread: Math.random() * 0.1, // Less spread for follow-ups initially
                            active: true,
                        };
                        // Delay handling: If followUp.delay is used, this needs a mechanism to queue events for future ticks.
                        // For simplicity now, triggering immediately if delay is not implemented.
                        currentActiveEvents.push(eventInstance);
                        console.log(`Follow-up event ${followUp.type} triggered by ${endedEvent.type}`);
                    }
                }
            }
        });
    });

    // Assign to newState and add to relevant regions
    newState.activeEvents = currentActiveEvents.filter(e => e.active); // Ensure only active ones remain

    newState.regions.forEach(region => {
        region.events = newState.activeEvents.filter(event => this.isEventInRegion(event, region));
    });

    // Update research progress
    this.updateResearchProgress(newState, deltaTime);

    this.calculateGlobalStats(newState);
    this.spawnRandomEvents(newState); // This also adds events
    this.applyModeEffects(newState);
    
    return newState;
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
    
    const noise = this.noise2D(region.x * 5, state.time * 0.0001) * 0.1;
    
    newRegion.health = Math.max(0, Math.min(100, newRegion.health + noise));
    newRegion.environment = Math.max(0, Math.min(100, newRegion.environment + noise * 0.8));
    newRegion.stability = Math.max(0, Math.min(100, newRegion.stability + noise * 1.2));
    
    // Apply effects of active events in this region
    state.activeEvents.forEach(event => {
        if (event.active && this.isEventInRegion(event, newRegion)) {
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

    // Specific checks for STRATEGIC_RESOURCE_NODE
    if (facilityType === FacilityType.STRATEGIC_RESOURCE_NODE) {
      if (!hexagonId) {
        return { success: false, message: "Strategic Resource Node must be built on a specific hexagon." };
      }
      if (!state.hexagonStrategicResources[hexagonId]) {
        return { success: false, message: `Hexagon ${hexagonId} does not contain a strategic resource.` };
      }
      // Check if a strategic node already exists on this hexagon
      const existingNodeOnHex = state.activeFacilities.find(f => f.hexagonId === hexagonId && f.type === FacilityType.STRATEGIC_RESOURCE_NODE);
      if (existingNodeOnHex) {
        return { success: false, message: `Hexagon ${hexagonId} already has a Strategic Resource Node.` };
      }
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

  public upgradeFacility(state: GameState, facilityId: string, toFacilityType: FacilityType): { success: boolean, message: string, newState?: GameState } {
    const facilityToUpgrade = state.activeFacilities.find(f => f.id === facilityId);
    if (!facilityToUpgrade) {
      return { success: false, message: `Facility with ID ${facilityId} not found.` };
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

    // Check tech prerequisites
    if (upgradePath.techRequired && !state.unlockedTechs.includes(upgradePath.techRequired)) {
      const techDef = TECH_TREE[upgradePath.techRequired];
      return { success: false, message: `Upgrade requires technology: ${techDef?.name || upgradePath.techRequired}.` };
    }

    // Check resource costs for the upgrade
    const costs = upgradePath.cost || {};
    let canAfford = true;
    let missingResources = "";
    for (const resource in costs) {
      if ((state.globalResources[resource] || 0) < costs[resource]) {
        canAfford = false;
        missingResources += `${resource}: ${costs[resource]} (Have: ${state.globalResources[resource] || 0}) `;
      }
    }
    if (!canAfford) {
      return { success: false, message: `Insufficient resources for upgrade. Missing: ${missingResources.trim()}` };
    }

    // Deduct costs
    const newGlobalResources = { ...state.globalResources };
    for (const resource in costs) {
      newGlobalResources[resource] -= costs[resource];
    }

    // Create the new upgraded facility instance
    // It replaces the old one, keeping its ID, region, and hex location.
    // Construction time for upgrade can be handled if `upgradePath.constructionTime` is added.
    // For now, assume instant upgrade once conditions are met.
    const upgradedFacility: PlanetaryFacility = {
      ...facilityToUpgrade, // Retain ID, regionId, hexagonId
      type: toFacilityType,
      operational: true, // Or false if upgrade has construction time
      constructionTimeLeft: 0, // Or `upgradePath.constructionTime`
    };

    const updatedActiveFacilities = state.activeFacilities.map(f =>
      f.id === facilityId ? upgradedFacility : f
    );

    const message = `${currentFacilityDef.name} (ID: ${facilityId}) upgraded to ${targetFacilityDef.name}.`;
    console.log(message);

    return {
      success: true,
      message,
      newState: {
        ...state,
        activeFacilities: updatedActiveFacilities,
        globalResources: newGlobalResources,
      }
    };
  }
}