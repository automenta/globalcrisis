import { createNoise2D } from 'simplex-noise';
import {
    THREAT_DEFINITIONS, ThreatDefinition,
    FACILITY_DEFINITIONS, PlanetaryFacilityDefinition, FacilityType, StrategicResourceType, BiomeType
} from './definitions';
import { TECH_TREE } from './Technology'; // Import TECH_TREE

export interface WorldRegion {
  id: string;
  name: string;
  population: number; // Current population of the region
  health: number; // Average health of the population (0-100)
  environment: number; // Environmental quality (0-100)
  stability: number; // Political and social stability (0-100)
  x: number; // Coordinate for map display
  y: number; // Coordinate for map display
  color: [number, number, number]; // Color for map display
  events: RegionEvent[]; // Active events in this region
  gdp: number; // Gross Domestic Product, representing economic output
  economicSectors: Record<EconomicSectorType, EconomicSector>; // Detailed economic sectors
  demographics: RegionDemographics; // Population demographics
  // Records for tracking the supply and demand of strategic resources within the region.
  // These are influenced by population, facilities, and global economic conditions.
  resourceDemand: Record<StrategicResourceType, number>; // Units demanded per tick
  resourceProduction: Record<StrategicResourceType, number>; // Units produced per tick
  dominantBiome: BiomeType; // Dominant biome type for the region
}

export interface RegionDemographics {
  workingAgePopulation: number;
  unemployedPopulation: number;
  educationLevel: number; // Average education level (e.g., 0-100 or an enum)
  birthRate: number; // Births per 1000 population per time unit (e.g., year/game tick)
  deathRate: number; // Deaths per 1000 population per time unit
  // Potentially add: age brackets (children, elderly), skilled vs unskilled labor, migration rates etc.
}

export enum EconomicSectorType {
  AGRICULTURE = 'agriculture',
  INDUSTRY = 'industry',
  SERVICES = 'services',
  ENERGY = 'energy',
  // RESEARCH_DEVELOPMENT = 'research_development', // Could be a sector or part of services/industry
}

