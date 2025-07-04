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

  // For emergent gameplay:
  synergiesWith?: {
    type: EventType;
    effectModifier?: Partial<RegionalEffects>; // How much to boost/change effects
    durationModifier?: number; // e.g., 1.5 for 50% longer combined duration
    newEffect?: RegionalEffects; // Completely new effect if synergy occurs
    description?: string; // Optional description of the synergy
  }[];
  conflictsWithEvents?: {
    type: EventType;
    severityReduction?: number; // e.g., 0.5 to halve incoming event's severity
    durationReduction?: number; // e.g., 0.7 to reduce incoming event's duration by 30%
    cancels?: boolean; // Does this event cancel the conflicting one?
    newEffect?: RegionalEffects; // New or modified effect due to conflict
    description?: string; // Optional description of the conflict
  }[];
  counteredByFacilities?: {
    type: FacilityType;
    severityReduction?: number; // e.g., 0.3 to reduce this event's severity by 30% if facility is present
    durationReduction?: number; // e.g., 0.5 to halve this event's duration
    preventsSpread?: boolean;
    description?: string; // Optional description of how facility counters
  }[];
  followUpEvents?: {
    type: EventType;
    chance: number; // 0-1 probability
    delay?: number; // Ticks/seconds after this event ends/triggers
    conditions?: any; // More complex conditions, e.g., region stability < X
  }[];
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
    counteredByFacilities: [
      { type: FacilityType.DEFENSE_PLATFORM, severityReduction: 0.25, durationReduction: 0.2 }
    ],
    followUpEvents: [
      { type: EventType.NUCLEAR_MELTDOWN, chance: 0.1, delay: 10, conditions: { minSeverity: 0.5 } }
    ]
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
    synergiesWith: [
      { type: EventType.PANDEMIC, effectModifier: { health: -10 }, durationModifier: 1.2 }
    ],
    conflictsWithEvents: [
      { type: EventType.HEALING, severityReduction: 0.5, durationReduction: 0.5 }
    ]
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
    counteredByFacilities: [
      { type: FacilityType.DEFENSE_PLATFORM, severityReduction: 0.1, description: "Hardened infrastructure resists some effects." } // Added description field to type for clarity
    ],
    conflictsWithEvents: [
        { type: EventType.ROGUE_AI, newEffect: {stability: -20}, description: "AI exploits cyber vulnerabilities during attack."}
    ]
  },
  [EventType.CLIMATE_DISASTER]: {
    name: 'Climate Disaster',
    description: 'Extreme weather event (e.g., superstorm, mega-drought) causing widespread destruction.',
    // cost: 0, // Naturally occurring or result of cumulative environmental damage
    effects: { environment: -60, stability: -30, population: -1000000 },
    duration: 50,
    visual: 'storm_effects',
    color: 0x00ffff,
    followUpEvents: [
      { type: EventType.ECONOMIC_COLLAPSE, chance: 0.15, delay: 20, conditions: { minSeverity: 0.6, minDuration: 30 } },
      { type: EventType.PANDEMIC, chance: 0.05, delay: 10, conditions: { environmentBelow: 40 } }
    ]
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
    synergiesWith: [
      { type: EventType.PEACE_TREATY, effectModifier: { health: 10, stability: 5}, description: "Peace accelerates recovery." },
      { type: EventType.ENVIRONMENTAL_RESTORATION, newEffect: { populationMultiplier: 1.02 }, description: "Healing in pristine environments boosts morale and recovery." }
    ],
    conflictsWithEvents: [
      { type: EventType.BIOLOGICAL_WEAPON, cancels: true, description: "Focused healing eradicates the pathogen." },
      { type: EventType.PANDEMIC, severityReduction: 0.7, durationReduction: 0.5, description: "Reduces impact of ongoing pandemic."}
    ]
  },
  [EventType.ENVIRONMENTAL_RESTORATION]: {
    name: 'Environmental Restoration',
    description: 'Rapid ecological recovery and cleansing of pollution in an area.',
    effects: { environment: 70 },
    duration: 100,
    visual: 'nature_bloom',
    color: 0x88ff00,
    synergiesWith: [
      { type: EventType.GEOENGINEERING, effectModifier: { environment: 20 }, description: "Geoengineering efforts are amplified by natural restoration." },
      { type: EventType.HEALING, newEffect: { stability: 5 }, description: "Visible environmental recovery boosts societal hope during healing efforts."}
    ],
    conflictsWithEvents: [
      { type: EventType.NUCLEAR_MELTDOWN, durationReduction: 0.3, description: "Restoration efforts can slowly mitigate long-term contamination." },
      { type: EventType.CHEMICAL_WEAPON, effectModifier: { environment: 10 }, description: "Natural processes help neutralize some chemical agents faster." }
    ]
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

export enum StrategicResourceType {
  RARE_METALS = 'rare_metals',
  ANTIMATTER_CELLS = 'antimatter_cells',
  EXOTIC_ISOTOPES = 'exotic_isotopes',
  DATA_CONDUITS = 'data_conduits', // Represents high-capacity data processing/transmission nodes
  BIOPRECURSORS = 'bioprecursors' // For advanced biological engineering or terraforming
}

// General resources can still be strings in GameState.globalResources
// This enum is for specific, map-located strategic resources.

export enum FacilityType {
  RESEARCH_OUTPOST = 'research_outpost',
  RESOURCE_EXTRACTOR = 'resource_extractor', // Generic extractor
  STRATEGIC_RESOURCE_NODE = 'strategic_resource_node', // Facility to tap into a specific hex resource
  DEFENSE_PLATFORM = 'defense_platform',
  ADVANCED_RESEARCH_LAB = 'advanced_research_lab',
  POWER_PLANT = 'power_plant', // New facility for energy production
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
  visual?: string; // Key for 3D model or icon
  maxPerRegion?: number;
  maxGlobal?: number;
  constructionTime?: number; // Time in seconds (or game ticks) to build the facility
  upgrades?: {
    toFacilityType: FacilityType;
    cost: Record<string, number>; // Cost to perform this specific upgrade
    techRequired?: string; // TechId from Technology.ts
    constructionTime?: number; // Optional: time this upgrade takes, distinct from initial construction
  }[];
  economicImpact?: { // Optional field for economic effects on the region
    gdpBoost?: number; // Flat boost to GDP per tick
    gdpMultiplier?: number; // Multiplicative boost to GDP (e.g., 1.05 for 5% boost)
    productionModifier?: Partial<Record<StrategicResourceType, number>>; // e.g., { RARE_METALS: 1.1 } for 10% boost
    demandModifier?: Partial<Record<StrategicResourceType, number>>; // e.g., { ANTIMATTER_CELLS: 0.9 } for 10% reduction in demand
  };
}

export const FACILITY_DEFINITIONS: Record<FacilityType, PlanetaryFacilityDefinition> = {
  [FacilityType.RESEARCH_OUTPOST]: {
    name: 'Research Outpost',
    description: 'Generates research points over time.',
    cost: { credits: 100 },
    effects: [
      { resourceYield: { research: 0.1 } }
    ],
    visual: 'research_dome',
    maxPerRegion: 3, // Allow a few basic ones
    upgrades: [
      {
        toFacilityType: FacilityType.ADVANCED_RESEARCH_LAB, // New facility type needed
        cost: { credits: 300, research: 100, [StrategicResourceType.DATA_CONDUITS]: 5 },
        techRequired: "appliedCybernetics" // Example tech prerequisite
      }
    ]
  },
  // We'll need to define ADVANCED_RESEARCH_LAB and other potential upgraded facilities
  [FacilityType.ADVANCED_RESEARCH_LAB]: { // Define the new upgraded facility
    name: 'Advanced Research Lab',
    description: 'Significantly boosts research point generation and enables advanced projects.',
    cost: { credits: 500, research: 200, [StrategicResourceType.DATA_CONDUITS]: 10 }, // Cost if built directly (perhaps higher or not directly buildable)
    effects: [
      { resourceYield: { research: 0.5 } } // Higher research yield
    ],
    visual: 'advanced_research_lab_visual', // Needs a new visual key
    maxPerRegion: 1, // Only one advanced lab per region
    // Could have further upgrades or be a terminal upgrade
  },
  [FacilityType.RESOURCE_EXTRACTOR]: { // This remains a generic extractor for regional (non-hex specific) resources
    name: 'Regional Resource Extractor',
    description: 'Extracts basic resources from the region. Does not require a specific hex node.',
    cost: { credits: 150 }, // Example cost
    effects: [
      { resourceYield: { credits: 0.05 } }
    ],
    visual: 'mining_rig_regional',
    maxPerRegion: 2, // Can have a few of these per region
  },
  [FacilityType.STRATEGIC_RESOURCE_NODE]: {
    name: 'Strategic Resource Node',
    description: 'Exploits a specific strategic resource found on this hexagon. Type of resource depends on the hexagon.',
    cost: { credits: 250, research: 50 }, // Higher cost, might require research points
    // Effects are dynamic based on the resource type of the hexagon it's built on.
    // This will be handled in GameEngine.ts when the facility is updated.
    // For example, if built on a RARE_METALS hex, it yields RARE_METALS.
    effects: [
        // Placeholder: Actual yield determined by hex resource type in GameEngine
        // { resourceYield: { [StrategicResourceType.RARE_METALS]: 0.02 } } // Example if hardcoded
    ],
    visual: 'strategic_node_generic', // Could have type-specific visuals later
    maxPerRegion: 5, // Arbitrary limit, could be 1 per hex with resource
    // Special condition: Must be built on a hexagon with a strategic resource. This will be checked in buildFacility.
  },
  [FacilityType.DEFENSE_PLATFORM]: {
    name: 'Defense Platform',
    description: 'Provides defensive capabilities to the region and contributes to global defense readiness.',
    cost: { credits: 200, energy: 50 }, // Added energy to initial cost as well
    effects: [
      { stabilityModifier: 0.01 }, // Small passive stability boost per tick
      { resourceYield: { defense: 0.1, energy: -0.05 } } // Produces defense, consumes energy for upkeep
    ],
    visual: 'defense_turret',
    maxPerRegion: 1,
    constructionTime: 20, // Takes 20 seconds to build
  },
  [FacilityType.POWER_PLANT]: {
    name: 'Power Plant',
    description: 'Generates energy required for advanced facilities and operations.',
    cost: { credits: 200 },
    effects: [
      { resourceYield: { energy: 0.5 } } // Produces 0.5 energy per tick (game time second)
    ],
    visual: 'power_plant_visual', // Needs a visual key
    maxPerRegion: 2, // Allow a couple per region
    constructionTime: 15, // Takes 15 seconds to build
    economicImpact: { // Example economic impact
      gdpBoost: 5, // Adds 5 GDP per second (assuming tickDelta of 1 per second)
      demandModifier: { // Slightly increases demand for maintenance materials
        [StrategicResourceType.RARE_METALS]: 1.02 // 2% increase in demand for rare metals
      }
    }
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
