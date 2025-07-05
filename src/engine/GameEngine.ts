// Silent Helix Game Engine Core
import type { IEntity as ILegacyEntity } from './entities/BaseEntity'; // Renamed to avoid conflict
import type { IComponent as ILegacyComponent } from './components/BaseComponent'; // Renamed
import {
    ScientistEntity,
    DroneEntity,
    MediaOutletEntity,
    HospitalEntity,
    WhistleblowerEntity
} from './entities';
import { v4 as uuidv4 } from 'uuid';


// Base Interfaces
interface Identifiable { id: string; } // Name might be part of specific entity types or configs

// METAMODEL CORE STRUCTURES

/**
 * Represents the type of an entity, action, or phenomenon.
 * Used for dynamic instantiation and configuration.
 */
export type MetamodelType = string;

/**
 * Base for all dynamic elements in the simulation (Entities, Actions, Phenomena).
 */
export interface MetamodelElement {
  id: string;
  type: MetamodelType; // e.g., "scientist", "deployExperiment", "mrnaTransfectionEffect"
  name?: string; // Optional display name
  description?: string; // Optional description
}

// 1. ENTITIES (Metamodel Component)
// BaseEntity in './entities/BaseEntity.ts' will be refactored to implement this.
// The old IEntity is now ILegacyEntity.
export interface IEntity extends MetamodelElement {
  location: EntityLocation;
  factionId?: string; // Allegiance (e.g., player consortium, rogue elements)
  // Entity-specific properties and methods will be in their classes.
  // Components can be used for shared behaviors if desired, but the primary
  // structure follows the Metamodel: Entity, Action, Phenomenon.
  getComponent?<T extends ILegacyComponent>(componentName: string): T | undefined; // Keep for potential reuse of old components
  hasComponent?(componentName: string): boolean; // Keep for potential reuse
  // update method will be specific to each entity type, if needed, or handled by systems.
  update?(gameState: GameState, deltaTime: number): void;
}

export enum EntityLocationType {
  HexTile = "HexTile",
  Global = "Global",
}

export interface EntityLocation {
  type: EntityLocationType;
  hexCellId?: string;
}

// 2. ACTIONS (Metamodel Component)
export interface IAction extends MetamodelElement {
  trigger: ActionTrigger;
  target: ActionTarget;
  parameters?: Record<string, any>;
}

export type ActionTrigger = 'player_initiated' | 'ai_initiated' | 'event_driven';
export type ActionTargetType = 'hex_tile' | 'entity' | 'global';
export interface ActionTarget {
  type: ActionTargetType;
  targetId?: string;
}

// 3. PHENOMENA (Metamodel Component)
export interface IPhenomenon extends MetamodelElement {
  scope: PhenomenonScope;
  trigger: PhenomenonTrigger;
  startTime?: number; // Game time when phenomenon started
  duration?: number; // How long it lasts, if applicable
  isActive?: boolean; // If the phenomenon is currently active
}

export type PhenomenonScope = 'hex_tile' | 'region_group' | 'global';
export type PhenomenonTriggerType = 'probabilistic' | 'conditional' | 'continuous';
export interface PhenomenonTrigger {
  type: PhenomenonTriggerType;
  chance?: number;
  condition?: string; // e.g., "trust < 0.3" - needs parsing logic
  interval?: number;
}


// 4. ENVIRONMENT (Metamodel Component)
// Hexagonal Tiles are the core of the environment.
export interface HexTileProperties {
  population: number;
  trust: number; // 0-1
  suspicion: number; // 0-1
  health: number; // 0-1 (average population health)
  infrastructure: number; // 0-1
  fertility: number; // 0-1
  // Color pulsing will be handled by the renderer based on trust/suspicion.
  misinformationLevel?: number; // 0-1, how much false info is circulating
  mediaInfluence?: Record<string, number>; // Key: mediaOutletId, Value: influence score 0-1 in this hex
  recentExperimentSeverity?: number; // 0-1, tracks impact of local experiments for triggering other phenomena
}


// FACTIONS (Simplified for Silent Helix: Player Consortium vs. World/Rogue Elements)
export interface SHFaction extends Identifiable {
  name: string;
  isPlayer: boolean;
  color?: string;
  researchPoints?: number;
  // Other global player/faction resources like 'exposure_level' or 'funding' can be added.
}


// TECHNOLOGIES (Silent Helix Specific)
export interface SHTechnology extends Identifiable {
  name: string;
  description: string;
  researchCost: number;
  prerequisites: string[];
  effects: SHTechnologyEffect[];
}

export interface SHTechnologyEffect {
  type: 'unlock_action' | 'unlock_entity_upgrade' | 'modify_phenomenon_risk' | 'improve_efficiency' | 'modify_global_variable';
  actionId?: string;
  entityType?: MetamodelType;
  phenomenonType?: MetamodelType;
  parameter?: string;
  modifier?: number | string | boolean; // Numerical change, new value, or flag
  description: string;
}


// GAME STATE
export interface GameState {
  time: number;
  running: boolean;
  speed: number;

  entities: Map<string, IEntity>; // All active Silent Helix entities
  factions: Map<string, SHFaction>;

  pendingActions: IAction[];
  activePhenomena: IPhenomenon[];

  availableTechnologies: Map<string, SHTechnology>;
  unlockedTechnologies: Set<string>;

  globalTrust: number;
  globalSuspicion: number;
  globalPopulation: number;

  // Other global metrics specific to Silent Helix
  globalPlayerExposure: number; // 0-1, how close player is to being discovered
  globalResearchProgress?: { currentTechId?: string, pointsAccumulated: number };


  settings: {
    baseSuspicionDecayRate: number;
    baseTrustDecayRate: number;
    // Equations from design doc:
    // dH/dt = -k1*Dose + k2*Placebo - k3*SideEffects.  (Will be implemented per-tile based on experiments)
    // dS/dt = k4*SideEffects + k5*Leaks - k6*Propaganda. (Will be implemented per-tile/globally)
  };
}

// MANAGERS
class EntityManager {
  constructor(private gameState: GameState) {}
  addEntity(entity: IEntity): void {
    this.gameState.entities.set(entity.id, entity);
  }
  removeEntity(entityId: string): void { this.gameState.entities.delete(entityId); }
  getEntity(entityId: string): IEntity | undefined { return this.gameState.entities.get(entityId); }

  updateAllEntities(deltaTime: number): void {
    this.gameState.entities.forEach(entity => {
      if (entity.update) {
          entity.update(this.gameState, deltaTime);
      }
    });
  }
}

// PhysicsManager might be simplified if complex physics aren't core to Silent Helix.
// Movement will be primarily grid-based (A* on hex grid).
class PhysicsManager {
  constructor(private gs: GameState) {}
  public update(dt: number) { /* TODO: Implement A* pathfinding requests or simple movement updates */ }
}

class ActionManager {
    constructor(private gameState: GameState, private engine: GameEngine) {}

    processPendingActions(): void {
        const processedActions: IAction[] = [];
        for (const action of this.gameState.pendingActions) {
            this.executeAction(action);
            processedActions.push(action);
        }
        this.gameState.pendingActions = this.gameState.pendingActions.filter(a => !processedActions.includes(a));
    }

    private executeAction(action: IAction): void {
        console.log(`Executing action: ${action.type} (ID: ${action.id}), Target: ${action.target.targetId || 'Global'}, Params:`, action.parameters);

        // Actual effect implementation will be more detailed.
        // This is a high-level dispatch based on type.
        switch (action.type) {
            case ActionTypes.DEPLOY_EXPERIMENT_ACTION:
                this.engine.handleDeployExperimentAction(action);
                break;
            case ActionTypes.MOVE_ENTITY_ACTION:
                this.engine.handleMoveEntityAction(action);
                break;
            case ActionTypes.HACK_MEDIA_ACTION:
                this.engine.handleHackMediaAction(action);
                break;
            case ActionTypes.BRIBE_GOVERNMENT_ACTION:
                this.engine.handleBribeGovernmentAction(action);
                break;
            case ActionTypes.FUND_HOSPITAL_ACTION:
                this.engine.handleFundHospitalAction(action);
                break;
            case ActionTypes.SPREAD_PROPAGANDA_ACTION:
                this.engine.handleSpreadPropagandaAction(action);
                break;
            case ActionTypes.DEPLOY_FAKE_WHISTLEBLOWER_ACTION:
                this.engine.handleDeployFakeWhistleblowerAction(action);
                break;
            default:
                console.warn(`Unknown action type: ${action.type}`);
        }
    }
}

class PhenomenonManager {
    constructor(private gameState: GameState, private engine: GameEngine) {}

