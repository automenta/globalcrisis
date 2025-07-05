// src/engine/DisasterManager.ts
import type { GameState, NaturalDisaster, NaturalDisasterEffect, DisasterType, Biome, Location, PhysicsLayer } from './GameEngine';
import type { IEntity } from './entities/BaseEntity';
import type { IHealthComponent } from './components/HealthComponent';
import type { IPopulationComponent } from './components/PopulationComponent';
import type { SoundManager } from './SoundManager'; // Import SoundManager

export class DisasterManager {
  private gameState: GameState;
  private soundManager: SoundManager; // Add SoundManager instance
  private timeSinceLastCheck: number = 0;
  private disasterCheckInterval: number = 60 * 10; // Check for new disasters every 10 minutes (game time)
  private nextDisasterId: number = 0;

  constructor(gameState: GameState, soundManager: SoundManager) { // Accept SoundManager
    this.gameState = gameState;
    this.soundManager = soundManager; // Store SoundManager instance
  }

  public update(deltaTime: number): void {
    this.timeSinceLastCheck += deltaTime * this.gameState.speed;

    if (this.timeSinceLastCheck >= this.disasterCheckInterval) {
      this.triggerRandomDisaster();
      this.timeSinceLastCheck = 0;
    }

    this.updateActiveDisasters(deltaTime);
  }

