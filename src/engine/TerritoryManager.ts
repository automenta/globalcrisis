// src/engine/TerritoryManager.ts
import type { GameState, Biome, Faction } from './GameEngine';
import type { IEntity } from './entities/BaseEntity';

const CITY_INFLUENCE_VALUE = 100;
const UNIT_INFLUENCE_VALUE = 5; // Military units exert some influence
const INFLUENCE_DECAY_RATE = 0.01; // Percentage decay per update cycle if no presence
const CONTROL_THRESHOLD_RATIO = 0.6; // Needs 60% of total influence in biome to control it

export class TerritoryManager {
  private lastUpdate: number = 0;
  private updateInterval: number = 60 * 1; // Update territory control every game minute

  constructor(private gameState: GameState) {}

  public update(deltaTime: number): void {
    this.lastUpdate += deltaTime * this.gameState.speed;
    if (this.lastUpdate >= this.updateInterval) {
      this.updateAllBiomeInfluence();
      this.lastUpdate = 0;
    }
  }

  private updateAllBiomeInfluence(): void {
    this.gameState.biomes.forEach(biome => {
      if (!biome.factionInfluence) {
        biome.factionInfluence = new Map<string, number>();
      }

      const currentFactionInfluences = new Map<string, number>();

      // Calculate influence from entities in the biome
      this.gameState.entities.forEach(entity => {
        if (entity.location?.biomeId === biome.id && entity.factionId) {
          let influenceToAdd = 0;
          if (entity.entityType === 'CityEntity') {
            influenceToAdd = CITY_INFLUENCE_VALUE;
          } else if (entity.entityType === 'InfantryUnitEntity') { // Could expand to other military/civic units
            influenceToAdd = UNIT_INFLUENCE_VALUE;
          }
          // Add other entity types that exert influence (e.g., control towers, cultural sites)

          if (influenceToAdd > 0) {
            currentFactionInfluences.set(
              entity.factionId,
              (currentFactionInfluences.get(entity.factionId) || 0) + influenceToAdd
            );
          }
        }
      });

      // Apply decay to existing influence and update with new presence
      const newInfluenceMap = new Map<string, number>();
      let totalInfluenceInBiome = 0;

      this.gameState.factions.forEach(faction => {
        const oldInfluence = biome.factionInfluence!.get(faction.id) || 0;
        const presenceInfluence = currentFactionInfluences.get(faction.id) || 0;

        let newInfluence = oldInfluence;
        if (presenceInfluence > 0) {
            // If faction has presence, their influence is mainly their presence value, plus some lingering old influence
            newInfluence = presenceInfluence + (oldInfluence * (1 - INFLUENCE_DECAY_RATE * 5)); // Slower decay if present
        } else {
            // If no presence, decay existing influence
            newInfluence = oldInfluence * (1 - INFLUENCE_DECAY_RATE * 10); // Faster decay if not present
        }
        newInfluence = Math.max(0, newInfluence); // Ensure influence doesn't go negative

        if (newInfluence > 0.1) { // Threshold to keep an entry
            newInfluenceMap.set(faction.id, newInfluence);
            totalInfluenceInBiome += newInfluence;
        }
      });

      biome.factionInfluence = newInfluenceMap;

      // Determine controlling faction
      let newControllingFactionId: string | undefined = undefined;
      let maxInfluence = 0;
      biome.factionInfluence.forEach((influence, factionId) => {
        if (influence > maxInfluence) {
          maxInfluence = influence;
          // Check if this faction has significant majority
          if (totalInfluenceInBiome > 0 && (influence / totalInfluenceInBiome) >= CONTROL_THRESHOLD_RATIO) {
            newControllingFactionId = factionId;
          }
        }
      });

      if (biome.controllingFactionId !== newControllingFactionId) {
        // console.log(`Biome ${biome.name} control changed from ${biome.controllingFactionId || 'None'} to ${newControllingFactionId || 'None'}`);
        biome.controllingFactionId = newControllingFactionId;
      }
    });
  }

  public getBiomeController(biomeId: string): Faction | undefined {
    const biome = this.gameState.biomes.get(biomeId);
    if (biome && biome.controllingFactionId) {
      return this.gameState.factions.get(biome.controllingFactionId);
    }
    return undefined;
  }
}
