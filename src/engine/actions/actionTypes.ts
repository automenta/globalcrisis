import type { IAction, ActionTarget, ActionTrigger, MetamodelType, EntityLocationType } from "../GameEngine";
import { v4 as uuidv4 } from 'uuid'; // For generating unique action IDs

// Specific Action Types (as MetamodelType)
export const DEPLOY_EXPERIMENT_ACTION: MetamodelType = "action_deploy_experiment";
export const MOVE_ENTITY_ACTION: MetamodelType = "action_move_entity";
export const HACK_MEDIA_ACTION: MetamodelType = "action_hack_media";
export const BRIBE_GOVERNMENT_ACTION: MetamodelType = "action_bribe_government";
export const FUND_HOSPITAL_ACTION: MetamodelType = "action_fund_hospital";
export const SPREAD_PROPAGANDA_ACTION: MetamodelType = "action_spread_propaganda";
export const DEPLOY_FAKE_WHISTLEBLOWER_ACTION: MetamodelType = "action_deploy_fake_whistleblower";

// Parameter interfaces for specific actions

export interface DeployExperimentParams {
  deliveryMethod: 'nanoparticles' | 'viral_vectors' | 'aerosols';
  dosage: 'low' | 'medium' | 'high';
  placeboRatio: number; // 0-1
  scientistId: string; // Entity ID of the scientist performing the action
}

export interface MoveEntityParams {
  entityId: string;
  destinationHexId: string;
  // path?: string[]; // Optional pre-calculated path
}

export interface HackMediaParams {
  scientistId: string;
  mediaOutletId: string;
}

export interface BribeGovernmentParams {
  scientistId: string;
  targetRegionHexId: string; // Hex ID representing the government/region to bribe
  amount: number; // Amount of "influence" or "resources" used for bribe
}

export interface FundHospitalParams {
  hospitalId: string;
  fundingAmount: number; // Amount of "resources" or "influence"
}

export interface SpreadPropagandaParams {
  mediaOutletId: string;
  messageType: 'pro-consortium' | 'anti-consortium'; // Aligns with media outlet bias, but can be forced
  scope: 'region' | 'global';
  targetHexId?: string; // if scope is 'region'
}

export interface DeployFakeWhistleblowerParams {
  spawnHexId: string;
  credibility: number; // 0-1 for the fake entity
  messageTheme: string; // e.g., "distraction_aliens", "distraction_rival_corp"
}


// Helper functions to create action objects

function createBaseAction(
  type: MetamodelType,
  trigger: ActionTrigger,
  target: ActionTarget,
  parameters?: Record<string, any>,
  name?: string,
  description?: string
): IAction {
  return {
    id: uuidv4(),
    type,
    name: name || type, // Default name to type if not provided
    description,
    trigger,
    target,
    parameters,
  };
}

export function createDeployExperimentAction(
  scientistId: string,
  targetRegionHexId: string,
  params: Omit<DeployExperimentParams, 'scientistId'>,
  trigger: ActionTrigger = 'player_initiated'
): IAction {
  return createBaseAction(
    DEPLOY_EXPERIMENT_ACTION,
    trigger,
    { type: 'hex_tile', targetId: targetRegionHexId },
    { ...params, scientistId },
    "Deploy mRNA Experiment"
  );
}

export function createMoveEntityAction(
  entityId: string,
  destinationHexId: string,
  trigger: ActionTrigger = 'player_initiated'
): IAction {
  const params: MoveEntityParams = { entityId, destinationHexId };
  return createBaseAction(
    MOVE_ENTITY_ACTION,
    trigger,
    { type: 'entity', targetId: entityId }, // Target is the entity being moved
    params,
    `Move Entity ${entityId}`
  );
}

export function createHackMediaAction(
  scientistId: string,
  mediaOutletId: string,
  trigger: ActionTrigger = 'player_initiated'
): IAction {
  const params: HackMediaParams = { scientistId, mediaOutletId };
  return createBaseAction(
    HACK_MEDIA_ACTION,
    trigger,
    { type: 'entity', targetId: mediaOutletId },
    params,
    `Hack Media Outlet ${mediaOutletId}`
  );
}

export function createBribeGovernmentAction(
  scientistId: string,
  targetRegionHexId: string,
  amount: number,
  trigger: ActionTrigger = 'player_initiated'
): IAction {
  const params: BribeGovernmentParams = { scientistId, targetRegionHexId, amount };
  return createBaseAction(
    BRIBE_GOVERNMENT_ACTION,
    trigger,
    { type: 'hex_tile', targetId: targetRegionHexId },
    params,
    `Bribe Government in ${targetRegionHexId}`
  );
}

export function createFundHospitalAction(
  hospitalId: string,
  fundingAmount: number,
  trigger: ActionTrigger = 'player_initiated'
): IAction {
  const params: FundHospitalParams = { hospitalId, fundingAmount };
  return createBaseAction(
    FUND_HOSPITAL_ACTION,
    trigger,
    { type: 'entity', targetId: hospitalId },
    params,
    `Fund Hospital ${hospitalId}`
  );
}

export function createSpreadPropagandaAction(
  mediaOutletId: string,
  messageType: 'pro-consortium' | 'anti-consortium',
  scope: 'region' | 'global',
  targetHexId?: string, // Required if scope is 'region'
  trigger: ActionTrigger = 'player_initiated'
): IAction {
  const params: SpreadPropagandaParams = { mediaOutletId, messageType, scope, targetHexId };
  return createBaseAction(
    SPREAD_PROPAGANDA_ACTION,
    trigger,
    scope === 'global' ? { type: 'global' } : { type: 'hex_tile', targetId: targetHexId },
    params,
    `Spread Propaganda via ${mediaOutletId}`
  );
}

export function createDeployFakeWhistleblowerAction(
  spawnHexId: string,
  credibility: number,
  messageTheme: string,
  trigger: ActionTrigger = 'player_initiated'
): IAction {
  const params: DeployFakeWhistleblowerParams = { spawnHexId, credibility, messageTheme };
  return createBaseAction(
    DEPLOY_FAKE_WHISTLEBLOWER_ACTION,
    trigger,
    { type: 'hex_tile', targetId: spawnHexId },
    params,
    `Deploy Fake Whistleblower at ${spawnHexId}`
  );
}

// It might be useful to have an Action constructor class if actions have their own logic,
// but for now, IAction is an interface, and these factory functions create plain objects.
// The "effect" of these actions will be interpreted by the ActionManager in the game engine.
// Example usage:
// const moveAction = createMoveEntityAction('scientist_1', 'hex_345');
// gameEngine.dispatchAction(moveAction);
