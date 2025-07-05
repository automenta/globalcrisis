import { BaseComponent, IComponent } from './BaseComponent';
import type { GameState, Location, PhysicsLayer } from '../GameEngine'; // Assuming Location & PhysicsLayer are exported

export interface ISimpleMovableComponent extends IComponent {
  speed: number; // Units per second (in world coordinates)
  targetPosition?: { x: number, y: number }; // For surface movement primarily
  isMoving: () => boolean;
  moveTo(targetX: number, targetY: number): void;
  stop(): void;
}

import { IEntity } from '../entities/BaseEntity'; // Import IEntity

export class SimpleMovableComponent extends BaseComponent implements ISimpleMovableComponent {
  public readonly type = 'SimpleMovableComponent';
  public speed: number;
  public targetPosition?: { x: number, y: number };
  private perceptionRadius: number = 0.1; // World units for detecting obstacles
  private avoidanceStrength: number = 0.05; // How strongly to steer away

  constructor(speed: number, perceptionRadius: number = 0.1, avoidanceStrength: number = 0.05) {
    super();
    this.speed = speed; // e.g., 0.1 world units per second
    this.perceptionRadius = perceptionRadius;
    this.avoidanceStrength = avoidanceStrength;
  }

  public init() {}

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
    const currentX = entity.location.coordinates.x;
    const currentY = entity.location.coordinates.y;

    let desiredDx = this.targetPosition.x - currentX;
    let desiredDy = this.targetPosition.y - currentY;
    const distanceToTarget = Math.sqrt(desiredDx * desiredDx + desiredDy * desiredDy);

    // Normalize desired direction
    if (distanceToTarget > 0) {
        desiredDx /= distanceToTarget;
        desiredDy /= distanceToTarget;
    }

    let avoidanceDx = 0;
    let avoidanceDy = 0;
    let obstaclesDetected = 0;

    // Basic Collision Avoidance
    gameState.entities.forEach(otherEntity => {
        if (otherEntity.id === this.entityId || !otherEntity.location) return;
        // Only avoid other surface entities for now
        if (otherEntity.location.layer !== PhysicsLayer.Surface) return;

        const otherX = otherEntity.location.coordinates.x;
        const otherY = otherEntity.location.coordinates.y;
        const distToOtherX = otherX - currentX;
        const distToOtherY = otherY - currentY;
        const distanceSquaredToOther = distToOtherX * distToOtherX + distToOtherY * distToOtherY;

        if (distanceSquaredToOther < this.perceptionRadius * this.perceptionRadius) {
            const distanceToOther = Math.sqrt(distanceSquaredToOther);
            if (distanceToOther > 0) { // Avoid division by zero if entities are exactly on top
                // Steer away from the obstacle
                avoidanceDx -= (distToOtherX / distanceToOther) * (1 - distanceToOther / this.perceptionRadius);
                avoidanceDy -= (distToOtherY / distanceToOther) * (1 - distanceToOther / this.perceptionRadius);
                obstaclesDetected++;
            }
        }
    });

    if (obstaclesDetected > 0) {
        // Normalize avoidance vector
        const avoidanceMag = Math.sqrt(avoidanceDx * avoidanceDx + avoidanceDy * avoidanceDy);
        if (avoidanceMag > 0) {
            avoidanceDx /= avoidanceMag;
            avoidanceDy /= avoidanceMag;
        }
    }

    // Combine desired direction with avoidance direction
    // Weight avoidance more strongly if very close or many obstacles. For now, simple weighting.
    const finalDx = desiredDx + avoidanceDx * this.avoidanceStrength;
    const finalDy = desiredDy + avoidanceDy * this.avoidanceStrength;

    // Normalize final direction
    const finalMag = Math.sqrt(finalDx * finalDx + finalDy * finalDy);
    let moveDx = 0;
    let moveDy = 0;
    if (finalMag > 0) {
        moveDx = finalDx / finalMag;
        moveDy = finalDy / finalMag;
    } else if (distanceToTarget > 0) { // If avoidance perfectly cancelled desired, just move towards target
        moveDx = desiredDx;
        moveDy = desiredDy;
    }


    const moveAmount = this.speed * deltaTime * gameState.speed;

    if (distanceToTarget <= moveAmount && obstaclesDetected === 0) { // Only stop if no obstacles nearby and close to target
      // Arrived at target
      entity.location.coordinates.x = this.targetPosition.x;
      entity.location.coordinates.y = this.targetPosition.y;
      this.stop();
      // console.log(`Entity ${this.entityId} arrived at target.`);
    } else {
      // Move
      entity.location.coordinates.x += moveDx * moveAmount;
      entity.location.coordinates.y += moveDy * moveAmount;
    }
  }
}
