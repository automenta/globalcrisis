import { FacilityType, StrategicResourceType } from "./definitions"; // Assuming EventType might be needed for effects

// Define possible effects of technologies
export interface TechEffect {
  unlockFacility?: FacilityType;
  unlockSatelliteAbility?: string; // e.g., 'long_range_scan', 'emp_hardening'
  globalResourceModifier?: { // Multiplier for global production rates or similar
    resource: string | StrategicResourceType; // 'credits', 'research', StrategicResourceType.RARE_METALS
    modifier: number; // e.g., 1.1 for +10%
  };
  facilityUpgrade?: { // Could specify which facility can be upgraded to what, or general upgrade unlocks
    from: FacilityType;
    to: FacilityType;
  };
  eventResistance?: { // Reduce severity/duration of certain event types
    eventType: string; // Using string for EventType to avoid direct dependency if not needed by all techs
    severityModifier?: number; // e.g., 0.9 for 10% less severe
    durationModifier?: number; // e.g., 0.8 for 20% shorter duration
  };
  // Add more effect types as needed: unit unlocks, new actions, etc.
}

export type TechId = string;

export interface TechNode {
  id: TechId;
  name: string;
  description: string;
  cost: {
    research: number; // Primary cost is research points
    // Could also include other resources like credits or strategic materials
    [resource: string]: number;
  };
  prerequisites: TechId[];
  effects: TechEffect[];
  uiPosition?: { x: number, y: number }; // For rendering the tech tree in UI
}

export const TECH_TREE: Record<TechId, TechNode> = {
  // Tier 1
  basicConstruction: {
    id: "basicConstruction",
    name: "Basic Construction",
    description: "Unlocks the ability to build standard resource extractors and defense platforms more efficiently.",
    cost: { research: 50 },
    prerequisites: [],
    effects: [
      { globalResourceModifier: { resource: "credits", modifier: 1.05 } } // Small boost to credit income conceptually
    ],
    uiPosition: { x: 50, y: 50 }
  },
  appliedCybernetics: {
    id: "appliedCybernetics",
    name: "Applied Cybernetics",
    description: "Improves research output and unlocks basic AI-assisted systems.",
    cost: { research: 75 },
    prerequisites: [],
    effects: [
      { globalResourceModifier: { resource: "research", modifier: 1.1 } }, // +10% research speed
      // { unlockFacility: FacilityType.AI_CORE } // Example: if AI_CORE was a facility
    ],
    uiPosition: { x: 50, y: 150 }
  },

  // Tier 2 - Requiring Basic Construction
  advancedEngineering: {
    id: "advancedEngineering",
    name: "Advanced Engineering",
    description: "Allows for construction of more complex and efficient facilities.",
    cost: { research: 150, credits: 100 },
    prerequisites: ["basicConstruction"],
    effects: [
      // Example: could reduce construction time or cost of certain facilities through game logic
    ],
    uiPosition: { x: 250, y: 50 }
  },
  strategicResourceExploitation: {
    id: "strategicResourceExploitation",
    name: "Strategic Resource Exploitation",
    description: "Unlocks the ability to build Strategic Resource Nodes to extract valuable materials.",
    cost: { research: 120 },
    prerequisites: ["basicConstruction"],
    effects: [
      { unlockFacility: FacilityType.STRATEGIC_RESOURCE_NODE }
    ],
    uiPosition: { x: 250, y: 0 }
  },

  // Tier 2 - Requiring Applied Cybernetics
  satelliteNetworking: {
    id: "satelliteNetworking",
    name: "Satellite Networking",
    description: "Enhances satellite capabilities and data processing.",
    cost: { research: 200 },
    prerequisites: ["appliedCybernetics"],
    effects: [
      { unlockSatelliteAbility: "optimized_surveillance_pattern" },
      // { globalResourceModifier: { resource: StrategicResourceType.DATA_CONDUITS, modifier: 1.1 } } // If data conduits were a generated resource
    ],
    uiPosition: { x: 250, y: 150 }
  },
  neuralInterface: {
    id: "neuralInterface",
    name: "Neural Interface Tech",
    description: "Advanced human-machine interfaces improve command and control.",
    cost: { research: 250, credits: 150 },
    prerequisites: ["appliedCybernetics", "advancedEngineering"], // Example of multiple prerequisites
    effects: [
        // Could reduce chance of 'propaganda' effectiveness or boost stability slightly
        { eventResistance: { eventType: "PROPAGANDA", severityModifier: 0.8 } }
    ],
    uiPosition: { x: 450, y: 100 }
  },

  // Tier 3 Example
  exoticMaterialsSynthesis: {
    id: "exoticMaterialsSynthesis",
    name: "Exotic Materials Synthesis",
    description: "Allows the creation of advanced materials for cutting-edge applications.",
    cost: { research: 500, [StrategicResourceType.RARE_METALS]: 20 },
    prerequisites: ["strategicResourceExploitation", "advancedEngineering"],
    effects: [
        // Example: unlock a new very advanced facility or ship type
    ],
    uiPosition: { x: 450, y: 0 }
  },
  globalEmpHardening: {
    id: "globalEmpHardening",
    name: "Global EMP Hardening",
    description: "Protects critical infrastructure against electromagnetic pulses.",
    cost: { research: 300 },
    prerequisites: ["satelliteNetworking"],
    effects: [
        { eventResistance: { eventType: "ELECTROMAGNETIC_PULSE", severityModifier: 0.5, durationModifier: 0.5 } }
    ],
    uiPosition: { x: 450, y: 200 }
  }
  // ... more technologies
};

// Helper function to get a specific tech (optional, direct access is also fine)
export function getTech(id: TechId): TechNode | undefined {
  return TECH_TREE[id];
}

// Helper function to check if all prerequisites for a tech are met
export function arePrerequisitesMet(techId: TechId, unlockedTechs: Set<TechId>): boolean {
  const tech = getTech(techId);
  if (!tech) return false;
  return tech.prerequisites.every(prereqId => unlockedTechs.has(prereqId));
}
