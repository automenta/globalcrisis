import { EventType } from './GameEngine';

// Type definition for the effects an event can have on a region
export interface RegionalEffects {
  health?: number; // Direct change to health points
  environment?: number; // Direct change to environment points
  stability?: number; // Direct change to stability points
  population?: number; // Absolute change in population number
  populationMultiplier?: number; // Multiplicative factor for population (e.g., 0.9 for 10% decrease)
  // Future effects could include:
  // resourceGeneration?: { [resourceType: string]: number }; // Changes resource generation rates
  // unlocks?: string[]; // IDs of technologies or units unlocked
  // triggersEvent?: EventType; // Another event triggered as a consequence
}

// Type definition for a single threat or event
export interface ThreatDefinition {
  name: string; // Display name
  description?: string; // In-game description
  cost?: number; // Cost to deploy (if player-triggered)
  effects: RegionalEffects; // Effects on the target region/area
  duration: number; // Duration of the event in seconds (or game ticks)
  visual?: string; // Key for visual effect type (e.g., 'explosion', 'plague_cloud')
  color?: number; // Hex color code for map markers or UI
  spread?: {
    chance: number; // 0-1 chance per update tick to spread
    radius: number; // Max distance to spread to
    decay: number;  // Factor by which spread chance/intensity decays with each spread hop
  };
  // Behavior-specific parameters
  behavior?: string; // Optional: key for specific hardcoded behavior (e.g., 'seismic_shockwave', 'healing_aura')
  behaviorParams?: Record<string, any>; // Parameters for that behavior
}

