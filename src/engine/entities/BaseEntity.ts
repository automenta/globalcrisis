import type {
    GameState,
    EntityLocation,
    IEntity as ISilentHelixEntity, // Use the new IEntity from GameEngine.ts
    MetamodelType
} from '../GameEngine';
import type { IComponent as ILegacyComponent } from '../components/BaseComponent'; // Legacy component system

// Note: The new ISilentHelixEntity interface is simpler and doesn't mandate a component system.
// This BaseEntity will adapt to ISilentHelixEntity while retaining component logic for potential reuse or gradual refactoring.

export abstract class BaseEntity implements ISilentHelixEntity {
  public readonly id: string;
  public readonly type: MetamodelType; // Corresponds to entityType in ISilentHelixEntity
  public name?: string;
  public description?: string;
  public factionId?: string;
  public location: EntityLocation;

  // Retain component system for now, for any existing components that might be useful.
  // This part is from the old IEntity/BaseEntity.
  public components: Map<string, ILegacyComponent>;

  constructor(
    id: string,
    type: MetamodelType,
    initialLocation: EntityLocation,
    name?: string,
    factionId?: string,
    description?: string,
  ) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.location = initialLocation;
    this.factionId = factionId;
    this.description = description;
    this.components = new Map<string, ILegacyComponent>();
  }

  // Methods from ISilentHelixEntity (id, type, name, factionId, location are properties)
  // update method is optional in ISilentHelixEntity and should be implemented by subclasses if needed.
  public abstract update?(gameState: Readonly<GameState>, deltaTime: number): void;

  // Component management methods (legacy, but kept for now)
  public addComponent(component: ILegacyComponent): void {
    if (component.entityId && component.entityId !== this.id) {
      console.warn(`Component ${component.type} is being reassigned from entity ${component.entityId} to ${this.id}. This might indicate an issue.`);
    }
    component.entityId = this.id; // Assuming ILegacyComponent has entityId and type
    this.components.set(component.type, component);
    if (component.onAddedToEntity) {
      component.onAddedToEntity();
    }
  }

  public getComponent<T extends ILegacyComponent>(componentType: string): T | undefined {
    return this.components.get(componentType) as T | undefined;
  }

  public removeComponent(componentType: string): boolean {
    const component = this.components.get(componentType);
    if (component) {
      if (component.onRemovedFromEntity) {
        component.onRemovedFromEntity();
      }
      return this.components.delete(componentType);
    }
    return false;
  }

  public hasComponent(componentType: string): boolean {
    return this.components.has(componentType);
  }

  // Optional lifecycle methods (can be part of ISilentHelixEntity or specific entity types)
  public onAddedToGame?(gameState: Readonly<GameState>): void;
  public onRemovedFromGame?(gameState: Readonly<GameState>): void;

  // Event handling (can be part of ISilentHelixEntity or specific entity types)
  public handleEvent?(eventName: string, data?: any): void;
}
