import { BaseComponent, IComponent } from './BaseComponent';
import type { GameState, PopulationStats } from '../GameEngine'; // Assuming PopulationStats is in GameEngine

export interface IPopulationComponent extends IComponent {
  stats: PopulationStats;
  // Add any methods specific to population interaction if needed
}

export class PopulationComponent extends BaseComponent implements IPopulationComponent {
  public readonly type = 'PopulationComponent';
  public stats: PopulationStats;

  // Growth rate is defined as a daily rate.
  // The update method will scale it by deltaTime (assumed to be in seconds).
import type { IResourceStorageComponent } from "./ResourceStorageComponent"; // For checking food

  private static readonly DEFAULT_DAILY_GROWTH_RATE = 0.0001; // e.g., 0.01% daily growth
  private static readonly SECONDS_PER_DAY = 86400; // 24 * 60 * 60

  private lowMoraleDuration: number = 0; // Tracks duration of low morale in game seconds

  constructor(
    initialPopulation: number,
    initialMorale: number = 70,
    initialHealthScore: number = 75,
    initialUnrest: number = 0, // Default unrest
    dailyGrowthRateInput?: number
  ) {
    super();
    const actualDailyGrowthRate = dailyGrowthRateInput !== undefined ? dailyGrowthRateInput : PopulationComponent.DEFAULT_DAILY_GROWTH_RATE;
    this.stats = {
      total: initialPopulation,
      growthRate: actualDailyGrowthRate,
      morale: initialMorale,
      healthScore: initialHealthScore,
      unrest: initialUnrest,
    };
  }

  public update(gameState: GameState, deltaTime: number): void {
    const parentEntity = gameState.entities.get(this.entityId);
    if (!parentEntity) return;
    const gameSpeedAdjustedDeltaTime = deltaTime * gameState.speed;

    // 1. Update Health Score
    // Health is affected by food availability.
    // This is a simplified model. Needs extension for housing, pollution, disease etc.
    let foodModifier = 0;
    if (parentEntity.entityType === 'CityEntity') {
        const storage = parentEntity.getComponent<IResourceStorageComponent>('ResourceStorageComponent');
        if (storage) {
            const foodAmount = storage.getResourceAmount('food');
            const foodConsumptionRate = this.stats.total * 0.005 * (deltaTime * gameState.speed / PopulationComponent.SECONDS_PER_DAY); // daily consumption per capita

            if (foodAmount >= foodConsumptionRate * 30) { // Ample food (e.g. >30 days supply)
                foodModifier = 0.1;
            } else if (foodAmount < foodConsumptionRate * 7 && foodAmount > 0) { // Low food (<7 days supply)
                foodModifier = -0.2;
            } else if (foodAmount === 0 && this.stats.total > 0) { // No food
                foodModifier = -0.5;
            }
             // Simulate food consumption by the population (basic)
            // storage.removeResource('food', foodConsumptionRate * this.stats.total); // this needs to be thought out, consumption is tricky.
            // Let's assume consumption is handled by demand calculation in EconomyManager or a dedicated NeedsManager.
            // For now, health reacts to available stock.
        } else {
            foodModifier = -0.1; // No storage implies no food
        }
    }
    this.stats.healthScore += foodModifier * gameSpeedAdjustedDeltaTime; // Slow change
    this.stats.healthScore = Math.max(0, Math.min(100, this.stats.healthScore));

    // 2. Update Morale based on health and other factors
    const healthEffectOnMorale = (this.stats.healthScore - 50) / 500;
    this.stats.morale += healthEffectOnMorale * gameSpeedAdjustedDeltaTime;
    // Unrest also affects morale negatively
    this.stats.morale -= (this.stats.unrest / 1000) * gameSpeedAdjustedDeltaTime; // Max -0.1 change from unrest
    this.stats.morale = Math.max(0, Math.min(100, this.stats.morale));

    // 3. Update Unrest based on morale
    const lowMoraleThreshold = 30;
    const highMoraleThreshold = 70;
    const unrestChangeRate = 0.05; // Rate at which unrest changes per second of gameSpeedAdjustedDeltaTime

    if (this.stats.morale < lowMoraleThreshold) {
        this.lowMoraleDuration += gameSpeedAdjustedDeltaTime;
        if (this.lowMoraleDuration > PopulationComponent.SECONDS_PER_DAY * 3) { // If morale low for >3 days
            this.stats.unrest += unrestChangeRate * gameSpeedAdjustedDeltaTime;
        }
    } else {
        this.lowMoraleDuration = 0; // Reset duration if morale recovers
        if (this.stats.morale > highMoraleThreshold) {
            this.stats.unrest -= unrestChangeRate * gameSpeedAdjustedDeltaTime * 0.5; // Unrest decreases slower
        }
    }
    this.stats.unrest = Math.max(0, Math.min(100, this.stats.unrest));

    // 4. Update Population Total based on growth rate, which is affected by health and morale (and unrest indirectly via morale)
    const basePerSecondGrowthRate = this.stats.growthRate / PopulationComponent.SECONDS_PER_DAY;

    // Health impact: perfect health = 1.2x growth, 0 health = 0.1x growth (or negative)
    const healthMultiplier = 0.1 + (this.stats.healthScore / 100) * 1.1;
    // Morale impact: perfect morale = 1.2x growth, 0 morale = 0.5x growth
    const moraleMultiplier = 0.5 + (this.stats.morale / 100) * 0.7;

    const finalPerSecondGrowthRate = basePerSecondGrowthRate * healthMultiplier * moraleMultiplier;

    const effectiveGrowth = this.stats.total * finalPerSecondGrowthRate * deltaTime * gameState.speed;
    this.stats.total += effectiveGrowth;

    if (this.stats.total < 0) this.stats.total = 0; // Population cannot be negative
    if (this.stats.total < 1 && this.stats.total > 0) this.stats.total = 0; // Effectively kill city if pop drops too low

    // if (parentEntity.id === 'city_01' && Math.random() < 0.01) { // Debug log for a specific city occasionally
    //     console.log(`City ${parentEntity.id}: Pop=${this.stats.total.toFixed(0)}, Morale=${this.stats.morale.toFixed(1)}, Health=${this.stats.healthScore.toFixed(1)}, Growth/s=${(effectiveGrowth/(deltaTime * gameState.speed)).toExponential(2)}`);
    // }
  }

  public getPopulation(): number {
    return Math.floor(this.stats.total); // Return whole numbers for population
  }

  public setMorale(newMorale: number): void {
    this.stats.morale = Math.max(0, Math.min(100, newMorale));
  }
}