// Main object to hold all threat/event definitions, keyed by EventType
export const THREAT_DEFINITIONS: Record<EventType, ThreatDefinition> = {
  [EventType.NUCLEAR_STRIKE]: {
    name: 'Nuclear Strike',
    description: 'Devastating nuclear explosion causing massive casualties and environmental damage.',
    cost: 500,
    effects: { populationMultiplier: 0.3, health: -50, environment: -70, stability: -40 },
    duration: 20, // Lingering radiation effects
    visual: 'nuclear_explosion',
    color: 0xff0000,
    spread: { chance: 0.05, radius: 0.3, decay: 0.5 }, // Fallout spread
  },
  [EventType.BIOLOGICAL_WEAPON]: {
    name: 'Biological Weapon',
    description: 'Release of a contagious pathogen causing widespread disease and death.',
    cost: 300,
    effects: { health: -60, stability: -30, populationMultiplier: 0.7 },
    duration: 60, // Pandemic duration
    visual: 'biohazard_cloud',
    color: 0x00ff00,
    spread: { chance: 0.2, radius: 0.4, decay: 0.2 },
  },
  [EventType.CHEMICAL_WEAPON]: {
    name: 'Chemical Weapon',
    description: 'Dispersal of toxic chemicals, causing immediate casualties and long-term health issues.',
    cost: 250,
    effects: { health: -40, environment: -30, populationMultiplier: 0.85 },
    duration: 40,
    visual: 'toxic_gas',
    color: 0xffff00,
    spread: { chance: 0.15, radius: 0.25, decay: 0.3 },
  },
  [EventType.CYBER_ATTACK]: {
    name: 'Cyber Attack',
    description: 'Large-scale disruption of critical digital infrastructure, affecting stability and resources.',
    cost: 150,
    effects: { stability: -50, /* todo: add resource effects like -energy, -research */ },
    duration: 30,
    visual: 'digital_glitch',
    color: 0x0000ff,
  },
  [EventType.CLIMATE_DISASTER]: {
    name: 'Climate Disaster',
    description: 'Extreme weather event (e.g., superstorm, mega-drought) causing widespread destruction.',
    // cost: 0, // Naturally occurring or result of cumulative environmental damage
    effects: { environment: -60, stability: -30, population: -1000000 },
    duration: 50,
    visual: 'storm_effects',
    color: 0x00ffff,
  },
  [EventType.SOLAR_FLARE]: {
    name: 'Solar Flare',
    description: 'A massive solar flare impacts Earth, disrupting satellites and power grids.',
    effects: { stability: -20, /* todo: add effect on satellites, power */ },
    duration: 15,
    visual: 'aurora_intense',
    color: 0xffaa00,
  },
  [EventType.ROGUE_AI]: {
    name: 'Rogue AI',
    description: 'An advanced Artificial Intelligence gains sentience and turns against humanity.',
    cost: 600,
    effects: { stability: -70, health: -20, /* todo: spawn rogue AI entities */ },
    duration: 120, // Long-term threat
    visual: 'ai_takeover_effect',
    color: 0xff00ff,
  },
  [EventType.DRONE_SWARM]: {
    name: 'Drone Swarm Attack',
    description: 'Autonomous combat drones attack civilian and military targets.',
    cost: 350,
    effects: { stability: -25, population: -500000, health: -10 },
    duration: 25,
    visual: 'drone_swarm_visual',
    color: 0x888888,
  },
  [EventType.SPACE_WEAPON]: {
    name: 'Orbital Strike',
    description: 'Kinetic bombardment or energy weapon firing from orbit.',
    cost: 700,
    effects: { populationMultiplier: 0.6, stability: -35, environment: -25 },
    duration: 5, // Short, intense impact
    visual: 'orbital_beam',
    color: 0xffffff,
  },
  [EventType.PROPAGANDA]: {
    name: 'Propaganda Campaign',
    description: 'Coordinated disinformation campaign eroding public trust and stability.',
    cost: 100,
    effects: { stability: -30, /* todo: affect population psychology if added */ },
    duration: 90,
    visual: 'propaganda_waves',
    color: 0xcccccc,
  },
  [EventType.ECONOMIC_COLLAPSE]: {
    name: 'Economic Collapse',
    description: 'Severe economic downturn leading to widespread poverty and instability.',
    effects: { stability: -60, /* todo: affect resources */ },
    duration: 180, // Long recovery
    visual: 'market_crash_effect',
    color: 0x800000,
  },
  [EventType.PANDEMIC]: { // Could be a more severe version of BIOLOGICAL_WEAPON or naturally occurring
    name: 'Global Pandemic',
    description: 'A highly infectious and lethal disease spreads globally.',
    effects: { health: -70, stability: -40, populationMultiplier: 0.5 },
    duration: 200,
    visual: 'pandemic_spread_strong',
    color: 0x33aa33,
    spread: { chance: 0.3, radius: 0.5, decay: 0.1 },
  },
  [EventType.NUCLEAR_MELTDOWN]: {
    name: 'Nuclear Meltdown',
    description: 'Catastrophic failure of a nuclear power plant, releasing radiation.',
    effects: { environment: -50, health: -30, population: -200000 },
    duration: 150, // Long-term contamination
    visual: 'radiation_zone',
    color: 0xccff00,
    spread: { chance: 0.08, radius: 0.2, decay: 0.4 },
  },
  [EventType.ALIEN_CONTACT]: {
    name: 'First Contact',
    description: 'Humanity makes verifiable contact with an extraterrestrial intelligence.',
    // Effects can be positive, negative, or mixed based on nature of contact
    effects: { stability: 50, /* todo: research points boost? or panic? */ },
    duration: 10, // Initial event, could trigger follow-ups
    visual: 'ufo_sighting',
    color: 0x00aaff,
  },
  [EventType.INTERDIMENSIONAL]: {
    name: 'Interdimensional Rift',
    description: 'A breach between dimensions opens, potentially releasing unknown threats or phenomena.',
    effects: { stability: -50, /* todo: spawn special entities/events */ },
    duration: 75,
    visual: 'dimensional_portal',
    color: 0xaa00ff,
  },
  [EventType.ELECTROMAGNETIC_PULSE]: {
    name: 'EMP Burst',
    description: 'An electromagnetic pulse disables electronic systems over a wide area.',
    effects: { stability: -40, /* todo: disable satellites, affect energy resources */ },
    duration: 10,
    visual: 'emp_wave',
    color: 0x00ffff,
  },
  [EventType.GEOENGINEERING]: { // Could be positive or negative
    name: 'Geoengineering Project',
    description: 'Large-scale manipulation of Earth\'s climate systems.',
    effects: { environment: 20, stability: -10 }, // Example: helps env but causes instability
    duration: 300,
    visual: 'geoengineering_effect',
    color: 0x0088aa,
  },
  [EventType.HEALING]: {
    name: 'Mass Healing Wave',
    description: 'A mysterious phenomenon rapidly heals populations in an area.',
    effects: { health: 80, populationMultiplier: 1.05 }, // Slight population boost due to saved lives
    duration: 15,
    visual: 'healing_aura',
    color: 0x00ff88,
  },
  [EventType.ENVIRONMENTAL_RESTORATION]: {
    name: 'Environmental Restoration',
    description: 'Rapid ecological recovery and cleansing of pollution in an area.',
    effects: { environment: 70 },
    duration: 100,
    visual: 'nature_bloom',
    color: 0x88ff00,
  },
  [EventType.PEACE_TREATY]: {
    name: 'Global Peace Treaty',
    description: 'A landmark peace agreement is signed, significantly boosting global stability.',
    effects: { stability: 80 }, // Global effect, or large regional if targeted
    duration: 5, // Effect is applied, then it's a new state
    visual: 'peace_doves',
    color: 0xffd700,
  },
};

