import type { GameState, Faction, Technology, TechnologyEffect, TechnologyId } from './GameEngine';
import type { EventBus } from './EventBus';

const BASE_RESEARCH_POINTS_PER_SECOND = 0.1;

export class TechManager {
  constructor(private gameState: Readonly<GameState>, private eventBus?: EventBus) {}

  public update(deltaTime: number): void {
    this.gameState.factions.forEach(faction => {
      this.updateFactionResearchProgress(faction, deltaTime);
    });
  }

  private updateFactionResearchProgress(faction: Faction, deltaTime: number): void {
    if (!faction.currentResearchProjectId) return;

    const researchRateModifier = faction.researchRateModifier || 1.0;
    const researchThisTick = BASE_RESEARCH_POINTS_PER_SECOND * researchRateModifier * deltaTime * this.gameState.gameSpeedMultiplier;

    faction.researchPoints = (faction.researchPoints || 0) + researchThisTick;

    const currentTech = this.gameState.technologies.get(faction.currentResearchProjectId);
    if (currentTech && faction.researchPoints >= currentTech.researchCost) {
      this.completeResearch(faction, currentTech);
    }
  }

  public canResearch(faction: Faction, techId: TechnologyId): boolean {
    const tech = this.gameState.technologies.get(techId);
    if (!tech) return false;
    if (faction.unlockedTechnologies.has(techId)) return false;
    if (faction.currentResearchProjectId === techId) return false;

    for (const prereqId of tech.prerequisites) {
      if (!faction.unlockedTechnologies.has(prereqId)) {
        return false;
      }
    }
    return true;
  }

  public startResearch(faction: Faction, techId: TechnologyId): boolean {
    if (!this.canResearch(faction, techId)) {
        return false;
    }
    const tech = this.gameState.technologies.get(techId);
    if (!tech) return false;

    faction.currentResearchProjectId = techId;
    faction.researchPoints = 0;
    // this.eventBus?.publish(TechEvent.RESEARCH_STARTED, { factionId: faction.id, techId });
    return true;
  }

  private completeResearch(faction: Faction, tech: Technology): void {
    faction.unlockedTechnologies.add(tech.id);
    faction.currentResearchProjectId = undefined;
    faction.researchPoints = Math.max(0, (faction.researchPoints || 0) - tech.researchCost);

    console.log(`Faction ${faction.name} completed research: ${tech.name}!`);
    this.applyTechEffects(faction, tech);
    // this.eventBus?.publish(TechEvent.RESEARCH_COMPLETED, { factionId: faction.id, techId: tech.id });
  }

  public applyTechEffects(faction: Faction, tech: Technology): void {
    if (!faction.techBonuses) {
        faction.techBonuses = new Map<string, number>();
    }

    tech.effects.forEach(effect => {
      switch (effect.type) {
        case 'unlock_recipe':
        case 'unlock_entity_type':
        case 'unlock_component':
        case 'unlock_policy':
          console.log(`Tech Effect: Faction ${faction.name} unlocked ${effect.type}: ${effect.targetId}`);
          // this.eventBus?.publish(TechEvent.ITEM_UNLOCKED, { factionId: faction.id, itemType: effect.type, itemId: effect.targetId });
          break;
        case 'improve_production_efficiency':
          const prodKey = effect.targetId ? `prod_eff_${effect.targetId}` : `prod_eff_cat_general`;
          const currentProdBonus = faction.techBonuses!.get(prodKey) || 0;
          faction.techBonuses!.set(prodKey, currentProdBonus + (effect.bonusPercentage || 0));
          console.log(`Tech Effect: Faction ${faction.name} improved production for ${prodKey} by ${effect.bonusPercentage}`);
          break;
        case 'improve_research_rate':
          faction.researchRateModifier = (faction.researchRateModifier || 1.0) * (1 + (effect.bonusPercentage || 0));
          console.log(`Tech Effect: Faction ${faction.name} research rate modifier changed to ${faction.researchRateModifier}`);
          break;
        case 'modify_entity_stats':
        case 'modify_faction_attribute':
            if (effect.type === 'modify_faction_attribute' && effect.statModifier && effect.targetId === faction.id) {
                const { stat, amount, operation } = effect.statModifier;
                let currentValue = (faction as any)[stat] || 0;
                if (operation === 'add') (faction as any)[stat] = currentValue + amount;
                else if (operation === 'multiply') (faction as any)[stat] = currentValue * amount;
                else if (operation === 'set') (faction as any)[stat] = amount;
                 console.log(`Tech Effect: Faction ${faction.id} attribute ${stat} changed to ${(faction as any)[stat]}`);
            } else {
                console.log(`Tech Effect: Faction ${faction.id} stat modification for ${effect.targetId} (details: ${effect.statModifier})`);
            }
            break;
        case 'modify_biome_yield':
             const biomeYieldKey = `biome_yield_${effect.targetId}_${effect.statModifier?.stat || 'general'}`;
             const currentBiomeBonus = faction.techBonuses!.get(biomeYieldKey) || 0;
             faction.techBonuses!.set(biomeYieldKey, currentBiomeBonus + (effect.bonusPercentage || 0));
             console.log(`Tech Effect: Faction ${faction.id} modified biome yield for ${effect.targetId} by ${effect.bonusPercentage}`);
            break;
        case 'reduce_pollution':
            const pollutionKey = `pollution_reduction_modifier`;
            const currentPollutionBonus = faction.techBonuses!.get(pollutionKey) || 0;
            faction.techBonuses!.set(pollutionKey, currentPollutionBonus + (effect.bonusPercentage || 0));
            console.log(`Tech Effect: Faction ${faction.id} can reduce pollution by ${effect.bonusPercentage}`);
            break;
        default:
          console.warn(`Unknown tech effect type: ${(effect as any).type}`);
      }
    });
  }
}
