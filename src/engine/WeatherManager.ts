// src/engine/WeatherManager.ts
import { GameState, HexTileProperties, IPhenomenon, PhenomenonManager } from './GameEngine';
import { HexGridManager, HexCell } from './HexGridManager';
import * as PhenomenonTypes from './phenomena/phenomenonTypes'; // If triggering weather phenomena

export class WeatherManager {
  private gameState: GameState;
  private hexGridManager: HexGridManager;
  private phenomenonManager?: PhenomenonManager; // Optional, if this manager triggers phenomena

  private timeSinceLastUpdate: number = 0;
  private weatherUpdateInterval: number = 3600; // Update weather every game hour (3600 seconds)

  constructor(
    gameState: GameState,
    hexGridManager: HexGridManager,
    phenomenonManager?: PhenomenonManager
  ) {
    this.gameState = gameState;
    this.hexGridManager = hexGridManager;
    this.phenomenonManager = phenomenonManager;
    this.timeSinceLastUpdate = 0;
  }

  public update(deltaTime: number): void {
    const scaledDeltaTime = deltaTime * this.gameState.speed;
    this.timeSinceLastUpdate += scaledDeltaTime;

    if (this.timeSinceLastUpdate >= this.weatherUpdateInterval) {
      this.hexGridManager.cells.forEach(cell => {
        if (cell.shProps) { // Ensure shProps exists
          this.updateHexWeather(cell);
        }
      });
      this.timeSinceLastUpdate = 0;
    }
  }

  private updateHexWeather(cell: HexCell): void {
    if (!cell.shProps) return; // Should be guaranteed by caller, but good practice

    // Simplified climate model based on latitude (cell.centerPointUnitSphere.y) and fertility
    // Latitude: y component of unit sphere vector (-1 at South Pole, 0 at Equator, 1 at North Pole)
    const latitudeEffect = 1 - Math.abs(cell.centerPointUnitSphere.y); // 1 at equator, 0 at poles

    // Base average temperature: warmer at equator, modified by fertility (e.g., lush areas might be cooler/more humid)
    const baseTemp = 10 + latitudeEffect * 20; // Ranges roughly from 10C (poles) to 30C (equator)
    const fertilityModifierTemp = (cell.shProps.fertility - 0.5) * -5; // Higher fertility slightly cools
    let averageTemperature = baseTemp + fertilityModifierTemp;

    // Base precipitation: more at equator, less with low fertility
    const basePrecip = 200 + latitudeEffect * 1000; // mm/year, e.g. 200 (poles) to 1200 (equator)
    const averagePrecipitation = basePrecip * (0.5 + cell.shProps.fertility); // Fertility scales it

    // Variances (can be fixed or also derived)
    const temperatureVariance = 5 + (1 - latitudeEffect) * 5; // More variance towards poles
    const precipitationVarianceFactor = 0.5; // How much precipitation can vary from hourly chance

    // Simulate temperature fluctuation
    const tempChange = (Math.random() * 2 - 1) * temperatureVariance;
    let newTemperature = averageTemperature + tempChange;
    newTemperature = parseFloat(Math.max(-50, Math.min(50, newTemperature)).toFixed(1));

    // Simulate precipitation
    let newPrecipitationRate = 0; // mm/hr
    // Convert annual average precipitation to an hourly chance factor
    const hourlyChanceOfRain = Math.min(0.5, (averagePrecipitation / (365 * 24)) * 2); // Scaled hourly chance

    if (Math.random() < hourlyChanceOfRain) {
      if (Math.random() < 0.3) { // 30% of rain events are heavier
        newPrecipitationRate = parseFloat((0.5 + Math.random() * 2.5 * precipitationVarianceFactor).toFixed(1)); // 0.5 - 1.75 mm/hr (example)
      } else { // 70% are lighter
        newPrecipitationRate = parseFloat((0.1 + Math.random() * 0.4 * precipitationVarianceFactor).toFixed(1)); // 0.1 - 0.3 mm/hr (example)
      }
    }
    newPrecipitationRate = Math.max(0, newPrecipitationRate);


    // Simulate wind speed
    const baseWind = 5 + latitudeEffect * 5; // Calmer near equator generally
    const windVariance = 10;
    let newWindSpeed = parseFloat(Math.max(0, baseWind + (Math.random() * 2 - 1) * windVariance).toFixed(1));

    // Determine weather description
    let weatherDescription = "Clear";
    if (newPrecipitationRate > 0) {
      if (newTemperature <= 0) {
        weatherDescription = newPrecipitationRate > 1.0 ? "Heavy Snow" : (newPrecipitationRate > 0 ? "Light Snow" : "Clear");
      } else {
        weatherDescription = newPrecipitationRate > 1.5 ? "Heavy Rain" : (newPrecipitationRate > 0 ? "Light Rain" : "Clear");
      }
    } else { // No precipitation
      if (newTemperature > 35) weatherDescription = "Very Hot";
      else if (newTemperature > 28) weatherDescription = "Hot";
      else if (newTemperature < 0) weatherDescription = "Freezing";
      else if (newTemperature < 10) weatherDescription = "Cool";
    }

    // Update HexTileProperties
    cell.shProps.currentTemperature = newTemperature;
    cell.shProps.currentPrecipitationRate = newPrecipitationRate;
    cell.shProps.currentWindSpeed = newWindSpeed;
    cell.shProps.weatherDescription = weatherDescription;

    // console.log(`Weather for ${cell.id}: ${weatherDescription}, ${newTemperatureC}°C, ${newPrecipitationRate}mm/hr`);

    // Optional: Trigger phenomena for severe weather events
    if (this.phenomenonManager) {
        // Example: Trigger a Drought phenomenon if no rain for a long time and high temps
        // This would require tracking rain history per cell, or simpler heuristic
        if (newPrecipitationRate === 0 && newTemperature > 30 && cell.shProps.fertility < 0.3) {
            // Check if a drought isn't already active on this cell
            const existingDrought = this.gameState.activePhenomena.find(p =>
                p.type === PhenomenonTypes.PHENOMENON_DROUGHT && (p.parameters as any)?.targetHexId === cell.id && p.isActive
            );
            if (!existingDrought && Math.random() < 0.01) { // Low chance each qualifying update
                const droughtId = `drought_${cell.id}_${this.gameState.time.toFixed(0)}`;
                const droughtDuration = (30 * 24 * 3600) * this.gameState.speed; // 30 game days
                const droughtPhenomenon = PhenomenonTypes.createDroughtPhenomenon(droughtId, cell.id, droughtDuration);
                this.phenomenonManager.activatePhenomenon(droughtPhenomenon);
                console.log(`Triggering Drought on ${cell.id}`);
            }
        }
        // TODO: Add triggers for other severe phenomena like storms, blizzards, heatwaves
    }
  }
}
