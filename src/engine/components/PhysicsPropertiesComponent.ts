// src/engine/components/PhysicsPropertiesComponent.ts
import type { IComponent } from './BaseComponent';
import type { Vector3 } from '../PhysicsManager'; // Using Vector3 from PhysicsManager

export interface IPhysicsPropertiesComponent extends IComponent {
    /** Velocity in meters per second (m/s) in the physics simulation space. */
    velocityMps: Vector3;

    /** Mass in kilograms (kg). */
    massKg: number;

    /**
     * Array of forces (in Newtons) to be applied to the entity in the current physics tick.
     * These are typically added by AI, player input, or other game systems.
     * Cleared by the PhysicsManager after each tick.
     */
    appliedForces: Vector3[];

    /** Maximum speed in m/s this entity can achieve (gameplay constraint). */
    maxSpeedMps: number;

    /**
     * Maximum acceleration in m/s^2 this entity's propulsion can achieve (gameplay constraint).
     * Optional: Not all entities might have this constraint.
     */
    maxAccelerationMps2?: number;

    /**
     * Coefficient of kinetic friction (μ_k) for this entity against a default surface.
     * Can be overridden by biome-specific friction. Lower is slipperier.
     * Dimensionless. Typical values range from 0.01 (ice) to 1.0 (rubber on concrete).
     */
    frictionCoefficient?: number;

    /**
     * Drag coefficient (C_d) for aerodynamic/hydrodynamic drag. Dimensionless.
     * Depends on the shape of the object. Common values:
     * Sphere: ~0.47
     * Cube: ~1.05
     * Streamlined body: ~0.04 - 0.1
     */
    dragCoefficient?: number;

    /**
     * Cross-sectional area (A) in square meters (m^2) perpendicular to the direction of motion.
     * Used for calculating aerodynamic/hydrodynamic drag.
     */
    crossSectionalAreaM2?: number;
}

export const DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME = 'PhysicsPropertiesComponent';

export function createDefaultPhysicsPropertiesComponent(
    mass: number = 1, // Default 1kg
    maxSpeed: number = 10, // Default 10 m/s
    initialVelocity: Vector3 = { x: 0, y: 0, z: 0 },
    frictionCoeff: number = 0.3,
    dragCoeff: number = 0.5,
    crossSectionArea: number = 1.0
): IPhysicsPropertiesComponent {
    return {
        name: DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME, // For identifying component by name
        type: DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME, // For IComponent type property
        velocityMps: initialVelocity,
        massKg: mass > 0 ? mass : 1, // Ensure mass is positive
        appliedForces: [],
        maxSpeedMps: maxSpeed,
        frictionCoefficient: frictionCoeff,
        dragCoefficient: dragCoeff,
        crossSectionalAreaM2: crossSectionArea,
    };
}
