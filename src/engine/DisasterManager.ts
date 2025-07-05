// src/engine/DisasterManager.ts
import type { GameState, NaturalDisaster, NaturalDisasterEffect, DisasterType, Biome, Location, PhysicsLayer } from './GameEngine';
import type { IEntity } from './entities/BaseEntity';
import type { IHealthComponent } from './components/HealthComponent';
import type { IPopulationComponent } from './components/PopulationComponent';

export class DisasterManager {
  private gameState: GameState;
  private timeSinceLastCheck: number = 0;
  private disasterCheckInterval: number = 60 * 10; // Check for new disasters every 10 minutes (game time)
  private nextDisasterId: number = 0;

  constructor(gameState: GameState) {
    this.gameState = gameState;
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
    if (Math.random() > 0.05) return;

    const disasterTypes = Object.values(DisasterType).filter(v => !isNaN(Number(v))) as DisasterType[];
    const randomType = disasterTypes[Math.floor(Math.random() * disasterTypes.length)];

    // Select a random biome for the disaster's origin
    const biomesArray = Array.from(this.gameState.biomes.values());
    if (biomesArray.length === 0) return;
    const targetBiome = biomesArray[Math.floor(Math.random() * biomesArray.length)];

    // For simplicity, center disaster in the biome (using placeholder coordinates if none defined)
    // In a real game, this would be more sophisticated, perhaps linked to specific entities or map points
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
        break;
      // TODO: Add cases for Drought, Wildfire, Flood with appropriate effects
      case DisasterType.Drought:
        newDisaster = {
            id: disasterId, name: "Drought", type: DisasterType.Drought,
            location: disasterLocation, radius: Math.random() * 0.5 + 0.3, // Large area
            startTime, duration: 3600 * 24 * (Math.random() * 20 + 10), // 10-30 game days
            effects: [{ type: 'modify_biome_resources', resourceId: 'food', magnitude: -0.5 }], // Reduce food production by 50% (interpreted by other systems)
            isActive: true, description: `A prolonged drought is affecting ${targetBiome.name}.`
        };
        // Droughts might also affect water availability in biomes directly
        targetBiome.naturalResources.set('water', (targetBiome.naturalResources.get('water') || 0) * 0.5);
        break;
    }

    if (newDisaster) {
      this.gameState.activeDisasters.push(newDisaster);
      console.log(`New disaster: ${newDisaster.name} started at biome ${targetBiome.name}. Effects: ${newDisaster.effects.map(e => e.type).join(', ')}`);
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
                    // Magnitude can be positive or negative. If negative, it's a reduction.
                    // If effect.magnitude is a multiplier (e.g. -0.5 for 50% reduction), logic needs to reflect that.
                    // Assuming magnitude is a direct quantity change for now.
                    const changeAmount = effect.magnitude; // If it's a delta.
                    // biome.naturalResources.set(effect.resourceId, Math.max(0, currentAmount + changeAmount));
                    // console.log(`Biome ${biome.id} resource ${effect.resourceId} changed by ${changeAmount} due to ${disaster.name}.`);
                    // For Drought, the effect is more on *rates* or *availability*, handled by ProductionFacilityComponent
                }
            }
            break;
          // case 'change_terrain': // More complex, might affect movement or arable land
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
