import { GameEngine } from './GameEngine';
import { HexGridManager, HexCell } from './HexGridManager';
import * as THREE from 'three';

import { vi } from 'vitest'; // Import vi for mocking

// Minimal mock for SoundManager if its constructor or methods are called during GameEngine init
vi.mock('./SoundManager', () => {
  return {
    SoundManager: vi.fn().mockImplementation(() => {
      return {
        setMusic: vi.fn(),
        playAmbientSound: vi.fn(),
        stopAmbientSound: vi.fn(),
        playSoundEffect: vi.fn(),
      };
    }),
  };
});

// Mock other managers if their constructors are complex or cause issues
// For now, assume they are simple enough or their impact is minimal for these tests.
// vi.mock('./WeatherManager');
// vi.mock('./DisasterManager');
// vi.mock('./TechManager');
// vi.mock('./TerritoryManager');


describe('GameEngine HexGridManager Integration', () => {
  const earthRadius = 120; // Using a different radius for tests to ensure it's passed through
  const subdivisions = 1; // Using 1 subdivision for manageable cell counts

  let gameEngine: GameEngine;

  beforeEach(() => {
    // Reset mocks if they are stateful between tests, though SoundManager mock is stateless here
    // (SoundManager as ReturnType<typeof vi.fn>).mockClear(); // Example if SoundManager itself was mocked

    gameEngine = new GameEngine(earthRadius, subdivisions);
  });

  it('should initialize HexGridManager in the constructor', () => {
    expect(gameEngine.hexGridManager).toBeInstanceOf(HexGridManager);
    // Check if HexGridManager received the correct parameters (indirectly by checking its properties)
    // @ts-ignore // Accessing private member for test verification
    expect(gameEngine.hexGridManager['earthRadius']).toBe(earthRadius);
    // We can also check number of cells expected for these params
    // For subdivision 1, expected cells = 12 (original vertices) + 30 (edge midpoints) = 42.
    expect(gameEngine.hexGridManager.cells.size).toBe(42);
  });

  it('getHexGridManager() should return the HexGridManager instance', () => {
    const hgm = gameEngine.getHexGridManager();
    expect(hgm).toBeInstanceOf(HexGridManager);
    expect(hgm).toBe(gameEngine.hexGridManager);
  });

  it('getHexGridCells() should return the map of hex cells from HexGridManager', () => {
    const cells = gameEngine.getHexGridCells();
    expect(cells).toBeInstanceOf(Map);
    expect(cells.size).toBe(gameEngine.hexGridManager.cells.size);
    if (cells.size > 0) {
      const firstCellFromGameEngine = cells.values().next().value;
      const firstCellFromHGM = gameEngine.hexGridManager.cells.values().next().value;
      expect(firstCellFromGameEngine.id).toBe(firstCellFromHGM.id);
      expect(firstCellFromGameEngine).toBeInstanceOf(Object); // HexCell is an interface, check for object structure
      expect(firstCellFromGameEngine.centerPointWorld).toBeInstanceOf(THREE.Vector3);
    }
  });

  it('getCellForWorldPoint() should correctly call HexGridManager and return a cell', () => {
    const testPoint = new THREE.Vector3(earthRadius, 0, 0); // A point on the sphere surface

    // Spy on the HGM instance's method to ensure GameEngine calls it
    const hgmSpy = vi.spyOn(gameEngine.hexGridManager, 'getCellForPoint');

    const cell = gameEngine.getCellForWorldPoint(testPoint);

    expect(hgmSpy).toHaveBeenCalledWith(testPoint);
    expect(cell).toBeDefined();
    expect(cell).not.toBeNull();
    if (cell) {
      expect(cell.centerPointWorld).toBeInstanceOf(THREE.Vector3);
      // Further validation: ensure the returned cell is actually the closest one
      let closestDistSq = Infinity;
      let actualClosestCell: HexCell | null = null;
      gameEngine.hexGridManager.cells.forEach(c => {
        const distSq = testPoint.distanceToSquared(c.centerPointWorld);
        if (distSq < closestDistSq) {
          closestDistSq = distSq;
          actualClosestCell = c;
        }
      });
      expect(cell.id).toBe(actualClosestCell?.id);
    }
    hgmSpy.mockRestore();
  });

  it('getCellForWorldPoint() should return null if HexGridManager returns null', () => {
    const testPoint = new THREE.Vector3(0,0,0); // A point that might be problematic or if grid is empty
     // Spy and mock HGM's method to return null
    const hgmSpy = vi.spyOn(gameEngine.hexGridManager, 'getCellForPoint').mockReturnValue(null);

    const cell = gameEngine.getCellForWorldPoint(testPoint);
    expect(hgmSpy).toHaveBeenCalledWith(testPoint);
    expect(cell).toBeNull();

    hgmSpy.mockRestore();
  });

  it('getHexCellById() should correctly call HexGridManager and return a cell', () => {
    // Get a valid cell ID from the HGM instance
    const firstCellId = gameEngine.hexGridManager.cells.keys().next().value;
    if (!firstCellId) {
      fail('HexGridManager has no cells, cannot test getHexCellById');
    }

    const hgmSpy = vi.spyOn(gameEngine.hexGridManager, 'getCellById');
    const cell = gameEngine.getHexCellById(firstCellId);

    expect(hgmSpy).toHaveBeenCalledWith(firstCellId);
    expect(cell).toBeDefined();
    expect(cell?.id).toBe(firstCellId);
    expect(cell?.centerPointWorld).toBeInstanceOf(THREE.Vector3);
    hgmSpy.mockRestore();
  });

  it('getHexCellById() should return undefined if HexGridManager returns undefined', () => {
    const invalidId = 'non-existent-cell-id';
    const hgmSpy = vi.spyOn(gameEngine.hexGridManager, 'getCellById');
    const cell = gameEngine.getHexCellById(invalidId);

    expect(hgmSpy).toHaveBeenCalledWith(invalidId);
    expect(cell).toBeUndefined();
    hgmSpy.mockRestore();
  });

});
