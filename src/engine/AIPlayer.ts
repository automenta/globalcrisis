import { GameEngine, GameState, PlayerState } from './GameEngine';
import { FacilityType, FACILITY_DEFINITIONS } from './definitions';
import { TECH_TREE, TechNode } from './Technology';

export class AIPlayer {
    public readonly id: string;
    private gameEngine: GameEngine; // To call actions like buildFacility, startResearch

    constructor(id: string, gameEngine: GameEngine) {
        this.id = id;
        this.gameEngine = gameEngine;
    }

    log(message: string) {
        console.log(`[AI Player ${this.id}] ${message}`);
    }

    makeDecisions(gameState: GameState): GameState {
        let currentGameState = { ...gameState };
        const playerState = currentGameState.players[this.id];

        if (!playerState) {
            this.log("Error: PlayerState not found for this AI.");
            return currentGameState;
        }

        // 1. Basic Resource Management: Build facilities if resources are low
        // For simplicity, let's say if credits < 500, build a resource extractor if possible.
        // And if research < 100, build a research outpost.

        // Prioritize building essential facilities
        const researchOutposts = playerState.activeFacilities.filter(f => f.type === FacilityType.RESEARCH_OUTPOST).length;
        if ((playerState.globalResources.research || 0) < 50 * (1 + researchOutposts) && researchOutposts < 2) {
            currentGameState = this.tryBuildFacility(currentGameState, playerState, FacilityType.RESEARCH_OUTPOST);
        }

        const creditExtractors = playerState.activeFacilities.filter(f => f.type === FacilityType.RESOURCE_EXTRACTOR).length;
        if ((playerState.globalResources.credits || 0) < 300 * (1 + creditExtractors) && creditExtractors < 2) {
            currentGameState = this.tryBuildFacility(currentGameState, playerState, FacilityType.RESOURCE_EXTRACTOR);
        }

        // Energy management: Build power plants if energy is low or negative (simplistic check)
        // A more robust check would sum potential energy production vs consumption.
        const currentEnergy = playerState.globalResources.energy || 0;
        const powerPlants = playerState.activeFacilities.filter(f => f.type === FacilityType.POWER_PLANT).length;
        // Target having at least some positive net energy or a minimum number of power plants if very low.
        // This heuristic is very basic: if energy is below a threshold and we have few power plants, build one.
        if (currentEnergy < 100 && powerPlants < 2) { // Thresholds can be tuned
             this.log(`Low energy (${currentEnergy}), considering Power Plant. Have ${powerPlants}.`);
             currentGameState = this.tryBuildFacility(currentGameState, playerState, FacilityType.POWER_PLANT);
        }

        // Defense management: Build defense platforms if defense score is low
        const currentDefense = playerState.globalResources.defense || 0;
        const defensePlatforms = playerState.activeFacilities.filter(f => f.type === FacilityType.DEFENSE_PLATFORM).length;
        if (currentDefense < 50 && defensePlatforms < 1) { // Example: build if defense score < 50 and less than 1 platform
            this.log(`Low defense (${currentDefense}), considering Defense Platform. Have ${defensePlatforms}.`);
            currentGameState = this.tryBuildFacility(currentGameState, playerState, FacilityType.DEFENSE_PLATFORM);
        }


        // 2. Basic Research Strategy: Pick an available tech and research it.
        if (!playerState.currentResearch) {
            const availableTechs = Object.keys(TECH_TREE).filter(techId => {
                if (playerState.unlockedTechs.includes(techId)) return false;
                const techDefinition = TECH_TREE[techId];
                if (!techDefinition) return false;
                // Check prerequisites
                const prerequisitesMet = techDefinition.prerequisites.every(prereqId => playerState.unlockedTechs.includes(prereqId));
                return prerequisitesMet;
            });

            if (availableTechs.length > 0) {
                const randomTechId = availableTechs[Math.floor(Math.random() * availableTechs.length)];
                this.log(`Attempting to start research on ${TECH_TREE[randomTechId]?.name || randomTechId}`);
                const researchResult = this.gameEngine.startResearch(currentGameState, randomTechId, this.id);
                if (researchResult.success && researchResult.newState) {
                    this.log(`Started research on ${TECH_TREE[randomTechId]?.name}.`);
                    currentGameState = researchResult.newState;
                } else {
                    // this.log(`Failed to start research on ${TECH_TREE[randomTechId]?.name}: ${researchResult.message}`);
                }
            }
        }

        // More decisions can be added here:
        // - Respond to threats
        // - Military buildup
        // - Strategic resource acquisition

        return currentGameState;
    }

    private tryBuildFacility(gameState: GameState, playerState: PlayerState, facilityType: FacilityType): GameState {
        const definition = FACILITY_DEFINITIONS[facilityType];
        if (!definition) return gameState;

        // Check affordability
        let canAfford = true;
        for (const resource in definition.cost) {
            if ((playerState.globalResources[resource] || 0) < definition.cost[resource]) {
                canAfford = false;
                break;
            }
        }

        if (!canAfford) {
            // this.log(`Cannot afford to build ${definition.name}.`);
            return gameState;
        }

        // Find a random region to build in (simplistic)
        // A better AI would pick regions strategically.
        const randomRegionIndex = Math.floor(Math.random() * gameState.regions.length);
        const targetRegion = gameState.regions[randomRegionIndex];

        if (targetRegion) {
            this.log(`Attempting to build ${definition.name} in ${targetRegion.name}`);
            // For facilities requiring specific hexes (like STRATEGIC_RESOURCE_NODE), this needs more logic.
            // For now, assume general facilities.
            const buildResult = this.gameEngine.buildFacility(gameState, facilityType, targetRegion.id, this.id, undefined);
            if (buildResult.success && buildResult.newState) {
                this.log(`Successfully started construction of ${definition.name} in ${targetRegion.name}.`);
                return buildResult.newState;
            } else {
                // this.log(`Failed to build ${definition.name} in ${targetRegion.name}: ${buildResult.message}`);
            }
        }
        return gameState;
    }
}
