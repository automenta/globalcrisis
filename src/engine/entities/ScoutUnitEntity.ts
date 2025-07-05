import { BaseEntity, IEntity } from './BaseEntity';
import { SimpleMovableComponent, ISimpleMovableComponent } from '../components/SimpleMovableComponent';
import { HealthComponent, IHealthComponent } from '../components/HealthComponent';
import type { Location, GameState } from '../GameEngine';

export interface IScoutUnitEntity extends IEntity {
  movableComponent: ISimpleMovableComponent;
  healthComponent: IHealthComponent;
  // Add other scout-specific interfaces or properties here (e.g., vision range)
}

export class ScoutUnitEntity extends BaseEntity implements IScoutUnitEntity {
  public readonly entityType = 'ScoutUnitEntity';
  public movableComponent: ISimpleMovableComponent;
  public healthComponent: IHealthComponent;

  constructor(
    id: string,
    name: string,
    location: Location,
    factionId?: string,
    speed: number = 0.5, // Default speed
    maxHp: number = 50,
    perceptionRadius: number = 0.15, // Scouts are more aware
    avoidanceStrength: number = 0.1 // Scouts are agile
  ) {
    super(id, name, 'ScoutUnitEntity', location, factionId);

    this.movableComponent = new SimpleMovableComponent(speed, perceptionRadius, avoidanceStrength);
    this.addComponent(this.movableComponent);

    this.healthComponent = new HealthComponent(maxHp);
    this.addComponent(this.healthComponent);
  }

  // Example scout-specific method
  public setMoveTarget(x: number, y: number): void {
    this.movableComponent.moveTo(x, y);
  }

  public getStatus(): string {
    let status = `${this.name} [HP: ${this.healthComponent.currentHp}/${this.healthComponent.maxHp}] at (${this.location.coordinates.x.toFixed(2)}, ${this.location.coordinates.y.toFixed(2)})`;
    if (this.movableComponent.isMoving() && this.movableComponent.targetPosition) {
      status += ` moving to (${this.movableComponent.targetPosition.x.toFixed(2)}, ${this.movableComponent.targetPosition.y.toFixed(2)})`;
    } else {
      status += " idle.";
    }
    return status;
  }

  // Override update if ScoutUnitEntity has specific logic beyond component updates
  // public update(gameState: GameState, deltaTime: number): void {
  //   super.update(gameState, deltaTime); // Calls update on all components
  //   // Scout-specific update logic here (e.g., scanning for other entities)
  // }
}
