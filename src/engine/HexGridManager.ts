import * as THREE from 'three';
// import { IEntity } from './entities/BaseEntity'; // Not directly used in HexCell itself
// import { Faction } from './GameEngine'; // Not directly used in HexCell itself

// Helper function for quantized vertex keys
const PRECISION_FACTOR = 10000; // For 4-5 decimal places of effective precision
function getQuantizedVertexKey(vertex: THREE.Vector3): string {
    return `${Math.round(vertex.x * PRECISION_FACTOR)}_${Math.round(vertex.y * PRECISION_FACTOR)}_${Math.round(vertex.z * PRECISION_FACTOR)}`;
}

export interface HexCell {
    id: string;
    centerPointUnitSphere: THREE.Vector3;
    verticesUnitSphere: THREE.Vector3[]; // Vertices defining the cell boundary
    centerPointWorld: THREE.Vector3;
    verticesWorld: THREE.Vector3[];

    neighborIds: string[];
    entitiesInCell: string[]; // IDs of entities within this cell
    shProps?: import('./GameEngine').HexTileProperties;
    mesh?: THREE.Mesh | THREE.LineLoop;

    // Pathfinding properties
    movementCost: number;
}

export class HexGridManager {
    public cells: Map<string, HexCell> = new Map();
    private earthRadius: number;

    constructor(earthRadius: number, subdivisions: number = 2) {
        this.earthRadius = earthRadius;
        this.generateGrid(subdivisions);
        this.computeNeighbors(); // Compute neighbors after grid generation
    }

    private generateGrid(subdivisions: number): void {
        console.log(`[HexGridManager] Generating grid with ${subdivisions} subdivisions for Earth radius ${this.earthRadius}.`);

        const t = (1.0 + Math.sqrt(5.0)) / 2.0;
        const icosahedronVerticesUnitSphere: THREE.Vector3[] = [
            new THREE.Vector3(-1,  t,  0), new THREE.Vector3( 1,  t,  0), new THREE.Vector3(-1, -t,  0), new THREE.Vector3( 1, -t,  0),
            new THREE.Vector3( 0, -1,  t), new THREE.Vector3( 0,  1,  t), new THREE.Vector3( 0, -1, -t), new THREE.Vector3( 0,  1, -t),
            new THREE.Vector3( t,  0, -1), new THREE.Vector3( t,  0,  1), new THREE.Vector3(-t,  0, -1), new THREE.Vector3(-t,  0,  1),
        ].map(v => v.normalize());

        const icosahedronFaces: [number, number, number][] = [
            [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2],
            [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5],
            [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
        ];

        let faces: THREE.Vector3[][] = icosahedronFaces.map(faceIndices =>
            faceIndices.map(index => icosahedronVerticesUnitSphere[index].clone())
        );

        for (let s = 0; s < subdivisions; s++) {
            const newFaces: THREE.Vector3[][] = [];
            faces.forEach(face => {
                const v0 = face[0]; const v1 = face[1]; const v2 = face[2];
                const m01 = new THREE.Vector3().addVectors(v0, v1).multiplyScalar(0.5).normalize();
                const m12 = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5).normalize();
                const m20 = new THREE.Vector3().addVectors(v2, v0).multiplyScalar(0.5).normalize();
                newFaces.push([v0.clone(), m01.clone(), m20.clone()]);
                newFaces.push([m01.clone(), v1.clone(), m12.clone()]);
                newFaces.push([m20.clone(), m12.clone(), v2.clone()]);
                newFaces.push([m01.clone(), m12.clone(), m20.clone()]);
            });
            faces = newFaces;
        }

        const uniqueVertices = new Map<string, THREE.Vector3>();
        const vertexToFacesMap = new Map<string, THREE.Vector3[][]>();
        const vertexKeyPrecision = 100000; // Higher precision for identifying unique vertices

        faces.forEach(face => {
            face.forEach(vertex => {
                const key = `${vertex.x.toFixed(6)}_${vertex.y.toFixed(6)}_${vertex.z.toFixed(6)}`; // Slightly higher precision for map key
                if (!uniqueVertices.has(key)) uniqueVertices.set(key, vertex);
                if (!vertexToFacesMap.has(key)) vertexToFacesMap.set(key, []);
                vertexToFacesMap.get(key)!.push(face);
            });
        });

        let cellIdCounter = 0;
        uniqueVertices.forEach((vertexCenter, key) => {
            const surroundingFaces = vertexToFacesMap.get(key)!;
            const faceCentroids = surroundingFaces.map(face =>
                new THREE.Vector3().add(face[0]).add(face[1]).add(face[2]).multiplyScalar(1/3).normalize()
            );

            if (faceCentroids.length < 3) {
                console.warn(`Vertex ${key} has only ${faceCentroids.length} surrounding faces. Skipping cell generation.`);
                return;
            }

            const tangentPlaneNormal = vertexCenter.clone();
            const arbitraryVec = (Math.abs(tangentPlaneNormal.x) > 0.9) ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
            const tangentU = new THREE.Vector3().crossVectors(tangentPlaneNormal, arbitraryVec).normalize();
            const tangentV = new THREE.Vector3().crossVectors(tangentPlaneNormal, tangentU).normalize();

            faceCentroids.sort((a, b) => {
                const aProj = new THREE.Vector2(a.dot(tangentU), a.dot(tangentV));
                const bProj = new THREE.Vector2(b.dot(tangentU), b.dot(tangentV));
                return Math.atan2(aProj.y, aProj.x) - Math.atan2(bProj.y, bProj.x);
            });

            const cell: HexCell = {
                id: `cell_${cellIdCounter++}`,
                centerPointUnitSphere: vertexCenter.clone(),
                verticesUnitSphere: faceCentroids,
                centerPointWorld: vertexCenter.clone().multiplyScalar(this.earthRadius),
                verticesWorld: faceCentroids.map(v => v.clone().multiplyScalar(this.earthRadius)),
                neighborIds: [],
                entitiesInCell: [],
                movementCost: 1.0, // Default movement cost
            };
            this.cells.set(cell.id, cell);
        });
        console.log(`[HexGridManager] Generated ${this.cells.size} cells.`);
    }

