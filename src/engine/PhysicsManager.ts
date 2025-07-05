// src/engine/PhysicsManager.ts
import type { GameState, Location, PhysicsLayer, Biome } from './GameEngine';
import type { IEntity } from './entities/BaseEntity';
import type { ITransformComponent } from './components/TransformComponent';
import {
    IPhysicsPropertiesComponent,
    DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME
} from './components/PhysicsPropertiesComponent';

// Using a simple Vector3 interface, assuming game engine doesn't integrate with Three.js directly for physics types
export interface Vector3 { x: number; y: number; z: number; }

// Constants
const STANDARD_GRAVITY = 9.80665; // m/s^2, standard Earth gravity for surface calculations
const EARTH_MASS_KG = 5.97219e24; // kg
const GRAVITATIONAL_CONSTANT_M3_KG_S2 = 6.67430e-11; // m^3 kg^-1 s^-2
export const EARTH_RADIUS_METERS = 6371000; // Average radius in meters

// Atmospheric model constants (simplified values for U.S. Standard Atmosphere)
const SEA_LEVEL_AIR_DENSITY_KG_M3 = 1.225; // kg/m^3
const SCALE_HEIGHT_METERS = 8500; // Approximate scale height for Earth's troposphere/lower stratosphere

// Visual scale in Earth3D vs. Physics scale
export const PHYSICS_TO_VISUAL_SCALE = 2.0 / EARTH_RADIUS_METERS;
export const VISUAL_TO_PHYSICS_SCALE = EARTH_RADIUS_METERS / 2.0;


// Helper for vector operations
export const VectorOps = {
    add: (v1: Vector3, v2: Vector3): Vector3 => ({ x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z }),
    subtract: (v1: Vector3, v2: Vector3): Vector3 => ({ x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z }),
    scale: (v: Vector3, scalar: number): Vector3 => ({ x: v.x * scalar, y: v.y * scalar, z: v.z * scalar }),
    magnitudeSq: (v: Vector3): number => v.x*v.x + v.y*v.y + v.z*v.z,
    magnitude: (v: Vector3): number => Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z),
    normalize: (v: Vector3): Vector3 => {
        const mag = VectorOps.magnitude(v);
        return mag > 0 ? VectorOps.scale(v, 1/mag) : {x:0, y:0, z:0};
    },
    dot: (v1: Vector3, v2: Vector3): number => v1.x*v2.x + v1.y*v2.y + v1.z*v2.z,
    distance: (p1: Vector3, p2: Vector3): number => VectorOps.magnitude(VectorOps.subtract(p1, p2)),
    clone: (v: Vector3): Vector3 => ({ x: v.x, y: v.y, z: v.z }),
    equals: (v1: Vector3, v2: Vector3, epsilon: number = 1e-6): boolean =>
        Math.abs(v1.x - v2.x) < epsilon &&
        Math.abs(v1.y - v2.y) < epsilon &&
        Math.abs(v1.z - v2.z) < epsilon,
};


export class PhysicsManager {
    private gameState: GameState;

    constructor(gameState: GameState) {
        this.gameState = gameState;
    }

    /**
     * Calculates approximate air density at a given altitude above sea level.
     * Uses a simplified exponential decay model.
     * @param altitudeMeters Altitude above sea level in meters.
     * @returns Air density in kg/m^3.
     */
    public getAtmosphericDensity(altitudeMeters: number): number {
        if (altitudeMeters < 0) altitudeMeters = 0; // Density doesn't increase below sea level in this model
        return SEA_LEVEL_AIR_DENSITY_KG_M3 * Math.exp(-altitudeMeters / SCALE_HEIGHT_METERS);
    }


