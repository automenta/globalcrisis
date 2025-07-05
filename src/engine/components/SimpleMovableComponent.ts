import { BaseComponent, IComponent } from './BaseComponent';
import type { GameState, Location, PhysicsLayer } from '../GameEngine';
import { IPhysicsPropertiesComponent, DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME } from './PhysicsPropertiesComponent';
import { ITransformComponent, DEFAULT_TRANSFORM_COMPONENT_NAME } from './TransformComponent';
import { VectorOps, Vector3, PHYSICS_TO_VISUAL_SCALE, VISUAL_TO_PHYSICS_SCALE, EARTH_RADIUS_METERS } from '../PhysicsManager';

export interface ISimpleMovableComponent extends IComponent {
  /** Target speed in game units per second (used to determine force magnitude). */
  targetSpeed: number;
  targetPositionGame?: { x: number, y: number, z?: number }; // Target in game coordinates
  isMoving: () => boolean;
  moveTo(targetX: number, targetY: number, targetZ?: number): void;
  stop(): void;
}

export class SimpleMovableComponent extends BaseComponent implements ISimpleMovableComponent {
  public readonly type = 'SimpleMovableComponent';
  public targetSpeed: number;
  public targetPositionGame?: { x: number, y: number, z?:number };
  private perceptionRadiusGame: number = 0.1; // Game units for detecting obstacles
  private avoidanceStrength: number = 0.05;
  private arrivalThresholdGame: number = 0.05; // Game units

  private forceFactor: number = 500;

  constructor(
    targetSpeed: number,
    perceptionRadiusGame: number = 0.1,
    avoidanceStrength: number = 0.05,
    arrivalThresholdGame: number = 0.05,
    forceFactor: number = 500,
    ) {
    super();
    this.targetSpeed = targetSpeed;
    this.perceptionRadiusGame = perceptionRadiusGame;
    this.avoidanceStrength = avoidanceStrength;
    this.arrivalThresholdGame = arrivalThresholdGame;
    this.forceFactor = forceFactor;
  }

  public init() {}

  public isMoving(): boolean {
    return this.targetPositionGame !== undefined;
  }

  public moveTo(targetX: number, targetY: number, targetZ?:number ): void {
    this.targetPositionGame = { x: targetX, y: targetY, z: targetZ };
  }

  public stop(): void {
    this.targetPositionGame = undefined;
  }

