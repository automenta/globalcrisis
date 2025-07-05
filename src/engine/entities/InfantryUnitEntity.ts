// src/engine/entities/InfantryUnitEntity.ts
import { BaseEntity, IEntity } from './BaseEntity';
import type { Location, GameState } from '../GameEngine';
import { HealthComponent, IHealthComponent } from '../components/HealthComponent';
import { SimpleMovableComponent, ISimpleMovableComponent } from '../components/SimpleMovableComponent';
import { CombatComponent, ICombatComponent, CombatStats } from '../components/CombatComponent';

export interface IInfantryUnitEntity extends IEntity {
  healthComponent: IHealthComponent;
  movableComponent: ISimpleMovableComponent;
  combatComponent: ICombatComponent;
}

export class InfantryUnitEntity extends BaseEntity implements IInfantryUnitEntity {
  public readonly entityType = 'InfantryUnitEntity';
  public healthComponent: IHealthComponent;
  public movableComponent: ISimpleMovableComponent;
  public combatComponent: ICombatComponent;

  constructor(
    id: string,
    name: string,
    location: Location,
    factionId: string, // Military units must belong to a faction
    combatStats: CombatStats,
    maxHp: number = 100,
    speed: number = 0.3,
    perceptionRadius: number = 0.2, // Infantry are fairly aware for combat
    avoidanceStrength: number = 0.05
  ) {
    super(id, name, 'InfantryUnitEntity', location, factionId);

    this.healthComponent = new HealthComponent(maxHp);
    this.addComponent(this.healthComponent);

    this.movableComponent = new SimpleMovableComponent(speed, perceptionRadius, avoidanceStrength);
    this.addComponent(this.movableComponent);

    this.combatComponent = new CombatComponent(combatStats);
    this.addComponent(this.combatComponent);
  }

  public update(gameState: GameState, deltaTime: number): void {
    super.update(gameState, deltaTime); // This will call update on all components

    // Infantry-specific logic can go here if needed,
    // for example, managing formations or special abilities.
    // For now, component updates are sufficient.
  }

  // Example utility methods
  public orderAttackMove(targetX: number, targetY: number): void {
    this.movableComponent.moveTo(targetX, targetY);
    // CombatComponent will automatically find targets if none is set,
    // or if current target is lost. If a specific initial target is desired,
    // it would need to be set on combatComponent.
  }

  public orderHoldPosition(): void {
    this.movableComponent.stop();
    // Optionally clear target for combat component or set to defensive mode
    // this.combatComponent.currentTargetId = undefined;
  }
}
