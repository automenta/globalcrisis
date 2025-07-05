// src/engine/entities/SatelliteEntity.ts
import { BaseEntity, IEntity } from './BaseEntity';
import type { Location, PhysicsLayer } from '../GameEngine';
import {
    createDefaultTransformComponent,
    ITransformComponent,
    DEFAULT_TRANSFORM_COMPONENT_NAME
} from '../components/TransformComponent';
import {
    createDefaultPhysicsPropertiesComponent,
    IPhysicsPropertiesComponent,
    DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME
} from '../components/PhysicsPropertiesComponent'; // Corrected import
import type { Vector3 } from '../PhysicsManager';
import type { IComponent } from '../components/BaseComponent'; // Ensure IComponent is imported

export type SatelliteType = 'military' | 'communication' | 'surveillance' | 'weapon' | 'civilian' | 'scientific' | 'navigation';

export interface ISatelliteDataComponent extends IComponent {
    satelliteType: SatelliteType;
    status: 'active' | 'inactive' | 'compromised' | 'destroyed';
    operationalAltitudeMeters: number;
    inclinationDegrees: number;
}
export const DEFAULT_SATELLITE_DATA_COMPONENT_NAME = 'SatelliteDataComponent';


export class SatelliteEntity extends BaseEntity implements IEntity {
    constructor(
        id: string,
        name: string,
        location: Location,
        satelliteType: SatelliteType,
        operationalAltitudeMeters: number,
        inclinationDegrees: number,
        initialPhysicsPosition: Vector3,
        initialPhysicsVelocity: Vector3,
        massKg: number = 100,
        dragCoefficient: number = 2.2, // Typical Cd for a boxy satellite
        crossSectionalAreaM2: number = 1.0, // Approx 1 m^2
        factionId?: string
    ) {
        super(id, name, 'SatelliteEntity', location, factionId);

        if (location.layer !== PhysicsLayer.Orbit) {
            console.warn(`SatelliteEntity ${id} created with layer ${location.layer} instead of Orbit. Correcting.`);
            this.location.layer = PhysicsLayer.Orbit;
        }

        this.addComponent(createDefaultTransformComponent(initialPhysicsPosition));

        // Satellites have high max speed (orbital velocity); frictionCoefficient is not applicable in orbit.
        // Drag coefficient and cross-sectional area are important for atmospheric drag in LEO.
        this.addComponent(
            createDefaultPhysicsPropertiesComponent(
                massKg,
                20000, // Max speed (e.g., 20 km/s, well above typical orbital speeds)
                initialPhysicsVelocity,
                0, // No ground friction in orbit
                dragCoefficient,
                crossSectionalAreaM2
            )
        );

        const satelliteData: ISatelliteDataComponent = {
            name: DEFAULT_SATELLITE_DATA_COMPONENT_NAME,
            type: DEFAULT_SATELLITE_DATA_COMPONENT_NAME,
            entityId: this.id,
            satelliteType,
            status: 'active',
            operationalAltitudeMeters,
            inclinationDegrees,
            update: () => {},
        };
        this.addComponent(satelliteData);
    }

    get transformComponent(): ITransformComponent | undefined {
        return this.getComponent<ITransformComponent>(DEFAULT_TRANSFORM_COMPONENT_NAME);
    }

    get physicsPropertiesComponent(): IPhysicsPropertiesComponent | undefined {
        return this.getComponent<IPhysicsPropertiesComponent>(DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME);
    }

    get satelliteDataComponent(): ISatelliteDataComponent | undefined {
        return this.getComponent<ISatelliteDataComponent>(DEFAULT_SATELLITE_DATA_COMPONENT_NAME);
    }
}