    updatePhenomena(deltaTime: number): void {
        // 1. Check triggers for new phenomena
        this.checkAndTriggerPhenomena(deltaTime);

        // 2. Update active phenomena
        const stillActivePhenomena: IPhenomenon[] = [];
        for (const phenomenon of this.gameState.activePhenomena) {
            if (phenomenon.isActive) {
                this.engine.handlePhenomenonUpdate(phenomenon, deltaTime);
                if (phenomenon.duration && phenomenon.startTime !== undefined) {
                    if (this.gameState.time < phenomenon.startTime + phenomenon.duration) {
                        stillActivePhenomena.push(phenomenon);
                    } else {
                        phenomenon.isActive = false;
                        console.log(`Phenomenon ${phenomenon.name} (ID: ${phenomenon.id}) has expired.`);
                        // TODO: Add any on-expire logic if needed
                    }
                } else if (phenomenon.trigger.type === 'continuous') {
                     stillActivePhenomena.push(phenomenon); // Continuous phenomena don't expire this way
                }
            }
        }
        this.gameState.activePhenomena = stillActivePhenomena;
    }

    private checkAndTriggerPhenomena(deltaTime: number): void {
        // Iterate over hex tiles to check for tile-specific conditional phenomena
        this.engine.hexGridManager.cells.forEach(cell => {
            const props = (cell as HexCell & { shProps?: HexTileProperties }).shProps;
            if (!props) return;

            // Riots
            if (props.trust < 0.3 && Math.random() < (0.05 * deltaTime * this.gameState.speed)) { // 5% chance per second approx
                const existingRiot = this.gameState.activePhenomena.find(p => p.type === PhenomenonTypes.PHENOMENON_RIOTS && (p as any).targetId === cell.id);
                if (!existingRiot) {
                    const riotIntensity = 0.1 + Math.random() * 0.2; // Random intensity
                    const riotDuration = 20 + Math.random() * 20; // Lasts 20-40s
                    const riot = PhenomenonTypes.createRiotPhenomenon(cell.id, riotIntensity, riotDuration);
                    this.activatePhenomenon(riot);
                }
            }

            // Trust Decay (continuous, but can be modeled as frequent small probabilistic events or direct updates)
            if (props.suspicion > 0.5) {
                 props.trust = Math.max(0, props.trust - (0.01 * deltaTime * this.gameState.speed)); // 0.01 per second
            }

            // Depopulation (continuous)
            if (props.fertility < 0.8) {
                props.population = Math.max(0, props.population * (1 - (0.0001 * deltaTime * this.gameState.speed))); // 0.01% per second
            }

            // Whistleblower Leaks (High suspicion)

            // Respirator-Induced ARDS (High ventilator use, possibly linked to a hospital)
            // This is currently also potentially triggered by FundHospitalAction.
            // Here, we can add a background chance if a hospital is under strain (e.g., low funding, high patient load - future properties)
            // For now, let's tie it to low health in a hex with a hospital, representing general strain.
            this.gameState.entities.forEach(entity => {
                if (entity.type === 'hospital' && entity.location.type === EntityLocationType.HexTile && entity.location.hexCellId === cell.id) {
                    if (props.health < 0.4 && props.population > 10000 && Math.random() < (0.02 * deltaTime * this.gameState.speed)) { // 2% chance if health is low
                        const existingArds = this.gameState.activePhenomena.find(p => p.type === PhenomenonTypes.PHENOMENON_RESPIRATOR_INDUCED_ARDS && (p as any).targetId === cell.id && p.isActive);
                        if (!existingArds) {
                            const numCases = Math.floor(props.population * (Math.random() * 0.005 + 0.0005)); // 0.05% to 0.55% of pop affected
                            const ardsDuration = 15 + Math.random() * 10; // Lasts 15-25s
                            const ardsPhenomenon = PhenomenonTypes.createRespiratorInducedArdsPhenomenon(cell.id, numCases, ardsDuration);
                            this.activatePhenomenon(ardsPhenomenon);
                            console.log(`Spontaneous ARDS outbreak in ${cell.id} due to health strain: ${numCases} cases.`);
                        }
                    }
                }
            });

            // Whistleblower Leaks (Triggered by high suspicion or risky actions)
            // Risky actions like BribeGovernmentAction already have a direct chance to spawn this.
            // This is a background check for general high suspicion.
            if (props.suspicion > 0.75 && Math.random() < (0.015 * deltaTime * this.gameState.speed * (props.suspicion - 0.75) * 4) ) { // Chance increases above 0.75 suspicion
                const existingLeak = this.gameState.activePhenomena.find(p => p.type === PhenomenonTypes.PHENOMENON_WHISTLEBLOWER_LEAKS && (p as any).targetId === cell.id && p.isActive);
                if (!existingLeak) {
                    // Check if a whistleblower entity already exists in this hex to avoid duplicates from this specific trigger
                    const whistleblowerInHex = Array.from(this.gameState.entities.values()).find(e => e.type === 'whistleblower' && e.location.hexCellId === cell.id);
                    if (!whistleblowerInHex) {
                        const leakPhenomenon = PhenomenonTypes.createWhistleblowerLeakPhenomenon(cell.id);
                        this.activatePhenomenon(leakPhenomenon); // The activatePhenomenon method will handle spawning
                    }
                }
            }

            // Distrust in Doctors (Hospital misdiagnoses or severe experiment side effects near hospital)
            // This requires knowing where hospitals are and if they have high misdiagnosis rates, or if experiments happened nearby.
            // For now, a simpler trigger based on very low health or high suspicion in a hex with a hospital.
            this.gameState.entities.forEach(entity => {
                if (entity.type === 'hospital' && entity.location.type === EntityLocationType.HexTile && entity.location.hexCellId === cell.id) {
                    const hospital = entity as HospitalEntity; // Assuming HospitalEntity type exists and has relevant props
                    // Example trigger: if hospital's localTrust is very low or recent severe side effects happened here
                    // For now, let's use a placeholder: if general hex trust is low and suspicion high.
                    if (props.trust < 0.2 && props.suspicion > 0.6 && Math.random() < (0.03 * deltaTime * this.gameState.speed)) {
                        const existingDistrust = this.gameState.activePhenomena.find(p => p.type === PhenomenonTypes.PHENOMENON_DISTRUST_IN_DOCTORS && (p as any).targetId === cell.id && p.isActive);
                        if (!existingDistrust) {
                            const distrustIntensity = 0.2 + Math.random() * 0.3; // Random intensity
                            const distrustDuration = 30 + Math.random() * 30; // Lasts 30-60s
                            const distrustPhenomenon = PhenomenonTypes.createDistrustInDoctorsPhenomenon(cell.id, distrustIntensity, distrustDuration, 'experiment_side_effects');
                            this.activatePhenomenon(distrustPhenomenon);
                        }
                    }
                }
            });

        });

        // Global phenomena checks
        // Example: Scientific Breakthrough (based on research points or random chance)
        // if (this.gameState.factions.get('player_consortium')?.researchPoints > 1000 && Math.random() < 0.01 * deltaTime * this.gameState.speed) {
        //    // trigger scientific breakthrough
        // }
    }

    public activatePhenomenon(phenomenon: IPhenomenon): void {
        phenomenon.startTime = this.gameState.time;
        phenomenon.isActive = true;
        this.gameState.activePhenomena.push(phenomenon);
        console.log(`Phenomenon Activated: ${phenomenon.name} (ID: ${phenomenon.id}), Scope: ${phenomenon.scope}, Target: ${(phenomenon as any).targetId || 'Global'}`);

        const eventBus = EventBus.getInstance();

        // Specific activation logic for certain phenomenon types
        if (phenomenon.type === PhenomenonTypes.PHENOMENON_RIOTS) {
            const riotData = phenomenon.parameters as PhenomenonTypes.RiotsData;
            if (riotData && riotData.targetHexId) { // Ensure targetHexId is present
                const payload: TriggerParticleEffectPayload = {
                    effectType: 'riot',
                    hexCellId: riotData.targetHexId,
                    intensity: riotData.intensity,
                    duration: phenomenon.duration, // Pass duration for emitter lifetime management
                };
                eventBus.publish(VisualEffectEvent.TRIGGER_PARTICLE_EFFECT, payload, 'PhenomenonManager', this.gameState.time);
            }
        } else if (phenomenon.type === PhenomenonTypes.PHENOMENON_WHISTLEBLOWER_LEAKS) {
            const leakData = phenomenon.parameters as PhenomenonTypes.WhistleblowerLeakSpawnData;
            const existingWhistleblowerInHex = Array.from(this.engine.entityManager['gameState'].entities.values()).find(
                e => e.type === 'whistleblower' && e.location.hexCellId === leakData.spawnLocationHexId
            );

            if (!existingWhistleblowerInHex) {
                const credibility = Math.random() * (leakData.credibilityMinMax[1] - leakData.credibilityMinMax[0]) + leakData.credibilityMinMax[0];
                const newWhistleblower = new WhistleblowerEntity(
                    `wb_${uuidv4().substring(0,8)}`, // Unique ID
                    `Whistleblower ${leakData.spawnLocationHexId}`,
                    { type: EntityLocationType.HexTile, hexCellId: leakData.spawnLocationHexId },
                    {
                        credibility: credibility,
                        informationLevel: 0.5 + Math.random() * 0.3, // Starts with some information
                        leakRate: 0.05 + Math.random() * 0.05, // How quickly they leak info
                        currentExposure: 0,
                    }
                    // No faction, or a 'neutral_hostile' faction
                );
                this.engine.entityManager.addEntity(newWhistleblower);
                console.log(`Whistleblower entity ${newWhistleblower.id} spawned at ${leakData.spawnLocationHexId} due to leak phenomenon ${phenomenon.id}. Credibility: ${credibility.toFixed(2)}`);

                // Small immediate global exposure increase from the event of a leak
                this.gameState.globalPlayerExposure = Math.min(1, this.gameState.globalPlayerExposure + 0.02);
                const cell = this.engine.hexGridManager.getCellById(leakData.spawnLocationHexId);
                if (cell && cell.shProps) {
                    cell.shProps.suspicion = Math.min(1, cell.shProps.suspicion + 0.1); // Immediate local suspicion boost
                }

            } else {
                console.log(`Whistleblower leak phenomenon ${phenomenon.id} occurred at ${leakData.spawnLocationHexId}, but a whistleblower already exists there. No new entity spawned.`);
            }
            phenomenon.isActive = false; // The "leak" event itself is instantaneous, spawning the entity is its main effect.
        }
    }
}

