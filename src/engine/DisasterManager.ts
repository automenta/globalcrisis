import type { GameState, NaturalDisaster, NaturalDisasterEffect, BiomeId, Location, PhysicsLayer, HexCellId, ResourceId, DisasterSeverity } from './GameEngine';
import type { IEntity } from './entities/BaseEntity';
import type { IHealthComponent } from './components/HealthComponent';
import type { IPopulationComponent } from './components/PopulationComponent';
import type { SoundManager } from './SoundManager';
import type { EventBus } from './EventBus'; // Assuming EventBus might be used later

// Example: Define specific disaster types if not already in GameEngine.ts or for local use
enum LocalDisasterType { Earthquake, Storm, Drought, Flood, Wildfire }


export class DisasterManager {
  private gameState: Readonly<GameState>; // GameState should be Readonly
  private soundManager: SoundManager;
  private eventBus?: EventBus;
  private timeSinceLastCheckTicks: number = 0;
  private disasterCheckIntervalTicks: number = 60 * 10 * 100; // Approx 10 game minutes (at 100 ticks/sec ideal)
  private nextDisasterId: number = 0;

  constructor(gameState: Readonly<GameState>, soundManager: SoundManager, eventBus?: EventBus) {
    this.gameState = gameState;
    this.soundManager = soundManager;
    this.eventBus = eventBus;
    // Initialize nextDisasterCheck based on current game time ticks if needed, or start with interval
    this.timeSinceLastCheckTicks = 0; // Or this.gameState.gameTimeTicks to start check relative to game start
  }

  public update(deltaTime: number): void { // deltaTime is raw seconds from main loop
    const scaledDeltaTicks = deltaTime * this.gameState.gameSpeedMultiplier * 100; // Approx ticks this frame
    this.timeSinceLastCheckTicks += scaledDeltaTicks;

    if (this.timeSinceLastCheckTicks >= this.disasterCheckIntervalTicks) {
      this.triggerRandomDisaster();
      this.timeSinceLastCheckTicks = 0; // Reset counter
    }
    this.updateActiveDisasters(scaledDeltaTicks);
  }

  private triggerRandomDisaster(): void {
    if (Math.random() > 0.05) return;

    const availableDisasterTypes = Object.values(LocalDisasterType).filter(v => !isNaN(Number(v))) as LocalDisasterType[];
    if (availableDisasterTypes.length === 0) return;
    const randomType = availableDisasterTypes[Math.floor(Math.random() * availableDisasterTypes.length)];

    const hexCellIds = Array.from(this.gameState.hexGrid.keys());
    if (hexCellIds.length === 0) return;
    const targetHexId = hexCellIds[Math.floor(Math.random() * hexCellIds.length)];
    const targetHexData = this.gameState.hexGrid.get(targetHexId);
    if (!targetHexData) return;

    const disasterLocation: Location = {
        layer: PhysicsLayer.Surface,
        coordinates: { x: 0, y: 0 }, // Placeholder, ideally get from hexGridManager or targetHexData visual center
        hexCellId: targetHexId,
        biomeId: targetHexData.biomeId,
    };

    let newDisaster: NaturalDisaster | null = null;
    const disasterId = `disaster_${this.nextDisasterId++}`;
    const startTimeTicks = this.gameState.gameTimeTicks;
    const randomDurationSeconds = (min: number, max: number) => (Math.random() * (max - min) + min);
    const secondsToTicks = (seconds: number) => Math.floor(seconds * 100); // Approx conversion

    switch (randomType) {
      case LocalDisasterType.Earthquake:
        newDisaster = {
          id: disasterId, name: "Earthquake", disasterType: "Earthquake",
          location: disasterLocation, radiusKm: (Math.random() * 20 + 10), // 10-30km radius
          startTime: startTimeTicks, durationTicks: secondsToTicks(randomDurationSeconds(1*60, 3*60)), // 1-3 game minutes
          effects: [{ type: 'damage_entities_in_area', magnitude: Math.random() * 50 + 25 }], // 25-75 damage
          isActive: true, description: `An earthquake strikes hex ${targetHexData.name}!`,
          severity: DisasterSeverity.Moderate,
        };
        this.soundManager.playSoundEffect('disaster_alert_earthquake');
        break;
      case LocalDisasterType.Wildfire:
        const biome = this.gameState.biomes.get(targetHexData.biomeId);
        if (!biome || biome.baseClimateProfile.averagePrecipitation > 1000 || biome.baseClimateProfile.averageTemperature < 10) break; // Less likely in wet/cold
        newDisaster = {
          id: disasterId, name: "Wildfire", disasterType: "Wildfire",
          location: disasterLocation, radiusKm: (Math.random() * 10 + 5),
          startTime: startTimeTicks, durationTicks: secondsToTicks(randomDurationSeconds(2*60*60, 6*60*60)), // 2-6 game hours
          effects: [
            { type: 'damage_entities_in_area', magnitude: Math.random() * 30 + 20 },
            { type: 'modify_biome_resources', resourceId: 'wood' as ResourceId, magnitude: -500 } // Example: -500 wood
          ],
          isActive: true, description: `A wildfire rages in hex ${targetHexData.name}!`,
          severity: DisasterSeverity.Major,
        };
        this.soundManager.playSoundEffect('disaster_alert_wildfire');
        break;
    }

    if (newDisaster) {
      this.gameState.activeDisasters.push(newDisaster);
      // this.eventBus?.publish(DisasterEvent.DISASTER_STARTED, newDisaster);
      this.applyDisasterEffects(newDisaster, 0); // Apply immediate effects
    }
  }

