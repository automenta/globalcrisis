import { GameEngine, GameState, PlayerState } from './GameEngine';
import {
    FacilityType, FACILITY_DEFINITIONS,
    StrategicResourceType, // Though not directly used in this diff, good to have for context
    REGIONAL_DEVELOPMENT_PROGRAM_DEFINITIONS, RegionalDevelopmentProgramType,
    POLICY_DEFINITIONS, PolicyType
} from './definitions';
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

        // Energy management: Build power plants if energy is low or negative.
        const currentEnergy = playerState.globalResources.energy || 0;
        const energyProduction = this.calculateNetResourceChange(playerState, 'energy', currentGameState);
        const powerPlants = playerState.activeFacilities.filter(f => f.type === FacilityType.POWER_PLANT).length;

        // If energy is low AND net production is low/negative, or if very few power plants exist.
        if ((currentEnergy < 100 && energyProduction < 5) || powerPlants < 1) { // Thresholds can be tuned
             this.log(`Energy status: current ${currentEnergy}, net prod ${energyProduction.toFixed(2)}. Considering Power Plant. Have ${powerPlants}.`);
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

        // 3. Strategic Resource Acquisition
        currentGameState = this.tryAcquireStrategicResources(currentGameState, playerState);

        // 4. Consider Regional Development Programs (very basic)
        if (Math.random() < 0.01) { // Low chance each decision cycle to consider this
            currentGameState = this.tryRegionalDevelopmentProgram(currentGameState, playerState);
        }

        // 5. Consider Enacting a Policy (very basic)
        if (Math.random() < 0.01) { // Low chance each decision cycle
            currentGameState = this.tryEnactPolicy(currentGameState, playerState);
        }

        return currentGameState;
    }

    private tryBuildFacility(gameState: GameState, playerState: PlayerState, facilityType: FacilityType, targetRegionId?: string, targetHexagonId?: string): GameState {
        const definition = FACILITY_DEFINITIONS[facilityType];
        if (!definition) return gameState;

        // Check affordability
        let canAfford = true;
        const costs = definition.cost || {};
        for (const resource in costs) {
            if ((playerState.globalResources[resource] || 0) < costs[resource as keyof typeof costs]) {
                canAfford = false;
                break;
            }
        }

        if (!canAfford) {
            // this.log(`Cannot afford to build ${definition.name}.`);
            return gameState;
        }

        let buildRegionId = targetRegionId;
        if (!buildRegionId) {
            // If no specific region, pick one somewhat randomly but try to find one that makes sense for the facility
            // For STRATEGIC_RESOURCE_NODE, region is determined by hexagon.
            // For others, could be random or based on some regional need.
            if (facilityType !== FacilityType.STRATEGIC_RESOURCE_NODE || !targetHexagonId) {
                 const randomRegionIndex = Math.floor(Math.random() * gameState.regions.length);
                 buildRegionId = gameState.regions[randomRegionIndex].id;
            } else if (targetHexagonId) {
                // For STRATEGIC_RESOURCE_NODE, find which region the hexagon falls into.
                // This is a simplification; hexes aren't directly tied to regions in current model.
                // AI will pick a region that owns the hex or is nearby. For now, pick any region.
                // TODO: Enhance this logic if hexes get explicit region ownership or proximity data.
                const randomRegionIndex = Math.floor(Math.random() * gameState.regions.length);
                buildRegionId = gameState.regions[randomRegionIndex].id;
                // A better approach would be to find the region containing or closest to the targetHexagonId.
                // This requires a mapping from hexagonId to regionId or coordinates.
            }
        }

        if (!buildRegionId) {
            this.log(`Could not determine a target region for ${definition.name}.`);
            return gameState;
        }
        const regionName = gameState.regions.find(r => r.id === buildRegionId)?.name || "Unknown Region";

        this.log(`Attempting to build ${definition.name} in ${regionName}` + (targetHexagonId ? ` on hex ${targetHexagonId}` : ""));

        const buildResult = this.gameEngine.buildFacility(gameState, facilityType, buildRegionId, this.id, targetHexagonId);
        if (buildResult.success && buildResult.newState) {
            this.log(`Successfully started construction of ${definition.name}.`);
            return buildResult.newState;
        } else {
            // this.log(`Failed to build ${definition.name}: ${buildResult.message}`);
        }
        return gameState;
    }

    private tryAcquireStrategicResources(gameState: GameState, playerState: PlayerState): GameState {
        let newState = { ...gameState };
        const scannedHexesWithResources: { hexId: string, resource: NonNullable<typeof gameState.hexagonStrategicResources[string]> }[] = [];

        playerState.scannedHexes.forEach(hexId => {
            const resource = gameState.hexagonStrategicResources[hexId];
            if (resource) {
                // Check if a node already exists (by any player)
                let nodeExists = false;
                for (const pId in gameState.players) {
                    if (gameState.players[pId].activeFacilities.some(f => f.hexagonId === hexId && f.type === FacilityType.STRATEGIC_RESOURCE_NODE)) {
                        nodeExists = true;
                        break;
                    }
                }
                if (!nodeExists) {
                    scannedHexesWithResources.push({ hexId, resource });
                }
            }
        });

        if (scannedHexesWithResources.length === 0) {
            return newState; // No available hexes with resources to build on
        }

        // Prioritize resources the AI is low on or needs for tech/upgrades (simplified for now)
        // Simple heuristic: build on the first available one if affordable
        for (const { hexId, resource } of scannedHexesWithResources) {
            // Check if AI is "low" on this resource or if it's generally valuable
            const currentAmount = playerState.globalResources[resource] || 0;
            const netChange = this.calculateNetResourceChange(playerState, resource, gameState);

            // Example condition: if low quantity and not producing much, or if it's a new resource type for the AI
            if (currentAmount < 10 && netChange < 0.1) {
                this.log(`Considering building Strategic Resource Node on ${hexId} for ${resource}. Current: ${currentAmount}, NetChange: ${netChange.toFixed(2)}`);
                // The region for building STRATEGIC_RESOURCE_NODE is not directly tied to hex in buildFacility call.
                // We need to determine a region. For AI, this can be a region it "focuses" on or a random one.
                // This is a simplification. Ideally, hexes would belong to regions or have clear proximity.
                const randomRegion = gameState.regions[Math.floor(Math.random() * gameState.regions.length)];
                newState = this.tryBuildFacility(newState, playerState, FacilityType.STRATEGIC_RESOURCE_NODE, randomRegion.id, hexId);
                // If a build was attempted (successfully or not), break for this decision cycle to avoid multiple builds at once
                if (newState !== gameState) break;
            }
        }
        return newState;
    }

    private calculateNetResourceChange(playerState: PlayerState, resourceName: string, gameState: GameState): number {
        let netChange = 0;

        playerState.activeFacilities.forEach(facility => {
            if (!facility.operational) return;

            const definition = FACILITY_DEFINITIONS[facility.type];
            if (!definition) return;

            // Add income from facility effects
            if (definition.effects) {
                definition.effects.forEach(effect => {
                    if (effect.resourceYield && effect.resourceYield[resourceName]) {
                        netChange += effect.resourceYield[resourceName]!;
                    }
                });
            }

            // Subtract upkeep from facility maintenance costs
            if (definition.maintenanceCost && definition.maintenanceCost[resourceName]) {
                netChange -= definition.maintenanceCost[resourceName]!;
            }

            // Special case for strategic resource nodes (if the resourceName matches the hex output)
            if (facility.type === FacilityType.STRATEGIC_RESOURCE_NODE && facility.hexagonId) {
                const resourceOnHex = gameState.hexagonStrategicResources[facility.hexagonId];
                if (resourceOnHex === resourceName) {
                    // This is a simplified assumption of yield rate; ideally, this comes from definition or constant
                    netChange += 0.02; // Assuming 0.02 units per second per node from updateFacility logic
                }
            }
        });

        // TODO: Add other global sources of income/expense for this resource if they exist
        // e.g., from policies, tech effects not tied to facilities, trade.

        return netChange; // This is net change per game tick (second) at current game speed=1
    }

    private tryRegionalDevelopmentProgram(gameState: GameState, playerState: PlayerState): GameState {
        // Simplistic: Pick a random available program and a random region.
        // A real AI would analyze regions and program benefits.
        const availablePrograms = Object.values(RegionalDevelopmentProgramType);
        if (availablePrograms.length === 0) return gameState;

        const randomProgramType = availablePrograms[Math.floor(Math.random() * availablePrograms.length)];
        const programDef = REGIONAL_DEVELOPMENT_PROGRAM_DEFINITIONS[randomProgramType];
        if (!programDef) return gameState;

        // Check if player can afford
        const costs = programDef.cost || {};
        let canAfford = true;
        for (const resource in costs) {
            if ((playerState.globalResources[resource] || 0) < costs[resource as keyof typeof costs]) {
                canAfford = false;
                break;
            }
        }
        if (!canAfford) return gameState;

        const randomRegion = gameState.regions[Math.floor(Math.random() * gameState.regions.length)];
        if (playerState.activeRegionalPrograms[randomRegion.id]) {
            return gameState; // Program already active in this randomly chosen region
        }

        this.log(`Considering initiating ${programDef.name} in ${randomRegion.name}`);
        const result = this.gameEngine.initiateRegionalDevelopmentProgram(gameState, this.id, randomRegion.id, randomProgramType);
        if (result.success && result.newState) {
            this.log(`Successfully initiated ${programDef.name} in ${randomRegion.name}.`);
            return result.newState;
        }
        return gameState;
    }

    private tryEnactPolicy(gameState: GameState, playerState: PlayerState): GameState {
        // Simplistic: Pick a random available policy the AI doesn't have yet.
        const availablePolicies = Object.values(PolicyType).filter(pType => !playerState.activePolicies.has(pType));
        if (availablePolicies.length === 0) return gameState;

        const randomPolicyType = availablePolicies[Math.floor(Math.random() * availablePolicies.length)];
        const policyDef = POLICY_DEFINITIONS[randomPolicyType];
        if (!policyDef) return gameState;

        // Check affordability for adoption
        const adoptionCosts = policyDef.adoptionCost || {};
        let canAffordAdoption = true;
        for (const resource in adoptionCosts) {
             if ((playerState.globalResources[resource] || 0) < adoptionCosts[resource as keyof typeof adoptionCosts]) {
                canAffordAdoption = false;
                break;
            }
        }
        if (!canAffordAdoption) return gameState;

        // Check if mutually exclusive with any active policy
        if (policyDef.mutuallyExclusivePolicies) {
            for (const exclusiveType of policyDef.mutuallyExclusivePolicies) {
                if (playerState.activePolicies.has(exclusiveType)) {
                    return gameState; // Cannot enact due to active mutually exclusive policy
                }
            }
        }

        this.log(`Considering enacting policy: ${policyDef.name}`);
        const result = this.gameEngine.enactPolicy(gameState, this.id, randomPolicyType);
        if (result.success && result.newState) {
            this.log(`Successfully enacted policy: ${policyDef.name}.`);
            return result.newState;
        }
        return gameState;
    }
}
