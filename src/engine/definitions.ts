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
    effects: { environment: -60, stability: -30, population: -1000000, [StrategicResourceType.WATER]: -50, [StrategicResourceType.FOOD]: -30 }, // Drought/floods impact water and food
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
  [EventType.REGIONAL_ENERGY_CRISIS]: {
    name: 'Regional Energy Crisis',
    description: 'Severe energy shortages are crippling the region, impacting stability, production, and daily life. Essential services may fail.',
    effects: { stability: -25, health: -5 }, // GDP impact will be indirect via stability and facility operation.
    duration: 90, // Duration in ticks (e.g., seconds if 1 tick/sec)
    visual: 'power_outage_effect', // Placeholder for a visual effect
    color: 0x808080, // Dull grey
    // This event is triggered dynamically, not by player cost.
    // No spread by default, but could be added.
    // Could be countered by policies or technologies that improve energy efficiency or production.
    followUpEvents: [
      { type: EventType.ECONOMIC_COLLAPSE, chance: 0.15, delay: 30, conditions: { stabilityBelow: 30 } },
      // Could also trigger social unrest events or factory shutdown events if those are modeled.
    ]
  },
};

// TODO: Define structures for other game entities like facilities, units, etc.
// export interface PlanetaryFacilityDefinition { ... }
// export const FACILITY_DEFINITIONS: Record<string, PlanetaryFacilityDefinition> = { ... };

// Defines the types of strategic resources available in the game.
// These are typically tied to specific locations (hexagons) or advanced facilities.
export enum StrategicResourceType {
  RARE_METALS = 'rare_metals', // Essential for advanced electronics and aerospace
  ANTIMATTER_CELLS = 'antimatter_cells', // High-density power for advanced tech
  EXOTIC_ISOTOPES = 'exotic_isotopes', // Used in fusion power or specialized weaponry
  DATA_CONDUITS = 'data_conduits', // Represents high-capacity data processing/transmission nodes
  BIOPRECURSORS = 'bioprecursors', // For advanced biological engineering or terraforming
  WATER = 'water', // Essential for population, agriculture, some industries
  FOOD = 'food'    // Essential for population survival
}

// General resources can still be strings in GameState.globalResources (like 'credits', 'research', 'energy', 'defense')
// This enum is for specific, map-located strategic resources.

// Defines the types of facilities players can build.
// Each facility has unique effects, costs, and potential upgrades.
export enum FacilityType {
  RESEARCH_OUTPOST = 'research_outpost', // Basic facility for generating research points
  RESOURCE_EXTRACTOR = 'resource_extractor', // Generic extractor for basic regional resources (not specific hex nodes)
  STRATEGIC_RESOURCE_NODE = 'strategic_resource_node', // Facility to tap into a specific strategic resource on a hexagon
  DEFENSE_PLATFORM = 'defense_platform', // Provides regional defense and stability
  ADVANCED_RESEARCH_LAB = 'advanced_research_lab', // Upgraded research facility
  POWER_PLANT = 'power_plant', // Generates energy, crucial for many advanced facilities
  // Potential future facilities:
  // ORBITAL_SHIPYARD = 'orbital_shipyard',
  // PROPAGANDA_TOWER = 'propaganda_tower',
  // INTELLIGENCE_CENTER = 'intelligence_center',
  // TERRAFORMING_STATION = 'terraforming_station'
}

// Defines the direct effects a facility has, such as resource generation or stability modification.
export interface FacilityEffect {
  resourceYield?: Partial<Record<StrategicResourceType | string, number>>; // e.g., { research: 5, [StrategicResourceType.RARE_METALS]: 0.1 }
  stabilityModifier?: number; // Direct modifier to regional stability per tick
  // other potential effects...
  // defenseBonus?: number; // Contribution to a defense score
  // environmentalImpact?: number; // Positive or negative impact on environment
}