// TODO: Define structures for other game entities like facilities, units, etc.
// export interface PlanetaryFacilityDefinition { ... }
// export const FACILITY_DEFINITIONS: Record<string, PlanetaryFacilityDefinition> = { ... };

export enum FacilityType {
  RESEARCH_OUTPOST = 'research_outpost',
  RESOURCE_EXTRACTOR = 'resource_extractor',
  DEFENSE_PLATFORM = 'defense_platform',
}

export interface FacilityEffect {
  resourceYield?: Record<string, number>; // e.g., { research: 5 }
  stabilityModifier?: number;
  // other potential effects...
}

export interface PlanetaryFacilityDefinition {
  name: string;
  description: string;
  cost: Record<string, number>; // e.g., { credits: 100, materials: 50 }
  effects: FacilityEffect[]; // Effects this facility provides (e.g., per turn/tick)
  upgrades?: Record<string, any>; // Potential upgrade paths
  visual?: string; // Key for 3D model or icon
  maxPerRegion?: number;
  maxGlobal?: number;
}

export const FACILITY_DEFINITIONS: Record<FacilityType, PlanetaryFacilityDefinition> = {
  [FacilityType.RESEARCH_OUTPOST]: {
    name: 'Research Outpost',
    description: 'Generates research points over time.',
    cost: { /* credits: 100 */ }, // Assuming credits are a global resource not yet in GameState
    effects: [
      { resourceYield: { research: 0.1 } } // 0.1 research points per update tick (deltaTime dependent)
    ],
    visual: 'research_dome',
    maxPerRegion: 1,
  },
  [FacilityType.RESOURCE_EXTRACTOR]: {
    name: 'Resource Extractor',
    description: 'Extracts basic resources from the region.',
    cost: { /* credits: 150 */ },
    effects: [
      { resourceYield: { credits: 0.05 } } // Placeholder for generic "credits" or specific materials
    ],
    visual: 'mining_rig',
    maxPerRegion: 3,
  },
  [FacilityType.DEFENSE_PLATFORM]: {
    name: 'Defense Platform',
    description: 'Provides defensive capabilities to the region.',
    cost: { /* credits: 200 */ },
    effects: [
      { stabilityModifier: 0.01 } // Small passive stability boost per tick
      // Could also have active defense capabilities (e.g. intercept missiles - more complex)
    ],
    visual: 'defense_turret',
    maxPerRegion: 1,
  }
};

// Example:
// [EventType.CUSTOM_EVENT_EXAMPLE]: {
//   name: 'Custom Event',
//   description: 'This is a test event.',
//   effects: { health: 10, stability: 5 },
//   duration: 10,
//   visual: 'custom_visual_key',
//   color: 0x123456,
//   behavior: 'custom_behavior_key',
//   behaviorParams: { intensity: 5, targetType: 'population' }
// }
