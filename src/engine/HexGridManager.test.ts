import { HexGridManager, HexCell } from './HexGridManager';
import * as THREE from 'three';

describe('HexGridManager', () => {
  const earthRadius = 100;

  describe('Constructor and Grid Generation', () => {
    it('should create a HexGridManager instance', () => {
      const manager = new HexGridManager(earthRadius, 0);
      expect(manager).toBeInstanceOf(HexGridManager);
      expect(manager.cells).toBeInstanceOf(Map);
    });

    it('should generate the correct number of cells for 0 subdivisions (icosahedron vertices)', () => {
      const manager = new HexGridManager(earthRadius, 0);
      // An icosahedron has 12 vertices. Each vertex becomes a cell center.
      expect(manager.cells.size).toBe(12);
      manager.cells.forEach(cell => {
        expect(cell.verticesUnitSphere.length).toBe(5); // Each cell around an icosahedron vertex is a pentagon
      });
    });

    it('should generate the correct number of cells for 1 subdivision', () => {
      const manager = new HexGridManager(earthRadius, 1);
      // V = 12 (original vertices)
      // E = 30 (original edges) -> new vertices at midpoints
      // F = 20 (original faces) -> new vertices at centroids (not directly used for cell centers here)
      // For subdivision level 1:
      // Number of vertices in the subdivided mesh = V_icosa + E_icosa = 12 + 30 = 42
      // These become the cell centers.
      expect(manager.cells.size).toBe(42);
    });

    it('should generate the correct number of cells for 2 subdivisions', () => {
      const manager = new HexGridManager(earthRadius, 2);
      // For subdivision 's', V_s = V_0 * (4^s - 1) / 3 + V_0 (This formula is for faces, not directly vertices of dual)
      // Euler characteristic: V - E + F = 2.
      // For an icosahedron: V=12, E=30, F=20.
      // Subdividing once: each face -> 4 faces. F1 = 20 * 4 = 80.
      // E1 = E0 + 3*F0 = 30 + 3*20 = 90 (Incorrect formula)
      // V_new = V_old + E_old = 12 + 30 = 42 for s=1.
      // For s=1, F_new = F_old * 4 = 20 * 4 = 80. E_new = E_old * 2 + 3*F_old = 30*2 + 3*20 = 120 (Incorrect)
      // Number of vertices in a subdivided icosahedron (where each original edge is split s times):
      // V(s) = 10 * (2^s)^2 + 2 = 10 * 4^s + 2. This is for number of vertices if edges are divided s times.
      // The formula used in code is: V_0 (original vertices) + V_mid_edges + V_mid_faces...
      // Simpler: After s subdivisions, an icosahedron has 10 * (4^s) + 2 vertices. No, this is for faces if starting from a triangle.
      // Correct for Goldberg Polyhedron G(m,n): Number of vertices = 10 * (m^2 + mn + n^2) + 2.
      // Our subdivision scheme is class I, so G(s,0) where s is effectively 2^subdivisions.
      // No, the code splits each triangular face into 4 smaller triangles.
      // Vertices of the subdivided mesh become cell centers.
      // s=0: 12 vertices (original icosahedron)
      // s=1: 12 (original) + 30 (edge midpoints) = 42 vertices.
      // s=2: 42 (from s=1) + (edges of s=1 mesh, which are 2*E0 + 3*F0 = 60+60=120 for a planar graph, but on sphere E = F*3/2)
      //      Each triangle from s=0 (20) becomes 4 triangles. Each of these 4 has 3 new edge midpoints.
      //      Total faces after s subdivisions = 20 * (4^s).
      //      Total edges after s subdivisions = 30 * (2^s). (Incorrect, edges are 3 * F / 2)
      //      Total vertices after s subdivisions = 10 * (2^s)^2 + 2.  No, this is 10*N^2+2, N=2^s.
      //      V(s) = 10 * (4^s) + 2. For s=0, V=12. For s=1, V=42. For s=2, V=162.
      expect(manager.cells.size).toBe(162); // 12 (original) + 30 (s=0 edge midpoints) + (new edges from s=1 subdivision)
    });


    it('should scale cell coordinates by earthRadius', () => {
      const manager = new HexGridManager(earthRadius, 0);
      const cell = manager.cells.values().next().value as HexCell;
      expect(cell.centerPointWorld.length()).toBeCloseTo(earthRadius);
      cell.verticesWorld.forEach(v => {
        expect(v.length()).toBeCloseTo(earthRadius);
      });
    });
  });

  describe('getCellById', () => {
    it('should return a cell for a valid ID', () => {
      const manager = new HexGridManager(earthRadius, 0);
      const firstCellId = manager.cells.keys().next().value;
      const cell = manager.getCellById(firstCellId);
      expect(cell).toBeDefined();
      expect(cell?.id).toBe(firstCellId);
    });

    it('should return undefined for an invalid ID', () => {
      const manager = new HexGridManager(earthRadius, 0);
      const cell = manager.getCellById('invalid-id');
      expect(cell).toBeUndefined();
    });
  });

  describe('getCellForPoint', () => {
    it('should return the closest cell to a given world point', () => {
      const manager = new HexGridManager(earthRadius, 1); // Use more cells for better testing
      const testPoint = new THREE.Vector3(earthRadius, 0, 0); // Point on the sphere surface
      const cell = manager.getCellForPoint(testPoint);
      expect(cell).toBeDefined();
      expect(cell).not.toBeNull();

      if (cell) {
        // The test point should be relatively close to the center of the returned cell
        const distanceToCellCenter = testPoint.distanceTo(cell.centerPointWorld);
        // This threshold is arbitrary and depends on cell density
        // For subdivision 1, cells are still quite large.
        expect(distanceToCellCenter).toBeLessThan(earthRadius * 0.8); // Max distance to center of a large cell

        // Check if the point is closer to this cell's center than to any other cell's center
        let minDistanceSq = Infinity;
        let closestCellToCheck: HexCell | null = null;
        manager.cells.forEach(c => {
            const distSq = testPoint.distanceToSquared(c.centerPointWorld);
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                closestCellToCheck = c;
            }
        });
        expect(closestCellToCheck?.id).toBe(cell.id);
      }
    });

    it('should return a cell even if the point is slightly off the sphere surface', () => {
      const manager = new HexGridManager(earthRadius, 0);
      const testPoint = new THREE.Vector3(earthRadius * 1.1, 0, 0); // Slightly outside
      const cell = manager.getCellForPoint(testPoint);
      expect(cell).toBeDefined();
      expect(cell).not.toBeNull();
    });

    it('should return null if no cells exist (empty manager)', () => {
        const manager = new HexGridManager(earthRadius, 0);
        manager.cells.clear(); // Manually empty cells
        const testPoint = new THREE.Vector3(earthRadius, 0, 0);
        const cell = manager.getCellForPoint(testPoint);
        expect(cell).toBeNull();
      });
  });

  describe('Neighbor Calculation', () => {
    it('should assign neighbors to cells', () => {
      const manager = new HexGridManager(earthRadius, 0); // 12 cells, all pentagons
      manager.cells.forEach(cell => {
        expect(cell.neighborIds.length).toBeGreaterThanOrEqual(1); // At least one neighbor for a connected graph
        // For an icosahedron (subdivisions=0), each of the 12 cells is a pentagon and should have 5 neighbors.
        expect(cell.neighborIds.length).toBe(5);
      });
    });

    it('each neighborId should correspond to an existing cell', () => {
        const manager = new HexGridManager(earthRadius, 1);
        manager.cells.forEach(cell => {
            cell.neighborIds.forEach(neighborId => {
                expect(manager.getCellById(neighborId)).toBeDefined();
            });
        });
    });

    it('neighbor relationship should be symmetric (if A is neighbor of B, B is neighbor of A)', () => {
        const manager = new HexGridManager(earthRadius, 1);
        manager.cells.forEach(cellA => {
            cellA.neighborIds.forEach(cellB_Id => {
                const cellB = manager.getCellById(cellB_Id);
                expect(cellB).toBeDefined();
                if (cellB) {
                    expect(cellB.neighborIds).toContain(cellA.id);
                }
            });
        });
    });

    // More specific tests for neighbor counts could be added if exact geometry is known
    // e.g., for subdivision 1, there are 12 pentagons and 30 hexagons.
    // Pentagons should have 5 neighbors, hexagons should have 6.
    it('should have correct number of neighbors for cells in subdivision 1 grid', () => {
        const manager = new HexGridManager(earthRadius, 1); // 42 cells total
        let pentagonCount = 0;
        let hexagonCount = 0;

        manager.cells.forEach(cell => {
            if (cell.verticesUnitSphere.length === 5) { // Pentagonal cell (original icosahedron vertices)
                expect(cell.neighborIds.length).toBe(5);
                pentagonCount++;
            } else if (cell.verticesUnitSphere.length === 6) { // Hexagonal cell (midpoints of original icosahedron edges)
                expect(cell.neighborIds.length).toBe(6);
                hexagonCount++;
            } else {
                // This case should not happen for G(1,0) subdivision
                fail(`Cell ${cell.id} has an unexpected number of vertices: ${cell.verticesUnitSphere.length}`);
            }
        });
        expect(pentagonCount).toBe(12); // Should be 12 pentagons
        expect(hexagonCount).toBe(30); // Should be 30 hexagons
    });
  });
});