// Defines the structure for all facility types in the game.
// This includes their costs, effects, upgrade paths, and economic impact on the region.
export interface PlanetaryFacilityDefinition {
  name: string;
  description: string;
  cost: Partial<Record<StrategicResourceType | string, number>>; // e.g., { credits: 100, [StrategicResourceType.RARE_METALS]: 50 }
  effects: FacilityEffect[]; // Direct effects this facility provides (e.g., resource yield per tick)
  visual?: string; // Key for 3D model or icon
  maxPerRegion?: number; // Maximum number of this facility type allowed per region for a single player
  maxGlobal?: number; // Maximum number of this facility type allowed globally for a single player
  constructionTime?: number; // Time in game ticks (e.g., seconds) to build the facility
  upgrades?: {
    toFacilityType: FacilityType; // The facility type this can be upgraded into
    cost: Partial<Record<StrategicResourceType | string, number>>; // Cost to perform this specific upgrade
    techRequired?: string; // TechId from Technology.ts required for this upgrade
    constructionTime?: number; // Optional: time this upgrade takes, distinct from initial construction
  }[];
  economicImpact?: { // Defines how this facility influences the broader regional economy (beyond direct player resource yield)
    gdpBoostPerTick?: number; // Flat boost to regional GDP per game tick
    gdpMultiplier?: number; // Multiplicative boost to regional GDP (e.g., 1.05 for 5% boost, applied once or per tick based on engine logic)
    regionalProductionModifier?: Partial<Record<StrategicResourceType, number>>; // Modifies the region's base production of strategic resources. e.g., { RARE_METALS: 1.1 } for a 10% boost.
    regionalDemandModifier?: Partial<Record<StrategicResourceType, number>>; // Modifies the region's base demand for strategic resources. e.g., { ANTIMATTER_CELLS: 0.9 } for a 10% reduction in demand.
    // employmentChange?: number; // Change in regional employment figures. To be added in Demographics step.
    // pollutionOutput?: number; // Amount of pollution generated per tick
    primarySector?: EconomicSectorType; // The main economic sector this facility belongs to or primarily boosts
    sectorEfficiencyBoost?: Partial<Record<EconomicSectorType, number>>; // e.g. { INDUSTRY: 0.05 } for a 5% boost to industry efficiency
    sectorOutputBoost?: Partial<Record<EconomicSectorType, number>>; // e.g. { ENERGY: 100 } for a flat output boost to energy sector
  };
  maintenanceCost?: Partial<Record<StrategicResourceType | string, number>>; // Resources consumed per tick for upkeep
}

// Defines the types of regional development programs a player can initiate.
export enum RegionalDevelopmentProgramType {
  INDUSTRIAL_EXPANSION = 'industrial_expansion',
  ECOLOGICAL_RESTORATION = 'ecological_restoration',
  SOCIAL_WELFARE_PROGRAM = 'social_welfare_program',
  TECHNOLOGICAL_ADVANCEMENT_HUB = 'technological_advancement_hub',
}

// Defines the effects and costs of a regional development program.
export interface RegionalDevelopmentProgramDefinition {
  name: string;
  description: string;
  cost: Partial<Record<StrategicResourceType | string, number>>; // Cost to initiate
  durationTicks: number; // How many game ticks the program actively runs and applies its primary effects
  effectsPerTick?: Partial<RegionalEffects>; // Effects applied each tick while active
  oneTimeEffects?: Partial<RegionalEffects>; // Effects applied once upon initiation or completion
  longTermRegionalModifiers?: { // Lingering modifiers after program completion
    gdpGrowthRateModifier?: number; // e.g., +0.001 to base GDP growth
    stabilityModifier?: number;     // e.g., -0.05 to stability per tick (simulating unrest)
    environmentRecoveryRate?: number; // e.g., +0.01 to environment per tick
    pollutionOutputModifier?: number; // e.g., +0.1 pollution per tick from this program's legacy
  };
  // Chance to trigger specific positive or negative events upon completion or during its operation
  eventTriggers?: {
    eventType: EventType;
    chance: number; // 0-1
    delayTicks?: number; // Delay after program start or end
    isNegativeEvent?: boolean; // To quickly identify if it's a downside
  }[];
  demographicEffects?: { // Effects on regional demographics
    educationLevelChange?: number; // Direct change to education level per tick or one-time
    unemploymentChange?: number; // Direct change to unemployment figures (e.g. job creation programs)
  };
}

