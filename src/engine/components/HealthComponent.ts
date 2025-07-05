import { BaseComponent, IComponent } from './BaseComponent';
import type { GameState } from '../GameEngine';

export interface IHealthComponent extends IComponent {
  currentHp: number;
  maxHp: number;
  isAlive: () => boolean;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  setHp(current: number, max?: number): void;
}

export class HealthComponent extends BaseComponent implements IHealthComponent {
  public readonly type = 'HealthComponent';
  public currentHp: number;
  public maxHp: number;

  constructor(initialMaxHp: number, initialCurrentHp?: number) {
    super();
    this.maxHp = initialMaxHp;
    this.currentHp = initialCurrentHp !== undefined ? initialCurrentHp : initialMaxHp;
  }

  public isAlive(): boolean {
    return this.currentHp > 0;
  }

  public takeDamage(amount: number): void {
    if (amount <= 0) return;
    this.currentHp -= amount;
    if (this.currentHp < 0) {
      this.currentHp = 0;
    }
    // console.log(`Entity ${this.entityId} took ${amount} damage, HP is now ${this.currentHp}/${this.maxHp}`);
  }

  public heal(amount: number): void {
    if (amount <= 0) return;
    this.currentHp += amount;
    if (this.currentHp > this.maxHp) {
      this.currentHp = this.maxHp;
    }
    // console.log(`Entity ${this.entityId} healed ${amount} HP, HP is now ${this.currentHp}/${this.maxHp}`);
  }

  public setHp(current: number, max?: number): void {
    if (max !== undefined) {
        this.maxHp = Math.max(0, max);
    }
    this.currentHp = Math.max(0, Math.min(current, this.maxHp));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public update(gameState: GameState, deltaTime: number): void {
    // Health typically doesn't update on its own per frame without specific regeneration logic
    // which could be added here or as a separate RegenComponent.
  }
}
