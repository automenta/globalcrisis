import { GameState, IPhenomenon, PhenomenonManager } from './GameEngine'; // Corrected GameState and added IPhenomenon, PhenomenonManager
import { HexGridManager, HexCell } from './HexGridManager';
import { SoundManager } from './SoundManager';
import * as PhenomenonTypes from './phenomena/phenomenonTypes'; // For creating phenomena

// Define specific disaster types locally for triggering logic if needed,
// actual phenomenon types are in phenomenonTypes.ts
enum LocalDisasterTriggerType { Earthquake, Wildfire } // Flood, Storm, Drought can be added

export class DisasterManager {
  private gameState: GameState;
  private hexGridManager: HexGridManager;
  private soundManager: SoundManager;
  private phenomenonManager: PhenomenonManager;

  private timeSinceLastCheck: number = 0; // Game time in seconds
  private disasterCheckInterval: number = 600; // Approx 10 game minutes (600 seconds)
  private nextDisasterId: number = 0;

  constructor(
    gameState: GameState,
    hexGridManager: HexGridManager,
    soundManager: SoundManager,
    phenomenonManager: PhenomenonManager
  ) {
    this.gameState = gameState;
    this.hexGridManager = hexGridManager;
    this.soundManager = soundManager;
    this.phenomenonManager = phenomenonManager;
    this.timeSinceLastCheck = 0;
    this.nextDisasterId = 0;
  }

  public update(deltaTime: number): void { // deltaTime is raw seconds from main loop
    const scaledDeltaTime = deltaTime * this.gameState.speed;
    this.timeSinceLastCheck += scaledDeltaTime;

    if (this.timeSinceLastCheck >= this.disasterCheckInterval) {
      this.triggerRandomDisaster();
      this.timeSinceLastCheck = 0; // Reset counter
    }
    // updateActiveDisasters is removed, as phenomena are managed by PhenomenonManager
  }

  private triggerRandomDisaster(): void {
    // Base chance to trigger any disaster in an interval
    if (Math.random() > 0.1) return; // e.g., 10% chance every check interval

    const availableDisasterTypes = Object.values(LocalDisasterTriggerType).filter(v => !isNaN(Number(v))) as LocalDisasterTriggerType[];
    if (availableDisasterTypes.length === 0) return;

    const randomType = availableDisasterTypes[Math.floor(Math.random() * availableDisasterTypes.length)];

    const allCellIds = Array.from(this.hexGridManager.cells.keys());
    if (allCellIds.length === 0) return;

    // Select a random cell for the disaster's origin
    const targetHexId = allCellIds[Math.floor(Math.random() * allCellIds.length)];
    const targetHex = this.hexGridManager.getCellById(targetHexId);

    if (!targetHex || !targetHex.shProps) return; // Cell or its properties not found

    let newDisasterPhenomenon: IPhenomenon | null = null;
    const disasterIdStr = `disaster_${this.nextDisasterId++}`;

    // Parameters common to many disasters
    const duration = (60 + Math.random() * 120) * this.gameState.speed; // 1-3 game minutes, adjusted by game speed

    switch (randomType) {
      case LocalDisasterTriggerType.Earthquake:
        // Earthquakes might be less dependent on shProps for triggering, but effects depend on infrastructure
        const earthquakeIntensity = Math.random() * 0.5 + 0.5; // Normalized intensity 0.5-1.0
        newDisasterPhenomenon = PhenomenonTypes.createEarthquakePhenomenon(
          disasterIdStr,
          targetHexId,
          earthquakeIntensity,
          duration
        );
        this.soundManager.playSoundEffect('placeholder_earthquake_alert'); // Ensure this key exists
        console.log(`Triggering Earthquake ${disasterIdStr} at ${targetHexId}`);
        break;

      case LocalDisasterTriggerType.Wildfire:
        // Wildfires are more likely in areas with low fertility (less moisture) or specific vegetation props (if added)
        // and high temperature (if weather system provides it to shProps)
        const currentTemp = targetHex.shProps.currentTemperature ?? 15; // Assume 15C if not set
        const fertility = targetHex.shProps.fertility ?? 0.5;

        if (fertility < 0.4 || currentTemp > 28) { // Higher chance if dry or hot
            if (Math.random() < 0.3) { // 30% chance if conditions met
                const wildfireIntensity = Math.random() * 0.4 + 0.2; // Normalized intensity 0.2-0.6
                const wildfireDuration = (300 + Math.random() * 600) * this.gameState.speed; // 5-15 game minutes
                newDisasterPhenomenon = PhenomenonTypes.createWildfirePhenomenon(
                    disasterIdStr,
                    targetHexId,
                    wildfireIntensity,
                    wildfireDuration
                );
                // this.soundManager.playSoundEffect('placeholder_wildfire_alert'); // Add sound effect
                console.log(`Triggering Wildfire ${disasterIdStr} at ${targetHexId}`);
            }
        }
        break;
        // Add cases for Flood, Storm, Drought etc.
        // Drought might be a longer phenomenon triggered by WeatherManager or here based on prolonged conditions
    }

    if (newDisasterPhenomenon) {
      this.phenomenonManager.activatePhenomenon(newDisasterPhenomenon);
    }
    // applyDisasterEffects and applyEffectsToEntity are removed.
    // Effects are handled by GameEngine.handlePhenomenonUpdate based on the phenomenon type.
  }
}
