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
            // this.log(`Low defense (${currentDefense}), considering Defense Platform. Have ${defensePlatforms}.`); // Less verbose
            currentGameState = this.tryBuildFacility(currentGameState, playerState, FacilityType.DEFENSE_PLATFORM);
        }

        // Food and Water management:
        // For now, AI doesn't build specific facilities for these, but it should be aware of shortages.
        // This awareness can be used later to influence policy or program choices.
        const foodLevel = playerState.globalResources[StrategicResourceType.FOOD] || 0;
        const waterLevel = playerState.globalResources[StrategicResourceType.WATER] || 0;
        const netFoodChange = this.calculateNetResourceChange(playerState, StrategicResourceType.FOOD, currentGameState);
        const netWaterChange = this.calculateNetResourceChange(playerState, StrategicResourceType.WATER, currentGameState);

        if (foodLevel < 50 && netFoodChange < 0) {
             this.log(`Critically low on Food: ${foodLevel.toFixed(2)}, Net change: ${netFoodChange.toFixed(2)}.`);
             // Future: AI might prioritize agriculture-boosting programs or policies.
        }
        if (waterLevel < 50 && netWaterChange < 0) {
            this.log(`Critically low on Water: ${waterLevel.toFixed(2)}, Net change: ${netWaterChange.toFixed(2)}.`);
            // Future: AI might prioritize water-related programs or policies.
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

        // 4. Consider Regional Development Programs
        // AI now considers programs more intelligently based on regional needs (demographics, sector performance)
        if (Math.random() < 0.02) { // Slightly higher chance to consider programs
            currentGameState = this.tryConsiderRegionalProgram(currentGameState, playerState);
        }

        // 5. Consider Enacting a Policy
        // AI now considers policies more intelligently based on overall state (resource shortages, research needs)
        if (Math.random() < 0.02) { // Slightly higher chance to consider policies
            currentGameState = this.tryConsiderPolicy(currentGameState, playerState);
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

    private tryConsiderRegionalProgram(gameState: GameState, playerState: PlayerState): GameState {
        // More intelligent program selection
        let bestProgram: RegionalDevelopmentProgramType | null = null;
        let targetRegionId: string | null = null;
        let maxScore = -Infinity;

        for (const region of gameState.regions) {
            if (playerState.activeRegionalPrograms[region.id]) continue; // Program already active here

            // Analyze regional needs
            const educationNeed = 100 - region.demographics.educationLevel; // Higher need if education is low
            const unemploymentRate = region.demographics.unemployedPopulation / Math.max(1, region.demographics.workingAgePopulation);
            const stabilityDeficit = 100 - region.stability;

            // Evaluate potential programs
            for (const progTypeStr in REGIONAL_DEVELOPMENT_PROGRAM_DEFINITIONS) {
                const progType = progTypeStr as RegionalDevelopmentProgramType;
                const progDef = REGIONAL_DEVELOPMENT_PROGRAM_DEFINITIONS[progType];
                if (!progDef) continue;

                let score = Math.random() * 10; // Base random chance + small preference

                // Check affordability
                let canAfford = true;
                const costs = progDef.cost || {};
                for (const resource in costs) {
                    if ((playerState.globalResources[resource] || 0) < costs[resource as keyof typeof costs]) {
                        canAfford = false;
                        break;
                    }
                }
                if (!canAfford) continue;

                // Simple scoring based on needs and program effects
                if (progDef.demographicEffects?.educationLevelChange && progDef.demographicEffects.educationLevelChange > 0) {
                    score += educationNeed * 0.5;
                }
                if (progDef.demographicEffects?.unemploymentChange && progDef.demographicEffects.unemploymentChange < 0) { // Negative change means reduces unemployment
                    score += unemploymentRate * 50; // Higher score if high unemployment and program helps
                }
                if (progDef.effectsPerTick?.stability && progDef.effectsPerTick.stability > 0) {
                    score += stabilityDeficit * 0.3;
                }
                 if (progType === RegionalDevelopmentProgramType.INDUSTRIAL_EXPANSION) {
                    // Prefer if industry sector is lagging or if high unemployment
                    const industryOutput = region.economicSectors.industry?.output || 0;
                    const totalOutput = Object.values(region.economicSectors).reduce((s, sec) => s + sec.output, 1);
                    if (industryOutput / totalOutput < 0.2) score += 20; // If industry is less than 20% of economy
                    if (unemploymentRate > 0.15) score += 15;
                }


                if (score > maxScore) {
                    maxScore = score;
                    bestProgram = progType;
                    targetRegionId = region.id;
                }
            }
        }

        if (bestProgram && targetRegionId) {
            const programDef = REGIONAL_DEVELOPMENT_PROGRAM_DEFINITIONS[bestProgram!];
            this.log(`AI decided to initiate ${programDef.name} in region ${targetRegionId} (Score: ${maxScore.toFixed(2)})`);
            const result = this.gameEngine.initiateRegionalDevelopmentProgram(gameState, this.id, targetRegionId, bestProgram);
            if (result.success && result.newState) {
                this.log(`Successfully initiated ${programDef.name}.`);
                return result.newState;
            }
        }
        return gameState;
    }

    private tryConsiderPolicy(gameState: GameState, playerState: PlayerState): GameState {
        let bestPolicy: PolicyType | null = null;
        let maxScore = -Infinity;

        const foodShortage = (playerState.globalResources[StrategicResourceType.FOOD] || 0) < 50 && this.calculateNetResourceChange(playerState, StrategicResourceType.FOOD, gameState) < 0;
        const waterShortage = (playerState.globalResources[StrategicResourceType.WATER] || 0) < 50 && this.calculateNetResourceChange(playerState, StrategicResourceType.WATER, gameState) < 0;
        const researchSlow = (playerState.globalResources.research || 0) < 20; // Example: if research points per tick is low

        for (const policyTypeStr in POLICY_DEFINITIONS) {
            const policyType = policyTypeStr as PolicyType;
            if (playerState.activePolicies.has(policyType)) continue;

            const policyDef = POLICY_DEFINITIONS[policyType];
            if (!policyDef) continue;

            let score = Math.random() * 10; // Base random chance

            // Check affordability
            const adoptionCosts = policyDef.adoptionCost || {};
            let canAffordAdoption = true;
            for (const resource in adoptionCosts) {
                 if ((playerState.globalResources[resource] || 0) < adoptionCosts[resource as keyof typeof adoptionCosts]) {
                    canAffordAdoption = false;
                    break;
                }
            }
            if (!canAffordAdoption) continue;

            // Check mutual exclusivity
            let exclusiveConflict = false;
            if (policyDef.mutuallyExclusivePolicies) {
                for (const exclusiveType of policyDef.mutuallyExclusivePolicies) {
                    if (playerState.activePolicies.has(exclusiveType)) {
                        exclusiveConflict = true;
                        break;
                    }
                }
            }
            if (exclusiveConflict) continue;

            // Score policies based on current game state
            if (policyType === PolicyType.EDUCATION_SUBSIDIES && researchSlow) {
                score += 30; // Prioritize if research is slow
            }
            if (policyType === PolicyType.SUSTAINABLE_DEVELOPMENT && (foodShortage || waterShortage)) {
                 // Sustainable dev might imply better food/water security through environment
                score += 20;
            }
             if (policyType === PolicyType.ENVIRONMENTAL_REGULATION && gameState.globalEnvironment < 50) {
                score += 25; // If global environment is suffering
            }
            if (policyType === PolicyType.AGGRESSIVE_RESOURCE_EXPLOITATION && (playerState.globalResources.credits || 0) < 500) {
                score += 20; // If low on credits
            }


            if (score > maxScore) {
                maxScore = score;
                bestPolicy = policyType;
            }
        }

        if (bestPolicy) {
            const policyDef = POLICY_DEFINITIONS[bestPolicy!];
            this.log(`AI decided to enact policy: ${policyDef.name} (Score: ${maxScore.toFixed(2)})`);
            const result = this.gameEngine.enactPolicy(gameState, this.id, bestPolicy);
            if (result.success && result.newState) {
                this.log(`Successfully enacted policy: ${policyDef.name}.`);
                return result.newState;
            }
        }
        return gameState;
    }
}
