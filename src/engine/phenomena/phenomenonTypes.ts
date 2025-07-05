import type { IPhenomenon, PhenomenonScope, PhenomenonTrigger, MetamodelType } from "../GameEngine";
import { v4 as uuidv4 } from 'uuid';

// Specific Phenomenon Types (as MetamodelType)
export const PHENOMENON_MRNA_TRANSFECTION_EFFECTS: MetamodelType = "phenomenon_mrna_transfection_effects";
export const PHENOMENON_POPULATION_DYNAMICS: MetamodelType = "phenomenon_population_dynamics"; // Generic, specific effects below
export const PHENOMENON_TRUST_DECAY: MetamodelType = "phenomenon_trust_decay";
export const PHENOMENON_DEPOPULATION: MetamodelType = "phenomenon_depopulation";
export const PHENOMENON_RIOTS: MetamodelType = "phenomenon_riots";
export const PHENOMENON_DISTRUST_IN_DOCTORS: MetamodelType = "phenomenon_distrust_in_doctors";
export const PHENOMENON_RESPIRATOR_INDUCED_ARDS: MetamodelType = "phenomenon_respirator_induced_ards";
export const PHENOMENON_WHISTLEBLOWER_LEAKS: MetamodelType = "phenomenon_whistleblower_leaks"; // Event that can spawn a WhistleblowerEntity
export const PHENOMENON_INFORMATION_WARFARE_EFFECT: MetamodelType = "phenomenon_information_warfare_effect";
export const PHENOMENON_SCIENTIFIC_BREAKTHROUGH: MetamodelType = "phenomenon_scientific_breakthrough"; // Event that can unlock tech

// Parameter interfaces or state for specific phenomena (if needed beyond basic IPhenomenon)
// Many phenomena effects are direct state changes handled by the PhenomenonManager based on type.
// However, some might have specific data associated with an active instance.

export interface MrnaTransfectionEffectsData {
  // From DeployExperimentAction parameters
  deliveryMethod: 'nanoparticles' | 'viral_vectors' | 'aerosols';
  dosage: 'low' | 'medium' | 'high';
  placeboRatio: number;
  targetHexId: string;
  // Resulting effects (can be stored on the phenomenon instance or applied immediately)
  intendedEffectMagnitude?: number;
  autoimmuneEffectMagnitude?: number;
  organStressEffectMagnitude?: number;
  fatalityRate?: number;
  // Flags for indirect effects that might be triggered subsequently
  triggeredSexualSpread?: boolean;
  triggeredFertilityDecrease?: boolean;
  triggeredReverseTranscriptase?: boolean;
}

export interface RiotsData {
  targetHexId: string;
  intensity: number; // e.g., 0-1, affecting population reduction
}

export interface RespiratorInducedArdsData {
  targetHexId: string; // Hospital location
  numberOfCases: number;
}

export interface WhistleblowerLeakSpawnData {
  spawnLocationHexId: string;
  credibilityMinMax: [number, number]; // Range for the spawned whistleblower
}


// Helper functions to create phenomenon objects (or define their static properties)

function createBasePhenomenon(
  type: MetamodelType,
  scope: PhenomenonScope,
  trigger: PhenomenonTrigger,
  name?: string,
  description?: string,
  duration?: number
): IPhenomenon {
  return {
    id: uuidv4(),
    type,
    name: name || type,
    description,
    scope,
    trigger,
    isActive: true, // Typically active when created
    startTime: 0, // Will be set by PhenomenonManager when activated
    duration, // Optional: how long it lasts
  };
}

// Example of creating a specific phenomenon instance.
// Most phenomena might be "templates" and the PhenomenonManager directly applies their effects
// when their triggers are met, rather than creating an IPhenomenon object for each occurrence,
// unless the phenomenon itself has a duration or ongoing state.

/**
 * Represents an active instance of mRNA side effects in a specific hex.
 */
export function createMrnaTransfectionEffectsPhenomenon(
  targetHexId: string,
  data: MrnaTransfectionEffectsData,
  durationTicks: number = 1 // Assume effects apply over a short period
): IPhenomenon {
  return {
    ...createBasePhenomenon(
      PHENOMENON_MRNA_TRANSFECTION_EFFECTS,
      'hex_tile',
      { type: 'conditional', condition: "post_experiment_deployment" }, // Triggered by an action
      "mRNA Transfection Effects",
      `Side effects from mRNA experiment in ${targetHexId}.`,
      durationTicks
    ),
    parameters: data, // Store specific data with the phenomenon instance
    targetId: targetHexId, // Custom property to easily identify target
  };
}

/**
 * Represents an active riot event.
 */
export function createRiotPhenomenon(
    targetHexId: string,
    intensity: number,
    durationTicks: number = 10 // Riots last for some time
): IPhenomenon {
    const data: RiotsData = { targetHexId, intensity };
    return {
        ...createBasePhenomenon(
            PHENOMENON_RIOTS,
            'hex_tile',
            // Triggered by conditions like low trust (handled by PhenomenonManager)
            { type: 'conditional', condition: `trust_in_${targetHexId} < 0.3`},
            "Riots Erupt",
            `Civil unrest and riots in ${targetHexId}.`,
            durationTicks
        ),
        parameters: data,
        targetId: targetHexId,
    };
}


// For many phenomena, we might not create an "instance" object.
// Instead, the PhenomenonManager will have rules:
// IF condition (e.g., trust < 0.3 in hex_N) THEN apply_effect (e.g., reduce population in hex_N).
// These helper functions are more for phenomena that have a distinct start, duration, and associated data.

// Definitions for phenomena that are more like system rules or continuous effects:
// These might not always result in an IPhenomenon object being created and stored in activePhenomena,
// but their logic will reside in the PhenomenonManager.

export const TrustDecayDefinition = {
  type: PHENOMENON_TRUST_DECAY,
  name: "Trust Decay",
  description: "Trust decays in regions with high suspicion.",
  scope: 'hex_tile',
  trigger: { type: 'continuous', interval: 1 } as PhenomenonTrigger, // Evaluated each tick
  // Effect: if suspicion > 0.5, trust -= 0.01 (per tick) - implemented in PhenomenonManager
};

export const DepopulationDefinition = {
  type: PHENOMENON_DEPOPULATION,
  name: "Depopulation",
  description: "Population declines in regions with low fertility.",
  scope: 'hex_tile',
  trigger: { type: 'continuous', interval: 1 } as PhenomenonTrigger,
  // Effect: if fertility < 0.8, population -= 0.001% (per tick) - implemented in PhenomenonManager
};

// ... other definitions for continuous or rule-based phenomena
// The distinction is whether a phenomenon is an "event instance" (like a specific riot)
// or an "ongoing process" (like trust decay under certain conditions).
// Both are managed by the PhenomenonManager.
// The IPhenomenon interface is more suited for event instances.
// Rule-based/continuous phenomena are effectively hardcoded rules in the manager,
// though their parameters (thresholds, rates) can be defined here.