class TechnologyManagerSH {
    constructor(private gameState: GameState) {}

    startResearch(techId: string): boolean {
        const tech = this.gameState.availableTechnologies.get(techId);
        if (!tech || this.gameState.unlockedTechnologies.has(techId) || this.gameState.globalResearchProgress?.currentTechId) {
            return false; // Already unlocked, doesn't exist, or research already in progress
        }
        // Check prerequisites
        for (const prereqId of tech.prerequisites) {
            if (!this.gameState.unlockedTechnologies.has(prereqId)) {
                console.warn(`Cannot research ${techId}, prerequisite ${prereqId} not met.`);
                return false;
            }
        }
        this.gameState.globalResearchProgress = { currentTechId: techId, pointsAccumulated: 0 };
        console.log(`Started research on: ${tech.name}`);
        return true;
    }

    updateResearch(deltaTime: number, researchPointsEarned: number): void {
        if (this.gameState.globalResearchProgress && this.gameState.globalResearchProgress.currentTechId) {
            const techId = this.gameState.globalResearchProgress.currentTechId;
            const tech = this.gameState.availableTechnologies.get(techId);
            if (tech) {
                this.gameState.globalResearchProgress.pointsAccumulated += researchPointsEarned * deltaTime; // Assuming researchPointsEarned is per second
                if (this.gameState.globalResearchProgress.pointsAccumulated >= tech.researchCost) {
                    this.unlockTechnology(techId);
                }
            }
        }
    }

    private unlockTechnology(techId: string): void {
        const tech = this.gameState.availableTechnologies.get(techId);
        if (tech && !this.gameState.unlockedTechnologies.has(techId)) {
            this.gameState.unlockedTechnologies.add(techId);
            this.gameState.globalResearchProgress = { pointsAccumulated: 0 }; // Clear current research
            console.log(`Technology Unlocked: ${tech.name}`);
            // Apply immediate effects of the technology
            tech.effects.forEach(effect => this.applyTechnologyEffect(effect));
             // Potentially trigger a game event or notification
        }
    }

    private applyTechnologyEffect(effect: SHTechnologyEffect): void {
        console.log(`Applying tech effect: ${effect.description}`);
        // Logic to apply various effects will be built out.
        // For example, modifying phenomenon risks, unlocking actions (by making them available in UI), etc.
        // This is a placeholder for now.
    }
}


// GAME ENGINE
import { SoundManager } from './SoundManager';
import { HexGridManager, HexCell } from './HexGridManager';
import * as THREE from 'three';
import * as ActionTypes from './actions/actionTypes';
import * as PhenomenonTypes from './phenomena/phenomenonTypes';
import { EventBus, VisualEffectEvent, TriggerParticleEffectPayload } from './EventBus'; // Added EventBus and related imports

export class GameEngine {
  private gameState: GameState;
  public hexGridManager: HexGridManager;
  public entityManager: EntityManager;
  public physicsManager: PhysicsManager;
  public soundManager: SoundManager;

  public actionManager: ActionManager;
  public phenomenonManager: PhenomenonManager;
  public technologyManagerSH: TechnologyManagerSH;


  private activeAmbientSounds: Set<string> = new Set();

  constructor(earthRadius: number = 100, hexGridSubdivisions: number = 2) {
    this.gameState = this.createInitialGameState();
    this.soundManager = new SoundManager();
    this.hexGridManager = new HexGridManager(earthRadius, hexGridSubdivisions);
    this.entityManager = new EntityManager(this.gameState);
    this.physicsManager = new PhysicsManager(this.gameState);

    this.actionManager = new ActionManager(this.gameState, this);
    this.phenomenonManager = new PhenomenonManager(this.gameState, this);
    this.technologyManagerSH = new TechnologyManagerSH(this.gameState);

    this.initializeSilentHelixWorld();
    this.soundManager.setMusic('placeholder_music_tension');
  }

  private createInitialGameState(): GameState {
    return {
      time: 0,
      running: false,
      speed: 1,
      entities: new Map<string, IEntity>(),
      factions: new Map<string, SHFaction>(),
      pendingActions: [],
      activePhenomena: [],
      availableTechnologies: new Map<string, SHTechnology>(),
      unlockedTechnologies: new Set<string>(),
      globalTrust: 0.5,
      globalSuspicion: 0.1,
      globalPopulation: 0,
      globalPlayerExposure: 0,
      globalResearchProgress: { pointsAccumulated: 0 },
      settings: {
        baseSuspicionDecayRate: 0.001,
        baseTrustDecayRate: 0.001,
      },
    };
  }

  private initializeSilentHelixWorld(): void {
    this.initializeHexGridProperties();
    this.initializeFactions();
    this.initializeTechnologies_SH();

    this.initializeStartingEntities(); // New method for SH entities

    this.calculateGlobalMetrics();
  }

  private initializeStartingEntities(): void {
    const playerFactionId = 'player_consortium';
    const allCellIds = Array.from(this.hexGridManager.cells.keys());

    if (allCellIds.length === 0) {
      console.warn("No hex cells available to place starting entities.");
      return;
    }

    // Get a few random hex cell IDs for placing entities
    const getRandomCellId = () => allCellIds[Math.floor(Math.random() * allCellIds.length)];

    // Player Scientist
    const scientist1 = new ScientistEntity(
      'sci_player_01',
      'Dr. Evelyn Hayes',
      { type: EntityLocationType.HexTile, hexCellId: getRandomCellId() },
      { expertise: 0.8, allegiance: 'consortium' },
      playerFactionId
    );
    this.entityManager.addEntity(scientist1);

    // Media Outlet 1 (Pro-Consortium)
    const media1 = new MediaOutletEntity(
      'media_01',
      'Global Truth Network',
      { type: EntityLocationType.HexTile, hexCellId: getRandomCellId() },
      { reach: 0.7, bias: 'pro-consortium', credibility: 0.75 },
      // No specific faction, or could be a neutral faction ID
    );
    this.entityManager.addEntity(media1);

    // Media Outlet 2 (Anti-Consortium)
    const media2 = new MediaOutletEntity(
      'media_02',
      'The People\'s Voice',
      { type: EntityLocationType.HexTile, hexCellId: getRandomCellId() },
      { reach: 0.5, bias: 'anti-consortium', credibility: 0.6 },
    );
    this.entityManager.addEntity(media2);
    
    // Hospital 1
    const hospital1 = new HospitalEntity(
      'hosp_01',
      'City General Hospital',
      { type: EntityLocationType.HexTile, hexCellId: getRandomCellId() },
      { funding: 0.6, localTrust: 0.7, capacity: 500 }
    );
    this.entityManager.addEntity(hospital1);

    // Drone 1 (Player)
    const drone1 = new DroneEntity(
        'drone_player_01',
        'Recon Drone Alpha',
        { type: EntityLocationType.HexTile, hexCellId: scientist1.location.hexCellId }, // Start near player scientist
        { capacity: 5, operationalRange: 20},
        playerFactionId
    );
    this.entityManager.addEntity(drone1);

    console.log(`Initialized ${this.gameState.entities.size} starting entities for Silent Helix.`);
  }

  private initializeHexGridProperties(): void {
    this.hexGridManager.cells.forEach(cell => {
        const properties: HexTileProperties = {
            population: Math.floor(Math.random() * 1000000 + 50000), // Random population
            trust: Math.random() * 0.4 + 0.3,
            suspicion: Math.random() * 0.2,
            health: Math.random() * 0.3 + 0.6,
            infrastructure: Math.random() * 0.5 + 0.2,
            fertility: Math.random() * 0.4 + 0.5,
            misinformationLevel: 0,
            mediaInfluence: {},
            recentExperimentSeverity: 0,
        };
        // shProps is now an official optional member of HexCell.
        cell.shProps = properties;
    });
  }

