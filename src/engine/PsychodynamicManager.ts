import type { GameState, HexCellData, PopulationSegment, PopulationNeed, ResourceId } from './GameEngine';
import type { EventBus, PopulationEvent } from './EventBus';

export class PsychodynamicManager {
    private gameState: Readonly<GameState>;
    private eventBus?: EventBus;

    // Configuration for need fulfillment impact
    private readonly CRITICAL_NEED_FULFILLMENT_THRESHOLD = 0.3; // Below this, severe morale/unrest penalty
    private readonly LOW_NEED_FULFILLMENT_THRESHOLD = 0.6;      // Below this, moderate penalty
    private readonly MORALE_RECOVERY_RATE = 0.1; // Points per tick (scaled by deltaTime)
    private readonly UNREST_INCREASE_RATE = 0.2; // Points per tick from very low morale
    private readonly UNREST_DECREASE_RATE = 0.05; // Points per tick from high morale

    constructor(gameState: Readonly<GameState>, eventBus?: EventBus) {
        this.gameState = gameState;
        this.eventBus = eventBus;
    }

    public update(deltaTime: number): void { // deltaTime is raw seconds
        const scaledDeltaTime = deltaTime * this.gameState.gameSpeedMultiplier;

        this.gameState.hexGrid.forEach(hexCell => {
            if (hexCell.populationIds && hexCell.populationIds.length > 0) {
                // This assumes populationSegments are stored elsewhere and keyed by populationIds
                // For now, we'll imagine a way to get the actual PopulationSegment objects.
                // In a full implementation, GameState would have a Map<string, PopulationSegment>.
                hexCell.populationIds.forEach(segmentId => {
                    // const segment = this.gameState.populationSegments.get(segmentId); // Ideal
                    // Placeholder: if segments were directly on hexCell (simplification for now)
                    // const segment = (hexCell as any).populationSegments?.find(s => s.id === segmentId);

                    // For this step, we'll assume we can get segment objects.
                    // The actual storage/retrieval of PopulationSegments needs to be solidified in GameEngine.ts
                    // For now, this manager will contain the logic assuming segments are accessible.

                    // Find a placeholder segment to work with for logic demonstration
                    // This is a HACK because GameEngine.ts is not modifiable to add gameState.populationSegments
                    let segment: PopulationSegment | undefined = undefined;
                    this.gameState.entities.forEach(e => {
                        if(e.location.hexCellId === hexCell.id && e.entityType === 'CityEntity' && e.hasComponent('PopulationComponent')){
                            const popComp = e.getComponent<any>('PopulationComponent'); // any to access .segments
                            if(popComp && popComp.segments && popComp.segments.size > 0){
                                segment = popComp.segments.values().next().value as PopulationSegment; // Just take first segment for demo
                            }
                        }
                    });


                    if (segment) {
                        this.updateSegmentNeeds(segment, hexCell, scaledDeltaTime);
                        this.updateSegmentMoraleAndUnrest(segment, scaledDeltaTime);
                    }
                });
            }
        });
    }

    private updateSegmentNeeds(segment: PopulationSegment, hexCell: HexCellData, scaledDeltaTime: number): void {
        segment.needs.forEach(need => {
            if (need.consumptionPerCapita && need.consumptionPerCapita > 0) {
                const resourceId = need.needId as ResourceId; // Assuming resource-based needs use ResourceId as needId
                const demand = segment.totalPopulation * need.consumptionPerCapita * scaledDeltaTime;

                const resourceData = hexCell.availableResources.get(resourceId);
                let consumedAmount = 0;

                if (resourceData && resourceData.currentAmount > 0) {
                    consumedAmount = Math.min(demand, resourceData.currentAmount);
                    resourceData.currentAmount -= consumedAmount;
                    // Optional: Event for resource consumption
                }

                // Update fulfillment: if demand is 0, fulfillment is 100% (no need or no pop)
                const fulfillmentRatio = demand > 0 ? consumedAmount / demand : 1.0;

                // Needs decay over time if not met, or improve if met
                // Let's say fulfillment moves towards fulfillmentRatio
                const fulfillmentChangeRate = 0.1; // How fast fulfillment adapts
                if (need.currentFulfillment < fulfillmentRatio) {
                    need.currentFulfillment = Math.min(fulfillmentRatio, need.currentFulfillment + fulfillmentChangeRate * scaledDeltaTime);
                } else if (need.currentFulfillment > fulfillmentRatio) {
                    need.currentFulfillment = Math.max(fulfillmentRatio, need.currentFulfillment - (fulfillmentChangeRate + need.decayRate) * scaledDeltaTime);
                }
                need.currentFulfillment = Math.max(0, Math.min(1, need.currentFulfillment));

            } else {
                // Non-resource based needs (housing, security etc.) would need different logic
                // e.g. based on building presence, policies, faction stability etc.
                // For now, let them decay slowly if not explicitly managed.
                need.currentFulfillment = Math.max(0, need.currentFulfillment - need.decayRate * scaledDeltaTime);
            }
        });
    }