    public update(deltaTime: number): void {
        if (deltaTime <= 0) return;

        this.gameState.entities.forEach(entity => {
            const physicsProps = entity.getComponent<IPhysicsPropertiesComponent>(DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME);
            const transformComponent = entity.getComponent<ITransformComponent>('TransformComponent');

            if (!entity.location || !physicsProps || !transformComponent) {
                return;
            }

            const { layer } = entity.location;
            const { massKg, appliedForces, velocityMps, dragCoefficient, crossSectionalAreaM2 } = physicsProps;
            const { positionMeters } = transformComponent; // Physics operates on this position

            let netForceNewton: Vector3 = appliedForces.reduce((acc, f) => VectorOps.add(acc, f), { x: 0, y: 0, z: 0 });
            physicsProps.appliedForces = [];

            // Apply universal forces like gravity and atmospheric drag
            const altitudeMeters = VectorOps.magnitude(positionMeters) - EARTH_RADIUS_METERS;

            // Consistent Gravity (towards Earth center {0,0,0})
            if (massKg > 0) {
                const rSq = VectorOps.magnitudeSq(positionMeters);
                if (rSq > 1e-6) { // Avoid division by zero if at center (shouldn't happen)
                    const gravForceMag = (GRAVITATIONAL_CONSTANT_M3_KG_S2 * EARTH_MASS_KG * massKg) / rSq;
                    const gravForceDir = VectorOps.normalize(VectorOps.scale(positionMeters, -1));
                    netForceNewton = VectorOps.add(netForceNewton, VectorOps.scale(gravForceDir, gravForceMag));
                }
            }

            // Atmospheric Drag (for Orbit and Air layers)
            if ((layer === PhysicsLayer.Orbit || layer === PhysicsLayer.Air) && massKg > 0) {
                const density = this.getAtmosphericDensity(altitudeMeters);
                const speedSq = VectorOps.magnitudeSq(velocityMps);
                if (speedSq > 1e-6 && dragCoefficient !== undefined && crossSectionalAreaM2 !== undefined) {
                    const dragForceMag = 0.5 * density * speedSq * dragCoefficient * crossSectionalAreaM2;
                    const dragForceDir = VectorOps.normalize(VectorOps.scale(velocityMps, -1)); // Opposes velocity
                    netForceNewton = VectorOps.add(netForceNewton, VectorOps.scale(dragForceDir, dragForceMag));
                }
            }


            switch (layer) {
                case PhysicsLayer.Surface:
                    this.updateSurfaceEntity(entity, physicsProps, transformComponent, netForceNewton, deltaTime);
                    break;
                case PhysicsLayer.Air:
                    this.applyForcesAndUpdateState(physicsProps, transformComponent, netForceNewton, deltaTime);
                    break;
                case PhysicsLayer.Orbit:
                    this.applyForcesAndUpdateState(physicsProps, transformComponent, netForceNewton, deltaTime);
                    if (altitudeMeters < 80000 && layer === PhysicsLayer.Orbit) {
                        // console.warn(`Satellite ${entity.id} is re-entering or very low LEO. Altitude: ${altitudeMeters.toFixed(0)}m`);
                    }
                    break;
                case PhysicsLayer.Underground:
                    this.updateSurfaceEntity(entity, physicsProps, transformComponent, netForceNewton, deltaTime);
                    break;
                case PhysicsLayer.Moon:
                    // TODO: Implement lunar gravity, no atmosphere
                    break;
            }
        });
    }

    private applyForcesAndUpdateState(
        physicsProps: IPhysicsPropertiesComponent,
        transform: ITransformComponent,
        netForce: Vector3,
        deltaTime: number
    ): void {
        if (physicsProps.massKg <= 0) return;

        const accelerationMps2 = VectorOps.scale(netForce, 1 / physicsProps.massKg);

        let newVelocityMps = VectorOps.add(physicsProps.velocityMps, VectorOps.scale(accelerationMps2, deltaTime));

        const currentSpeedMps = VectorOps.magnitude(newVelocityMps);
        if (currentSpeedMps > physicsProps.maxSpeedMps) {
            newVelocityMps = VectorOps.scale(VectorOps.normalize(newVelocityMps), physicsProps.maxSpeedMps);
        }
        physicsProps.velocityMps = newVelocityMps;

        transform.positionMeters = VectorOps.add(transform.positionMeters, VectorOps.scale(newVelocityMps, deltaTime));
    }


    private updateSurfaceEntity(
        entity: IEntity,
        physicsProps: IPhysicsPropertiesComponent,
        transform: ITransformComponent,
        netForce: Vector3, // Already includes gravity
        deltaTime: number
    ): void {
        if (physicsProps.massKg <= 0) return;

        // Apply terrain friction
        const biome = entity.location?.biomeId ? this.gameState.biomes.get(entity.location.biomeId) : undefined;
        const movementModifierTerrain = biome?.terrainProperties.movementModifier || 1.0;
        const entityFrictionCoeff = physicsProps.frictionCoefficient !== undefined ? physicsProps.frictionCoefficient : 0.3;
        const effectiveFrictionCoefficient = entityFrictionCoeff * (1.0 / Math.max(0.1, movementModifierTerrain));

        const speedMps = VectorOps.magnitude(physicsProps.velocityMps);
        if (speedMps > 0.01) {
            const normalForceMagnitude = physicsProps.massKg * STANDARD_GRAVITY;
            const frictionForceMagnitude = effectiveFrictionCoefficient * normalForceMagnitude;
            const frictionForce = VectorOps.scale(VectorOps.normalize(physicsProps.velocityMps), -frictionForceMagnitude);
            netForce = VectorOps.add(netForce, frictionForce);
        }

        this.applyForcesAndUpdateState(physicsProps, transform, netForce, deltaTime);

        // Constraint: Keep entity on the surface of the Earth
        const distFromCenter = VectorOps.magnitude(transform.positionMeters);
        const expectedDistFromCenter = EARTH_RADIUS_METERS; // Surface entities are on the main radius

        if (distFromCenter > 1e-6 && Math.abs(distFromCenter - expectedDistFromCenter) > 0.1) {
            transform.positionMeters = VectorOps.scale(VectorOps.normalize(transform.positionMeters), expectedDistFromCenter);

            const surfaceNormal = VectorOps.normalize(transform.positionMeters);
            const normalVelocityComponent = VectorOps.dot(physicsProps.velocityMps, surfaceNormal);
            physicsProps.velocityMps = VectorOps.subtract(physicsProps.velocityMps, VectorOps.scale(surfaceNormal, normalVelocityComponent));
        }
    }

    public getVisualPosition(physicsPositionMeters: Vector3): Vector3 {
        return VectorOps.scale(physicsPositionMeters, PHYSICS_TO_VISUAL_SCALE);
    }

    public getPhysicsPosition(visualPosition: Vector3): Vector3 {
        return VectorOps.scale(visualPosition, VISUAL_TO_PHYSICS_SCALE);
    }
}