    private computeNeighbors(): void {
        const edgeToCellsMap = new Map<string, string[]>();

        this.cells.forEach(cell => {
            cell.neighborIds = []; // Clear existing neighbors before recomputing
            for (let i = 0; i < cell.verticesUnitSphere.length; i++) {
                const v1 = cell.verticesUnitSphere[i];
                const v2 = cell.verticesUnitSphere[(i + 1) % cell.verticesUnitSphere.length];

                const keyV1 = getQuantizedVertexKey(v1);
                const keyV2 = getQuantizedVertexKey(v2);

                const edgeKey = keyV1 < keyV2 ? `${keyV1}|${keyV2}` : `${keyV2}|${keyV1}`;

                if (!edgeToCellsMap.has(edgeKey)) {
                    edgeToCellsMap.set(edgeKey, []);
                }
                // Avoid adding same cell twice to an edge if vertices are truly identical (quantized)
                if (!edgeToCellsMap.get(edgeKey)!.includes(cell.id)) {
                    edgeToCellsMap.get(edgeKey)!.push(cell.id);
                }
            }
        });

        edgeToCellsMap.forEach(cellIdsOnEdge => {
            if (cellIdsOnEdge.length === 2) {
                const cell1 = this.cells.get(cellIdsOnEdge[0]);
                const cell2 = this.cells.get(cellIdsOnEdge[1]);
                if (cell1 && cell2) {
                    if (!cell1.neighborIds.includes(cell2.id)) cell1.neighborIds.push(cell2.id);
                    if (!cell2.neighborIds.includes(cell1.id)) cell2.neighborIds.push(cell1.id);
                }
            } else if (cellIdsOnEdge.length > 2) {
                // This might indicate an issue with vertex quantization or grid topology if non-manifold edges are not expected.
                // For this grid generation, it should ideally be 2.
                console.warn(`Edge shared by more than 2 cells: ${cellIdsOnEdge.join(', ')}`);
            }
        });
        console.log(`[HexGridManager] Computed neighbors for ${this.cells.size} cells.`);
    }