    private updateSegmentMoraleAndUnrest(segment: PopulationSegment, scaledDeltaTime: number): void {
        let overallNeedFulfillmentScore = 0;
        let totalImportance = 0;

        segment.needs.forEach(need => {
            overallNeedFulfillmentScore += need.currentFulfillment * need.importance;
            totalImportance += need.importance;
        });

        const averageFulfillment = totalImportance > 0 ? overallNeedFulfillmentScore / totalImportance : 1.0; // Default to 1 if no needs defined

        let moraleChange = 0;
        if (averageFulfillment < this.CRITICAL_NEED_FULFILLMENT_THRESHOLD) {
            moraleChange = -2 * this.MORALE_RECOVERY_RATE; // Severe penalty
        } else if (averageFulfillment < this.LOW_NEED_FULFILLMENT_THRESHOLD) {
            moraleChange = -this.MORALE_RECOVERY_RATE; // Moderate penalty
        } else {
            // Gradual recovery towards a target based on fulfillment (e.g. target 80 morale if fulfillment is 1.0)
            const targetMorale = averageFulfillment * 70 + 20; // Scale: 0 fulfillment -> 20 morale, 1 fulfillment -> 90 morale
            moraleChange = (targetMorale - segment.baseMorale) * this.MORALE_RECOVERY_RATE * 0.1; // Slower adjustment towards target
        }

        // Health score also impacts morale
        const healthImpact = (segment.healthScore - 50) / 100; // Ranges roughly -0.5 to 0.5
        moraleChange += healthImpact * this.MORALE_RECOVERY_RATE * 0.5;


        const oldMorale = segment.baseMorale;
        segment.baseMorale += moraleChange * scaledDeltaTime;
        segment.baseMorale = Math.max(0, Math.min(100, segment.baseMorale));
        if(Math.abs(oldMorale - segment.baseMorale) > 0.1) {
            // this.eventBus?.publish(PopulationEvent.POPULATION_MORALE_CHANGE, { hexCellId: segment.location.hexCellId, populationSegmentId: segment.id, newMorale: segment.baseMorale });
        }


        let unrestChange = 0;
        if (segment.baseMorale < 20) { // Very low morale
            unrestChange = this.UNREST_INCREASE_RATE * 2;
        } else if (segment.baseMorale < 40) { // Low morale
            unrestChange = this.UNREST_INCREASE_RATE;
        } else if (segment.baseMorale > 75) { // High morale
            unrestChange = -this.UNREST_DECREASE_RATE;
        }
        // TODO: Add effects from policies, faction stability, events on unrest

        const oldUnrest = segment.baseUnrest;
        segment.baseUnrest += unrestChange * scaledDeltaTime;
        segment.baseUnrest = Math.max(0, Math.min(100, segment.baseUnrest));
        if(Math.abs(oldUnrest - segment.baseUnrest) > 0.1) {
            // this.eventBus?.publish(PopulationEvent.POPULATION_UNREST_CHANGE, { hexCellId: segment.location.hexCellId, populationSegmentId: segment.id, newUnrest: segment.baseUnrest });
        }
    }
}
