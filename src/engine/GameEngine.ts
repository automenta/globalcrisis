// Silent Helix Game Engine Core
import type { IEntity as ILegacyEntity } from './entities/BaseEntity'; // Renamed to avoid conflict
import type { IComponent as ILegacyComponent } from './components/BaseComponent'; // Renamed
import {
    ScientistEntity,
    DroneEntity,
    MediaOutletEntity,
    HospitalEntity,
    // WhistleblowerEntity // Not spawning Whistleblowers initially by default
} from './entities';


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

            // TODO: Add more phenomenon triggers:
            // - Distrust in Doctors (Hospital misdiagnoses)
            // - Respirator-Induced ARDS (High ventilator use)
            // - Whistleblower Leaks (High suspicion)
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
    console.log(`GameEngine: Handling DeployExperiment on ${targetHexId} by ${params.scientistId}`, params);
    // TODO:
    // 1. Get scientist entity, check capabilities.
    // 2. Get target hex cell.
    // 3. Calculate outcomes based on params (delivery, dosage, placebo), hex props (infra, trust).
    // 4. Create and activate PHENOMENON_MRNA_TRANSFECTION_EFFECTS.
    //    - This phenomenon will then apply dH/dt changes and trigger other sub-phenomena.
    // 5. Update scientist state (e.g., cooldown, resource consumption if any).
    // 6. Update global/regional suspicion.

    // Example: Triggering the phenomenon
    const effectData: PhenomenonTypes.MrnaTransfectionEffectsData = {
        deliveryMethod: params.deliveryMethod,
        dosage: params.dosage,
        placeboRatio: params.placeboRatio,
        targetHexId: targetHexId!,
    };
    const transfectionPhenomenon = PhenomenonTypes.createMrnaTransfectionEffectsPhenomenon(targetHexId!, effectData, 1);
    this.phenomenonManager.activatePhenomenon(transfectionPhenomenon);
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
    const mediaOutlet = this.entityManager.getEntity(params.mediaOutletId) as import('./entities').MediaOutletEntity | undefined;
    if (mediaOutlet) {
        mediaOutlet.credibility = Math.max(0, mediaOutlet.credibility - 0.1);
        // Effect: Reduce outlet’s credibility, lower suspicion (0.1 decrease).
        // This suspicion decrease should apply to the region of the media outlet or globally.
        const targetHex = this.hexGridManager.getCellById(mediaOutlet.location.hexCellId!);
        if (targetHex) {
            const props = (targetHex as HexCell & {shProps: HexTileProperties}).shProps;
            props.suspicion = Math.max(0, props.suspicion - 0.1);
            console.log(`Media outlet ${mediaOutlet.name} credibility reduced to ${mediaOutlet.credibility}. Suspicion in ${mediaOutlet.location.hexCellId} reduced.`);
        }
    }
  }

  public handleBribeGovernmentAction(action: IAction): void {
    const params = action.parameters as ActionTypes.BribeGovernmentParams;
    console.log(`GameEngine: Handling BribeGovernment in ${params.targetRegionHexId}`);
    const targetHex = this.hexGridManager.getCellById(params.targetRegionHexId);
    if (targetHex) {
        const props = (targetHex as HexCell & {shProps: HexTileProperties}).shProps;
        props.suspicion = Math.max(0, props.suspicion - 0.2); // Reduce regional suspicion
         console.log(`Suspicion in ${params.targetRegionHexId} reduced by bribe. New suspicion: ${props.suspicion}`);
        // Risk whistleblower spawn (5%)
        if (Math.random() < 0.05) {
            console.log("Whistleblower spawn risked by bribe!");
            // TODO: Spawn a whistleblower entity
            // const wbData: PhenomenonTypes.WhistleblowerLeakSpawnData = { spawnLocationHexId: params.targetRegionHexId, credibilityMinMax: [0.3, 0.7]};
            // const wbSpawnPhenomenon = createPhenomenon(PHENOMENON_WHISTLEBLOWER_LEAKS, ...);
            // this.phenomenonManager.activatePhenomenon(wbSpawnPhenomenon);
        }
    }
  }

  public handleFundHospitalAction(action: IAction): void {
    const params = action.parameters as ActionTypes.FundHospitalParams;
    console.log(`GameEngine: Handling FundHospital ${params.hospitalId}`);
    const hospital = this.entityManager.getEntity(params.hospitalId) as import('./entities').HospitalEntity | undefined;
    if (hospital) {
        hospital.receiveFunding(params.fundingAmount); // Method on HospitalEntity
        // Risk ARDS deaths, increase misdiagnoses (handled by hospital logic or new phenomenon)
        console.log(`Hospital ${hospital.name} funding increased.`);
         // Risk ARDS deaths (5%) - This could be a phenomenon triggered here
        if (Math.random() < 0.05) {
            console.log("ARDS deaths risked by hospital funding!");
            // const ardsData: PhenomenonTypes.RespiratorInducedArdsData = { targetHexId: hospital.location.hexCellId!, numberOfCases: Math.floor(Math.random() * 5 + 1) };
            // const ardsPhenomenon = createPhenomenon(PHENOMENON_RESPIRATOR_INDUCED_ARDS, ...);
            // this.phenomenonManager.activatePhenomenon(ardsPhenomenon);
        }
    }
  }

  public handleSpreadPropagandaAction(action: IAction): void {
    const params = action.parameters as ActionTypes.SpreadPropagandaParams;
    console.log(`GameEngine: Handling SpreadPropaganda via ${params.mediaOutletId}`);
    // Effect: Increase trust (0.1), risk backlash if overused (10%).
    if (params.scope === 'global') {
        this.gameState.globalTrust = Math.min(1, this.gameState.globalTrust + 0.1);
        console.log(`Global trust increased to ${this.gameState.globalTrust}`);
    } else if (params.scope === 'region' && params.targetHexId) {
        const targetHex = this.hexGridManager.getCellById(params.targetHexId);
        if (targetHex) {
            const props = (targetHex as HexCell & {shProps: HexTileProperties}).shProps;
            props.trust = Math.min(1, props.trust + 0.1);
            console.log(`Trust in ${params.targetHexId} increased to ${props.trust}`);
        }
    }
    if (Math.random() < 0.10) {
        console.log("Propaganda backlash risked!");
        // TODO: Trigger a backlash phenomenon (e.g., temporary drop in trust or increase in suspicion)
    }
  }

  public handleDeployFakeWhistleblowerAction(action: IAction): void {
    const params = action.parameters as ActionTypes.DeployFakeWhistleblowerParams;
    console.log(`GameEngine: Handling DeployFakeWhistleblower at ${params.spawnHexId}`);
    // TODO: Create a "fake" WhistleblowerEntity or a special event.
    // Effect: Distract from real leaks, reduce suspicion (0.1), risk exposure (10%).
    const targetHex = this.hexGridManager.getCellById(params.spawnHexId);
    if (targetHex) {
        const props = (targetHex as HexCell & {shProps: HexTileProperties}).shProps;
        props.suspicion = Math.max(0, props.suspicion - 0.1);
        console.log(`Suspicion in ${params.spawnHexId} reduced by fake whistleblower. New suspicion: ${props.suspicion}`);
    }
    if (Math.random() < 0.10) {
        this.gameState.globalPlayerExposure = Math.min(1, this.gameState.globalPlayerExposure + 0.1);
        console.log(`Player exposure increased due to fake whistleblower! Exposure: ${this.gameState.globalPlayerExposure}`);
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
                    let doseEffectiveness = 0.1; // Base
                    if(data.deliveryMethod === 'nanoparticles') doseEffectiveness *= 1.2;
                    if(data.deliveryMethod === 'viral_vectors') doseEffectiveness *= 1.5;

                    let dosageMultiplier = 0.5; // low
                    if(data.dosage === 'medium') dosageMultiplier = 1.0;
                    if(data.dosage === 'high') dosageMultiplier = 1.5;

                    const intendedHealthChange = doseEffectiveness * dosageMultiplier * (1 - data.placeboRatio) * 0.1; // Max 0.1 health increase from one shot
                    const sideEffectMagnitude = dosageMultiplier * (data.deliveryMethod === 'aerosols' ? 0.2 : 0.1); // Aerosols riskier

                    props.health = Math.max(0, Math.min(1, props.health + intendedHealthChange - sideEffectMagnitude * 0.05));
                    props.suspicion = Math.min(1, props.suspicion + sideEffectMagnitude * 0.02);
                    this.gameState.globalPlayerExposure = Math.min(1, this.gameState.globalPlayerExposure + sideEffectMagnitude * 0.001);

                    // console.log(`Hex ${targetHexId} health: ${props.health.toFixed(3)}, suspicion: ${props.suspicion.toFixed(3)} due to experiment.`);

                    // TODO: Trigger indirect effects based on probability (Sexual Trans, Fertility, Reverse Transcriptase)
                    // These would spawn new phenomena or directly modify properties.
                }
            }
            phenomenon.isActive = false; // Typically, transfection effects are instantaneous after duration.
            break;

        case PhenomenonTypes.PHENOMENON_RIOTS:
            const riotData = phenomenon.parameters as PhenomenonTypes.RiotsData;
            const riotHex = this.hexGridManager.getCellById(riotData.targetHexId);
            if (riotHex) {
                const props = (riotHex as HexCell & {shProps: HexTileProperties}).shProps;
                if (props) {
                    props.population *= (1 - (riotData.intensity * 0.01 * scaledDeltaTime) ); // Lose 0.01 of intensity % pop per sec
                    props.infrastructure = Math.max(0, props.infrastructure - riotData.intensity * 0.005 * scaledDeltaTime);
                    props.suspicion = Math.min(1, props.suspicion + riotData.intensity * 0.01 * scaledDeltaTime);
                    // console.log(`Riots in ${riotData.targetHexId}: Pop ${props.population.toFixed(0)}, Infra ${props.infrastructure.toFixed(3)}`);
                }
            }
            break;

        // Continuous phenomena like TrustDecay, Depopulation are handled in PhenomenonManager.checkAndTriggerPhenomena for now.
        // If they needed more complex state or distinct instances, they could be handled here too.

        default:
            // console.warn(`Unhandled phenomenon type in GameEngine.handlePhenomenonUpdate: ${phenomenon.type}`);
            break;
    }
  }
}