  private initializeFactions(): void {
    const playerConsortium: SHFaction = {
      id: 'player_consortium',
      name: 'Silent Helix Consortium',
      isPlayer: true,
      color: '#00FFFF',
      researchPoints: 0,
    };
    this.gameState.factions.set(playerConsortium.id, playerConsortium);
  }
  
  private initializeTechnologies_SH(): void {
    const techs: SHTechnology[] = [
      {
        id: 'basic_mrna_synthesis', name: 'Basic mRNA Synthesis',
        description: 'Fundamental understanding of mRNA sequence design and production.',
        researchCost: 100, prerequisites: [],
        effects: [{ type: 'unlock_action', actionId: 'deploy_basic_experiment', description: 'Allows deployment of simple mRNA experiments.' }]
      },
      {
        id: 'nanoparticle_delivery', name: 'Nanoparticle Delivery Systems',
        description: 'Develop lipid nanoparticles for improved mRNA delivery.',
        researchCost: 150, prerequisites: ['basic_mrna_synthesis'],
        effects: [{ type: 'improve_efficiency', parameter: 'mrna_delivery_effectiveness', modifier: 0.1, description: 'Increases effectiveness of mRNA delivery by 10%.' }]
      },
      {
        id: 'ai_drug_discovery', name: 'AI Drug Discovery',
        description: 'Utilize AI to accelerate the discovery of novel mRNA sequences and countermeasures.',
        researchCost: 300, prerequisites: ['nanoparticle_delivery'],
        effects: [
          { type: 'improve_efficiency', parameter: 'research_speed_modifier', modifier: 0.2, description: 'Increases overall research speed by 20%.'},
          { type: 'unlock_action', actionId: 'ai_assisted_experiment_design', description: 'Unlocks AI-assisted experiment design for more complex trials.'}
        ]
      },
      {
        id: 'global_media_manipulation', name: 'Global Media Manipulation',
        description: 'Advanced techniques for influencing global media narratives and public perception.',
        researchCost: 250, prerequisites: [],
        effects: [
            { type: 'improve_efficiency', parameter: 'propaganda_effectiveness', modifier: 0.25, description: 'Increases propaganda effectiveness by 25%.'},
            { type: 'modify_global_variable', parameter: 'base_suspicion_increase_rate_modifier', modifier: -0.1, description: 'Reduces base rate of suspicion increase globally by 10%.'}
        ]
      }
    ];
    techs.forEach(t => this.gameState.availableTechnologies.set(t.id, t));
  }


  public updateWorld(deltaTime: number): GameState {
    if (!this.gameState.running) return this.gameState;
    const scaledDeltaTime = deltaTime * this.gameState.speed;
    this.gameState.time += scaledDeltaTime;

    // Player input / AI decisions would typically generate actions here.
    // For now, actions are dispatched via `dispatchAction`.

    this.phenomenonManager.updatePhenomena(scaledDeltaTime);
    this.actionManager.processPendingActions();
    this.entityManager.updateAllEntities(scaledDeltaTime);
    this.physicsManager.update(scaledDeltaTime);

    // Update research based on player faction's research rate (to be defined)
    const playerFaction = this.gameState.factions.get('player_consortium');
    const baseResearchRate = 1; // Example: 1 research point per second per active lab/scientist?
    // This rate should be modified by technology, number of scientists, etc.
    if (playerFaction) {
        this.technologyManagerSH.updateResearch(scaledDeltaTime, baseResearchRate /* * modifiers */);
    }

    this.calculateGlobalMetrics();
    this.updateGlobalSoundscape(scaledDeltaTime);

    return this.gameState;
  }

  private updateGlobalSoundscape(deltaTime: number): void {
    // Example: Tie ambient sound to global suspicion
    if (this.gameState.globalSuspicion > 0.7 && !this.activeAmbientSounds.has('suspense_high')) {
        this.soundManager.stopAmbientSound('suspense_low' as any); // TODO: Define sound types
        this.soundManager.playAmbientSound('suspense_high' as any);
        this.activeAmbientSounds.add('suspense_high');
        this.activeAmbientSounds.delete('suspense_low');
    } else if (this.gameState.globalSuspicion <= 0.3 && !this.activeAmbientSounds.has('suspense_low')) {
        this.soundManager.stopAmbientSound('suspense_high' as any);
        this.soundManager.playAmbientSound('suspense_low' as any);
        this.activeAmbientSounds.add('suspense_low');
        this.activeAmbientSounds.delete('suspense_high');
    }
    // Add more complex sound logic as needed
  }

  private calculateGlobalMetrics(): void {
    let totalPopulation = 0;
    let sumTrust = 0;
    let sumSuspicion = 0;
    let numCellsWithPopulation = 0;

    this.hexGridManager.cells.forEach(cell => {
        const props = (cell as HexCell & { shProps?: HexTileProperties }).shProps;
        if (props && props.population > 0) {
            totalPopulation += props.population;
            sumTrust += props.trust * props.population; // Weighted by population
            sumSuspicion += props.suspicion * props.population; // Weighted by population
            numCellsWithPopulation++;
        }
    });

    this.gameState.globalPopulation = totalPopulation;
    if (totalPopulation > 0) {
        this.gameState.globalTrust = sumTrust / totalPopulation;
        this.gameState.globalSuspicion = sumSuspicion / totalPopulation;
    } else {
        this.gameState.globalTrust = 0.5;
        this.gameState.globalSuspicion = 0.1;
    }
    // Decay global suspicion/trust (or apply on hex tiles directly)
    this.gameState.globalSuspicion = Math.max(0, this.gameState.globalSuspicion - this.gameState.settings.baseSuspicionDecayRate * this.gameState.speed * (1/60)); // Assuming 60fps for delta
    this.gameState.globalTrust = Math.max(0, this.gameState.globalTrust - this.gameState.settings.baseTrustDecayRate * this.gameState.speed * (1/60));
  }

  public setRunning(running: boolean): void { this.gameState.running = running; }
  public setSpeed(speed: number): void { this.gameState.speed = Math.max(0.1, speed); }
  public getGameState(): Readonly<GameState> { return this.gameState; }

  public getHexGridManager(): HexGridManager {
    return this.hexGridManager;
  }
  public getHexGridCells(): Map<string, HexCell> {
    return this.hexGridManager.cells;
  }
  public getCellForWorldPoint(worldPoint: THREE.Vector3): HexCell | null {
    return this.hexGridManager.getCellForPoint(worldPoint);
  }
  public getHexCellById(cellId: string): HexCell | undefined {
    return this.hexGridManager.getCellById(cellId);
  }

  public dispatchAction(action: IAction): void {
    this.gameState.pendingActions.push(action);
    console.log(`Action dispatched: ${action.type}, Target: ${action.target.targetId || 'Global'}`);
  }

  // Placeholder handlers for actions and phenomena effects (to be implemented in Step 5)
  // These would be called by ActionManager and PhenomenonManager respectively.

  // Action Handlers
  public handleDeployExperimentAction(action: IAction): void {
    const params = action.parameters as ActionTypes.DeployExperimentParams;
    const targetHexId = action.target.targetId;
    if (!targetHexId) {
        console.warn("DeployExperimentAction: Target Hex ID is missing.");
        return;
    }
    console.log(`GameEngine: Handling DeployExperiment on ${targetHexId} by ${params.scientistId}`, params);

    const scientist = this.entityManager.getEntity(params.scientistId) as ScientistEntity | undefined;
    if (!scientist) {
        console.warn(`DeployExperimentAction: Scientist ${params.scientistId} not found.`);
        return;
    }
    // TODO: Implement actual scientist capability checks (e.g., expertise influencing outcomes)
    // For now, assume scientist is capable.
    // const capabilityFactor = scientist.properties.expertise > 0.7 ? 1.1 : 0.9; // Example

    const targetCell = this.hexGridManager.getCellById(targetHexId);
    if (!targetCell || !targetCell.shProps) {
        console.warn(`DeployExperimentAction: Target cell ${targetHexId} or its properties not found.`);
        return;
    }

    // Direct local suspicion and global player exposure for performing the action
    targetCell.shProps.suspicion = Math.min(1, targetCell.shProps.suspicion + 0.05); // Small immediate suspicion increase in target hex
    this.gameState.globalPlayerExposure = Math.min(1, this.gameState.globalPlayerExposure + 0.002); // Small exposure increase

    // Notify adjacent hexes of the activity, slightly increasing their suspicion
    targetCell.neighborIds.forEach(neighborId => {
        const neighbor = this.hexGridManager.getCellById(neighborId);
        if (neighbor && neighbor.shProps) {
            neighbor.shProps.suspicion = Math.min(1, neighbor.shProps.suspicion + 0.02);
        }
    });

    // Update recentExperimentSeverity in the target hex
    // More sophisticated experiments (higher dosage, certain delivery methods) could increase this more.
    let severityScore = 0.1;
    if (params.dosage === 'medium') severityScore = 0.2;
    if (params.dosage === 'high') severityScore = 0.3;
    if (params.deliveryMethod === 'viral_vectors') severityScore += 0.1;
    if (params.deliveryMethod === 'aerosols') severityScore += 0.2;
    targetCell.shProps.recentExperimentSeverity = Math.min(1, (targetCell.shProps.recentExperimentSeverity || 0) + severityScore);


    // Create and activate the phenomenon that handles the detailed effects
    const effectData: PhenomenonTypes.MrnaTransfectionEffectsData = {
        deliveryMethod: params.deliveryMethod,
        dosage: params.dosage,
        placeboRatio: params.placeboRatio,
        targetHexId: targetHexId,
        // Include flags for potential indirect effects based on tech or experiment design
        // These would ideally be set based on researched technologies or specific experiment choices
        canTriggerSexualSpread: Math.random() < 0.1, // Placeholder: 10% chance any experiment could have this property
        canTriggerFertilityDecrease: Math.random() < 0.15, // Placeholder: 15% chance
        canTriggerReverseTranscriptase: Math.random() < 0.05, // Placeholder: 5% chance
    };
    const transfectionPhenomenon = PhenomenonTypes.createMrnaTransfectionEffectsPhenomenon(targetHexId, effectData, 1); // Duration 1 tick, effects are immediate
    this.phenomenonManager.activatePhenomenon(transfectionPhenomenon);

    // TODO: Update scientist state (e.g., cooldown, resource consumption) - future
  }