  public update(gameState: GameState, deltaTime: number): void {
    const entity = gameState.entities.get(this.entityId);
    if (!entity) { this.stop(); return; }

    const physicsProps = entity.getComponent<IPhysicsPropertiesComponent>(DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME);
    const transformComp = entity.getComponent<ITransformComponent>(DEFAULT_TRANSFORM_COMPONENT_NAME);

    if (!physicsProps || !transformComp) {
        this.stop();
        return;
    }

    if (!this.targetPositionGame) {
      // If not actively moving towards a target, apply a damping force to slow down
      if (VectorOps.magnitudeSq(physicsProps.velocityMps) > 0.01) {
          const dampingForce = VectorOps.scale(physicsProps.velocityMps, -physicsProps.massKg * 2.0); // Factor 2.0 is arbitrary damping
          physicsProps.appliedForces.push(dampingForce);
      }
      return;
    }

    if (entity.location.layer !== PhysicsLayer.Surface && entity.location.layer !== PhysicsLayer.Underground) {
        return;
    }

    const currentPosPhysics = transformComp.positionMeters;

    // Convert targetPositionGame (game coordinates) to physics world coordinates.
    // This relies on GameEngine having a method for this conversion.
    const targetLocationForConversion: Location = {
        layer: entity.location.layer,
        coordinates: this.targetPositionGame,
        biomeId: entity.location.biomeId, // Important for correct height mapping on surface
        regionId: entity.location.regionId,
    };

    // Assuming gameState.gameEngine reference exists and has the conversion method.
    // This part is crucial and depends on GameEngine.ts structure.
    // For now, we'll have to assume such a method exists or do a simpler placeholder.
    // Let's use the one in PhysicsManager for now, which is a simplified spherical mapping.
    // This needs to be robust: game clicks (likely 2D screen or map) -> 3D world point on sphere.
    let targetPosPhysics: Vector3;
    if (gameState.gameEngine && typeof gameState.gameEngine.convertGameLocationToPhysicsPosition === 'function') {
        targetPosPhysics = gameState.gameEngine.convertGameLocationToPhysicsPosition(targetLocationForConversion);
    } else {
        // Fallback / Placeholder if the method isn't found (should be fixed in GameEngine)
        // This simplified conversion assumes targetPositionGame.x/y are lon/lat factors.
        const lonRad = this.targetPositionGame.x * Math.PI;
        const latRad = this.targetPositionGame.y * (Math.PI / 2);
        const r = EARTH_RADIUS_METERS + ((this.targetPositionGame.z || 0) * VISUAL_TO_PHYSICS_SCALE);
        targetPosPhysics = {
            x: r * Math.cos(latRad) * Math.cos(lonRad),
            y: r * Math.cos(latRad) * Math.sin(lonRad),
            z: r * Math.sin(latRad)
        };
        // console.warn("SimpleMovableComponent: Using fallback for target physics position conversion.");
    }


    let desiredDirectionPhysics = VectorOps.subtract(targetPosPhysics, currentPosPhysics);
    const surfaceNormal = VectorOps.normalize(currentPosPhysics); // Normal to sphere at current position
    const componentNormalToSurface = VectorOps.dot(desiredDirectionPhysics, surfaceNormal);
    // Project desired direction onto the tangent plane of the sphere
    desiredDirectionPhysics = VectorOps.subtract(desiredDirectionPhysics, VectorOps.scale(surfaceNormal, componentNormalToSurface));

    const distanceToTargetPhysics = VectorOps.magnitude(desiredDirectionPhysics);

    // Use physics scale for arrival threshold
    const arrivalThresholdPhysics = this.arrivalThresholdGame * VISUAL_TO_PHYSICS_SCALE * EARTH_RADIUS_METERS; // Rough conversion

    if (distanceToTargetPhysics < arrivalThresholdPhysics) {
      this.stop();
      // Apply a strong braking force to stop quickly at target
      const brakingForce = VectorOps.scale(physicsProps.velocityMps, -physicsProps.massKg * 5.0); // Strong damping
      physicsProps.appliedForces.push(brakingForce);
      return;
    }

    desiredDirectionPhysics = VectorOps.normalize(desiredDirectionPhysics);

    // TODO: Collision Avoidance would modify desiredDirectionPhysics or add counter-forces

    // Target speed in m/s (this.targetSpeed is in game units/sec)
    // This conversion of targetSpeed is also a placeholder and needs to be robust.
    // If this.targetSpeed is meant to be a desired m/s in physics, no conversion needed.
    // If it's game units / sec, then VISUAL_TO_PHYSICS_SCALE might be involved.
    // Let's assume this.targetSpeed is already a desired physical speed in m/s for now.
    const desiredPhysicalSpeed = this.targetSpeed;

    const targetVelocity = VectorOps.scale(desiredDirectionPhysics, desiredPhysicalSpeed);
    const steeringVector = VectorOps.subtract(targetVelocity, physicsProps.velocityMps);

    let steeringForce = VectorOps.scale(steeringVector, physicsProps.massKg); // Basic P-controller for velocity
    // Scale by forceFactor to control "responsiveness"
    steeringForce = VectorOps.scale(steeringForce, this.forceFactor * deltaTime);


    if (physicsProps.maxAccelerationMps2) {
        const maxForceMag = physicsProps.massKg * physicsProps.maxAccelerationMps2;
        if (VectorOps.magnitudeSq(steeringForce) > maxForceMag * maxForceMag) {
            steeringForce = VectorOps.scale(VectorOps.normalize(steeringForce), maxForceMag);
        }
    }

    physicsProps.appliedForces.push(steeringForce);
  }
}
