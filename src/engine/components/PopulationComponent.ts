import { BaseComponent, IComponent } from './BaseComponent';
// import type { GameState, PopulationSegment } from '../GameEngine'; // Problematic import, PopulationSegment not found there
import type { GameState } from '../GameEngine'; // Keep GameState import
import type { IResourceStorageComponent } from "./ResourceStorageComponent";

// Define PopulationSegment here as it's not found elsewhere
// This is a placeholder structure based on usage in this file.
export interface PopulationSegment {
  id: string; // Unique ID for this segment (e.g., 'human_adults', 'robots')
  name: string; // Display name (e.g., "Human Adults", "Worker Drones")
  totalPopulation: number;
  growthRate: number; // Base growth rate (e.g., per year, per day - component converts to per second)
  baseMorale: number; // 0-100
  healthScore: number; // 0-100
  baseUnrest: number; // 0-100, affects morale and events
  // Define needs as a map where key is resourceId/needId and value is details about the need
  needs: Map<string, {
    // perCapitaNeed: number; // Amount of resource needed per individual per unit of time
    // priority: number; // How critical this need is
    currentFulfillment: number; // 0-1, how well this need is currently being met
  }>;
  // Other segment-specific properties like age distribution, skills, etc. could be added
}


export interface IPopulationComponent extends IComponent {
  segments: Map<string, PopulationSegment>;
  addSegment(segment: PopulationSegment): void;
  getSegment(segmentId: string): PopulationSegment | undefined;
  getTotalPopulation(): number;
}

export class PopulationComponent extends BaseComponent implements IPopulationComponent {
  public readonly type = 'PopulationComponent';
  // public stats: PopulationStats; // Old
  public segments: Map<string, PopulationSegment> = new Map();

  private static readonly DEFAULT_DAILY_GROWTH_RATE = 0.0001;
  private static readonly SECONDS_PER_DAY = 86400;

  // Constructor might change to accept initial segments or a factory for segments
  constructor(initialSegments?: PopulationSegment[]) {
    super();
    if (initialSegments) {
      initialSegments.forEach(seg => this.addSegment(seg));
    }
  }

  public addSegment(segment: PopulationSegment): void {
    this.segments.set(segment.id, segment);
  }

  public getSegment(segmentId: string): PopulationSegment | undefined {
    return this.segments.get(segmentId);
  }

  public getTotalPopulation(): number {
    let total = 0;
    this.segments.forEach(seg => total += seg.totalPopulation);
    return Math.floor(total);
  }

  public update(gameState: Readonly<GameState>, deltaTime: number): void {
    const parentEntity = gameState.entities.get(this.entityId);
    if (!parentEntity) return;
    const gameSpeedAdjustedDeltaTime = deltaTime * gameState.gameSpeedMultiplier;

    this.segments.forEach(segment => {
      // Simplified update logic for each segment
      // 1. Update Health Score (example logic, needs to be more robust using segment.needs)
      let foodModifier = 0;
      const foodNeed = segment.needs.get('food'); // Assuming 'food' is a ResourceId and a needId
      if (foodNeed) {
        if (foodNeed.currentFulfillment > 0.8) foodModifier = 0.1;
        else if (foodNeed.currentFulfillment < 0.2) foodModifier = -0.5;
        else foodModifier = -0.1; // Moderate lack
      } else {
        foodModifier = -0.05; // No defined food need, slight penalty or neutral
      }
      segment.healthScore += foodModifier * gameSpeedAdjustedDeltaTime;
      segment.healthScore = Math.max(0, Math.min(100, segment.healthScore));

      // 2. Update Morale
      const healthEffectOnMorale = (segment.healthScore - 50) / 500;
      segment.baseMorale += healthEffectOnMorale * gameSpeedAdjustedDeltaTime;
      segment.baseMorale -= (segment.baseUnrest / 1000) * gameSpeedAdjustedDeltaTime;
      segment.baseMorale = Math.max(0, Math.min(100, segment.baseMorale));

      // 3. Update Unrest (simplified)
      if (segment.baseMorale < 30) segment.baseUnrest += 0.05 * gameSpeedAdjustedDeltaTime;
      else if (segment.baseMorale > 70) segment.baseUnrest -= 0.025 * gameSpeedAdjustedDeltaTime;
      segment.baseUnrest = Math.max(0, Math.min(100, segment.baseUnrest));

      // 4. Update Population Total
      const healthMultiplier = 0.1 + (segment.healthScore / 100) * 1.1;
      const moraleMultiplier = 0.5 + (segment.baseMorale / 100) * 0.7;
      // segment.growthRate is per segment, could be based on age demographics etc.
      const segmentGrowthRatePerSecond = (segment.growthRate || PopulationComponent.DEFAULT_DAILY_GROWTH_RATE) / PopulationComponent.SECONDS_PER_DAY;

      const finalPerSecondGrowthRate = segmentGrowthRatePerSecond * healthMultiplier * moraleMultiplier;
      const effectiveGrowth = segment.totalPopulation * finalPerSecondGrowthRate * gameSpeedAdjustedDeltaTime;
      segment.totalPopulation += effectiveGrowth;

      if (segment.totalPopulation < 1 && segment.totalPopulation > 0) segment.totalPopulation = 0;
      else if (segment.totalPopulation < 0) segment.totalPopulation = 0;
    });
  }
}
