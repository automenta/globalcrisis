import { BaseComponent, IComponent } from './BaseComponent';
import type { GameState, Location, PhysicsLayer } from '../GameEngine'; // Assuming Location & PhysicsLayer are exported

export interface ISimpleMovableComponent extends IComponent {
  speed: number; // Units per second (in world coordinates)
  targetPosition?: { x: number, y: number }; // For surface movement primarily
  isMoving: () => boolean;
  moveTo(targetX: number, targetY: number): void;
  stop(): void;
}

export class SimpleMovableComponent extends BaseComponent implements ISimpleMovableComponent {
  public readonly type = 'SimpleMovableComponent';
  public speed: number;
  public targetPosition?: { x: number, y: number };
  private parentLocation?: Location; // To get current position

  constructor(speed: number) {
    super();
    this.speed = speed; // e.g., 0.1 world units per second
  }

  public init() {
    // This component needs access to its parent entity's Location.
    // It's better to fetch it once here or ensure GameState provides easy access.
    // For now, it will try to get it from gameState in update, which is less efficient.
  }

  public isMoving(): boolean {
    return this.targetPosition !== undefined;
  }

  public moveTo(targetX: number, targetY: number): void {
    this.targetPosition = { x: targetX, y: targetY };
    // console.log(`Entity ${this.entityId} moving to (${targetX}, ${targetY})`);
  }

  public stop(): void {
    this.targetPosition = undefined;
  }

  public update(gameState: GameState, deltaTime: number): void {
    if (!this.targetPosition) {
      return;
    }

    const entity = gameState.entities.get(this.entityId);
    if (!entity) {
      this.stop(); // Should not happen if component is properly managed
      return;
    }

    // We'll assume surface movement for this simple component (x, y only)
    // More complex movement would check entity.location.layer
    if (entity.location.layer !== PhysicsLayer.Surface) {
        // console.warn(`Entity ${this.entityId}: SimpleMovableComponent only supports Surface movement for now.`);
        // this.stop(); // Or handle differently
        return;
    }

    const currentX = entity.location.coordinates.x;
    const currentY = entity.location.coordinates.y;

    const dx = this.targetPosition.x - currentX;
    const dy = this.targetPosition.y - currentY;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const moveAmount = this.speed * deltaTime * gameState.speed;

    if (distance <= moveAmount) {
      // Arrived at target
      entity.location.coordinates.x = this.targetPosition.x;
      entity.location.coordinates.y = this.targetPosition.y;
      this.stop();
      // console.log(`Entity ${this.entityId} arrived at target.`);
    } else {
      // Move towards target
      entity.location.coordinates.x += (dx / distance) * moveAmount;
      entity.location.coordinates.y += (dy / distance) * moveAmount;
    }
  }
}