// Defines the types of strategic policies a player can enact.
export enum PolicyType {
  SUSTAINABLE_DEVELOPMENT = 'sustainable_development',
  AGGRESSIVE_RESOURCE_EXPLOITATION = 'aggressive_resource_exploitation',
  RAPID_MILITARIZATION = 'rapid_militarization',
  OPEN_SOCIETY = 'open_society', // Focus on research, global collaboration, stability
  CLOSED_SOCIETY = 'closed_society', // Focus on defense, internal control, slower research but more resilient to some threats
  ENVIRONMENTAL_REGULATION = 'environmental_regulation',
  GLOBAL_TRADE_INITIATIVE = 'global_trade_initiative',
  EDUCATION_SUBSIDIES = 'education_subsidies',
}

// Defines the effects, costs, and requirements of a strategic policy.
export interface PolicyDefinition {
  name: string;
  description: string;
  adoptionCost?: Partial<Record<StrategicResourceType | string, number>>; // One-time cost to enact
  maintenanceCostPerTick?: Partial<Record<StrategicResourceType | string, number>>; // Ongoing upkeep
  // Modifiers applied globally to the player or to all their controlled regions
  globalPlayerModifiers?: {
    resourceIncomeModifier?: Partial<Record<StrategicResourceType | string, number>>; // e.g., { credits: 0.9 } for -10%
    researchSpeedModifier?: number; // e.g., 1.1 for +10%
    facilityUpkeepModifier?: number; // e.g., 0.8 for 20% less upkeep on all facilities
    diplomaticInfluenceModifier?: number; // Abstract modifier for future diplomacy systems
  };
  // Modifiers applied to all regions controlled by the player
  regionalModifiers?: {
    stabilityBonusPerTick?: number;
    environmentChangePerTick?: number;
    healthChangePerTick?: number;
    facilityConstructionSpeedModifier?: number; // e.g., 1.2 for 20% faster
    pollutionFromIndustryModifier?: number; // e.g., 0.75 for 25% less pollution
  };
  // Specific tech tree boosts or event resistances/vulnerabilities
  techResearchBoosts?: Partial<Record<string, number>>; // { techCategoryOrId: 1.1 } for +10% speed
  eventEffectModifiers?: {
    eventType: EventType;
    severityModifier?: number; // e.g., 0.8 to reduce severity by 20%
    durationModifier?: number; // e.g., 1.2 to increase duration by 20%
  }[];
  mutuallyExclusivePolicies?: PolicyType[]; // Policies that cannot be active at the same time
}

