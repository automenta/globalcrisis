import { EventBus, GameEvent, EngineEvent } from './EventBus';

import { vi } from 'vitest'; // Import vi

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.getInstance();
    eventBus.clearAllListeners();
  });

  test('should be a singleton instance', () => {
    const instance1 = EventBus.getInstance();
    const instance2 = EventBus.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('should subscribe a listener to an event type', () => {
    const mockListener = vi.fn(); // Use vi.fn()
    eventBus.subscribe('testEvent', mockListener);
    eventBus.publish('testEvent', { data: 'payload' });
    expect(mockListener).toHaveBeenCalledTimes(1);
  });

  test('should call the listener with the correct payload', () => {
    const mockListener = vi.fn(); // Use vi.fn()
    const payload = { message: 'hello world' };
    eventBus.subscribe('payloadTest', mockListener);
    eventBus.publish('payloadTest', payload);
    expect(mockListener).toHaveBeenCalledWith(expect.objectContaining({ type: 'payloadTest', payload }));
  });

  test('should allow multiple listeners for the same event type', () => {
    const listener1 = vi.fn(); // Use vi.fn()
    const listener2 = vi.fn(); // Use vi.fn()
    eventBus.subscribe('multiTest', listener1);
    eventBus.subscribe('multiTest', listener2);
    eventBus.publish('multiTest');
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  test('unsubscribe should remove a listener', () => {
    const mockListener = vi.fn(); // Use vi.fn()
    const unsubscribe = eventBus.subscribe('unsubscribeTest', mockListener);

    eventBus.publish('unsubscribeTest');
    expect(mockListener).toHaveBeenCalledTimes(1);

    unsubscribe();

    eventBus.publish('unsubscribeTest');
    expect(mockListener).toHaveBeenCalledTimes(1);
  });

  test('publishing an event with no listeners should not error', () => {
    expect(() => eventBus.publish('noListenerEvent')).not.toThrow();
  });

  test('should use gameTime in event if provided', () => {
    const mockListener = vi.fn(); // Use vi.fn()
    const gameTime = 12345;
    eventBus.subscribe(EngineEvent.TICK_UPDATED, mockListener);
    eventBus.publish(EngineEvent.TICK_UPDATED, { data: 'tick' }, 'TestSource', gameTime);

    expect(mockListener).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: gameTime,
        source: 'TestSource',
      })
    );
  });

   test('should use Date.now() if gameTime is not provided', () => {
    const mockListener = vi.fn(); // Use vi.fn()
    const beforeTime = Date.now();
    eventBus.subscribe('dateNowTest', mockListener);
    eventBus.publish('dateNowTest', { data: 'payload' });
    const afterTime = Date.now();

    expect(mockListener).toHaveBeenCalled();
    const eventArg = mockListener.mock.calls[0][0] as GameEvent;
    expect(eventArg.timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(eventArg.timestamp).toBeLessThanOrEqual(afterTime);
  });

  test('getListenerCount should return correct counts', () => {
    expect(eventBus.getListenerCount('countTest')).toBe(0);
    const l1 = eventBus.subscribe('countTest', vi.fn()); // Use vi.fn()
    expect(eventBus.getListenerCount('countTest')).toBe(1);
    const l2 = eventBus.subscribe('countTest', vi.fn()); // Use vi.fn()
    expect(eventBus.getListenerCount('countTest')).toBe(2);
    eventBus.subscribe('anotherCountTest', vi.fn()); // Use vi.fn()
    expect(eventBus.getListenerCount('anotherCountTest')).toBe(1);
    expect(eventBus.getListenerCount()).toBe(3);

    l1();
    expect(eventBus.getListenerCount('countTest')).toBe(1);
    expect(eventBus.getListenerCount()).toBe(2);
    l2();
    expect(eventBus.getListenerCount('countTest')).toBe(0);
    expect(eventBus.getListenerCount()).toBe(1);
  });

  test('clearAllListeners should remove all listeners', () => {
    eventBus.subscribe('clearTest1', vi.fn()); // Use vi.fn()
    eventBus.subscribe('clearTest2', vi.fn()); // Use vi.fn()
    expect(eventBus.getListenerCount()).toBe(2);
    eventBus.clearAllListeners();
    expect(eventBus.getListenerCount()).toBe(0);
  });

  test('listener throwing an error should not stop other listeners', () => {
    const errorListener = vi.fn(() => { throw new Error("Test Error"); }); // Use vi.fn()
    const normalListener = vi.fn(); // Use vi.fn()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Use vi.spyOn

    eventBus.subscribe('errorHandlingTest', errorListener);
    eventBus.subscribe('errorHandlingTest', normalListener);

    eventBus.publish('errorHandlingTest');

    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(normalListener).toHaveBeenCalledTimes(1); // Should still be called
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
