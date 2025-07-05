// src/engine/WeatherManager.ts
import type { GameState, Biome, WeatherCondition } from './GameEngine';

export class WeatherManager {
  private gameState: GameState;
  private timeSinceLastUpdate: number = 0;
  private weatherUpdateInterval: number = 3600; // Update weather every hour (in game seconds)

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  public update(deltaTime: number): void {
    this.timeSinceLastUpdate += deltaTime * this.gameState.speed;

    if (this.timeSinceLastUpdate >= this.weatherUpdateInterval) {
      this.gameState.biomes.forEach(biome => {
        this.updateBiomeWeather(biome);
      });
      this.timeSinceLastUpdate = 0;
    }
  }

  private updateBiomeWeather(biome: Biome): void {
    const { averageTemperature, temperatureVariance, averagePrecipitation, precipitationVariance } = biome.climateProfile;

    // Simulate temperature fluctuation
    const tempChange = (Math.random() * 2 - 1) * temperatureVariance;
    let newTemperature = averageTemperature + tempChange; // Simplified: should be more complex (e.g. seasonal)

    // Simulate precipitation fluctuation
    let newPrecipitation = 0;
    let weatherDescription = "Clear"; // Default to clear, will be overridden by precipitation or temp extremes

    // Simplified precipitation model based on biome's general wetness
    const baseWetness = Math.min(1, averagePrecipitation / 1500); // Normalize annual precip to a 0-1 "wetness" factor (1500mm = very wet)
    const hourlyRainChance = 0.05 + baseWetness * 0.15; // Base 5% + up to 15% based on wetness = max 20% chance of some rain per hour

    if (Math.random() < hourlyRainChance) {
      if (Math.random() < 0.3) { // 30% of rain events are heavier
        newPrecipitation = parseFloat((1.5 + Math.random() * 3.5).toFixed(1)); // 1.5 - 5.0 mm/hr
        // Description will be set based on temp + precip later
      } else { // 70% are lighter
        newPrecipitation = parseFloat((0.1 + Math.random() * 1.4).toFixed(1)); // 0.1 - 1.5 mm/hr
      }
    }

    // Clamp temperature to realistic bounds (e.g., -50 to 50 C)
    newTemperature = Math.max(-50, Math.min(50, newTemperature));

    // Simulate wind speed (simple random fluctuation around a base)
    const baseWindSpeed = 5; // km/h
    const windVariance = 10; // km/h
    const newWindSpeed = Math.max(0, baseWindSpeed + (Math.random() * 2 - 1) * windVariance);

    // Determine description based on temperature and precipitation
    if (newPrecipitation > 0) {
        if (newTemperature <= 0) {
            weatherDescription = newPrecipitation > 1 ? "Heavy Snow" : "Light Snow";
        } else {
            weatherDescription = newPrecipitation > 2 ? "Heavy Rain" : "Light Rain";
        }
    } else { // No precipitation
        // Check for drought conditions - simplified: prolonged low precipitation and high temp
        // This is a simplistic model for drought. A better one would track precipitation over time.
        // For now, if averagePrecipitation is low and it's not raining, and temp is high, might be "Dry" or "Drought"
        if (averagePrecipitation < 400 && newTemperature > 28) { // Example: low annual rainfall and hot
            weatherDescription = "Drought"; // Can be triggered by weather now
        } else if (newTemperature > 30) {
            weatherDescription = "Hot";
        } else if (newTemperature > 25 && newWindSpeed < 5) {
            weatherDescription = "Hot and Calm";
        } else if (newTemperature > 20) {
            weatherDescription = "Warm";
        } else if (newTemperature < 5 && newTemperature > 0) {
            weatherDescription = "Cool";
        } else if (newTemperature <= 0) {
            weatherDescription = "Freezing";
        } else {
            weatherDescription = "Clear";
        }
    }


    biome.currentWeather = {
      temperature: parseFloat(newTemperature.toFixed(1)),
      precipitation: parseFloat(newPrecipitation.toFixed(1)),
      windSpeed: parseFloat(newWindSpeed.toFixed(1)),
      description: weatherDescription,
    };

    // console.log(`Weather updated for ${biome.name}: ${biome.currentWeather.description}, Temp: ${biome.currentWeather.temperature}°C`);
  }

  // getWeatherDescription is not strictly needed if logic is in updateBiomeWeather, but can be kept for utility
  // private getWeatherDescription(temperature: number, precipitation: number, windSpeed: number): string {
  //   if (precipitation > 2.5) {
  //     return temperature <= 0 ? "Heavy Snow" : "Heavy Rain";
  //   } else if (precipitation > 0) {
  //     return temperature <= 0 ? "Light Snow" : "Light Rain";
  //   } else if (temperature > 30) { // Assuming "Drought" is handled by more complex logic
  //     return "Hot";
  //   } else if (temperature < 0) {
  //     return "Freezing";
  //   } else if (windSpeed > 30) {
  //     return "Windy";
  //   }
  //   return "Clear";
  // }
}
