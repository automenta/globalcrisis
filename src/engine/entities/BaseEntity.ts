import type { GameState, Location, Identifiable, EntityId, FactionId, ComponentType } from '../GameEngine';
import type { IComponent } from '../components/BaseComponent';

export interface IEntity extends Identifiable {
  id: EntityId;
  entityType: string;
  factionId?: FactionId;
  location: Location;
  components: Map<ComponentType, IComponent>;

  update(gameState: Readonly<GameState>, deltaTime: number): void;
  addComponent(component: IComponent): void;
  getComponent<T extends IComponent>(componentType: ComponentType): T | undefined;
  removeComponent(componentType: ComponentType): boolean;
  hasComponent(componentType: ComponentType): boolean;
  onAddedToGame?(gameState: Readonly<GameState>): void;
  onRemovedFromGame?(gameState: Readonly<GameState>): void;
  handleEvent?(eventName: string, data?: any): void;
}


export abstract class BaseEntity implements IEntity {
  public readonly id: EntityId;
  public name: string;
  public readonly entityType: string;
  public factionId?: FactionId;
  public location: Location;
  public components: Map<ComponentType, IComponent>;

  constructor(id: EntityId, name: string, entityType: string, initialLocation: Location, factionId?: FactionId) {
    this.id = id;
    this.name = name;
    this.entityType = entityType;
    this.location = initialLocation;
    this.factionId = factionId;
    this.components = new Map<ComponentType, IComponent>();
  }

  public addComponent(component: IComponent): void {
    if (component.entityId && component.entityId !== this.id) {
      console.warn(`Component ${component.type} is being reassigned from entity ${component.entityId} to ${this.id}. This might indicate an issue.`);
    }
    component.entityId = this.id;
    this.components.set(component.type, component);
    if (component.onAddedToEntity) {
      component.onAddedToEntity();
    }
  }

  public getComponent<T extends IComponent>(componentType: ComponentType): T | undefined {
    return this.components.get(componentType) as T | undefined;
  }

  public removeComponent(componentType: ComponentType): boolean {
    const component = this.components.get(componentType);
    if (component) {
      if (component.onRemovedFromEntity) {
        component.onRemovedFromEntity();
      }
      return this.components.delete(componentType);
    }
    return false;
  }

  public hasComponent(componentType: ComponentType): boolean {
    return this.components.has(componentType);
  }

  public update(gameState: Readonly<GameState>, deltaTime: number): void {
    for (const component of this.components.values()) {
      component.update(gameState, deltaTime);
    }
  }

  public onAddedToGame?(gameState: Readonly<GameState>): void;
  public onRemovedFromGame?(gameState: Readonly<GameState>): void;
  public handleEvent?(eventName: string, data?: any): void;
}