  private updateActiveDisasters(scaledDeltaTicks: number): void {
    this.gameState.activeDisasters.forEach(disaster => {
      if (!disaster.isActive) return;
      if (this.gameState.gameTimeTicks >= disaster.startTime + disaster.durationTicks) {
        disaster.isActive = false;
        // this.eventBus?.publish(DisasterEvent.DISASTER_ENDED, { disasterId: disaster.id });
        return;
      }
    });
    this.gameState.activeDisasters = this.gameState.activeDisasters.filter(d => d.isActive);
  }

  private applyDisasterEffects(disaster: NaturalDisaster, deltaTimeSeconds: number): void {
    // Iterate entities within disaster.radiusKm of disaster.location
    // This requires a spatial query on entities using their hexCellId or coordinates.
    // For now, apply to all entities in the disaster's primary hexCellId for simplicity.
    this.gameState.entities.forEach(entity => {
      if (entity.location.hexCellId === disaster.location.hexCellId) {
        this.applyEffectsToEntity(entity, disaster, deltaTimeSeconds);
      }
    });
    // Also apply effects to HexCellData if applicable
    const targetHex = this.gameState.hexGrid.get(disaster.location.hexCellId!);
    if(targetHex) {
        disaster.effects.forEach(effect => {
            if (effect.type === 'modify_biome_resources' && effect.resourceId && deltaTimeSeconds === 0) { // One-shot
                const resData = targetHex.availableResources.get(effect.resourceId);
                if (resData) {
                    resData.currentAmount = Math.max(0, resData.currentAmount + effect.magnitude);
                    console.log(`Resource ${effect.resourceId} in hex ${targetHex.id} changed by ${effect.magnitude} due to ${disaster.name}`);
                }
            }
        });
    }
  }

  private applyEffectsToEntity(entity: IEntity, disaster: NaturalDisaster, deltaTimeSeconds: number) {
    disaster.effects.forEach(effect => {
        if (effect.affectedEntityType && entity.entityType !== effect.affectedEntityType) return;
        switch (effect.type) {
          case 'damage_entities_in_area':
            if (deltaTimeSeconds === 0) { // One-shot damage
              const healthComp = entity.getComponent<IHealthComponent>('HealthComponent');
              if (healthComp) {
                healthComp.takeDamage(effect.magnitude);
              }
            }
            break;
          case 'reduce_population_in_area':
            if (deltaTimeSeconds === 0 && entity.entityType === 'CityEntity') {
              const popComp = entity.getComponent<IPopulationComponent>('PopulationComponent');
              if (popComp) {
                // This part needs to be updated to work with PopulationSegments
                // For now, assuming a simplified single population stat for the city if available
                // const currentPop = popComp.getTotalPopulation ? popComp.getTotalPopulation() : (popComp as any).stats?.total || 0;
                // const reduction = Math.floor(currentPop * effect.magnitude);
                // (popComp as any).stats.total = Math.max(0, currentPop - reduction); // Placeholder for update
              }
            }
            break;
        }
      });
  }
}
