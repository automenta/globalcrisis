export interface GameEvent<T = any> {
  type: string;
  payload?: T;
  timestamp?: number;
  source?: string;
}

export type EventListener<T = any> = (event: GameEvent<T>) => void;

export class EventBus {
  private listeners: Map<string, EventListener<any>[]> = new Map();
  private static instance: EventBus;

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  private constructor() {}

  public subscribe<T = any>(eventType: string, listener: EventListener<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    const eventListeners = this.listeners.get(eventType)!;
    eventListeners.push(listener as EventListener<any>);

    return () => {
      const index = eventListeners.indexOf(listener as EventListener<any>);
      if (index > -1) {
        eventListeners.splice(index, 1);
        if (eventListeners.length === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  public publish<T = any>(eventType: string, payload?: T, source?: string, gameTime?: number): void {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners && eventListeners.length > 0) {
      const event: GameEvent<T> = {
        type: eventType,
        payload,
        timestamp: gameTime !== undefined ? gameTime : Date.now(),
        source,
      };
      [...eventListeners].forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  public clearAllListeners(): void {
    this.listeners.clear();
    console.log("EventBus: All listeners cleared.");
  }

  public getListenerCount(eventType?: string): number {
    if (eventType) {
      return this.listeners.get(eventType)?.length || 0;
    }
    let count = 0;
    this.listeners.forEach(list => count += list.length);
    return count;
  }
}

export const EngineEvent = {
  GAME_STARTED: 'engine:game_started',
  GAME_PAUSED: 'engine:game_paused',
  GAME_RESUMED: 'engine:game_resumed',
  GAME_SPEED_CHANGED: 'engine:game_speed_changed',
  TICK_UPDATED: 'engine:tick_updated',
};

export const EntityEvent = {
  ENTITY_CREATED: 'entity:created',
  ENTITY_REMOVED: 'entity:removed',
  ENTITY_DAMAGED: 'entity:damaged',
  ENTITY_HEALED: 'entity:healed',
  ENTITY_DESTROYED: 'entity:destroyed',
  ENTITY_LOCATION_CHANGED: 'entity:location_changed',
};

export const FactionEvent = {
  FACTION_RELATION_CHANGED: 'faction:relation_changed',
  FACTION_POLICY_CHANGED: 'faction:policy_changed',
  FACTION_GOAL_ACHIEVED: 'faction:goal_achieved',
  FACTION_DECLARED_WAR: 'faction:declared_war',
  FACTION_MADE_PEACE: 'faction:made_peace',
};

export const EconomyEvent = {
  RESOURCE_PRICE_UPDATED: 'economy:resource_price_updated',
  TRADE_EXECUTED: 'economy:trade_executed',
  RESOURCE_DEPLETED: 'economy:resource_depleted',
};

export const PopulationEvent = {
  POPULATION_GROWTH: 'population:growth',
  POPULATION_DECLINE: 'population:decline',
  POPULATION_UNREST_CHANGE: 'population:unrest_change',
  POPULATION_MORALE_CHANGE: 'population:morale_change',
};

export const VisualEffectEvent = {
  TRIGGER_PARTICLE_EFFECT: 'visual:trigger_particle_effect',
  // Add other visual effect event types here
};

export interface TriggerParticleEffectPayload {
  effectType: string; // e.g., 'riot', 'explosion', 'experiment_deploy'
  hexCellId: string;  // ID of the hex cell where the effect should originate
  intensity?: number; // Optional intensity (0-1) to scale the effect
  duration?: number;  // Optional duration for the effect or emitter lifetime in seconds
  // Add other relevant parameters like color, scale, specific entity target ID etc.
}
