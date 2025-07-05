import type { GameState, Location } from '../GameEngine'; // Assuming Location is still in GameEngine or moved appropriately
import type { IComponent } from '../components/BaseComponent';

// Re-define Entity interface here or import from a central types file if created
export interface IEntity extends Identifiable {
  entityType: string;
  factionId?: string;
  location: Location;
  components: Map<string, IComponent>;
  update(gameState: GameState, deltaTime: number): void;
  addComponent(component: IComponent): void;
  getComponent<T extends IComponent>(type: string): T | undefined;
  removeComponent(type: string): boolean;
  hasComponent(type: string): boolean;
  init?(): void; // Optional initialization
}

interface Identifiable { id: string; name: string; }


export class BaseEntity implements IEntity {
  public readonly id: string;
  public name: string;
  public readonly entityType: string;
  public factionId?: string;
  public location: Location;
  public components: Map<string, IComponent>;

  constructor(id: string, name: string, entityType: string, location: Location, factionId?: string) {
    this.id = id;
    this.name = name;
    this.entityType = entityType;
    this.location = location;
    this.factionId = factionId;
    this.components = new Map();
  }

  public addComponent(component: IComponent): void {
    component.entityId = this.id; // Ensure component knows its parent
    this.components.set(component.type, component);
    if (component.init) {
      component.init();
    }
  }

  public getComponent<T extends IComponent>(type: string): T | undefined {
    return this.components.get(type) as T | undefined;
  }

  public removeComponent(type: string): boolean {
    return this.components.delete(type);
  }

  public hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public update(gameState: GameState, deltaTime: number): void {
    for (const component of this.components.values()) {
      component.update(gameState, deltaTime);
    }
  }

  public init?(): void;
}