  private triggerRandomDisaster(): void {
    // Basic probability: 5% chance of a disaster event per check interval
    if (Math.random() > 0.05) return; // Overall chance of any disaster

    const availableDisasterTypes = Object.values(DisasterType).filter(v => !isNaN(Number(v))) as DisasterType[];
    if (availableDisasterTypes.length === 0) return;

    const randomType = availableDisasterTypes[Math.floor(Math.random() * availableDisasterTypes.length)];

    // Select a random biome for the disaster's origin
    let biomesArray = Array.from(this.gameState.biomes.values());
    if (biomesArray.length === 0) return;

    let targetBiome: Biome | undefined;

    // Specific biome selection logic for Wildfire
    if (randomType === DisasterType.Wildfire) {
        const potentialBiomesForWildfire = biomesArray.filter(b =>
            (b.naturalResources.get('wood') || 0) > 50 && // Must have some wood
            b.currentWeather && b.currentWeather.temperature > 25 && // Hot
            b.currentWeather.precipitation < 0.1 // Dry
        );
        if (potentialBiomesForWildfire.length > 0) {
            targetBiome = potentialBiomesForWildfire[Math.floor(Math.random() * potentialBiomesForWildfire.length)];
        } else {
            // If no ideal biome, maybe don't trigger wildfire or pick a less ideal one (e.g. just has wood)
            // For now, if no suitable biome, we might skip this specific wildfire event this time.
            // To ensure a disaster still has a chance, we could re-pick type or allow fallback.
            // Fallback: pick any biome that has wood.
            const fallbackBiomes = biomesArray.filter(b => (b.naturalResources.get('wood') || 0) > 20);
            if (fallbackBiomes.length > 0) {
                targetBiome = fallbackBiomes[Math.floor(Math.random() * fallbackBiomes.length)];
            } else {
                 console.log("Skipping Wildfire: No suitable biomes found (hot, dry, with wood).");
                 return; // Skip disaster this time if no suitable biome for wildfire
            }
        }
    } else {
        targetBiome = biomesArray[Math.floor(Math.random() * biomesArray.length)];
    }

    if (!targetBiome) { // Should not happen if logic above is correct, but as a safeguard
        console.warn("DisasterManager: Could not select a target biome.");
        return;
    }

    // For simplicity, center disaster in the biome
    const disasterLocation: Location = {
        layer: PhysicsLayer.Surface, // Assume surface disasters for now
        // Attempt to find a central point or use a default
        coordinates: { x: Math.random() * 2 -1, y: Math.random() * 2 - 1}, // Random point for now
        biomeId: targetBiome.id,
    };

    let newDisaster: NaturalDisaster | null = null;
    const disasterId = `disaster_${this.nextDisasterId++}`;
    const startTime = this.gameState.time;

    // Define disaster properties based on type
    switch (randomType) {
      case DisasterType.Earthquake:
        newDisaster = {
          id: disasterId, name: "Earthquake", type: DisasterType.Earthquake,
          location: disasterLocation, radius: Math.random() * 0.2 + 0.1, // Radius 0.1 to 0.3 world units
          startTime, duration: 60 * (Math.random() * 5 + 5), // 5-10 game minutes
          effects: [{ type: 'damage_entities', magnitude: Math.random() * 50 + 50 }], // 50-100 damage
          isActive: true, description: `A powerful earthquake strikes near ${targetBiome.name}!`
        };
        this.soundManager.playSoundEffect('disaster_alert_earthquake');
        break;
      case DisasterType.Storm:
        newDisaster = {
          id: disasterId, name: "Severe Storm", type: DisasterType.Storm,
          location: disasterLocation, radius: Math.random() * 0.3 + 0.2, // Radius 0.2 to 0.5
          startTime, duration: 3600 * (Math.random() + 1), // 1-2 game hours
          effects: [
            { type: 'damage_entities', magnitude: Math.random() * 30 + 20, affectedEntityType: 'FactoryEntity' }, // 20-50 damage to factories
            { type: 'reduce_population', magnitude: Math.random() * 0.05 + 0.01 } // 1-5% population reduction in affected cities
          ],
          isActive: true, description: `A severe storm is battering the region around ${targetBiome.name}!`
        };
        this.soundManager.playSoundEffect('disaster_alert_storm');
        break;
      // TODO: Add cases for Drought, Flood with appropriate effects
      case DisasterType.Drought:
        // Droughts are often silent, might not need an immediate alert sound, or a more subtle one.
        // For now, no specific sound alert for drought start. Ambience might reflect it.
        newDisaster = {
            id: disasterId, name: "Drought", type: DisasterType.Drought,
            location: disasterLocation, radius: Math.random() * 0.5 + 0.3, // Large area
            startTime, duration: 3600 * 24 * (Math.random() * 20 + 10), // 10-30 game days
            effects: [{ type: 'modify_biome_resources', resourceId: 'food', magnitude: -0.5 }], // Reduce food production by 50% (interpreted by other systems)
            isActive: true, description: `A prolonged drought is affecting ${targetBiome.name}.`
        };
        // Droughts might also affect water availability in biomes directly
        const currentWater = targetBiome.naturalResources.get('water') || 0;
        targetBiome.naturalResources.set('water', Math.max(0, currentWater * 0.5));
        break;
      case DisasterType.Wildfire:
        newDisaster = {
          id: disasterId, name: "Wildfire", type: DisasterType.Wildfire,
          location: disasterLocation, radius: Math.random() * 0.25 + 0.15, // Radius 0.15 to 0.4
          startTime, duration: 3600 * (Math.random() * 4 + 2), // 2-6 game hours
          effects: [
            { type: 'damage_entities', magnitude: Math.random() * 40 + 30 }, // 30-70 damage to entities in area
            { type: 'modify_biome_resources', resourceId: 'wood', magnitude: -(Math.random() * 0.5 + 0.2) * (targetBiome.naturalResources.get('wood') || 0) } // Reduce wood by 20-70%
          ],
          isActive: true, description: `A wildfire is raging through ${targetBiome.name}!`
        };
        // Directly reduce wood resources in the biome when wildfire starts
        const woodReduction = (targetBiome.naturalResources.get('wood') || 0) * (Math.random() * 0.4 + 0.2); // Example: 20-60% reduction
        const currentWood = targetBiome.naturalResources.get('wood') || 0;
        targetBiome.naturalResources.set('wood', Math.max(0, currentWood - woodReduction));
        console.log(`Wildfire reduced wood in ${targetBiome.name} by ${woodReduction.toFixed(0)} units.`);
        this.soundManager.playSoundEffect('disaster_alert_wildfire');
        break;
      // TODO: Add case for Flood
    }

    if (newDisaster) {
      this.gameState.activeDisasters.push(newDisaster);
      console.log(`New disaster: ${newDisaster.name} started at biome ${targetBiome.id} (${targetBiome.name}). Effects: ${newDisaster.effects.map(e => `${e.type} (mag: ${e.magnitude})`).join(', ')}`);
      // Sound effects are now triggered inside each disaster case.
      // Apply immediate one-time effects of the disaster
      this.applyDisasterEffects(newDisaster);
    }
  }

  private updateActiveDisasters(deltaTime: number): void {
    this.gameState.activeDisasters.forEach(disaster => {
      if (!disaster.isActive) return;

      // Check if disaster duration has passed
      if (this.gameState.time >= disaster.startTime + disaster.duration) {
        disaster.isActive = false;
        console.log(`Disaster ended: ${disaster.name} at biome ${disaster.location.biomeId}`);
        // TODO: Could have lingering effects or cleanup phase
        return;
      }

      // Some disasters might have ongoing effects per update, others are one-time or passive
      // For example, a continuous damage effect for entities in an area for certain disaster types
      if (disaster.type === DisasterType.Wildfire) { // Example of continuous damage
        // this.applyContinuousEffects(disaster, deltaTime);
      }
    });

    // Remove inactive disasters from the list
    this.gameState.activeDisasters = this.gameState.activeDisasters.filter(d => d.isActive);
  }