  public handleMoveEntityAction(action: IAction): void {
    const params = action.parameters as ActionTypes.MoveEntityParams;
    console.log(`GameEngine: Handling MoveEntity ${params.entityId} to ${params.destinationHexId}`);
    const entity = this.entityManager.getEntity(params.entityId);
    if (entity) {
      // TODO: Implement pathfinding (A*) using HexGridManager.
      // For now, teleport:
      entity.location = { type: EntityLocationType.HexTile, hexCellId: params.destinationHexId };
      console.log(`Entity ${params.entityId} moved to ${params.destinationHexId}`);
    } else {
      console.warn(`MoveEntityAction: Entity ${params.entityId} not found.`);
    }
  }

  public handleHackMediaAction(action: IAction): void {
    const params = action.parameters as ActionTypes.HackMediaParams;
    console.log(`GameEngine: Handling HackMedia ${params.mediaOutletId} by ${params.scientistId}`);
    const mediaOutlet = this.entityManager.getEntity(params.mediaOutletId) as MediaOutletEntity | undefined; // Ensure MediaOutletEntity is imported
    const scientist = this.entityManager.getEntity(params.scientistId) as ScientistEntity | undefined;

    if (!mediaOutlet) {
        console.warn(`HackMediaAction: MediaOutlet ${params.mediaOutletId} not found.`);
        return;
    }
    if (!scientist) {
        console.warn(`HackMediaAction: Scientist ${params.scientistId} not found.`);
        // Could proceed without scientist if skill checks aren't implemented yet, or deny action.
        // For now, let's allow it but note the absence for future skill checks.
    }

    const HACK_SUCCESS_CHANCE = 0.8; // Base success chance, can be modified by scientist skill vs outlet security
    const EXPOSURE_RISK_ON_FAIL = 0.3;
    const EXPOSURE_RISK_ON_SUCCESS = 0.05; // Even successful hacks carry some risk

    if (Math.random() < HACK_SUCCESS_CHANCE) {
        console.log(`Hack successful on ${mediaOutlet.name}`);
        mediaOutlet.properties.credibility = Math.max(0, mediaOutlet.properties.credibility - (0.15 + Math.random() * 0.1)); // Reduce credibility by 15-25%

        // Temporarily disrupt bias or inject narrative (conceptual for now)
        // For now, let's say it makes the media outlet temporarily 'neutral' or less effective for a short duration.
        // This could be a temporary status effect on the media outlet entity.
        console.log(`Media outlet ${mediaOutlet.name} credibility reduced to ${mediaOutlet.properties.credibility.toFixed(2)} and temporarily disrupted.`);

        // Slightly decrease suspicion in the media outlet's primary operational area or globally
        if (mediaOutlet.location.type === EntityLocationType.HexTile && mediaOutlet.location.hexCellId) {
            const targetHex = this.hexGridManager.getCellById(mediaOutlet.location.hexCellId);
            if (targetHex && targetHex.shProps) {
                targetHex.shProps.suspicion = Math.max(0, targetHex.shProps.suspicion - (0.05 + Math.random() * 0.05)); // Reduce suspicion by 5-10%
                console.log(`Suspicion in ${mediaOutlet.location.hexCellId} reduced to ${targetHex.shProps.suspicion.toFixed(2)}.`);
                // Potentially update misinformationLevel
                targetHex.shProps.misinformationLevel = Math.min(1, (targetHex.shProps.misinformationLevel || 0) + 0.1); // Hacking can sow confusion/misinfo
            }
        } else { // Global media outlet or no specific location
            this.gameState.globalSuspicion = Math.max(0, this.gameState.globalSuspicion - (0.02 + Math.random() * 0.03)); // Smaller global reduction
            console.log(`Global suspicion reduced to ${this.gameState.globalSuspicion.toFixed(2)}.`);
        }

        if (Math.random() < EXPOSURE_RISK_ON_SUCCESS) {
            this.gameState.globalPlayerExposure = Math.min(1, this.gameState.globalPlayerExposure + (0.02 + Math.random()*0.03));
            console.warn(`Hack successful, but player exposure increased to ${this.gameState.globalPlayerExposure.toFixed(2)}.`);
        }

    } else {
        console.warn(`Hack failed on ${mediaOutlet.name}.`);
        if (Math.random() < EXPOSURE_RISK_ON_FAIL) {
            this.gameState.globalPlayerExposure = Math.min(1, this.gameState.globalPlayerExposure + (0.05 + Math.random()*0.05));
            console.error(`Hack failed AND player exposure increased significantly to ${this.gameState.globalPlayerExposure.toFixed(2)}!`);
        }
        // Optional: Failed hack could also slightly boost media outlet's credibility or make them harder to hack next time.
        mediaOutlet.properties.credibility = Math.min(1, mediaOutlet.properties.credibility + 0.05); // Small credibility boost from thwarting a hack
    }
  }

  public handleBribeGovernmentAction(action: IAction): void {
    const params = action.parameters as ActionTypes.BribeGovernmentParams;
    console.log(`GameEngine: Handling BribeGovernment in ${params.targetRegionHexId} by ${params.scientistId} with amount ${params.amount}`);
    const targetHex = this.hexGridManager.getCellById(params.targetRegionHexId);

    if (!targetHex || !targetHex.shProps) {
        console.warn(`BribeGovernmentAction: Target hex ${params.targetRegionHexId} or its properties not found.`);
        return;
    }
    const props = targetHex.shProps;

    // Effectiveness of bribe could depend on amount, scientist skill, current suspicion/trust, etc.
    const BRIBE_EFFECTIVENESS_FACTOR = 0.001; // How much 1 unit of "amount" reduces suspicion
    const suspicionReduction = Math.min(props.suspicion, params.amount * BRIBE_EFFECTIVENESS_FACTOR * (0.5 + Math.random())); // Reduce suspicion by a variable amount

    props.suspicion = Math.max(0, props.suspicion - suspicionReduction);
    console.log(`Suspicion in ${params.targetRegionHexId} reduced by ${suspicionReduction.toFixed(3)} due to bribe. New suspicion: ${props.suspicion.toFixed(3)}`);

    // Risk 1: Whistleblower spawn
    const WHISTLEBLOWER_RISK_BASE = 0.10; // 10% base chance
    const whistleblowerRisk = WHISTLEBLOWER_RISK_BASE + (params.amount / 100000); // Higher amount, higher risk (e.g. +10% if amount is 1000)
    if (Math.random() < Math.min(0.5, whistleblowerRisk)) { // Cap risk at 50%
        console.log("Whistleblower spawn risked by bribe!");
        const leakPhenomenon = PhenomenonTypes.createWhistleblowerLeakPhenomenon(params.targetRegionHexId, [0.5, 0.9]); // Bribes can lead to more credible whistleblowers
        this.phenomenonManager.activatePhenomenon(leakPhenomenon);
    }

    // Risk 2: Increase global player exposure
    const exposureIncrease = 0.01 + (params.amount / 200000); // Base 1% + scales with amount
    this.gameState.globalPlayerExposure = Math.min(1, this.gameState.globalPlayerExposure + exposureIncrease);
    console.log(`Global player exposure increased to ${this.gameState.globalPlayerExposure.toFixed(3)} due to bribe.`);

    // TODO: Future - Grant temporary bonus in the region (e.g., reduced cost for other actions, temporary immunity to certain negative events).
    // This could be a temporary status effect on the hex or region.
  }

