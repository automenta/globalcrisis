import * as THREE from 'three';
import { IEntity } from './entities/BaseEntity';
import { Faction } from './GameEngine'; // Assuming Faction is exported from GameEngine

export interface HexCell {
    id: string;
    // Center point in 3D space on the surface of a unit sphere
    centerPointUnitSphere: THREE.Vector3;
    // Vertices defining the cell boundary on the surface of a unit sphere
    verticesUnitSphere: THREE.Vector3[];

    // Actual world-space coordinates (scaled by Earth radius)
    centerPointWorld: THREE.Vector3;
    verticesWorld: THREE.Vector3[];

    neighborIds: string[];

    // Game data
    biomeId?: string;
    // Later: resourceDistribution: Map<string, number>;
    controllingFactionId?: string;
    entitiesInCell: string[]; // IDs of entities within this cell

    // Visual representation (optional, could be managed separately)
    mesh?: THREE.Mesh | THREE.LineLoop;
}

export class HexGridManager {
    public cells: Map<string, HexCell> = new Map();
    private earthRadius: number; // Visual radius of the Earth in Three.js scene

    constructor(earthRadius: number, subdivisions: number = 2) {
        this.earthRadius = earthRadius;
        this.generateGrid(subdivisions);
    }

    private generateGrid(subdivisions: number): void {
        // Placeholder for icosahedron generation and subdivision
        // This is a complex part.
        // For now, let's create a few dummy cells for structure.

        console.log(`[HexGridManager] Generating grid with ${subdivisions} subdivisions for Earth radius ${this.earthRadius}.`);

        // Step 1: Create a base polyhedron (e.g., Icosahedron)
        const t = (1.0 + Math.sqrt(5.0)) / 2.0; // Golden ratio

        const icosahedronVerticesUnitSphere: THREE.Vector3[] = [
            new THREE.Vector3(-1,  t,  0).normalize(),
            new THREE.Vector3( 1,  t,  0).normalize(),
            new THREE.Vector3(-1, -t,  0).normalize(),
            new THREE.Vector3( 1, -t,  0).normalize(),

            new THREE.Vector3( 0, -1,  t).normalize(),
            new THREE.Vector3( 0,  1,  t).normalize(),
            new THREE.Vector3( 0, -1, -t).normalize(),
            new THREE.Vector3( 0,  1, -t).normalize(),

            new THREE.Vector3( t,  0, -1).normalize(),
            new THREE.Vector3( t,  0,  1).normalize(),
            new THREE.Vector3(-t,  0, -1).normalize(),
            new THREE.Vector3(-t,  0,  1).normalize(),
        ];

        // Icosahedron faces (vertex indices)
        const icosahedronFaces: [number, number, number][] = [
            [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
            [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
            [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
            [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
        ];

        let faces: THREE.Vector3[][] = icosahedronFaces.map(faceIndices =>
            faceIndices.map(index => icosahedronVerticesUnitSphere[index].clone())
        );

        // Step 2: Subdivide faces
        // For each subdivision level, each triangle is split into 4 smaller triangles
        for (let s = 0; s < subdivisions; s++) {
            const newFaces: THREE.Vector3[][] = [];
            for (const face of faces) {
                const v0 = face[0];
                const v1 = face[1];
                const v2 = face[2];

                const m01 = new THREE.Vector3().addVectors(v0, v1).multiplyScalar(0.5).normalize();
                const m12 = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5).normalize();
                const m20 = new THREE.Vector3().addVectors(v2, v0).multiplyScalar(0.5).normalize();

                newFaces.push([v0.clone(), m01.clone(), m20.clone()]);
                newFaces.push([m01.clone(), v1.clone(), m12.clone()]);
                newFaces.push([m20.clone(), m12.clone(), v2.clone()]);
                newFaces.push([m01.clone(), m12.clone(), m20.clone()]);
            }
            faces = newFaces;
        }

        // Step 3: Create hexagonal/pentagonal cells from the vertices of the subdivided icosahedron mesh.
        // Each vertex of the subdivided mesh will become the center of a hexagonal (or pentagonal) cell.
        // The vertices of these cells will be the centroids of the triangles surrounding each vertex.

        const uniqueVertices = new Map<string, THREE.Vector3>(); // Store unique vertices by string key "x_y_z"
        const vertexToFacesMap = new Map<string, THREE.Vector3[][]>(); // Map vertex key to list of faces it belongs to

        for (const face of faces) {
            for (const vertex of face) {
                const key = `${vertex.x.toFixed(5)}_${vertex.y.toFixed(5)}_${vertex.z.toFixed(5)}`;
                if (!uniqueVertices.has(key)) {
                    uniqueVertices.set(key, vertex);
                }
                if (!vertexToFacesMap.has(key)) {
                    vertexToFacesMap.set(key, []);
                }
                vertexToFacesMap.get(key)!.push(face);
            }
        }

        let cellIdCounter = 0;
        uniqueVertices.forEach((vertexCenter, key) => {
            const surroundingFaces = vertexToFacesMap.get(key)!;
            const cellVerticesUnitSphere: THREE.Vector3[] = [];

            // Order surrounding face centroids to form the cell polygon
            // This requires a robust way to sort points around a central point on a sphere.
            // A common approach is to sort them by angle around the vertexCenter.
            const faceCentroids = surroundingFaces.map(face =>
                new THREE.Vector3()
                    .add(face[0])
                    .add(face[1])
                    .add(face[2])
                    .multiplyScalar(1/3)
                    .normalize()
            );

            if (faceCentroids.length < 3) { // Should not happen in a valid subdivided icosahedron
                console.warn(`Vertex ${key} has only ${faceCentroids.length} surrounding faces. Skipping cell generation.`);
                return;
            }

            // Sort faceCentroids around vertexCenter.
            // Project onto a plane tangent to the sphere at vertexCenter for 2D sorting.
            const tangentPlaneNormal = vertexCenter.clone();
            const arbitraryVector = (Math.abs(tangentPlaneNormal.x) > 0.9) ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
            const tangentU = new THREE.Vector3().crossVectors(tangentPlaneNormal, arbitraryVector).normalize();
            const tangentV = new THREE.Vector3().crossVectors(tangentPlaneNormal, tangentU).normalize();

            faceCentroids.sort((a, b) => {
                const aProjected = new THREE.Vector2(a.dot(tangentU), a.dot(tangentV));
                const bProjected = new THREE.Vector2(b.dot(tangentU), b.dot(tangentV));
                return Math.atan2(aProjected.y, aProjected.x) - Math.atan2(bProjected.y, bProjected.x);
            });

            const cell: HexCell = {
                id: `cell_${cellIdCounter++}`,
                centerPointUnitSphere: vertexCenter.clone(),
                verticesUnitSphere: faceCentroids, // These are the vertices of the hex/pentagon cell
                centerPointWorld: vertexCenter.clone().multiplyScalar(this.earthRadius),
                verticesWorld: faceCentroids.map(v => v.clone().multiplyScalar(this.earthRadius)),
                neighborIds: [], // To be computed later
                entitiesInCell: [],
            };
            this.cells.set(cell.id, cell);
        });

        console.log(`[HexGridManager] Generated ${this.cells.size} hexagonal/pentagonal cells.`);

        // Step 4: Compute neighbor relationships (placeholder)
        this.computeNeighbors();
    }

    private computeNeighbors(): void {
        // For each cell, find its neighbors.
        // Two cells are neighbors if they share an edge (i.e., two vertices in their verticesUnitSphere list).
        // This is computationally intensive if done naively (O(N^2 * V^2)).
        // A more efficient way is to build an edge map: map pairs of vertex indices (sorted) to the cells sharing that edge.

        // This is a simplified placeholder. A robust implementation is needed.
        const allCellIds = Array.from(this.cells.keys());
        this.cells.forEach(cell => {
            // Naive: check distance between centers (not accurate for shared edges but a rough start)
            const potentialNeighbors = allCellIds
                .filter(otherId => otherId !== cell.id)
                .map(otherId => this.cells.get(otherId)!)
                .sort((a, b) => cell.centerPointUnitSphere.distanceToSquared(a.centerPointUnitSphere) - cell.centerPointUnitSphere.distanceToSquared(b.centerPointUnitSphere));

            // Typically, a hex cell has 6 neighbors (or 5 for pentagons at icosahedron vertices)
            const numNeighbors = cell.verticesUnitSphere.length; // Pentagons or Hexagons
            for(let i = 0; i < Math.min(numNeighbors, potentialNeighbors.length); i++) {
                 // This simple distance check is not guaranteed to find true topological neighbors
                 // A proper check involves finding shared vertices between cell polygons.
                 // For now, we assume the closest N cell centers are neighbors.
                const distThreshold = (this.earthRadius / (5 * Math.pow(2, (this.cells.get(potentialNeighbors[i].id)!.verticesUnitSphere.length === 5 ? 0 : 1 )))) * 1.5; // Heuristic threshold
                // A more robust way: find cells that share at least two vertices.
                // Iterate over cell's vertices. For each pair of adjacent vertices (edge), find other cell that has same edge.
                // This is complex. For now, this is a placeholder.
                // A proper solution involves checking shared vertices between cell polygons.
                // This distance based approach is a rough approximation and will have errors.
                // A true adjacency check would iterate through all other cells and see if their `verticesUnitSphere`
                // share two common vertices with the current cell's `verticesUnitSphere`.
            }
             // A more robust method:
            const cellVerticesKeys = new Set(cell.verticesUnitSphere.map(v => `${v.x.toFixed(4)}_${v.y.toFixed(4)}_${v.z.toFixed(4)}`));
            this.cells.forEach(otherCell => {
                if (cell.id === otherCell.id) return;
                let sharedVertices = 0;
                for (const ov of otherCell.verticesUnitSphere) {
                    if (cellVerticesKeys.has(`${ov.x.toFixed(4)}_${ov.y.toFixed(4)}_${ov.z.toFixed(4)}`)) {
                        sharedVertices++;
                    }
                }
                if (sharedVertices >= 2) { // If they share 2 vertices, they share an edge
                    cell.neighborIds.push(otherCell.id);
                }
            });


        });
        console.log(`[HexGridManager] Computed (approximate) neighbors for cells.`);
    }

    public getCellById(id: string): HexCell | undefined {
        return this.cells.get(id);
    }

    // Method to find the closest cell to a point on the sphere
    public getCellForPoint(worldPoint: THREE.Vector3): HexCell | null {
        if (this.cells.size === 0) return null;

        const unitPoint = worldPoint.clone().normalize();
        let closestCell: HexCell | null = null;
        let minDistanceSq = Infinity;

        for (const cell of this.cells.values()) {
            const distSq = cell.centerPointUnitSphere.distanceToSquared(unitPoint);
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                closestCell = cell;
            }
        }
        return closestCell;
    }
}

// Example Usage (for testing, not part of the class itself)
// const gridManager = new HexGridManager(2, 1); // Earth radius 2, 1 subdivision
// console.log(gridManager.cells.values().next().value);
// const testPoint = new THREE.Vector3(1,1,1).normalize().multiplyScalar(2);
// console.log("Cell for test point:", gridManager.getCellForPoint(testPoint)?.id);

// Next steps:
// 1. Refine generateGrid to create actual hexagonal cells from the subdivided icosahedron.
//    This usually involves taking the vertices of the subdivided triangles as the centers of hexagons,
//    and the centers of the original triangles (and midpoints of edges) as vertices of the hexagons.
//    Or, more simply, each triangle of the subdivided icosahedron *is* a cell, and we draw its boundary.
//    For "hexagonal grid," users usually expect cells with ~6 neighbors.
// 2. Implement neighbor finding.
// 3. Integrate into Earth3D for visualization.
// 4. Integrate into GameEngine for game logic.
