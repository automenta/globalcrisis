// src/engine/components/CombatComponent.ts
import { BaseComponent, IComponent } from './BaseComponent';
import type { GameState } from '../GameEngine';
import type { IEntity } from '../entities/BaseEntity';
import type { IHealthComponent } from './HealthComponent';
import type { ISimpleMovableComponent } from './SimpleMovableComponent';

export interface CombatStats {
  attackPower: number;    // Damage dealt per attack
  attackRange: number;    // Max distance to attack (world units)
  attackSpeed: number;    // Attacks per second (e.g., 1 means 1 attack per second)
  defensePower?: number;   // Flat damage reduction (optional)
  accuracy?: number;       // Chance to hit (0.0 to 1.0, optional)
}

export interface ICombatComponent extends IComponent {
  stats: CombatStats;
  currentTargetId?: string;
  lastAttackTime: number;

  findTarget(potentialTargets: IEntity[], gameState: GameState): void;
  attackTarget(gameState: GameState): void; // Attacks currentTargetId if conditions met
  canAttack(targetEntity: IEntity, currentX: number, currentY: number): boolean;
  isTargetInRange(targetEntity: IEntity, currentX: number, currentY: number): boolean;
}

export class CombatComponent extends BaseComponent implements ICombatComponent {
  public readonly type = 'CombatComponent';
  public stats: CombatStats;
  public currentTargetId?: string;
  public lastAttackTime: number = 0;
  private attackCooldown: number;

  constructor(stats: CombatStats) {
    super();
    this.stats = stats;
    this.attackCooldown = 1 / this.stats.attackSpeed; // Time in seconds between attacks
  }

  public update(gameState: GameState, deltaTime: number): void {
    const parentEntity = gameState.entities.get(this.entityId);
    if (!parentEntity) return;

    // Auto-find target if none exists or current target is invalid/dead
    if (!this.currentTargetId || !gameState.entities.has(this.currentTargetId)) {
      const potentialTargets = this.getPotentialTargets(gameState, parentEntity);
      this.findTarget(potentialTargets, gameState);
    }

    const targetEntity = this.currentTargetId ? gameState.entities.get(this.currentTargetId) : undefined;
    if (targetEntity) {
        const targetHealth = targetEntity.getComponent<IHealthComponent>('HealthComponent');
        if (!targetHealth || !targetHealth.isAlive()) {
            this.currentTargetId = undefined; // Target is dead or has no health
            return;
        }

        if (this.canAttack(targetEntity, parentEntity.location.coordinates.x, parentEntity.location.coordinates.y)) {
            if (gameState.time >= this.lastAttackTime + this.attackCooldown) {
                this.attackTarget(gameState);
            }
        } else {
            // Target is out of range, try to move closer if this entity has a movable component
            const movable = parentEntity.getComponent<ISimpleMovableComponent>('SimpleMovableComponent');
            if (movable && targetEntity.location) {
                // Check if already moving to this target or if it should retarget
                const currentTargetPos = movable.targetPosition;
                if (!currentTargetPos ||
                    currentTargetPos.x !== targetEntity.location.coordinates.x ||
                    currentTargetPos.y !== targetEntity.location.coordinates.y) {
                    movable.moveTo(targetEntity.location.coordinates.x, targetEntity.location.coordinates.y);
                }
            }
        }
    }
  }

  private getPotentialTargets(gameState: GameState, selfEntity: IEntity): IEntity[] {
    const potentialTargets: IEntity[] = [];
    gameState.entities.forEach(entity => {
      if (entity.id === this.entityId) return; // Cannot target self
      if (entity.factionId === selfEntity.factionId) return; // Cannot target own faction (for now)
      // TODO: Add checks for neutrality based on faction relations
      if (entity.hasComponent('HealthComponent')) {
        potentialTargets.push(entity);
      }
    });
    return potentialTargets;
  }

  public findTarget(potentialTargets: IEntity[], gameState: GameState): void {
    const parentEntity = gameState.entities.get(this.entityId);
    if (!parentEntity) return;

    let closestTarget: IEntity | undefined = undefined;
    let minDistanceSq = this.stats.attackRange * this.stats.attackRange * 4; // Look slightly beyond attack range initially

    for (const target of potentialTargets) {
      if (!target.location) continue;
      const targetHealth = target.getComponent<IHealthComponent>('HealthComponent');
      if (!targetHealth || !targetHealth.isAlive()) continue; // Skip dead or invulnerable targets

      const dx = target.location.coordinates.x - parentEntity.location.coordinates.x;
      const dy = target.location.coordinates.y - parentEntity.location.coordinates.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq;
        closestTarget = target;
      }
    }
    this.currentTargetId = closestTarget?.id;
    // if (this.currentTargetId) console.log(`${this.entityId} targeted ${this.currentTargetId}`);
  }

  public isTargetInRange(targetEntity: IEntity, currentX: number, currentY: number): boolean {
    if (!targetEntity.location) return false;
    const dx = targetEntity.location.coordinates.x - currentX;
    const dy = targetEntity.location.coordinates.y - currentY;
    const distanceSq = dx * dx + dy * dy;
    return distanceSq <= this.stats.attackRange * this.stats.attackRange;
  }

  public canAttack(targetEntity: IEntity, currentX: number, currentY: number): boolean {
    if (!targetEntity) return false;
    const targetHealth = targetEntity.getComponent<IHealthComponent>('HealthComponent');
    if (!targetHealth || !targetHealth.isAlive()) {
      this.currentTargetId = undefined; // Target is dead
      return false;
    }
    return this.isTargetInRange(targetEntity, currentX, currentY);
  }

  public attackTarget(gameState: GameState): void {
    if (!this.currentTargetId) return;
    const targetEntity = gameState.entities.get(this.currentTargetId);
    const parentEntity = gameState.entities.get(this.entityId);

    if (!targetEntity || !parentEntity) {
      this.currentTargetId = undefined;
      return;
    }

    if (!this.canAttack(targetEntity, parentEntity.location.coordinates.x, parentEntity.location.coordinates.y)) {
        // console.log(`${this.entityId} cannot attack ${this.currentTargetId}: out of range or dead.`);
        return; // Target moved out of range or died before attack landed
    }

    const targetHealth = targetEntity.getComponent<IHealthComponent>('HealthComponent');
    if (targetHealth) {
      targetHealth.takeDamage(this.stats.attackPower);
      this.lastAttackTime = gameState.time;
    //   console.log(`Entity ${this.entityId} attacked ${this.currentTargetId} for ${this.stats.attackPower} damage. Target HP: ${targetHealth.currentHp}`);
      if (!targetHealth.isAlive()) {
        // console.log(`Entity ${this.currentTargetId} destroyed by ${this.entityId}.`);
        this.currentTargetId = undefined; // Clear target if it's destroyed
      }
    }
  }
}