export const POLICY_DEFINITIONS: Record<PolicyType, PolicyDefinition> = {
  [PolicyType.SUSTAINABLE_DEVELOPMENT]: {
    name: "Sustainable Development",
    description: "Balances economic growth with environmental protection and social well-being.",
    adoptionCost: { credits: 200 },
    maintenanceCostPerTick: { credits: 2 },
    globalPlayerModifiers: { researchSpeedModifier: 1.05 },
    regionalModifiers: { environmentChangePerTick: 0.01, stabilityBonusPerTick: 0.005 },
    mutuallyExclusivePolicies: [PolicyType.AGGRESSIVE_RESOURCE_EXPLOITATION]
  },
  [PolicyType.AGGRESSIVE_RESOURCE_EXPLOITATION]: {
    name: "Aggressive Resource Exploitation",
    description: "Prioritizes rapid resource extraction and industrial output, often at environmental cost.",
    adoptionCost: { credits: 100 },
    maintenanceCostPerTick: { credits: 1 },
    globalPlayerModifiers: { resourceIncomeModifier: { credits: 1.1 } }, // Example: +10% credit income
    regionalModifiers: { environmentChangePerTick: -0.02, facilityConstructionSpeedModifier: 1.1 },
    mutuallyExclusivePolicies: [PolicyType.SUSTAINABLE_DEVELOPMENT, PolicyType.ENVIRONMENTAL_REGULATION]
  },
  [PolicyType.RAPID_MILITARIZATION]: {
    name: "Rapid Militarization",
    description: "Focuses national efforts on building a strong military and defense infrastructure.",
    adoptionCost: { credits: 300, [StrategicResourceType.RARE_METALS]: 20 },
    maintenanceCostPerTick: { credits: 5, [StrategicResourceType.RARE_METALS]: 0.1 },
    globalPlayerModifiers: { facilityUpkeepModifier: 1.1 }, // Increased upkeep for all facilities (resources diverted)
    // regionalModifiers: { unitProductionSpeed: 1.2 } // Example if units were a concept
  },
  [PolicyType.OPEN_SOCIETY]: {
    name: "Open Society",
    description: "Promotes freedom, collaboration, and innovation, boosting research and global standing but potentially increasing vulnerability.",
    adoptionCost: { credits: 150 },
    maintenanceCostPerTick: { credits: 1 },
    globalPlayerModifiers: { researchSpeedModifier: 1.15, diplomaticInfluenceModifier: 1.1 },
    eventEffectModifiers: [ { eventType: EventType.PROPAGANDA, severityModifier: 1.2 } ], // More vulnerable to propaganda
    mutuallyExclusivePolicies: [PolicyType.CLOSED_SOCIETY]
  },
  [PolicyType.CLOSED_SOCIETY]: {
    name: "Closed Society",
    description: "Emphasizes internal security, control, and self-reliance, making the nation more resilient to some external threats but slower to innovate.",
    adoptionCost: { credits: 150 },
    maintenanceCostPerTick: { credits: 3 },
    globalPlayerModifiers: { researchSpeedModifier: 0.9, diplomaticInfluenceModifier: 0.8 },
    regionalModifiers: { stabilityBonusPerTick: 0.01 },
    eventEffectModifiers: [ { eventType: EventType.PROPAGANDA, severityModifier: 0.7 } ], // More resistant to propaganda
    mutuallyExclusivePolicies: [PolicyType.OPEN_SOCIETY]
  },
  [PolicyType.ENVIRONMENTAL_REGULATION]: {
    name: "Environmental Regulation",
    description: "Implements strict standards to protect the environment, potentially slowing industrial output but improving ecological health and global standing.",
    adoptionCost: { credits: 250 },
    maintenanceCostPerTick: { credits: 3 },
    globalPlayerModifiers: { /* Potentially a small hit to overall industrial efficiency if not balanced by tech */ },
    regionalModifiers: { environmentChangePerTick: 0.02, pollutionFromIndustryModifier: 0.75 }, // 25% less pollution
     // Could make some industrial facilities less efficient or more costly if not upgraded with green tech
    mutuallyExclusivePolicies: [PolicyType.AGGRESSIVE_RESOURCE_EXPLOITATION]
  },
  [PolicyType.GLOBAL_TRADE_INITIATIVE]: {
    name: "Global Trade Initiative",
    description: "Focuses on fostering international trade, improving resource exchange efficiency and economic output.",
    adoptionCost: { credits: 200, [StrategicResourceType.DATA_CONDUITS]: 10 },
    maintenanceCostPerTick: { credits: 2 },
    globalPlayerModifiers: { resourceIncomeModifier: {credits: 1.05} }, // General small boost to credit income
    // This policy would ideally interact with a global market system or inter-player trade mechanics.
    // For now, can simulate a small boost to efficiency of resource-producing sectors.
    // regionalModifiers: { sectorEfficiencyBoost: { INDUSTRY: 0.01, SERVICES: 0.01 } } // Placeholder
  },
  [PolicyType.EDUCATION_SUBSIDIES]: {
    name: "Education Subsidies",
    description: "Invests heavily in education, improving research capabilities and workforce skills over time.",
    adoptionCost: { credits: 300 },
    maintenanceCostPerTick: { credits: 4 },
    globalPlayerModifiers: { researchSpeedModifier: 1.05 }, // Small direct boost to research
    // Primary effect would be a slow increase to regional educationLevel, handled in processPlayerProgramsAndPolicies
    // This is a new type of effect not directly fitting global/regional modifiers per tick in the same way.
    // We will need to handle this in the GameEngine's policy processing logic.
  }
};