  public handleFundHospitalAction(action: IAction): void {
    const params = action.parameters as ActionTypes.FundHospitalParams;
    console.log(`GameEngine: Handling FundHospital ${params.hospitalId} with amount ${params.fundingAmount}`);
    const hospital = this.entityManager.getEntity(params.hospitalId) as HospitalEntity | undefined;

    if (!hospital) {
        console.warn(`FundHospitalAction: Hospital ${params.hospitalId} not found.`);
        return;
    }
    if (hospital.location.type !== EntityLocationType.HexTile || !hospital.location.hexCellId) {
        console.warn(`FundHospitalAction: Hospital ${params.hospitalId} has no valid hex location.`);
        return;
    }
    const hospitalHexId = hospital.location.hexCellId;
    const hospitalCell = this.hexGridManager.getCellById(hospitalHexId);

    if (!hospitalCell || !hospitalCell.shProps) {
        console.warn(`FundHospitalAction: Hospital's cell ${hospitalHexId} or its properties not found.`);
        return;
    }
    const props = hospitalCell.shProps;

    // Effect 1: Increase hospital.funding and hospital.localTrust (on HospitalEntity)
    hospital.receiveFunding(params.fundingAmount); // Assuming this method updates funding and potentially localTrust
    console.log(`Hospital ${hospital.name} funding increased by ${params.fundingAmount}. Current funding: ${hospital.properties.funding}, Local Trust: ${hospital.properties.localTrust.toFixed(2)}`);

    // Effect 2: Slightly improve health in the hospital's service area (the hex it's in)
    const healthImprovement = params.fundingAmount * 0.00001 * (hospital.properties.localTrust); // More trust, more effective funding use for health
    props.health = Math.min(1, props.health + healthImprovement);
    console.log(`Health in ${hospitalHexId} improved by ${healthImprovement.toFixed(4)}. New health: ${props.health.toFixed(3)}`);

    // Effect 3: May increase hospital.capacity (on HospitalEntity)
    // hospital.properties.capacity += Math.floor(params.fundingAmount / 1000); // Example: 1 capacity unit per 1000 funding

    // Risk 1: Chance to trigger PHENOMENON_RESPIRATOR_INDUCED_ARDS
    const ARDS_RISK_BASE = 0.03; // 3% base chance
    // Risk increases if hospital is already over capacity or funding is very large (implying rapid, potentially mismanaged expansion)
    const ardsRisk = ARDS_RISK_BASE + (params.fundingAmount / 500000) + ( (hospital.properties.currentLoad || 0) > hospital.properties.capacity ? 0.05 : 0);
    if (Math.random() < Math.min(0.3, ardsRisk)) { // Cap risk at 30%
        const numCases = Math.floor((params.fundingAmount / 100000) + Math.random() * 5 + 1); // More cases with more funding
        console.log(`ARDS outbreak triggered by hospital funding in ${hospitalHexId}! Cases: ${numCases}`);
        const ardsPhenomenon = PhenomenonTypes.createRespiratorInducedArdsPhenomenon(hospitalHexId, numCases, 20 + Math.random() * 10);
        this.phenomenonManager.activatePhenomenon(ardsPhenomenon);
    }

    // Risk 2: Small chance to increase local suspicion if funding is perceived as unusual
    const SUSPICION_RISK = 0.05;
    if (Math.random() < SUSPICION_RISK) {
        props.suspicion = Math.min(1, props.suspicion + (0.02 + params.fundingAmount / 1000000));
        console.log(`Suspicion in ${hospitalHexId} slightly increased due to hospital funding. New suspicion: ${props.suspicion.toFixed(3)}`);
    }
  }

  public handleSpreadPropagandaAction(action: IAction): void {
    const params = action.parameters as ActionTypes.SpreadPropagandaParams;
    console.log(`GameEngine: Handling SpreadPropaganda via ${params.mediaOutletId} (${params.messageType}) to ${params.scope}`);

    const mediaOutlet = this.entityManager.getEntity(params.mediaOutletId) as MediaOutletEntity | undefined;
    if (!mediaOutlet) {
        console.warn(`SpreadPropagandaAction: MediaOutlet ${params.mediaOutletId} not found.`);
        return;
    }

    const baseTrustChange = 0.1; // Base impact of propaganda
    const effectiveness = baseTrustChange * mediaOutlet.properties.credibility * (mediaOutlet.properties.bias === params.messageType ? 1.2 : 0.8); // More effective if aligns with bias

    let trustChangeDirection = params.messageType === 'pro-consortium' ? 1 : -1;
    // For Silent Helix, "pro-consortium" generally means increasing trust in the system/player, "anti-consortium" decreases it.

    const applyTrustChange = (currentTrust: number, change: number): number => {
        return Math.max(0, Math.min(1, currentTrust + change));
    };

    const MISINFO_INCREASE = 0.1 * mediaOutlet.properties.reach; // Propaganda always increases some level of misinformation

    if (params.scope === 'global') {
        const oldTrust = this.gameState.globalTrust;
        this.gameState.globalTrust = applyTrustChange(this.gameState.globalTrust, effectiveness * trustChangeDirection);
        console.log(`Global trust changed from ${oldTrust.toFixed(3)} to ${this.gameState.globalTrust.toFixed(3)}.`);
        // Global misinformation is harder to model simply, could be an average or a separate metric
    } else if (params.scope === 'region' && params.targetHexId) {
        const targetHex = this.hexGridManager.getCellById(params.targetHexId);
        if (targetHex && targetHex.shProps) {
            const props = targetHex.shProps;
            const oldTrust = props.trust;
            props.trust = applyTrustChange(props.trust, effectiveness * trustChangeDirection);
            props.misinformationLevel = Math.min(1, (props.misinformationLevel || 0) + MISINFO_INCREASE);
            console.log(`Trust in ${params.targetHexId} changed from ${oldTrust.toFixed(3)} to ${props.trust.toFixed(3)}. Misinformation: ${props.misinformationLevel.toFixed(2)}`);

            // Optionally, affect mediaInfluence for this outlet in this hex
            if (!props.mediaInfluence) props.mediaInfluence = {};
            props.mediaInfluence[mediaOutlet.id] = Math.min(1, (props.mediaInfluence[mediaOutlet.id] || 0) + 0.05 * mediaOutlet.properties.reach);

        } else {
            console.warn(`SpreadPropagandaAction: Target hex ${params.targetHexId} for regional propaganda not found.`);
            return;
        }
    }

    // Risk of backlash
    const BACKLASH_CHANCE = 0.10 + (1 - mediaOutlet.properties.credibility) * 0.1; // Higher chance if less credible
    if (Math.random() < BACKLASH_CHANCE) {
        console.warn("Propaganda backlash triggered!");
        const backlashMagnitude = 0.05 + Math.random() * 0.1; // 5-15% negative impact
        if (params.scope === 'global') {
            this.gameState.globalTrust = applyTrustChange(this.gameState.globalTrust, -backlashMagnitude * trustChangeDirection); // Opposite effect
            this.gameState.globalSuspicion = Math.min(1, this.gameState.globalSuspicion + backlashMagnitude * 0.5);
            console.log(`Backlash: Global trust to ${this.gameState.globalTrust.toFixed(3)}, Global Suspicion to ${this.gameState.globalSuspicion.toFixed(3)}`);
        } else if (params.scope === 'region' && params.targetHexId) {
            const targetHex = this.hexGridManager.getCellById(params.targetHexId);
            if (targetHex && targetHex.shProps) {
                const props = targetHex.shProps;
                props.trust = applyTrustChange(props.trust, -backlashMagnitude * trustChangeDirection);
                props.suspicion = Math.min(1, props.suspicion + backlashMagnitude);
                console.log(`Backlash in ${params.targetHexId}: Trust to ${props.trust.toFixed(3)}, Suspicion to ${props.suspicion.toFixed(3)}`);
            }
        }
        // Player exposure might increase slightly due to obvious manipulation
        this.gameState.globalPlayerExposure = Math.min(1, this.gameState.globalPlayerExposure + 0.01);
    }
  }

