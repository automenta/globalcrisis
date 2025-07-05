// src/engine/TechManager.ts
import type { GameState, Faction, Technology, TechnologyEffect } from './GameEngine';
import type { ProductionFacilityComponent } from './components/ProductionFacilityComponent';

export class TechManager {
  constructor(private gameState: GameState) {}

  public update(deltaTime: number): void {
    this.gameState.factions.forEach(faction => {
      this.updateFactionResearchProgress(faction, deltaTime);
    });
  }

  private updateFactionResearchProgress(faction: Faction, deltaTime: number): void {
    if (!faction.researchRate || faction.researchRate <= 0) return;
    if (!faction.currentResearchProjectId) return; // Not researching anything

    // Add research points
    faction.researchPoints = (faction.researchPoints || 0) + faction.researchRate * deltaTime * this.gameState.speed;

    // Check if current research project is complete
    const currentTech = this.gameState.availableTechnologies.get(faction.currentResearchProjectId);
    if (currentTech && (faction.researchPoints || 0) >= currentTech.researchCost) {
      this.completeResearch(faction, currentTech);
      // FactionManager will be responsible for picking a new tech if AI controlled
    }
  }

  public canResearch(faction: Faction, techId: string): boolean {
    const tech = this.gameState.availableTechnologies.get(techId);
    if (!tech) return false; // Tech doesn't exist
    if (faction.unlockedTechnologies?.includes(techId)) return false; // Already researched

    // Check prerequisites
    for (const prereqId of tech.prerequisites) {
      if (!faction.unlockedTechnologies?.includes(prereqId)) {
        return false; // Missing prerequisite
      }
    }
    return true;
  }

  public startResearch(faction: Faction, techId: string): boolean {
    if (!this.canResearch(faction, techId)) {
        // console.warn(`Faction ${faction.name} cannot start research on ${techId}. Prerequisites not met or already researched.`);
        return false;
    }
    const tech = this.gameState.availableTechnologies.get(techId);
    if (!tech) return false;

    faction.currentResearchProjectId = techId;
    faction.researchPoints = 0; // Reset points for the new project or carry over? For now, reset.
    // console.log(`Faction ${faction.name} started research on ${tech.name}. Cost: ${tech.researchCost}`);
    return true;
  }

  private completeResearch(faction: Faction, tech: Technology): void {
    if (!faction.unlockedTechnologies) faction.unlockedTechnologies = [];

    faction.unlockedTechnologies.push(tech.id);
    faction.currentResearchProjectId = undefined;
    // faction.researchPoints = 0; // Points spent, or keep surplus for next? For now, assume exact cost.
    // Let's allow surplus to carry over by not resetting faction.researchPoints here after check.
    // It's effectively reset/accounted for when starting a *new* project if we set it to 0 there.
    // Or, more accurately, subtract the cost:
    faction.researchPoints = (faction.researchPoints || 0) - tech.researchCost;


    console.log(`Faction ${faction.name} completed research: ${tech.name}!`);
    this.applyTechEffects(faction, tech);

    // AI Faction should pick a new research project.
    // This logic could be in FactionManager or here. For now, FactionManager will handle it.
  }

  public applyTechEffects(faction: Faction, tech: Technology): void {
    tech.effects.forEach(effect => {
      switch (effect.type) {
        case 'unlock_unit':
          // Logic to make unit available for production by the faction
          // For now, this is conceptual. FactionAI would check unlockedTechs.
          console.log(`Tech Effect: ${faction.name} unlocked unit ${effect.unitId}`);
          break;
        case 'improve_production_efficiency':
          // This effect needs to be applied to existing and future production facilities.
          // One way: add a modifier to the faction or store in gameState,
          // and ProductionFacilityComponent's getEfficiency reads it.
          // For now, let's log it. A more robust solution would modify faction-wide stats or component behavior.
          console.log(`Tech Effect: ${faction.name} efficiency bonus ${effect.bonus} for category ${effect.resourceCategory || effect.resourceId}`);
          // Example of direct application (complex to maintain):
          this.gameState.entities.forEach(entity => {
            if (entity.factionId === faction.id && entity.hasComponent('ProductionFacilityComponent')) {
              const prodComp = entity.getComponent<ProductionFacilityComponent>('ProductionFacilityComponent');
              if (prodComp && prodComp.currentRecipe) { // currentRecipe might not be loaded yet
                const recipe = this.gameState.recipes.get(prodComp.recipeId!);
                if (recipe) {
                    let applies = false;
                    if (effect.resourceCategory === 'All') applies = true;
                    else if (effect.resourceCategory && recipe.outputs.forEach((_, resId) => {
                        const res = this.gameState.resources.get(resId);
                        if (res && res.category === effect.resourceCategory) applies = true;
                    }));
                    else if (effect.resourceId && recipe.outputs.has(effect.resourceId)) applies = true;

                    if (applies) {
                        // This is a direct modification. Ideally, efficiency calculation in component reads from faction's tech bonuses.
                        // prodComp.baseEfficiency += effect.bonus || 0; // This is problematic as it's permanent and stacks on load.
                        // Instead, a faction-level map of bonuses is better.
                         if (!faction.techBonuses) faction.techBonuses = new Map();
                         const key = effect.resourceId ? `efficiency_${effect.resourceId}` : `efficiency_category_${effect.resourceCategory}`;
                         faction.techBonuses.set(key, (faction.techBonuses.get(key) || 0) + (effect.bonus || 0));

                    }
                }
              }
            }
          });
          break;
        case 'improve_research_rate':
          faction.researchRate = (faction.researchRate || 0) + (effect.bonus || 0);
          console.log(`Tech Effect: ${faction.name} research rate increased by ${effect.bonus}. New rate: ${faction.researchRate}`);
          break;
        // case 'modify_unit_stats':
        //   // This would require iterating through all units of a type or applying a global modifier.
        //   console.log(`Tech Effect: ${faction.name} unit ${effect.unitId} stats modified.`);
        //   break;
        default:
          console.warn(`Unknown tech effect type: ${effect.type}`);
      }
    });
  }
}

// Add techBonuses to Faction interface if not implicitly handled by TS dynamic properties
declare module './GameEngine' {
    interface Faction {
        techBonuses?: Map<string, number>; // e.g. "efficiency_food" -> 0.1
    }
}
