import type { GameState, EntityId, ComponentType } from '../GameEngine';

export interface IComponent {
  type: ComponentType;
  entityId: EntityId;

  onAddedToEntity?(): void;
  onRemovedFromEntity?(): void;
  update(gameState: Readonly<GameState>, deltaTime: number): void;
  onEntityAddedToGame?(gameState: Readonly<GameState>): void;
  onEntityRemovedFromGame?(gameState: Readonly<GameState>): void;
  handleEntityEvent?(eventName: string, data?: any, gameState?: Readonly<GameState>): void;
}

export abstract class BaseComponent implements IComponent {
  public abstract readonly type: ComponentType;
  public entityId!: EntityId;

  constructor() {}

  public onAddedToEntity?(): void;
  public onRemovedFromEntity?(): void;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public update(gameState: Readonly<GameState>, deltaTime: number): void {}

  public onEntityAddedToGame?(gameState: Readonly<GameState>): void;
  public onEntityRemovedFromGame?(gameState: Readonly<GameState>): void;
  public handleEntityEvent?(eventName: string, data?: any, gameState?: Readonly<GameState>): void;
}