export interface EconomicSector {
  type: EconomicSectorType;
  output: number; // Monetary value produced by this sector per tick
  employment: number; // Number of people employed
  efficiency: number; // Factor (0-1) affecting output and resource consumption
  // Specific resource needs for this sector to function optimally
  // Value: units of resource needed per 1000 units of monetary output, or per tick if output not directly tied
  inputResourceNeeds?: Partial<Record<StrategicResourceType | string, number>>;
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
  PEACE_TREATY = 'peace_treaty',
  // Dynamically triggered economic/regional state events
  REGIONAL_ENERGY_CRISIS = 'regional_energy_crisis',
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
  activePolicies: Set<PolicyType>; // Player-wide active strategic policies
  // Stores active regional development programs, key is regionId
  activeRegionalPrograms: Record<string, {
    programType: RegionalDevelopmentProgramType;
    definition: RegionalDevelopmentProgramDefinition; // Store definition for easy access
    startedAtTick: number; // Game time (ticks) when it started
    durationTicks: number; // Total duration in ticks
    effectsAppliedPerTick?: boolean; // Flag if per-tick effects have been applied for current tick cycle
  }>;
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
    return assignments;
  }

  createInitialWorld(numAI: number = 1): GameState {
    // Helper to initialize resource demand/production for a region
    const initialRegionalEconomicProfile = (population: number, gdp: number, baseDemandFactor: number = 5, baseProductionFactor: number = 3) => {
      const profile: Record<StrategicResourceType, number> = {} as Record<StrategicResourceType, number>;
      const popMillions = population / 1000000;
      const gdpThousands = gdp / 1000;

      for (const resType of Object.values(StrategicResourceType)) {
        // More nuanced initial values based on population and GDP
        // Example: demand scales with population and GDP, production more with GDP and some randomness
        const demand = (popMillions / 100) * (gdpThousands / 10) * (Math.random() * 0.5 + 0.75) * baseDemandFactor;
        const production = (gdpThousands / 10) * (Math.random() * 0.8 + 0.6) * baseProductionFactor;
        profile[resType] = demand; // For demand map
        // To use this for production map, call it again or assign profile[resType] = production;
      }
      return profile;
    };

    const createInitialResourceValues = (population: number, gdp: number, isDemand: boolean) => {
        const resources: Record<StrategicResourceType, number> = {} as Record<StrategicResourceType, number>;
        const popFactor = population / 100000000; // Population in 100 millions
        const gdpFactor = gdp / 10000; // GDP in 10 trillions (assuming GDP is in billions)

        for (const resType of Object.values(StrategicResourceType)) {
            let baseValue = Math.random() * 5 + 2; // Base random value between 2-7
            if (isDemand) {
                // Demand influenced by population and GDP complexity
                resources[resType] = baseValue * popFactor * (1 + gdpFactor * 0.5);
            } else {
                // Production influenced more by GDP (industrial capacity) and some base potential
                resources[resType] = baseValue * (1 + gdpFactor) * (Math.random() * 0.5 + 0.5); // More variability in production
            }
            resources[resType] = Math.max(0.1, resources[resType]); // Ensure not zero
        }
        return resources;
    };

    const regionsData = [
      { id: 'na', name: 'North America', population: 580000000, health: 78, environment: 65, stability: 75, x: -0.6, y: 0.3, color: [0.3, 0.6, 0.9] as [number,number,number], gdp: 25000000 }, // GDP in millions
      { id: 'sa', name: 'South America', population: 430000000, health: 72, environment: 55, stability: 65, x: -0.4, y: -0.4, color: [0.4, 0.8, 0.3] as [number,number,number], gdp: 10000000 },
      { id: 'eu', name: 'Europe', population: 750000000, health: 82, environment: 70, stability: 80, x: 0.1, y: 0.4, color: [0.7, 0.4, 0.9] as [number,number,number], gdp: 22000000 },
      { id: 'af', name: 'Africa', population: 1400000000, health: 65, environment: 45, stability: 55, x: 0.2, y: -0.1, color: [0.9, 0.6, 0.2] as [number,number,number], gdp: 5000000 },
      { id: 'as', name: 'Asia', population: 4600000000, health: 74, environment: 50, stability: 70, x: 0.6, y: 0.2, color: [0.9, 0.3, 0.4] as [number,number,number], gdp: 30000000 },
      { id: 'oc', name: 'Oceania', population: 50000000, health: 85, environment: 75, stability: 85, x: 0.8, y: -0.5, color: [0.2, 0.9, 0.7] as [number,number,number], gdp: 3000000 }
    ];

    const regions: WorldRegion[] = regionsData.map(r => {
      const initialSectors: Record<EconomicSectorType, EconomicSector> = {
        [EconomicSectorType.AGRICULTURE]: {
          type: EconomicSectorType.AGRICULTURE, output: r.gdp * 0.1, employment: r.population * 0.05, efficiency: 0.7,
          inputResourceNeeds: { [StrategicResourceType.WATER]: 0.02, 'energy': 0.005 } // water per 1k output, energy per 1k output
        },
        [EconomicSectorType.INDUSTRY]: {
          type: EconomicSectorType.INDUSTRY, output: r.gdp * 0.3, employment: r.population * 0.1, efficiency: 0.6,
          inputResourceNeeds: { [StrategicResourceType.RARE_METALS]: 0.01, 'energy': 0.05, [StrategicResourceType.WATER]: 0.01 } // Example: 0.05 energy per 1k output
        },
        [EconomicSectorType.SERVICES]: {
          type: EconomicSectorType.SERVICES, output: r.gdp * 0.4, employment: r.population * 0.15, efficiency: 0.8,
          inputResourceNeeds: { [StrategicResourceType.DATA_CONDUITS]: 0.005, 'energy': 0.02 }
        },
        [EconomicSectorType.ENERGY]: {
          type: EconomicSectorType.ENERGY, output: r.gdp * 0.2, employment: r.population * 0.02, efficiency: 0.75,
          inputResourceNeeds: { [StrategicResourceType.EXOTIC_ISOTOPES]: 0.001 } // e.g. for fusion, or could be other base inputs for conventional
        },
      };
      const calculatedGdp = Object.values(initialSectors).reduce((sum, sector) => sum + sector.output, 0);
      const initialTotalEmployment = Object.values(initialSectors).reduce((sum, sector) => sum + sector.employment, 0);

      // Initial demographics setup
      const initialDemographics: RegionDemographics = {
        workingAgePopulation: r.population * 0.65,
        unemployedPopulation: Math.max(0, (r.population * 0.65) - initialTotalEmployment),
        educationLevel: 50 + (r.gdp / Math.max(1,r.population) / 1000),
        birthRate: 0.02 + (r.health / 100 - 0.5) * 0.015, // Base rate 20/1000, modified by health. Max ~35/1000, Min ~5/1000
        deathRate: 0.015 - (r.health / 100 - 0.5) * 0.013, // Base rate 15/1000, modified by health. Max ~28/1000, Min ~2/1000
      };
      initialDemographics.educationLevel = Math.max(10, Math.min(95, initialDemographics.educationLevel));
      initialDemographics.birthRate = Math.max(0.002, Math.min(0.05, initialDemographics.birthRate)); // Clamp birth rate
      initialDemographics.deathRate = Math.max(0.001, Math.min(0.04, initialDemographics.deathRate)); // Clamp death rate


      return {
        ...r,
        gdp: calculatedGdp, // Override gdp with sum of sectors
        events: [],
        economicSectors: initialSectors,
        demographics: initialDemographics,
        resourceDemand: createInitialResourceValues(r.population, calculatedGdp, true),
        resourceProduction: createInitialResourceValues(r.population, calculatedGdp, false),
        dominantBiome: BiomeType.PLAINS, // Placeholder: Assign a default biome. Will be refined.
      };
    });

    // Assign biomes more intelligently (simple latitude-based for now)
    regions.forEach(region => {
      // Approximate latitude: y-coordinate (0 is equator, positive is North, negative is South)
      // Assuming y ranges roughly from -0.5 to 0.5 for major landmasses based on initial data
      const approxLatPercent = (region.y + 0.5); // Ranges 0 (South Pole) to 1 (North Pole)

      if (approxLatPercent < 0.15 || approxLatPercent > 0.85) { // Polar regions
        region.dominantBiome = BiomeType.POLAR_ICE;
        if (approxLatPercent > 0.15 && approxLatPercent < 0.25 || approxLatPercent < 0.85 && approxLatPercent > 0.75) {
          region.dominantBiome = BiomeType.TUNDRA; // Transition to Tundra closer to temperate
        }
      } else if (approxLatPercent < 0.3 || approxLatPercent > 0.7) { // Sub-polar / Boreal
        region.dominantBiome = BiomeType.BOREAL_FOREST; // Taiga
      } else if (approxLatPercent < 0.4 || approxLatPercent > 0.6) { // Temperate
        // Could add more logic here based on x-coordinate (continental vs coastal) for moisture
        const isCoastal = Math.abs(region.x) > 0.5; // Very rough coastal check
        region.dominantBiome = isCoastal ? BiomeType.TEMPERATE_FOREST : BiomeType.GRASSLAND;
      } else { // Tropical/Equatorial
         // Crude check for deserts vs rainforests based on existing environment score or x-coord
        if (region.environment < 55 && (Math.abs(region.x) < 0.3 || Math.abs(region.x) > 0.7)) { // Inland or specific longitude bands for deserts
            region.dominantBiome = BiomeType.DESERT;
        } else {
            region.dominantBiome = BiomeType.TROPICAL_RAINFOREST;
        }
      }

      // Specific overrides based on name for obvious cases
      if (region.name.toLowerCase().includes('africa') && region.dominantBiome !== BiomeType.DESERT) {
        // A large part of Africa is Savannah (Grassland) or Desert
        if (region.y > -0.05 && region.y < 0.15) region.dominantBiome = BiomeType.TROPICAL_RAINFOREST; // Congo basin like
        else if (region.y < -0.2 || region.y > 0.2) region.dominantBiome = BiomeType.DESERT; // Sahara/Kalahari like
        else region.dominantBiome = BiomeType.GRASSLAND; // Savannah
      }
      if (region.name.toLowerCase().includes('america')) {
          if (region.id === 'na' && region.y > 0.35) region.dominantBiome = BiomeType.BOREAL_FOREST; // Canada/Alaska
          else if (region.id === 'na' && region.y < 0.15 && region.x < -0.55) region.dominantBiome = BiomeType.DESERT; // SW USA
          else if (region.id === 'sa' && region.y > -0.1 && region.y < 0.1) region.dominantBiome = BiomeType.TROPICAL_RAINFOREST; // Amazon
          else if (region.id === 'sa' && region.y < -0.2) region.dominantBiome = BiomeType.GRASSLAND; // Pampas / Patagonia plains
      }
       if (region.name.toLowerCase().includes('asia')) {
        if (region.x > 0.6 && region.y > 0.25) region.dominantBiome = BiomeType.BOREAL_FOREST; // Siberia
        else if (region.x > 0.5 && region.y < 0.1) region.dominantBiome = BiomeType.DESERT; // Middle East / Gobi
        else if (region.x > 0.45 && region.y > 0.05 && region.y < 0.25) region.dominantBiome = BiomeType.TEMPERATE_FOREST; // China/Japan like
        else if (region.x > 0.4 && region.y > -0.05 && region.y < 0.05) region.dominantBiome = BiomeType.TROPICAL_RAINFOREST; // SE Asia
      }
      if (region.name.toLowerCase().includes('oceania')) {
        region.dominantBiome = BiomeType.DESERT; // Australia is largely desert
        if (region.x > 0.85 && region.y < -0.35) region.dominantBiome = BiomeType.TEMPERATE_FOREST; // NZ like
      }


    });

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
      activePolicies: new Set<PolicyType>(),
      activeRegionalPrograms: {},
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
        activePolicies: new Set<PolicyType>(),
        activeRegionalPrograms: {},
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
        return facility;
    }

    const newFacility = { ...facility }; // Operate on a copy
    const tickDeltaTime = deltaTime * state.speed;

    // Construction
    if (newFacility.constructionTimeLeft && newFacility.constructionTimeLeft > 0) {
      newFacility.constructionTimeLeft -= tickDeltaTime;
      if (newFacility.constructionTimeLeft <= 0) {
        newFacility.operational = true;
        newFacility.constructionTimeLeft = 0;
        // console.log(`Facility ${newFacility.id} (${newFacility.type}) for player ${facility.ownerPlayerId} in region ${newFacility.regionId} is now operational.`);
      }
      return newFacility;
    }

    if (!newFacility.operational) {
      return newFacility;
    }

    const definition = FACILITY_DEFINITIONS[newFacility.type];
    if (!definition) return newFacility;

    // Apply player-specific resource yield and maintenance costs
    if (definition.effects) {
        definition.effects.forEach(effect => {
            if (effect.resourceYield) {
                for (const resourceType in effect.resourceYield) {
                    const yieldAmount = effect.resourceYield[resourceType as keyof typeof effect.resourceYield] || 0;
                    playerState.globalResources[resourceType] = (playerState.globalResources[resourceType] || 0) + yieldAmount * tickDeltaTime;
                }
            }
            // Stability effects are now regional, but direct player effects could be here
        });
    }
    if (definition.maintenanceCost) {
        for (const resource in definition.maintenanceCost) {
            const costAmount = definition.maintenanceCost[resource as keyof typeof definition.maintenanceCost] || 0;
            playerState.globalResources[resource] = (playerState.globalResources[resource] || 0) - costAmount * tickDeltaTime;
        }
    }

    // Strategic Resource Node specific yield (player direct yield)
    if (newFacility.type === FacilityType.STRATEGIC_RESOURCE_NODE && newFacility.hexagonId) {
      const resourceOnHex = state.hexagonStrategicResources[newFacility.hexagonId];
      if (resourceOnHex) {
        // Yield rate could be defined in FACILITY_DEFINITIONS or a global constant
        const yieldAmount = 0.02 * tickDeltaTime; // Example: 0.02 units per second
        playerState.globalResources[resourceOnHex] = (playerState.globalResources[resourceOnHex] || 0) + yieldAmount;
      }
    }

    // Apply regional economic impacts (once per facility update, affects the region it's in)
    const region = state.regions.find(r => r.id === newFacility.regionId);
    if (region && definition.economicImpact) {
        const impact = definition.economicImpact;
        const tickScaledImpact = (value: number | undefined) => (value || 0) * tickDeltaTime;

        // Overall GDP Boost (can be deprecated if sector boosts are comprehensive)
        if (impact.gdpBoostPerTick) {
            region.gdp += tickScaledImpact(impact.gdpBoostPerTick);
        }
        // Note: gdpMultiplier might be better applied once on construction or very slowly.
        // For per-tick: region.gdp *= (1 + (impact.gdpMultiplier - 1) * tickDeltaTime);

        // Sector-specific impacts
        if (impact.primarySector && region.economicSectors[impact.primarySector]) {
            // Example: A facility might directly increase its primary sector's output or efficiency
            // This is a placeholder for more detailed logic; actual impact values come from definition.
        }
        if (impact.sectorOutputBoost) {
            for (const sectorKey in impact.sectorOutputBoost) {
                const sectorType = sectorKey as EconomicSectorType;
                const boostAmount = impact.sectorOutputBoost[sectorType];
                if (region.economicSectors[sectorType] && boostAmount) {
                    region.economicSectors[sectorType].output += tickScaledImpact(boostAmount);
                }
            }
        }
        if (impact.sectorEfficiencyBoost) {
            for (const sectorKey in impact.sectorEfficiencyBoost) {
                const sectorType = sectorKey as EconomicSectorType;
                const efficiencyBoost = impact.sectorEfficiencyBoost[sectorType];
                if (region.economicSectors[sectorType] && efficiencyBoost) {
                    // Efficiency boost could be additive factor or multiplier. Assuming additive for now.
                    // Ensure efficiency is capped, e.g., between 0 and 1 (or higher if it's a different scale)
                    const currentEfficiency = region.economicSectors[sectorType].efficiency;
                    region.economicSectors[sectorType].efficiency = Math.min(1, currentEfficiency + tickScaledImpact(efficiencyBoost)); // Cap at 1
                }
            }
        }

        // Regional strategic resource production/demand modifiers (existing logic)
        if (impact.regionalProductionModifier) {
            for (const resTypeStr in impact.regionalProductionModifier) {
                const resType = resTypeStr as StrategicResourceType;
                const modifier = impact.regionalProductionModifier[resType];
                if (modifier && region.resourceProduction[resType] !== undefined) {
                    region.resourceProduction[resType] += (modifier - 1) * 0.1 * tickDeltaTime; // Small additive boost
                    region.resourceProduction[resType] = Math.max(0, region.resourceProduction[resType]);
                }
            }
        }
        if (impact.regionalDemandModifier) {
            for (const resTypeStr in impact.regionalDemandModifier) {
                const resType = resTypeStr as StrategicResourceType;
                const modifier = impact.regionalDemandModifier[resType];
                if (modifier && region.resourceDemand[resType] !== undefined) {
                    region.resourceDemand[resType] += (modifier - 1) * 0.1 * tickDeltaTime; // Small additive change
                    region.resourceDemand[resType] = Math.max(0.1, region.resourceDemand[resType]);
                }
            }
        }
        // Recalculate overall GDP based on sector outputs after modifications
        region.gdp = Object.values(region.economicSectors).reduce((sum, sector) => sum + sector.output, 0);
        region.gdp = Math.max(1, region.gdp); // Ensure GDP doesn't drop below a minimum.
    }
    return newFacility;
  }

  // Placeholder for fetching hexagon adjacencies - remains the same. This might be removed if not used by Research Outposts anymore.
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

    // Process player-specific programs and policies
    newState = this.processPlayerProgramsAndPolicies(newState, deltaTime);

    // AI Player decisions
    if (newState.running) {
        this.aiPlayers.forEach(aiPlayer => {
            // Each AI decision returns a completely new GameState object
            newState = aiPlayer.makeDecisions(newState);
        });
    }

    // Check for and trigger dynamic events based on current state
    newState = this.checkAndTriggerDynamicEvents(newState);
    
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
    const newRegion = { ...region, economicSectors: { ...region.economicSectors }, demographics: { ...region.demographics} }; // Deep copy sectors and demographics
    const tickDelta = deltaTime;

    // Baseline environmental and stability fluctuations
    const baseNoise = this.noise2D(region.x * 5 + state.time * 0.00001, state.time * 0.00005);
    newRegion.environment = Math.max(0, Math.min(100, newRegion.environment + baseNoise * 0.1 * tickDelta));
    newRegion.stability = Math.max(0, Math.min(100, newRegion.stability + baseNoise * 0.2 * tickDelta));

    // --- Update Demographics ---
    // Base working age population changes with total population
    newRegion.demographics.workingAgePopulation = newRegion.population * 0.65 * (newRegion.health / 100); // Healthier population, more working age
    newRegion.demographics.workingAgePopulation = Math.max(0, newRegion.demographics.workingAgePopulation);

    // Education level can slowly change based on stability, GDP per capita, and policies (later)
    let educationChange = (newRegion.stability / 100 - 0.5) * 0.01; // Stability effect
    educationChange += ( (newRegion.gdp / Math.max(1,newRegion.population)) / 50000 - 0.5) * 0.005; // GDP per capita effect (normalized around 50k)
    newRegion.demographics.educationLevel += educationChange * tickDelta;
    newRegion.demographics.educationLevel = Math.max(5, Math.min(100, newRegion.demographics.educationLevel));


    // --- Enhanced Economic Simulation Update ---
    let totalRegionalGdp = 0;
    let totalEmployment = 0;
    const popMillions = newRegion.population / 1000000;

    // 1. Update each Economic Sector
    for (const sectorTypeStr in newRegion.economicSectors) {
        const sectorType = sectorTypeStr as EconomicSectorType;
        const sector = { ...newRegion.economicSectors[sectorType] }; // Operate on a copy of the sector

        // Workforce impact on efficiency: Higher education & lower unemployment = better efficiency
        let workforceFactor = (newRegion.demographics.educationLevel / 75); // Base on education (normalized around 75)
        workforceFactor *= (1 - (newRegion.demographics.unemployedPopulation / Math.max(1, newRegion.demographics.workingAgePopulation)) * 0.5 ); // Unemployment drag
        workforceFactor = Math.max(0.5, Math.min(1.5, workforceFactor)); // Clamp factor

        sector.efficiency *= (1 + (workforceFactor -1) * 0.001 * tickDelta); // Small tick influence of workforce quality
        sector.efficiency = Math.max(0.1, Math.min(1, sector.efficiency));


        // Base growth/decay factors for sector output
        let sectorGrowthFactor = 0.0001; // Tiny base growth/adjustment tendency
        sectorGrowthFactor += (newRegion.stability / 100 - 0.5) * 0.0005; // Stability influence
        sectorGrowthFactor += (sector.efficiency - 0.5) * 0.001; // Efficiency influence (now includes workforce)


        // Resource availability impact on this sector's output/efficiency
        let sectorResourceShortageImpactFactor = 1.0; // Factor from 0 to 1, 1 means no shortage
        if (sector.inputResourceNeeds) {
            for (const resKey in sector.inputResourceNeeds) {
                const typedResKey = resKey as StrategicResourceType | string;
                // Needs are per 1000 units of output. So for current output, scale it.
                // Or, if it's a flat per-tick need (e.g. for 'energy' as string key), use it directly.
                let requiredAmountPerTick = 0;
                if (Object.values(StrategicResourceType).includes(typedResKey as StrategicResourceType)) {
                     requiredAmountPerTick = sector.inputResourceNeeds[typedResKey]! * (sector.output / 1000) * tickDelta;
                } else { // Assume flat per-tick if not a StrategicResourceType (e.g. 'energy' string for now)
                     requiredAmountPerTick = sector.inputResourceNeeds[typedResKey]! * tickDelta;
                }

                // How to determine availableAmount?
                // Option 1: Regional production only.
                // Option 2: Regional production + player's global stockpile (if this region is player-controlled or benefits from player resources).
                // For now, let's use a simplified regional availability.
                // A more complex model would involve resource distribution.
                const availableAmountInRegion = (newRegion.resourceProduction[typedResKey as StrategicResourceType] || 0) * tickDelta;

                // If player resources should contribute (complex to model perfectly without ownership/distribution)
                // Let's assume for now a portion of player's global resources could conceptually be available.
                // This part is highly abstract without a clear owner for the region or a market.
                // Sticking to regional production for simplicity in this step.
                // const playerOwner = Object.values(state.players).find(p => p.activeFacilities.some(f => f.regionId === newRegion.id));
                // const playerGlobalResource = playerOwner ? (playerOwner.globalResources[typedResKey] || 0) : 0;
                // const availableAmount = availableAmountInRegion + playerGlobalResource * 0.01; // Tiny fraction of global stockpile hypothetically available

                const demandMetFactor = Math.min(1, (availableAmountInRegion + 0.001) / (requiredAmountPerTick + 0.001));

                if (demandMetFactor < 1.0) { // Any shortage impacts efficiency
                    // The impact of a single resource shortage could be averaged or the worst one taken.
                    // Let's average the impact factor.
                    sectorResourceShortageImpactFactor = Math.min(sectorResourceShortageImpactFactor, demandMetFactor);
                }
            }
        }
        // Apply the overall shortage factor to efficiency AND output growth
        sector.efficiency *= (1 - (1 - sectorResourceShortageImpactFactor) * 0.1 * tickDelta); // Efficiency hit from shortage
        sectorGrowthFactor *= sectorResourceShortageImpactFactor; // Reduce growth if inputs are scarce

        sector.output *= (1 + sectorGrowthFactor * tickDelta);
        sector.output = Math.max(1, sector.output); // Minimum sector output
        sector.efficiency = Math.max(0.1, Math.min(1, sector.efficiency)); // Clamp efficiency

        // Employment in sector can adjust based on output and efficiency (simplified)
        const desiredEmployment = sector.output / (20000 * Math.max(0.1, sector.efficiency)); // Arbitrary: 1 person per 20k output at normal efficiency
        const employmentChange = (desiredEmployment - sector.employment) * 0.01 * tickDelta; // Slow adjustment
        sector.employment += employmentChange;
        sector.employment = Math.max(0, Math.min(sector.employment, newRegion.demographics.workingAgePopulation * 0.8)); // Cap by available workforce portion

        newRegion.economicSectors[sectorType] = sector; // Update the sector in newRegion
        totalRegionalGdp += sector.output;
        totalEmployment += sector.employment;
    }
    newRegion.gdp = totalRegionalGdp; // Update total GDP from sum of sector outputs
    newRegion.demographics.unemployedPopulation = Math.max(0, newRegion.demographics.workingAgePopulation - totalEmployment);

    // Stability impact from unemployment
    const unemploymentRate = newRegion.demographics.unemployedPopulation / Math.max(1, newRegion.demographics.workingAgePopulation);
    if (unemploymentRate > 0.1) { // If unemployment is over 10%
        newRegion.stability -= (unemploymentRate - 0.1) * 0.1 * tickDelta * 60; // Scaled stability hit
        newRegion.stability = Math.max(0, newRegion.stability);
    }


    // 2. Update Regional Strategic Resource Demand based on new sector outputs and their needs
    // Reset demand before recalculating
    for (const resType of Object.values(StrategicResourceType)) {
      newRegion.resourceDemand[resType] = 0.1; // Base minimal demand
    }
    // General population based demand (includes FOOD and WATER directly for population)
    newRegion.resourceDemand[StrategicResourceType.FOOD] = (newRegion.resourceDemand[StrategicResourceType.FOOD] || 0) + popMillions * 0.01 * tickDelta; // Each million people demand 0.01 food per tick
    newRegion.resourceDemand[StrategicResourceType.WATER] = (newRegion.resourceDemand[StrategicResourceType.WATER] || 0) + popMillions * 0.015 * tickDelta; // Each million people demand 0.015 water per tick

    // General demand for other strategic resources based on population and GDP
    Object.values(StrategicResourceType).forEach(resType => {
        if (resType !== StrategicResourceType.FOOD && resType !== StrategicResourceType.WATER) { // Already handled
            newRegion.resourceDemand[resType] = (newRegion.resourceDemand[resType] || 0) + (popMillions / 20) * (newRegion.gdp / 10000000) * 0.0005 * tickDelta; // Reduced factor as some is covered by sector needs
        }
    });

    // Sector-specific demand
    for (const sectorTypeStr in newRegion.economicSectors) {
        const sector = newRegion.economicSectors[sectorTypeStr as EconomicSectorType];
        if (sector.resourceNeeds) {
            for (const resKey in sector.resourceNeeds) {
                const demandAmount = sector.resourceNeeds[resKey as keyof typeof sector.resourceNeeds]! * sector.output * 0.01 * tickDelta; // Scaled by output & tick
                newRegion.resourceDemand[resKey as StrategicResourceType] = (newRegion.resourceDemand[resKey as StrategicResourceType] || 0) + demandAmount;
            }
        }
    }
    // TODO: Update Regional Strategic Resource Production (can be more dynamic based on available workforce, tech, etc.)
    // For now, production side is mostly affected by facilities directly in updateFacility and base values.
    // Could add a small natural regeneration or depletion factor here.
    Object.values(StrategicResourceType).forEach(resType => {
        let baseProductionFactor = (newRegion.environment / 100) * (newRegion.stability / 100) * (newRegion.health / 100);
        newRegion.resourceProduction[resType] = Math.max(0, (newRegion.resourceProduction[resType] || 0) * (1 - 0.0001 * tickDelta) + (baseProductionFactor * (newRegion.gdp / 10000000) * 0.0005 * tickDelta));
    });


    // 3. Health and Stability affected by Resource Balance (similar to before, but uses new demand figures)
    let overallResourceBalanceScore = 0;
    const numStrategicResources = Object.keys(StrategicResourceType).length;
    for (const resType of Object.values(StrategicResourceType)) {
        const balance = (newRegion.resourceProduction[resType] || 0) - (newRegion.resourceDemand[resType] || 0);
        if (balance < 0) { // Deficit
            overallResourceBalanceScore -= Math.abs(balance) / Math.max(1, (newRegion.resourceDemand[resType] || 1)); // Fractional deficit impact
        } else { // Surplus
            overallResourceBalanceScore += (balance / Math.max(1, (newRegion.resourceDemand[resType] || 1))) * 0.2; // Surplus is less impactful
        }
    }
    // Normalize score (very roughly)
    const normalizedBalanceImpact = overallResourceBalanceScore / numStrategicResources; // General resource balance

    // Specific impact from FOOD and WATER shortages on HEALTH
    const foodBalance = (newRegion.resourceProduction[StrategicResourceType.FOOD] || 0) - (newRegion.resourceDemand[StrategicResourceType.FOOD] || 0);
    const waterBalance = (newRegion.resourceProduction[StrategicResourceType.WATER] || 0) - (newRegion.resourceDemand[StrategicResourceType.WATER] || 0);

    let foodShortageHealthImpact = 0;
    if (foodBalance < 0) {
        foodShortageHealthImpact = (foodBalance / Math.max(1, newRegion.resourceDemand[StrategicResourceType.FOOD])) * 0.1 * tickDelta * 60; // More severe health impact for food
    }
    let waterShortageHealthImpact = 0;
    if (waterBalance < 0) {
        waterShortageHealthImpact = (waterBalance / Math.max(1, newRegion.resourceDemand[StrategicResourceType.WATER])) * 0.08 * tickDelta * 60; // Significant health impact for water
    }

    newRegion.stability += normalizedBalanceImpact * 0.05 * tickDelta * 60; // General resource balance affects stability
    newRegion.health += normalizedBalanceImpact * 0.01 * tickDelta * 60; // General resource balance has smaller direct health impact
    newRegion.health += foodShortageHealthImpact + waterShortageHealthImpact; // Add specific food/water shortage impacts

    newRegion.stability = Math.max(0, Math.min(100, newRegion.stability));
    newRegion.health = Math.max(0, Math.min(100, newRegion.health));

    // --- End Economic Simulation Update ---
    
    // Apply effects of active events in this region
    state.activeEvents.forEach(event => {
        if (event.active && this.isEventInRegion(event, newRegion)) {
            this.applyEventToRegion(newRegion, event); // applyEventToRegion uses event.severity directly
        }
    });
    
    // --- Update Demographics (Births, Deaths) & Population ---
    // Base birth rate influenced by health, food availability
    let currentBirthRate = newRegion.demographics.birthRate; // Start with the region's base rate
    currentBirthRate *= (newRegion.health / 70); // Healthier population, higher birth rate (normalized around 70 health)
    const foodAvailabilityFactor = Math.min(1, (newRegion.resourceProduction[StrategicResourceType.FOOD] + 0.1) / (newRegion.resourceDemand[StrategicResourceType.FOOD] + 0.1));
    currentBirthRate *= (0.8 + foodAvailabilityFactor * 0.2); // Food shortages reduce birth rate (up to 20% reduction from this factor)
    currentBirthRate = Math.max(0.001, Math.min(0.055, currentBirthRate)); // Clamp final rate

    // Base death rate influenced by health, food availability, active pandemics
    let currentDeathRate = newRegion.demographics.deathRate; // Start with region's base rate
    currentDeathRate *= (120 - newRegion.health) / 70; // Lower health, higher death rate (normalized around 70 health)
    currentDeathRate *= (1.2 - foodAvailabilityFactor * 0.2); // Food shortages increase death rate
    
    const pandemicEvents = state.activeEvents.filter(e => e.active && this.isEventInRegion(e, newRegion) && (e.type === EventType.PANDEMIC || e.type === EventType.BIOLOGICAL_WEAPON));
    if (pandemicEvents.length > 0) {
        const avgPandemicSeverity = pandemicEvents.reduce((sum, ev) => sum + ev.severity, 0) / pandemicEvents.length;
        currentDeathRate += avgPandemicSeverity * 0.02; // Pandemics significantly increase death rate
    }
    currentDeathRate = Math.max(0.0005, Math.min(0.06, currentDeathRate)); // Clamp final rate

    // Store updated rates
    newRegion.demographics.birthRate = currentBirthRate;
    newRegion.demographics.deathRate = currentDeathRate;

    // Population change calculation
    // The rates are per 1000, so divide by 1000 for direct multiplier, or ensure rates are already fractional.
    // Assuming rates are already fractional (e.g., 0.02 for 20 per 1000)
    const births = newRegion.population * currentBirthRate * tickDelta;
    const deaths = newRegion.population * currentDeathRate * tickDelta;
    const netPopulationChange = births - deaths;
    newRegion.population = Math.max(0, newRegion.population + netPopulationChange);

    // Update working age population (simple percentage for now)
    newRegion.demographics.workingAgePopulation = newRegion.population * 0.65;
    newRegion.demographics.workingAgePopulation = Math.max(0, newRegion.demographics.workingAgePopulation);
    // Unemployment will be recalculated after sector employment updates.
    // --- End Population Update ---

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

  // --- Player Actions: Policies and Regional Programs ---

  public enactPolicy(currentState: GameState, playerId: string, policyType: PolicyType): { success: boolean, message: string, newState?: GameState } {
    const playerState = currentState.players[playerId];
    if (!playerState) {
      return { success: false, message: `Player ${playerId} not found.` };
    }

    const definition = POLICY_DEFINITIONS[policyType];
    if (!definition) {
      return { success: false, message: `Policy ${policyType} not defined.` };
    }

    if (playerState.activePolicies.has(policyType)) {
      return { success: false, message: `Policy ${definition.name} is already active for player ${playerId}.` };
    }

    // Check for mutually exclusive policies
    if (definition.mutuallyExclusivePolicies) {
      for (const exclusivePolicy of definition.mutuallyExclusivePolicies) {
        if (playerState.activePolicies.has(exclusivePolicy)) {
          const exclusiveDef = POLICY_DEFINITIONS[exclusivePolicy];
          return { success: false, message: `Cannot enact ${definition.name}: It is mutually exclusive with the active policy "${exclusiveDef?.name || exclusivePolicy}".` };
        }
      }
    }

    // Check adoption costs
    const costs = definition.adoptionCost || {};
    const canAfford = Object.entries(costs).every(([resource, cost]) => (playerState.globalResources[resource] || 0) >= cost);

    if (!canAfford) {
      let missing = "";
      for (const resource in costs) {
        if ((playerState.globalResources[resource] || 0) < costs[resource]) {
          missing += `${resource}: ${costs[resource]} (has ${playerState.globalResources[resource] || 0}), `;
        }
      }
      return { success: false, message: `Player ${playerId} cannot enact ${definition.name}: Insufficient resources. Missing: ${missing.slice(0,-2)}` };
    }

    // Deduct costs and update player state
    const newPlayerResources = { ...playerState.globalResources };
    for (const resource in costs) {
      newPlayerResources[resource] -= costs[resource];
    }
    const newActivePolicies = new Set(playerState.activePolicies);
    newActivePolicies.add(policyType);

    const updatedPlayerState: PlayerState = {
      ...playerState,
      globalResources: newPlayerResources,
      activePolicies: newActivePolicies,
    };

    return {
      success: true,
      message: `Policy "${definition.name}" enacted for player ${playerId}.`,
      newState: {
        ...currentState,
        players: {
          ...currentState.players,
          [playerId]: updatedPlayerState,
        }
      }
    };
  }

  public revokePolicy(currentState: GameState, playerId: string, policyType: PolicyType): { success: boolean, message: string, newState?: GameState } {
    const playerState = currentState.players[playerId];
    if (!playerState) {
      return { success: false, message: `Player ${playerId} not found.` };
    }

    const definition = POLICY_DEFINITIONS[policyType];
    if (!definition) {
      return { success: false, message: `Policy ${policyType} not defined.` };
    }

    if (!playerState.activePolicies.has(policyType)) {
      return { success: false, message: `Policy ${definition.name} is not active for player ${playerId}.` };
    }

    // TODO: Consider revocation costs or cooldowns in the future.
    const newActivePolicies = new Set(playerState.activePolicies);
    newActivePolicies.delete(policyType);

    const updatedPlayerState: PlayerState = {
      ...playerState,
      activePolicies: newActivePolicies,
    };

    return {
      success: true,
      message: `Policy "${definition.name}" revoked for player ${playerId}.`,
      newState: {
        ...currentState,
        players: {
          ...currentState.players,
          [playerId]: updatedPlayerState,
        }
      }
    };
  }

  public initiateRegionalDevelopmentProgram(
    currentState: GameState,
    playerId: string,
    regionId: string,
    programType: RegionalDevelopmentProgramType
  ): { success: boolean, message: string, newState?: GameState } {
    const playerState = currentState.players[playerId];
    if (!playerState) {
      return { success: false, message: `Player ${playerId} not found.` };
    }

    const region = currentState.regions.find(r => r.id === regionId);
    if (!region) {
      return { success: false, message: `Region ${regionId} not found.` };
    }

    // Potentially check if the region is controlled by the player in a more complex ownership model.
    // For now, assuming player can initiate in any region if they can afford it.

    const definition = REGIONAL_DEVELOPMENT_PROGRAM_DEFINITIONS[programType];
    if (!definition) {
      return { success: false, message: `Regional Development Program ${programType} not defined.` };
    }

    // Check if a program is already active in this region for this player
    if (playerState.activeRegionalPrograms[regionId]) {
        const activeProgram = playerState.activeRegionalPrograms[regionId];
        return { success: false, message: `A program ("${activeProgram.definition.name}") is already active in ${region.name} for player ${playerId}.`};
    }

    // Check costs
    const costs = definition.cost || {};
    const canAfford = Object.entries(costs).every(([resource, cost]) => (playerState.globalResources[resource] || 0) >= cost);

    if (!canAfford) {
      let missing = "";
      for (const resource in costs) {
        if ((playerState.globalResources[resource] || 0) < costs[resource]) {
          missing += `${resource}: ${costs[resource]} (has ${playerState.globalResources[resource] || 0}), `;
        }
      }
      return { success: false, message: `Player ${playerId} cannot initiate ${definition.name} in ${region.name}: Insufficient resources. Missing: ${missing.slice(0,-2)}` };
    }

    // Deduct costs
    const newPlayerResources = { ...playerState.globalResources };
    for (const resource in costs) {
      newPlayerResources[resource] -= costs[resource];
    }

    // Add program to player's active list
    const newActiveRegionalPrograms = { ...playerState.activeRegionalPrograms };
    newActiveRegionalPrograms[regionId] = {
      programType,
      definition,
      startedAtTick: currentState.time, // Assuming state.time is effectively game ticks or can be used as such
      durationTicks: definition.durationTicks,
    };

    // Apply one-time effects of the program to the region immediately
    let newRegions = [...currentState.regions];
    if (definition.oneTimeEffects) {
        const targetRegionIndex = newRegions.findIndex(r => r.id === regionId);
        if (targetRegionIndex !== -1) {
            let updatedRegion = { ...newRegions[targetRegionIndex] };
            const effects = definition.oneTimeEffects;
            if(effects.health) updatedRegion.health = Math.max(0, Math.min(100, updatedRegion.health + effects.health));
            if(effects.environment) updatedRegion.environment = Math.max(0, Math.min(100, updatedRegion.environment + effects.environment));
            if(effects.stability) updatedRegion.stability = Math.max(0, Math.min(100, updatedRegion.stability + effects.stability));
            if(effects.population) updatedRegion.population = Math.max(0, updatedRegion.population + effects.population);
            if(effects.populationMultiplier) updatedRegion.population = Math.max(0, updatedRegion.population * effects.populationMultiplier);
            // Note: GDP and resource production/demand changes from oneTimeEffects would also go here if defined.
            newRegions[targetRegionIndex] = updatedRegion;
        }
    }

    const updatedPlayerState: PlayerState = {
      ...playerState,
      globalResources: newPlayerResources,
      activeRegionalPrograms: newActiveRegionalPrograms,
    };

    return {
      success: true,
      message: `Regional Development Program "${definition.name}" initiated in ${region.name} by player ${playerId}.`,
      newState: {
        ...currentState,
        regions: newRegions, // Make sure to use the potentially updated regions
        players: {
          ...currentState.players,
          [playerId]: updatedPlayerState,
        }
      }
    };
  }

  // Placeholder for processing active programs and policies - to be called in updateWorld
  private processPlayerProgramsAndPolicies(currentState: GameState, deltaTime: number): GameState {
    let newState = { ...currentState };

    for (const playerId in newState.players) {
      const player = newState.players[playerId];
      let playerNeedsUpdate = false;

      // Process active regional programs
      const activePrograms = { ...player.activeRegionalPrograms };
      for (const regionId in activePrograms) {
        const program = activePrograms[regionId];
        const regionIndex = newState.regions.findIndex(r => r.id === regionId);
        if (regionIndex === -1) {
          delete activePrograms[regionId]; // Region no longer exists or program is invalid
          playerNeedsUpdate = true;
          continue;
        }

        let region = { ...newState.regions[regionIndex] };

        // Apply per-tick effects
        if (program.definition.effectsPerTick) {
          const effects = program.definition.effectsPerTick;
          // Apply to region (health, stability, env, etc.)
          if(effects.health) region.health += effects.health * deltaTime * newState.speed;
          if(effects.environment) region.environment += effects.environment * deltaTime * newState.speed;
          if(effects.stability) region.stability += effects.stability * deltaTime * newState.speed;
          // Clamp values
          region.health = Math.max(0, Math.min(100, region.health));
          region.environment = Math.max(0, Math.min(100, region.environment));
          region.stability = Math.max(0, Math.min(100, region.stability));
        }
        // Apply demographic effects per tick (if any)
        if (program.definition.demographicEffects && program.definition.demographicEffects.educationLevelChange) {
            region.demographics.educationLevel += program.definition.demographicEffects.educationLevelChange * deltaTime * newState.speed;
            region.demographics.educationLevel = Math.max(5, Math.min(100, region.demographics.educationLevel));
        }
        if (program.definition.demographicEffects && program.definition.demographicEffects.unemploymentChange) {
            // This is a direct change to number of unemployed people. Positive value increases unemployment.
            const changeInUnemployed = program.definition.demographicEffects.unemploymentChange * deltaTime * newState.speed;
            region.demographics.unemployedPopulation += changeInUnemployed;
            // Ensure unemployment doesn't go below zero or exceed working age population
            region.demographics.unemployedPopulation = Math.max(0, Math.min(region.demographics.unemployedPopulation, region.demographics.workingAgePopulation));
        }


        newState.regions[regionIndex] = region; // Update region in newState

        // Check duration
        // Note: Using state.time directly for duration check. Ensure program.startedAtTick and program.durationTicks are compatible.
        if (newState.time >= program.startedAtTick + program.durationTicks) {
          // Program finished, apply long-term modifiers and trigger final events
          if (program.definition.longTermRegionalModifiers) {
            // These modifiers would ideally be stored on the region or player state persistently
            // For now, log that they would apply. Actual application needs careful thought on how they persist.
            console.log(`Program ${program.definition.name} in ${region.name} finished. Long term modifiers would apply.`);
          }
          program.definition.eventTriggers?.forEach(trigger => {
            if (Math.random() < trigger.chance) {
              // TODO: Implement delayed event spawning if trigger.delayTicks is used
              console.log(`Program ${program.definition.name} triggering event ${trigger.eventType} in ${region.name}`);
              newState = this.triggerEvent(newState, trigger.eventType, regionId, playerId);
            }
          });
          delete activePrograms[regionId];
          playerNeedsUpdate = true;
        }
      }
      if(playerNeedsUpdate) {
           newState.players[playerId] = { ...player, activeRegionalPrograms: activePrograms };
      }

      // Process active policies (apply maintenance costs, global/regional modifiers)
      player.activePolicies.forEach(policyType => {
        const definition = POLICY_DEFINITIONS[policyType];
        if (!definition) return;

        // Apply maintenance costs
        if (definition.maintenanceCostPerTick) {
          for (const resource in definition.maintenanceCostPerTick) {
            const cost = definition.maintenanceCostPerTick[resource as keyof typeof definition.maintenanceCostPerTick] || 0;
            newState.players[playerId].globalResources[resource] = (newState.players[playerId].globalResources[resource] || 0) - cost * deltaTime * newState.speed;
          }
        }

        // Global player modifiers
        if (definition.globalPlayerModifiers) {
          const { researchSpeedModifier, resourceIncomeModifier, facilityUpkeepModifier } = definition.globalPlayerModifiers;
          if (researchSpeedModifier) {
            // Actual application is in updateResearchProgress, which checks playerState.globalResources.research.
            // This policy effect should modify that base research generation rate if active.
            // For now, this is implicitly handled if 'research' is a resource in globalResources and the policy modifies it.
            // A more direct way: playerState.researchBonusFactor = (playerState.researchBonusFactor || 1) * researchSpeedModifier;
          }
          if (resourceIncomeModifier) {
            for (const res in resourceIncomeModifier) {
              const incomeKey = res as keyof typeof resourceIncomeModifier;
              // This should apply to the *rate* of income, not directly to the stockpile each tick.
              // For now, if it's 'credits', let's assume a small flat bonus symbolic of better trade/tax efficiency.
              if (res === 'credits' && resourceIncomeModifier[incomeKey]! > 1) {
                 newState.players[playerId].globalResources[res] = (newState.players[playerId].globalResources[res] || 0) + (resourceIncomeModifier[incomeKey]! - 1) * 5 * deltaTime * newState.speed; // Smaller flat bonus
              }
            }
          }
          // facilityUpkeepModifier would ideally reduce maintenance costs calculated elsewhere (e.g. in updateFacility)
        }

        // Regional modifiers (applied to all regions, assuming player policies affect their entire sphere of influence)
        if (definition.regionalModifiers) {
          const { stabilityBonusPerTick, environmentChangePerTick, facilityConstructionSpeedModifier, pollutionFromIndustryModifier } = definition.regionalModifiers;
          newState.regions.forEach(region => { // TODO: In future, only apply to regions player 'controls' or has high influence in.
            if (stabilityBonusPerTick) {
              region.stability += stabilityBonusPerTick * deltaTime * newState.speed;
              region.stability = Math.max(0, Math.min(100, region.stability));
            }
            if (environmentChangePerTick) {
              region.environment += environmentChangePerTick * deltaTime * newState.speed;
              region.environment = Math.max(0, Math.min(100, region.environment));
            }
            // facilityConstructionSpeedModifier would be checked by facilities under construction.
            // pollutionFromIndustryModifier would affect calculations within sectors or facilities.
          });
        }

        // Specific policy direct effects (like Education Subsidies impacting regional education levels)
        if (policyType === PolicyType.EDUCATION_SUBSIDIES) {
            newState.regions.forEach(region => { // Apply to all player regions
                region.demographics.educationLevel += 0.02 * deltaTime * newState.speed; // Slow tick effect
                region.demographics.educationLevel = Math.max(5, Math.min(100, region.demographics.educationLevel));
            });
        }
         if (policyType === PolicyType.ENVIRONMENTAL_REGULATION) {
            newState.regions.forEach(region => {
                const industrySector = region.economicSectors[EconomicSectorType.INDUSTRY];
                if (industrySector) {
                    // Increased efficiency hit for Environmental Regulation to make it more impactful.
                    industrySector.efficiency -= 0.005 * deltaTime * newState.speed; // Adjusted impact
                    industrySector.efficiency = Math.max(0.1, industrySector.efficiency);
                }
            });
        }

      });
    }
    return newState;
  }

  private checkAndTriggerDynamicEvents(currentState: GameState): GameState {
    let newState = { ...currentState };
    const tickDelta = currentState.speed * (1/60); // Assuming 60 FPS for tick delta calculation, adjust if needed

    // Check for Regional Energy Crisis for each player
    for (const playerId in newState.players) {
      const player = newState.players[playerId];
      const energyBalance = player.globalResources.energy || 0; // Current stored energy

      // Estimate net energy change based on facilities (a more accurate calculation might be needed)
      let netEnergyProduction = 0;
      player.activeFacilities.forEach(facility => {
        const def = FACILITY_DEFINITIONS[facility.type];
        if (def && facility.operational) {
          def.effects.forEach(effect => {
            if (effect.resourceYield && effect.resourceYield['energy']) {
              netEnergyProduction += effect.resourceYield['energy'];
            }
          });
          if (def.maintenanceCost && def.maintenanceCost['energy']) {
            netEnergyProduction -= def.maintenanceCost['energy'];
          }
        }
      });

      // Condition: Low stored energy AND significant negative net production
      // Add a random chance to prevent it from firing every single tick once conditions are met.
      if (energyBalance < 20 && netEnergyProduction < -1 && Math.random() < 0.05) { // Thresholds and chance can be tuned
        // Find a suitable region owned/influenced by the player to trigger the event
        // For simplicity, pick a random region where the player has at least one facility.
        const playerRegions = new Set<string>();
        player.activeFacilities.forEach(f => playerRegions.add(f.regionId));

        if (playerRegions.size > 0) {
          const targetRegionId = Array.from(playerRegions)[Math.floor(Math.random() * playerRegions.size)];
          const targetRegion = newState.regions.find(r => r.id === targetRegionId);

          if (targetRegion) {
            // Check if an energy crisis is NOT already active in this region for this player
            const existingCrisis = newState.activeEvents.find(e =>
              e.type === EventType.REGIONAL_ENERGY_CRISIS &&
              e.active &&
              this.isEventInRegion(e, targetRegion) // Basic check if coordinates match region
              // Ideally, events might store a targetRegionId or be more clearly scoped
            );

            if (!existingCrisis) {
              console.log(`Player ${playerId} is experiencing an energy crisis. Triggering ${EventType.REGIONAL_ENERGY_CRISIS} in region ${targetRegion.name}. Balance: ${energyBalance}, Net Prod: ${netEnergyProduction}`);
              newState = this.triggerEvent(newState, EventType.REGIONAL_ENERGY_CRISIS, targetRegion.id, playerId);
              // Potentially only trigger one such crisis per player per short interval to avoid spam
            }
          }
        }
      }
    }
    // TODO: Add checks for other dynamic events (e.g., resource shortages leading to famine/unrest)
    return newState;
  }
}