  private applyDisasterEffects(disaster: NaturalDisaster): void {
    this.gameState.entities.forEach(entity => {
      if (!this.isEntityAffected(entity, disaster)) return;

      disaster.effects.forEach(effect => {
        if (effect.affectedEntityType && entity.entityType !== effect.affectedEntityType) {
          return;
        }

        switch (effect.type) {
          case 'damage_entities':
            const healthComp = entity.getComponent<IHealthComponent>('HealthComponent');
            if (healthComp) {
              healthComp.takeDamage(effect.magnitude);
              console.log(`Entity ${entity.id} took ${effect.magnitude} damage from ${disaster.name}. HP: ${healthComp.currentHp}`);
            }
            break;
          case 'reduce_population':
            if (entity.entityType === 'CityEntity') {
              const popComp = entity.getComponent<IPopulationComponent>('PopulationComponent');
              if (popComp) {
                const reduction = Math.floor(popComp.stats.total * effect.magnitude);
                popComp.stats.total -= reduction;
                if (popComp.stats.total < 0) popComp.stats.total = 0;
                console.log(`City ${entity.id} population reduced by ${reduction} due to ${disaster.name}. Pop: ${popComp.stats.total}`);
              }
            }
            break;
          case 'modify_biome_resources':
            // This effect is typically applied to the biome itself or interpreted by production facilities.
            // For direct biome resource change (e.g. wildfire destroying wood):
            if (disaster.location.biomeId && effect.resourceId) {
                const biome = this.gameState.biomes.get(disaster.location.biomeId);
                if (biome) {
                    const currentAmount = biome.naturalResources.get(effect.resourceId) || 0;
                    let changeAmount = effect.magnitude;

                    // If magnitude is negative and less than 1 (treat as percentage reduction for some effects like wildfire wood reduction)
                    // This interpretation depends on how magnitude was set during disaster creation.
                    // For wildfire wood effect, magnitude is already calculated as a negative absolute value.
                    // For drought food effect, magnitude is -0.5, which is a multiplier handled by production logic.

                    // Let's assume direct modification for resources like wood from wildfire.
                    // The DisasterManager already directly modified the wood when the wildfire started.
                    // This effect definition is more for logging or if other systems need to react to it.
                    // So, for 'modify_biome_resources' handled directly at disaster start (like Wildfire wood),
                    // this switch case might not need to do much more than log, or it could be a secondary effect.
                    // For now, the direct modification in triggerRandomDisaster for Wildfire's wood is the primary mechanism.
                    // This effect here could be for *additional* changes or for other systems to notice.

                    // Example: if effect.magnitude is a direct change amount:
                    // biome.naturalResources.set(effect.resourceId, Math.max(0, currentAmount + changeAmount));
                    // console.log(`Biome ${biome.id} resource ${effect.resourceId} additionally changed by ${changeAmount} due to ${disaster.name} effect processing.`);
                }
            }
            break;
          // case 'change_terrain': // More complex, might affect movement or arable land (e.g. after wildfire, land becomes less fertile for a time)
          //   break;
        }
      });
    });
  }

  private isEntityAffected(entity: IEntity, disaster: NaturalDisaster): boolean {
    if (!entity.location || !disaster.location) return false;
    // Simple distance check (2D for now)
    const dx = entity.location.coordinates.x - disaster.location.coordinates.x;
    const dy = entity.location.coordinates.y - disaster.location.coordinates.y;
    const distanceSquared = dx * dx + dy * dy;
    return distanceSquared <= disaster.radius * disaster.radius;
  }

  // Example for continuous effects if needed later
  /*
  private applyContinuousEffects(disaster: NaturalDisaster, deltaTime: number): void {
    this.gameState.entities.forEach(entity => {
      if (!this.isEntityAffected(entity, disaster)) return;

      // Example: Wildfire deals small damage over time
      if (disaster.type === DisasterType.Wildfire) {
        const healthComp = entity.getComponent<IHealthComponent>('HealthComponent');
        if (healthComp) {
          const damagePerSecond = 5; // Example
          healthComp.takeDamage(damagePerSecond * deltaTime * this.gameState.speed);
        }
      }
    });
  }
  */
}