// Central registry for all facility definitions.
// This allows for easy addition and modification of facility types.
export const FACILITY_DEFINITIONS: Record<FacilityType, PlanetaryFacilityDefinition> = {
  [FacilityType.RESEARCH_OUTPOST]: {
    name: 'Research Outpost',
    description: 'Generates research points over time. Can be upgraded to an Advanced Research Lab.',
    cost: { credits: 100 },
    effects: [{ resourceYield: { research: 0.1 } }],
    visual: 'research_dome',
    maxPerRegion: 3,
    constructionTime: 10,
    upgrades: [
      {
        toFacilityType: FacilityType.ADVANCED_RESEARCH_LAB,
        cost: { credits: 300, research: 100, [StrategicResourceType.DATA_CONDUITS]: 5 },
        techRequired: "appliedCybernetics",
        constructionTime: 20,
      }
    ],
    economicImpact: {
      regionalDemandModifier: { [StrategicResourceType.DATA_CONDUITS]: 1.01 }, // Slightly increases demand for data conduits
      primarySector: EconomicSectorType.SERVICES, // Assuming research primarily boosts the knowledge/service economy
      sectorEfficiencyBoost: { [EconomicSectorType.SERVICES]: 0.01 }, // Small boost to service sector efficiency
      sectorOutputBoost: { [EconomicSectorType.SERVICES]: 5 } // Small flat output boost to services
    },
    maintenanceCost: { energy: 0.02 }
  },
  [FacilityType.ADVANCED_RESEARCH_LAB]: {
    name: 'Advanced Research Lab',
    description: 'Significantly boosts research point generation and enables advanced projects.',
    cost: { credits: 500, research: 200, [StrategicResourceType.DATA_CONDUITS]: 10 },
    effects: [{ resourceYield: { research: 0.5 } }],
    visual: 'advanced_research_lab_visual',
    maxPerRegion: 1,
    constructionTime: 30,
    economicImpact: {
        gdpBoostPerTick: 0.1, // Keeps overall GDP impact
        regionalDemandModifier: { [StrategicResourceType.DATA_CONDUITS]: 1.05, [StrategicResourceType.EXOTIC_ISOTOPES]: 1.02 },
        primarySector: EconomicSectorType.SERVICES, // Advanced research is highly service-oriented
        sectorEfficiencyBoost: { [EconomicSectorType.SERVICES]: 0.05, [EconomicSectorType.INDUSTRY]: 0.02 }, // Boosts services significantly, industry moderately
        sectorOutputBoost: { [EconomicSectorType.SERVICES]: 20 }
    },
    maintenanceCost: { credits: 0.1, energy: 0.1, [StrategicResourceType.RARE_METALS]: 0.01 }
  },
  [FacilityType.RESOURCE_EXTRACTOR]: {
    name: 'Regional Resource Extractor',
    description: 'Extracts basic resources (credits) from the region. Does not require a specific hex node.',
    cost: { credits: 150 },
    effects: [{ resourceYield: { credits: 0.05 } }], // Yields credits directly to player
    visual: 'mining_rig_regional',
    maxPerRegion: 2,
    constructionTime: 15,
    economicImpact: {
        gdpBoostPerTick: 0.02,
        regionalProductionModifier: { [StrategicResourceType.RARE_METALS]: 1.01 }, // General extraction helps regional strategics
        primarySector: EconomicSectorType.INDUSTRY, // Resource extraction is an industrial activity
        sectorOutputBoost: { [EconomicSectorType.INDUSTRY]: 10 } // Directly boosts industrial output slightly
    },
    maintenanceCost: { energy: 0.01 }
  },
  [FacilityType.STRATEGIC_RESOURCE_NODE]: {
    name: 'Strategic Resource Node',
    description: 'Exploits a specific strategic resource found on this hexagon. Yield depends on the hexagon\'s resource.',
    cost: { credits: 250, research: 50, energy: 20 }, // Requires some energy to build
    effects: [ /* Actual yield determined by hex resource type in GameEngine */ ],
    visual: 'strategic_node_generic',
    maxPerRegion: 5, // Max per region for a player, but effectively 1 per hex resource node.
    constructionTime: 25,
    // This facility's economic impact is primarily through the player gaining the strategic resource,
    // but could also slightly boost related regional industries.
    economicImpact: {
        gdpBoostPerTick: 0.05,
        primarySector: EconomicSectorType.INDUSTRY, // Specialized extraction is industrial
        // Specific sector boosts for strategic nodes might depend on the resource type,
        // handled in updateFacility/updateRegion logic if needed, or generalized here.
        sectorOutputBoost: { [EconomicSectorType.INDUSTRY]: 15 } // General boost to industry from having strategic materials
    },
    maintenanceCost: { credits: 0.05, energy: 0.05 }
  },
  [FacilityType.DEFENSE_PLATFORM]: {
    name: 'Defense Platform',
    description: 'Provides defensive capabilities to the region, contributes to global defense readiness, and slightly boosts stability.',
    cost: { credits: 200, energy: 50, [StrategicResourceType.RARE_METALS]: 10 },
    effects: [
      { stabilityModifier: 0.002 }, // Smaller, more granular stability boost per tick
      { resourceYield: { defense: 0.1 } } // Produces defense points for the player
    ],
    visual: 'defense_turret',
    maxPerRegion: 1, // Only one major platform per region for a player
    constructionTime: 20,
    economicImpact: {
        gdpBoostPerTick: 0.01,
        regionalDemandModifier: { [StrategicResourceType.RARE_METALS]: 1.01 },
        primarySector: EconomicSectorType.SERVICES, // Defense can be seen as a government service
        sectorOutputBoost: { [EconomicSectorType.SERVICES]: 5 }, // Contribution to the service sector (e.g. security)
        sectorEfficiencyBoost: { [EconomicSectorType.INDUSTRY]: 0.01 } // Secure environment might slightly boost industrial confidence/efficiency
    },
    maintenanceCost: { credits: 0.02, energy: 0.08 } // Consumes more energy
  },
  [FacilityType.POWER_PLANT]: {
    name: 'Power Plant',
    description: 'Generates energy required for advanced facilities and operations. Essential for a thriving technological base.',
    cost: { credits: 200, [StrategicResourceType.RARE_METALS]: 5 },
    effects: [{ resourceYield: { energy: 0.5 } }], // Produces energy for the player
    visual: 'power_plant_visual',
    maxPerRegion: 2,
    constructionTime: 15,
    economicImpact: {
      gdpBoostPerTick: 0.03,
      primarySector: EconomicSectorType.ENERGY, // Directly contributes to the Energy sector
      sectorOutputBoost: { [EconomicSectorType.ENERGY]: 50 }, // Significant output boost to energy
      sectorEfficiencyBoost: { [EconomicSectorType.INDUSTRY]: 0.03, [EconomicSectorType.SERVICES]: 0.02 }, // Reliable energy boosts other sectors
      regionalProductionModifier: { [StrategicResourceType.RARE_METALS]: 1.01 },
      regionalDemandModifier: { [StrategicResourceType.EXOTIC_ISOTOPES]: 1.01 }
    },
    maintenanceCost: { credits: 0.03 }
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
