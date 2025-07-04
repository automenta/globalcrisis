import type { GameState } from '../GameEngine'; // Assuming GameState is in GameEngine.ts

export interface IComponent {
  type: string;
  entityId: string; // Will be set when component is added to an entity
  update(gameState: GameState, deltaTime: number): void;
  init?(): void; // Optional initialization method
}

export abstract class BaseComponent implements IComponent {
  public abstract readonly type: string;
  public entityId!: string; // Definite assignment assertion, will be set by Entity

  constructor() {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public update(gameState: GameState, deltaTime: number): void {
    // Base components might not have a complex update logic themselves,
    // but concrete components will override this.
  }

  public init?(): void;
}