  public handleDeployFakeWhistleblowerAction(action: IAction): void {
    const params = action.parameters as ActionTypes.DeployFakeWhistleblowerParams;
    console.log(`GameEngine: Handling DeployFakeWhistleblower at ${params.spawnHexId} with theme "${params.messageTheme}" and credibility ${params.credibility}`);

    const targetHex = this.hexGridManager.getCellById(params.spawnHexId);
    if (!targetHex || !targetHex.shProps) {
        console.warn(`DeployFakeWhistleblowerAction: Target hex ${params.spawnHexId} or its properties not found.`);
        return;
    }
    const props = targetHex.shProps;

    // Effect 1: Create a temporary "event" or a non-interactive entity that draws attention.
    // For now, this is conceptual. We can log it. In future, it might spawn a temporary, non-functional entity or trigger a special map icon.
    console.log(`Fake whistleblower event deployed at ${params.spawnHexId}. Theme: ${params.messageTheme}. This may distract from real leaks.`);

    // Effect 2: Reduce suspicion in spawnHexId and potentially globally by a small amount.
    // The effectiveness of suspicion reduction depends on the credibility of the fake.
    const suspicionReduction = (0.05 + Math.random() * 0.1) * params.credibility; // Max 0.15 reduction at full credibility
    props.suspicion = Math.max(0, props.suspicion - suspicionReduction);
    console.log(`Suspicion in ${params.spawnHexId} reduced by ${suspicionReduction.toFixed(3)}. New suspicion: ${props.suspicion.toFixed(3)}.`);

    // Small global suspicion reduction as well, as it muddies the waters.
    const globalSuspicionReduction = 0.01 * params.credibility;
    this.gameState.globalSuspicion = Math.max(0, this.gameState.globalSuspicion - globalSuspicionReduction);
    console.log(`Global suspicion reduced by ${globalSuspicionReduction.toFixed(3)}. New global suspicion: ${this.gameState.globalSuspicion.toFixed(3)}.`);

    // Update misinformation level locally
    props.misinformationLevel = Math.min(1, (props.misinformationLevel || 0) + (0.2 * (1 - params.credibility) + 0.05) ); // Less credible fakes create more misinfo

    // Risk: Significant chance to sharply increase globalPlayerExposure if the fake is discovered or poorly executed.
    // Lower credibility fakes are riskier.
    const EXPOSURE_RISK_BASE = 0.10; // 10% base chance of exposure
    const exposureRisk = EXPOSURE_RISK_BASE + (1 - params.credibility) * 0.20; // Up to 20% additional risk for 0 credibility fake
    if (Math.random() < exposureRisk) {
        const exposureIncrease = 0.05 + Math.random() * 0.15; // Significant jump in exposure
        this.gameState.globalPlayerExposure = Math.min(1, this.gameState.globalPlayerExposure + exposureIncrease);
        console.error(`Fake whistleblower discovered or poorly executed! Player exposure increased significantly by ${exposureIncrease.toFixed(3)} to ${this.gameState.globalPlayerExposure.toFixed(3)}.`);
        // Potentially, could also trigger a real whistleblower if the fake is too obvious and angers people.
        if (Math.random() < 0.1) { // 10% chance of this happening on exposure
             console.warn("Fake whistleblower failure triggered a REAL whistleblower leak!");
             const leakPhenomenon = PhenomenonTypes.createWhistleblowerLeakPhenomenon(params.spawnHexId, [0.6, 0.95]); // Real one is angry and credible
             this.phenomenonManager.activatePhenomenon(leakPhenomenon);
        }
    } else {
        console.log("Fake whistleblower deployed without immediate major exposure increase.");
    }
  }