    public getCellById(id: string): HexCell | undefined {
        return this.cells.get(id);
    }

    public getCellForPoint(worldPoint: THREE.Vector3): HexCell | null {
        if (this.cells.size === 0) return null;
        const unitPoint = worldPoint.clone().normalize();
        let closestCell: HexCell | null = null;
        let minDistanceSq = Infinity;

        this.cells.forEach(cell => {
            const distSq = cell.centerPointUnitSphere.distanceToSquared(unitPoint);
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                closestCell = cell;
            }
        });
        return closestCell;
    }

    // A* Pathfinding Implementation
    public findPath(startCellId: string, endCellId: string): string[] | null {
        const startNode = this.cells.get(startCellId);
        const endNode = this.cells.get(endCellId);

        if (!startNode || !endNode) return null;
        if (startCellId === endCellId) return [startCellId];

        // Node structure for pathfinding
        interface PathNode {
            cellId: string;
            gCost: number; // Cost from start to this node
            hCost: number; // Heuristic cost from this node to end
            fCost: number; // gCost + hCost
            parentCellId?: string;
        }

        const openSet = new Map<string, PathNode>(); // cellId -> PathNode
        const closedSet = new Set<string>(); // cellId

        const calculateHeuristic = (cellA: HexCell, cellB: HexCell): number => {
            return Math.acos(THREE.MathUtils.clamp(cellA.centerPointUnitSphere.dot(cellB.centerPointUnitSphere), -1, 1));
        };

        const startPathNode: PathNode = {
            cellId: startCellId,
            gCost: 0,
            hCost: calculateHeuristic(startNode, endNode),
            fCost: calculateHeuristic(startNode, endNode),
            parentCellId: undefined
        };
        openSet.set(startCellId, startPathNode);

        const cameFrom = new Map<string, string>(); // For path reconstruction: childId -> parentId

        while (openSet.size > 0) {
            let currentCellId: string | undefined;
            let lowestFCost = Infinity;
            openSet.forEach((nodeData, nodeId) => {
                if (nodeData.fCost < lowestFCost) {
                    lowestFCost = nodeData.fCost;
                    currentCellId = nodeId;
                } else if (nodeData.fCost === lowestFCost) { // Tie-breaking: prefer higher gCost (closer to target)
                    if (nodeData.gCost > openSet.get(currentCellId!)!.gCost) {
                        currentCellId = nodeId;
                    }
                }
            });

            if (!currentCellId) break;

            const currentNodeData = openSet.get(currentCellId)!;
            const currentCell = this.cells.get(currentCellId)!;

            if (currentCellId === endCellId) { // Target found
                const path: string[] = [currentCellId];
                let currentTraceId = currentCellId;
                while (cameFrom.has(currentTraceId)) {
                    currentTraceId = cameFrom.get(currentTraceId)!;
                    path.unshift(currentTraceId);
                }
                return path;
            }

            openSet.delete(currentCellId);
            closedSet.add(currentCellId);

            for (const neighborId of currentCell.neighborIds) {
                if (closedSet.has(neighborId)) continue;

                const neighborCell = this.cells.get(neighborId);
                if (!neighborCell) continue;

                const tentativeGCost = currentNodeData.gCost + neighborCell.movementCost;

                let neighborNode = openSet.get(neighborId);
                if (!neighborNode || tentativeGCost < neighborNode.gCost) {
                    cameFrom.set(neighborId, currentCellId);
                    const hCost = calculateHeuristic(neighborCell, endNode);
                    neighborNode = {
                        cellId: neighborId,
                        gCost: tentativeGCost,
                        hCost: hCost,
                        fCost: tentativeGCost + hCost,
                        parentCellId: currentCellId // Kept for potential direct reconstruction if needed, but cameFrom is primary
                    };
                    openSet.set(neighborId, neighborNode);
                }
            }
        }
        return null; // No path found
    }
}
