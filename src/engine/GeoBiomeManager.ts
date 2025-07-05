import type { GameState, HexCellData, ResourceId, BiomeId } from './GameEngine';
import type { EventBus } from './EventBus';

export class GeoBiomeManager {
    private gameState: Readonly<GameState>;
    private eventBus?: EventBus;

    // Constants for resource regeneration, etc.
    private readonly TICKS_PER_REGENERATION_CYCLE = 100 * 60; // e.g., every game minute (assuming 100 ticks/sec)
    private timeSinceLastRegenCycle: number = 0;

    constructor(gameState: Readonly<GameState>, eventBus?: EventBus) {
        this.gameState = gameState;
        this.eventBus = eventBus;
    }

    public update(deltaTime: number): void { // deltaTime is raw seconds
        const scaledDeltaTime = deltaTime * this.gameState.gameSpeedMultiplier;
        // Assuming gameTimeTicks is updated elsewhere at approx 100 ticks per second of gameSpeedMultiplier=1
        const deltaTicks = scaledDeltaTime * 100;

        this.timeSinceLastRegenCycle += deltaTicks;

        let runRegenCycle = false;
        if (this.timeSinceLastRegenCycle >= this.TICKS_PER_REGENERATION_CYCLE) {
            runRegenCycle = true;
            this.timeSinceLastRegenCycle -= this.TICKS_PER_REGENERATION_CYCLE;
        }

        for (const hexCell of this.gameState.hexGrid.values()) {
            if (runRegenCycle) {
                this.regenerateResources(hexCell);
            }
            this.applyWeatherEffects(hexCell, scaledDeltaTime);
            this.updateClimate(hexCell, scaledDeltaTime); // Placeholder for dynamic climate
            this.updatePollutionEffects(hexCell, scaledDeltaTime); // Placeholder for pollution
        }
    }

    private regenerateResources(hexCell: HexCellData): void {
        const biome = this.gameState.biomes.get(hexCell.biomeId);
        if (!biome) return;

        biome.baseNaturalResources.forEach(biomeResource => {
            const resourceData = hexCell.availableResources.get(biomeResource.resourceId);
            if (resourceData) {
                const regenerationRate = biomeResource.regenerationRate; // Units per tick (or per cycle)
                const modifier = resourceData.regenerationRateModifier || 1.0;
                const maxAmount = biomeResource.abundance * 1000; // Assuming abundance 0-1, max is 1000 units

                // Assuming regenerationRate is per TICKS_PER_REGENERATION_CYCLE
                const amountToRegen = regenerationRate * modifier;

                if (resourceData.currentAmount < maxAmount) {
                    resourceData.currentAmount = Math.min(maxAmount, resourceData.currentAmount + amountToRegen);
                    // console.log(`Hex ${hexCell.id} resource ${biomeResource.resourceId} regenerated to ${resourceData.currentAmount}`);
                }
            } else {
                // If resource isn't in hexCell.availableResources, but biome says it should be, maybe initialize it?
                // This can happen if new resources are added to a biome definition later.
                // For now, we only regenerate what's already there.
            }
        });
    }

    private applyWeatherEffects(hexCell: HexCellData, scaledDeltaTime: number): void {
        if (!hexCell.currentWeather) return;

        const biome = this.gameState.biomes.get(hexCell.biomeId);
        if (!biome) return;

        // Example: Rain replenishes surface water resource
        if (hexCell.currentWeather.precipitationType === 'rain' && hexCell.currentWeather.precipitationAmount > 0.5) { // Threshold for significant rain
            const waterResource = hexCell.availableResources.get('water' as ResourceId);
            if (waterResource) {
                const waterReplenishRate = 0.1; // Units per mm of rain per second (example)
                const maxWater = biome.baseNaturalResources.find(r => r.resourceId === 'water')?.abundance * 1000 || 0;
                waterResource.currentAmount = Math.min(maxWater, waterResource.currentAmount + hexCell.currentWeather.precipitationAmount * waterReplenishRate * scaledDeltaTime);
            }
        }

        // Example: Extreme temperatures affect food growth (modifier)
        const foodResourceData = hexCell.availableResources.get('food' as ResourceId);
        if (foodResourceData) {
            let tempModifier = 1.0;
            const idealTempForFood = biome.baseClimateProfile.averageTemperature; // Simplification
            const tempDiff = Math.abs(hexCell.currentWeather.temperature - idealTempForFood);
            if (tempDiff > 15) tempModifier = 0.5; // Significantly off ideal temp
            else if (tempDiff > 10) tempModifier = 0.75;

            // Apply this modifier to food's regenerationRateModifier if it's not too different from existing
            // This prevents wild swings if other systems also modify it.
            // A more robust system would have effects stack or be prioritized.
            if (Math.abs((foodResourceData.regenerationRateModifier || 1.0) - tempModifier) > 0.1) {
                 foodResourceData.regenerationRateModifier = tempModifier;
            }
        }
    }

    private updateClimate(hexCell: HexCellData, scaledDeltaTime: number): void {
        // Placeholder for long-term climate change effects on hexCell.currentClimate
        // For now, currentClimate is mostly static copy of biome's base.
        // Could slowly drift based on global pollution, tech, or large-scale events.
    }

    private updatePollutionEffects(hexCell: HexCellData, scaledDeltaTime: number): void {
        // Placeholder for effects of hexCell.pollutionLevel
        // e.g., reduce resource regeneration, impact population health (via events)
        if (hexCell.pollutionLevel > 50) {
            const foodResourceData = hexCell.availableResources.get('food' as ResourceId);
            if (foodResourceData) {
                foodResourceData.regenerationRateModifier = (foodResourceData.regenerationRateModifier || 1.0) * 0.95; // 5% reduction
            }
        }
    }
}