  // Phenomenon Update Handler
  public handlePhenomenonUpdate(phenomenon: IPhenomenon, deltaTime: number): void {
    // console.log(`GameEngine: Updating phenomenon ${phenomenon.name} (ID: ${phenomenon.id})`);
    const scaledDeltaTime = deltaTime * this.gameState.speed;

    switch (phenomenon.type) {
        case PhenomenonTypes.PHENOMENON_MRNA_TRANSFECTION_EFFECTS:
            const data = phenomenon.parameters as PhenomenonTypes.MrnaTransfectionEffectsData;
            const targetHexId = (phenomenon as any).targetId as string;
            const cell = this.hexGridManager.getCellById(targetHexId);
            if (cell) {
                const props = (cell as HexCell & {shProps: HexTileProperties}).shProps;
                if (props) {
                    // dH/dt = -k1*DoseVal + k2*PlaceboRatio - k3*SideEffectsMagnitude
                    // Simplified for now:
                    let baseEffectiveness = 0.05; // Max potential positive health impact from a single dose before multipliers
                    let baseSideEffectRate = 0.02; // Base rate for negative effects before multipliers

                    // Adjust effectiveness and side effects based on delivery method
                    switch (data.deliveryMethod) {
                        case 'nanoparticles':
                            baseEffectiveness *= 1.2;
                            baseSideEffectRate *= 1.1;
                            break;
                        case 'viral_vectors':
                            baseEffectiveness *= 1.5;
                            baseSideEffectRate *= 1.4; // More effective, but higher risk
                            break;
                        case 'aerosols':
                            baseEffectiveness *= 0.8; // Less targeted
                            baseSideEffectRate *= 1.2; // Wider exposure, more unpredictable side effects
                            break;
                    }

                    // Adjust based on dosage
                    let dosageEffectMultiplier = 1.0;
                    let dosageSideEffectMultiplier = 1.0;
                    switch (data.dosage) {
                        case 'low':
                            dosageEffectMultiplier = 0.5;
                            dosageSideEffectMultiplier = 0.7;
                            break;
                        case 'medium':
                            // Default multipliers
                            break;
                        case 'high':
                            dosageEffectMultiplier = 1.3;
                            dosageSideEffectMultiplier = 1.8;
                            break;
                    }

                    const finalEffectiveness = baseEffectiveness * dosageEffectMultiplier * (1 - data.placeboRatio);
                    const finalSideEffectMagnitude = baseSideEffectRate * dosageSideEffectMultiplier;

                    // Calculate actual health change components
                    const intendedPositiveHealthChange = finalEffectiveness; // Assuming 100% of subjects get intended effect if not placebo
                    const autoimmuneNegativeHealthChange = finalSideEffectMagnitude * (Math.random() * 0.5 + 0.25); // Random factor for severity
                    const organStressNegativeHealthChange = finalSideEffectMagnitude * (Math.random() * 0.4 + 0.1); // Random factor

                    // Fatality calculation
                    let fatalityChance = 0.001; // Base fatality chance for any experiment
                    fatalityChance += finalSideEffectMagnitude * 0.05; // Higher side effects, higher fatality
                    if (props.health < 0.3) fatalityChance *= 1.5; // Higher risk if already unhealthy

                    let deaths = 0;
                    if (Math.random() < fatalityChance) {
                        deaths = Math.floor(props.population * (Math.random() * 0.01 + 0.001)); // 0.1% to 1.1% of pop in hex if fatal
                        props.population = Math.max(0, props.population - deaths);
                        console.log(`FATALITY in ${targetHexId}: ${deaths} deaths due to experiment complications. Population now ${props.population}`);
                    }

                    // Apply health changes
                    const netHealthChange = intendedPositiveHealthChange - autoimmuneNegativeHealthChange - organStressNegativeHealthChange;
                    props.health = Math.max(0, Math.min(1, props.health + netHealthChange));

                    // Update suspicion and player exposure
                    const suspicionIncrease = finalSideEffectMagnitude * 0.1 + (deaths > 0 ? 0.2 : 0); // Higher suspicion if deaths occur
                    props.suspicion = Math.min(1, props.suspicion + suspicionIncrease);
                    this.gameState.globalPlayerExposure = Math.min(1, this.gameState.globalPlayerExposure + finalSideEffectMagnitude * 0.005 + (deaths > 0 ? 0.01 : 0));

                    // Store some of these calculated magnitudes on the phenomenon if needed for other systems, or just use for logging.
                    (phenomenon.parameters as PhenomenonTypes.MrnaTransfectionEffectsData).intendedEffectMagnitude = intendedPositiveHealthChange;
                    (phenomenon.parameters as PhenomenonTypes.MrnaTransfectionEffectsData).autoimmuneEffectMagnitude = autoimmuneNegativeHealthChange;
                    (phenomenon.parameters as PhenomenonTypes.MrnaTransfectionEffectsData).organStressEffectMagnitude = organStressNegativeHealthChange;
                    (phenomenon.parameters as PhenomenonTypes.MrnaTransfectionEffectsData).fatalityRate = fatalityChance;


                    console.log(`Hex ${targetHexId} health: ${props.health.toFixed(3)} (Change: ${netHealthChange.toFixed(3)}), suspicion: ${props.suspicion.toFixed(3)} due to experiment.`);

                    // Probabilistic triggers for indirect effects:
                    const baseIndirectChance = finalSideEffectMagnitude * 0.1; // Base chance scales with side effects

                    // Sexual Spread:
                    if ((phenomenon.parameters as PhenomenonTypes.MrnaTransfectionEffectsData).canTriggerSexualSpread && Math.random() < baseIndirectChance * 0.05) {
                        console.log(`Potential Sexual Spread triggered in ${targetHexId}. TODO: Implement spread mechanism or flag.`);
                        // Future: Could spawn a new, slow-spreading phenomenon or set a flag on the hex/population.
                        // For now, maybe increase local suspicion or player exposure slightly more.
                        props.suspicion = Math.min(1, props.suspicion + 0.05);
                        this.gameState.globalPlayerExposure = Math.min(1, this.gameState.globalPlayerExposure + 0.002);
                    }

                    // Fertility Decrease:
                    if ((phenomenon.parameters as PhenomenonTypes.MrnaTransfectionEffectsData).canTriggerFertilityDecrease && Math.random() < baseIndirectChance * 0.1) {
                        const fertilityReduction = Math.random() * 0.05 + 0.01; // Reduce fertility by 1-6%
                        props.fertility = Math.max(0, props.fertility - fertilityReduction);
                        console.log(`Fertility Decrease triggered in ${targetHexId}. Fertility now ${props.fertility.toFixed(3)}.`);
                    }

                    // Reverse Transcriptase Activation:
                    if ((phenomenon.parameters as PhenomenonTypes.MrnaTransfectionEffectsData).canTriggerReverseTranscriptase && Math.random() < baseIndirectChance * 0.02) {
                        console.log(`Reverse Transcriptase Activation potential in ${targetHexId}. TODO: Implement consequences.`);
                        // Future: Could increase risk of other negative phenomena, make population vulnerable, or add a "genetically altered" flag.
                        // For now, increases player exposure significantly.
                        this.gameState.globalPlayerExposure = Math.min(1, this.gameState.globalPlayerExposure + 0.01);
                        props.suspicion = Math.min(1, props.suspicion + 0.1); // Higher local suspicion due to unknown long-term effects
                    }
                }
            }
            phenomenon.isActive = false; // Transfection effects are typically considered instantaneous after their initial calculation.
            break;

        case PhenomenonTypes.PHENOMENON_RIOTS:
            const riotData = phenomenon.parameters as PhenomenonTypes.RiotsData;
            const riotHex = this.hexGridManager.getCellById(riotData.targetHexId);
            if (riotHex) {
                const props = (riotHex as HexCell & {shProps: HexTileProperties}).shProps;
                if (props) {
                    props.population *= (1 - (riotData.intensity * 0.001 * scaledDeltaTime) ); // Lose 0.1% of intensity % pop per sec (tuned down from 1%)
                    props.infrastructure = Math.max(0, props.infrastructure - riotData.intensity * 0.005 * scaledDeltaTime); // Damage infrastructure
                    props.suspicion = Math.min(1, props.suspicion + riotData.intensity * 0.02 * scaledDeltaTime); // Increase suspicion more significantly
                    props.trust = Math.max(0, props.trust - riotData.intensity * 0.01 * scaledDeltaTime); // Riots should also decrease trust

                    // console.log(`Riots in ${riotData.targetHexId}: Pop ${props.population.toFixed(0)}, Infra ${props.infrastructure.toFixed(3)}, Suspicion ${props.suspicion.toFixed(3)}, Trust ${props.trust.toFixed(3)}`);

                    // Chance for riots to spread to adjacent low-trust hexes
                    const SPREAD_CHANCE_PER_NEIGHBOR = 0.01; // 1% chance per update tick per eligible neighbor
                    if (Math.random() < riotData.intensity * 0.05 * scaledDeltaTime) { // Overall chance to attempt spread, scales with intensity
                        const currentCell = this.hexGridManager.getCellById(riotData.targetHexId);
                        if (currentCell) {
                            for (const neighborId of currentCell.neighborIds) {
                                const neighborCell = this.hexGridManager.getCellById(neighborId);
                                const neighborProps = (neighborCell as HexCell & { shProps?: HexTileProperties })?.shProps;
                                if (neighborProps && neighborProps.trust < 0.35 && Math.random() < SPREAD_CHANCE_PER_NEIGHBOR) {
                                    // Check if a riot is already active there
                                    const existingRiotInNeighbor = this.gameState.activePhenomena.find(p =>
                                        p.type === PhenomenonTypes.PHENOMENON_RIOTS &&
                                        (p.parameters as PhenomenonTypes.RiotsData)?.targetHexId === neighborId &&
                                        p.isActive
                                    );
                                    if (!existingRiotInNeighbor) {
                                        const newRiotIntensity = riotData.intensity * (Math.random() * 0.3 + 0.5); // Spread with 50-80% of original intensity
                                        const newRiotDuration = phenomenon.duration ? phenomenon.duration * (Math.random() * 0.3 + 0.6) : (20 + Math.random() * 20); // Spread for 60-90% of original duration
                                        const newRiot = PhenomenonTypes.createRiotPhenomenon(neighborId, newRiotIntensity, newRiotDuration);
                                        this.phenomenonManager.activatePhenomenon(newRiot);
                                        console.log(`Riots spread from ${riotData.targetHexId} to ${neighborId} with intensity ${newRiotIntensity.toFixed(2)}.`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            break;

        case PhenomenonTypes.PHENOMENON_DISTRUST_IN_DOCTORS:
            const distrustData = phenomenon.parameters as PhenomenonTypes.DistrustInDoctorsData;
            const distrustHex = this.hexGridManager.getCellById(distrustData.targetHexId);
            if (distrustHex) {
                const props = (distrustHex as HexCell & {shProps: HexTileProperties}).shProps;
                if (props) {
                    // Effect: Reduce HexTileProperties.trust, potentially impact effectiveness of FundHospitalAction, increase local suspicion.
                    props.trust = Math.max(0, props.trust - distrustData.intensity * 0.015 * scaledDeltaTime); // Reduce trust
                    props.suspicion = Math.min(1, props.suspicion + distrustData.intensity * 0.01 * scaledDeltaTime); // Increase suspicion

                    // Reduce effectiveness of hospitals in the area (conceptual - actual impact on FundHospitalAction might be elsewhere or a new property)
                    // For now, let's say it makes people less likely to seek hospital care, slightly reducing health improvements from other sources
                    props.health = Math.max(0, props.health - distrustData.intensity * 0.001 * scaledDeltaTime); // Small health degradation due to avoidance

                    // console.log(`Distrust in Doctors in ${distrustData.targetHexId}: Trust ${props.trust.toFixed(3)}, Suspicion ${props.suspicion.toFixed(3)}`);
                }
            }
            break;

        case PhenomenonTypes.PHENOMENON_RESPIRATOR_INDUCED_ARDS:
            const ardsData = phenomenon.parameters as PhenomenonTypes.RespiratorInducedArdsData;
            const ardsHex = this.hexGridManager.getCellById(ardsData.targetHexId);
            if (ardsHex) {
                const props = (ardsHex as HexCell & {shProps: HexTileProperties}).shProps;
                if (props) {
                    const healthDecreasePerCase = 0.0001; // Small health impact per case on average hex health
                    const populationLossPerCase = 0.8; // 80% mortality for ARDS cases for this event instance

                    const totalHealthDecrease = ardsData.numberOfCases * healthDecreasePerCase * scaledDeltaTime / (phenomenon.duration || 1); // Spread effect over duration
                    const populationLostThisTick = Math.min(props.population, Math.floor(ardsData.numberOfCases * populationLossPerCase * scaledDeltaTime / (phenomenon.duration || 1)));

                    props.health = Math.max(0, props.health - totalHealthDecrease);
                    props.population = Math.max(0, props.population - populationLostThisTick);

                    const suspicionIncrease = (ardsData.numberOfCases / Math.max(1000, props.population)) * 0.1 * scaledDeltaTime; // Suspicion scales with % of pop affected
                    props.suspicion = Math.min(1, props.suspicion + suspicionIncrease);
                    this.gameState.globalPlayerExposure = Math.min(1, this.gameState.globalPlayerExposure + (populationLostThisTick > 0 ? 0.0005 : 0) * scaledDeltaTime);

                    // console.log(`ARDS in ${ardsData.targetHexId}: ${populationLostThisTick} deaths this tick. Health ${props.health.toFixed(3)}, Pop ${props.population.toFixed(0)}, Suspicion ${props.suspicion.toFixed(3)}`);

                    // Reduce number of active cases for next tick if phenomenon has duration
                    (phenomenon.parameters as PhenomenonTypes.RespiratorInducedArdsData).numberOfCases -= populationLostThisTick;
                    if ((phenomenon.parameters as PhenomenonTypes.RespiratorInducedArdsData).numberOfCases <= 0) {
                        phenomenon.isActive = false;
                    }
                }
            }
            if (phenomenon.startTime !== undefined && phenomenon.duration !== undefined && (this.gameState.time >= phenomenon.startTime + phenomenon.duration)) {
                 phenomenon.isActive = false; // Ensure it deactivates if duration expires regardless of cases
            }
            break;

        // Continuous phenomena like TrustDecay, Depopulation are handled in PhenomenonManager.checkAndTriggerPhenomena for now.
        // If they needed more complex state or distinct instances, they could be handled here too.
        // TODO: Implement PHENOMENON_WHISTLEBLOWER_LEAKS effects here if they become stateful active phenomena.

        default:
            // console.warn(`Unhandled phenomenon type in GameEngine.handlePhenomenonUpdate: ${phenomenon.type}`);
            break;
    }
  }
}