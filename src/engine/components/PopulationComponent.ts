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
  private static readonly DEFAULT_DAILY_GROWTH_RATE = 0.0001; // e.g., 0.01% daily growth
  private static readonly SECONDS_PER_DAY = 86400; // 24 * 60 * 60

  constructor(initialPopulation: number, initialMorale: number = 70, dailyGrowthRateInput?: number) {
    super();
    // Store the raw daily growth rate. The update function will handle scaling.
    const actualDailyGrowthRate = dailyGrowthRateInput !== undefined ? dailyGrowthRateInput : PopulationComponent.DEFAULT_DAILY_GROWTH_RATE;
    this.stats = {
      total: initialPopulation,
      growthRate: actualDailyGrowthRate, // This now stores the daily rate
      morale: initialMorale,
    };
  }

  public update(gameState: GameState, deltaTime: number): void {
    // deltaTime is assumed to be in seconds (from GameEngine.updateWorld)
    // Convert daily growth rate to per-second rate for this update tick
    const perSecondGrowthRate = this.stats.growthRate / PopulationComponent.SECONDS_PER_DAY;

    // Calculate growth for this frame
    // gameState.speed is a multiplier for how fast game time progresses
    const effectiveGrowth = this.stats.total * perSecondGrowthRate * deltaTime * gameState.speed;
    this.stats.total += effectiveGrowth;

    if (this.stats.total < 0) this.stats.total = 0;

    // Morale could be affected by various factors from gameState (events, resource availability etc.)
    // For now, it's static unless changed externally.
    // Example: this.stats.morale -= 0.01 * deltaTime; // Slow morale decay if not supported
  }

  public getPopulation(): number {
    return Math.floor(this.stats.total); // Return whole numbers for population
  }

  public setMorale(newMorale: number): void {
    this.stats.morale = Math.max(0, Math.min(100, newMorale));
  }
}
