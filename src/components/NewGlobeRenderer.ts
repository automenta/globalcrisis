import * as THREE from 'three';
import SimplexNoise from 'simplex-noise';
// Updated GameEngine import to reflect new structure
import {
    GameState,
    IEntity,
    EntityLocationType,
    HexTileProperties,
    MetamodelType
} from '../engine/GameEngine';
import { HexGridManager, HexCell } from '../engine/HexGridManager';
// Silent Helix specific entities
import {
    ScientistEntity,
    DroneEntity,
    MediaOutletEntity,
    HospitalEntity,
    WhistleblowerEntity
} from '../engine/entities';

// Legacy entity imports (to be removed or adapted if their components are reused)
import { SatelliteEntity, ISatelliteDataComponent, DEFAULT_SATELLITE_DATA_COMPONENT_NAME, SatelliteType } from '../engine/entities/SatelliteEntity';
import { ITransformComponent, DEFAULT_TRANSFORM_COMPONENT_NAME } from '../engine/components/TransformComponent';
import { IHealthComponent } from '../engine/components/HealthComponent'; // May be reused for SH entities if they adopt components
import { IPhysicsPropertiesComponent, DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME } from '../engine/components/PhysicsPropertiesComponent';
import { PHYSICS_TO_VISUAL_SCALE, VectorOps, EARTH_RADIUS_METERS } from '../engine/PhysicsManager'; // Keep for physics scale if needed
import { CityEntity } from '../engine/entities/CityEntity'; // Legacy
import { FactoryEntity } from '../engine/entities/FactoryEntity'; // Legacy


const VISUAL_EARTH_RADIUS = 2;
// ENTITY_VISUAL_SCALE can be adjusted for Silent Helix entities
const ENTITY_VISUAL_SCALE = 0.05;

// Helper for randomizing pulse animation per cell
interface String {
    hashCode(): number;
}
String.prototype.hashCode = function() {
    var hash = 0, i, chr;
    if (this.length === 0) return hash;
    for (i = 0; i < this.length; i++) {
        chr = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};


export interface NewGlobeRendererCallbacks {
    onHexCellClick?: (cell: HexCell, event: MouseEvent) => void;
    onEntityClick?: (entity: IEntity, event: MouseEvent) => void;
}

export class NewGlobeRenderer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;

    private earthMesh!: THREE.Mesh;
    private atmosphereMesh?: THREE.Mesh;
    private cloudsMesh?: THREE.Mesh;
    private starfield?: THREE.Points;

    private hexGridManager: HexGridManager;
    private hexCellMeshes: Map<string, THREE.Mesh> = new Map();

    private entityVisuals: Map<string, THREE.Object3D> = new Map();

    private mouse: THREE.Vector2 = new THREE.Vector2();
    private raycaster: THREE.Raycaster = new THREE.Raycaster();

    private animationId: number = 0;
    private isDragging: boolean = false;
    private previousMousePosition = { x: 0, y: 0 };

    private callbacks: NewGlobeRendererCallbacks;
    private currentGameState: GameState | null = null;

    private selectedHexId: string | null = null;
    private selectedEntityId: string | null = null;

    // Material Caches
    private factionMaterialsCache: Map<string, THREE.MeshBasicMaterial> = new Map();
    private biomeMaterialsCache: Map<string, THREE.MeshBasicMaterial> = new Map();

    private defaultHexMaterial!: THREE.MeshBasicMaterial;
    private selectedHexMaterial!: THREE.MeshBasicMaterial;

    private highlightVisuals: Map<string, THREE.Object3D> = new Map();

    private containerElement: HTMLElement;

    constructor(container: HTMLElement, callbacks: NewGlobeRendererCallbacks = {}) {
        this.containerElement = container;
        this.callbacks = callbacks;

        this.initializeMaterials(); // Initialize materials first

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            (EARTH_RADIUS_METERS * 10) * PHYSICS_TO_VISUAL_SCALE
        );
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });

        this.setupRenderer(container);
        this.setupCamera();
        this.setupLighting();

        this.createEarth();
        this.createAtmosphere();
        this.createClouds();
        this.createStarfield();

        this.hexGridManager = new HexGridManager(VISUAL_EARTH_RADIUS, 1);
        this.createHexGridVisuals();

        this.setupControls();
        this.setupEventListeners();

        this.animate();
    }

    private setupRenderer(container: HTMLElement): void {
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        container.appendChild(this.renderer.domElement);
    }

    private initializeMaterials(): void {
        this.defaultHexMaterial = new THREE.MeshBasicMaterial({
            color: 0x222222, transparent: true, opacity: 0.2, side: THREE.DoubleSide,
        });
        this.selectedHexMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
        });
    }

    private setupCamera(): void {
        this.camera.position.set(0, 0, VISUAL_EARTH_RADIUS * 2.5);
        this.camera.lookAt(0, 0, 0);
    }

    private setupLighting(): void {
        const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
        sunLight.position.set(5, 3, 5);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        this.scene.add(sunLight);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
    }

    private createEarth(): void {
        const geometry = new THREE.SphereGeometry(VISUAL_EARTH_RADIUS, 64, 64);

        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d')!;
        this.generateProceduralEarthTexture(ctx, canvas.width, canvas.height);
        const earthTexture = new THREE.CanvasTexture(canvas);
        earthTexture.wrapS = THREE.RepeatWrapping;
        earthTexture.wrapT = THREE.RepeatWrapping;
        earthTexture.colorSpace = THREE.SRGBColorSpace;

        const material = new THREE.MeshStandardMaterial({
            map: earthTexture,
            roughness: 0.85,
            metalness: 0.1,
        });

        this.earthMesh = new THREE.Mesh(geometry, material);
        this.earthMesh.name = "Earth";
        this.earthMesh.receiveShadow = true;
        this.earthMesh.castShadow = true;
        this.scene.add(this.earthMesh);
    }

    private generateProceduralEarthTexture(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        const simplex = new SimplexNoise();

        const getColor = (elevation: number, moisture: number) => {
            if (elevation < -0.1) return [10, 20, 80 + elevation * 200];
            else if (elevation < 0.05) return [20, 80, 150 + elevation * 400];
            else if (elevation < 0.15) {
                if (moisture > 0.3) return [139, 178, 102];
                return [210, 180, 140];
            } else if (elevation < 0.4) {
                if (moisture > 0.5) return [34, 139, 34];
                if (moisture > 0.1) return [124, 252, 0];
                return [188, 143, 143];
            } else if (elevation < 0.6) {
                if (moisture > 0.3) return [85, 107, 47];
                return [139, 119, 101];
            } else if (elevation < 0.8) {
                return [100, 100, 100];
            } else {
                return [220, 220, 220];
            }
        };

        for (let j = 0; j < height; j++) {
            for (let i = 0; i < width; i++) {
                const index = (j * width + i) * 4;
                const u = i / width;
                const v = j / height;
                const lon = u * 2 * Math.PI;
                const lat = (v - 0.5) * Math.PI;

                const x = Math.cos(lat) * Math.cos(lon);
                const y = Math.cos(lat) * Math.sin(lon);
                const z = Math.sin(lat);

                let elevation = 0;
                let frequency = 2.5;
                let amplitude = 1;
                let lacunarity = 2.0;
                let persistence = 0.5;

                for (let o = 0; o < 6; o++) {
                    elevation += simplex.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
                    frequency *= lacunarity;
                    amplitude *= persistence;
                }
                elevation = elevation / 1.8;

                let moisture = 0;
                frequency = 1.5;
                amplitude = 1;
                for (let o = 0; o < 4; o++) {
                    moisture += simplex.noise3D(x * frequency + 100, y * frequency + 100, z * frequency + 100) * amplitude;
                    frequency *= lacunarity;
                    amplitude *= persistence;
                }
                moisture = (moisture / 1.5 + 1) / 2;

                const temperatureFactor = 1 - Math.abs(j - height / 2) / (height / 2);

                if (temperatureFactor < 0.15 && elevation > 0) {
                   elevation = Math.max(elevation, 0.75);
                }
                if (temperatureFactor < 0.1 && elevation <= 0.05 ) {
                    elevation = 0.75;
                }

                const [r, g, b] = getColor(elevation, moisture);
                data[index] = r;
                data[index + 1] = g;
                data[index + 2] = b;
                data[index + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    private createAtmosphere(): void {
        const geometry = new THREE.SphereGeometry(VISUAL_EARTH_RADIUS + 0.1, 64, 64);
        const material = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                uniform vec3 viewVector;

                void main() {
                    float intensity = pow(0.7 - dot(vNormal, normalize(viewVector - vPosition)), 2.0);
                    gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity * 0.8;
                }
            `,
            uniforms: {
                viewVector: { value: this.camera.position }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
        });
        this.atmosphereMesh = new THREE.Mesh(geometry, material);
        this.atmosphereMesh.name = "Atmosphere";
        this.scene.add(this.atmosphereMesh);
    }

    private createClouds(): void {
        const cloudGeometry = new THREE.SphereGeometry(VISUAL_EARTH_RADIUS + 0.05, 64, 32);
        const cloudCanvas = document.createElement('canvas');
        cloudCanvas.width = 2048;
        cloudCanvas.height = 1024;
        const cloudCtx = cloudCanvas.getContext('2d')!;
        this.generateProceduralCloudTexture(cloudCtx, cloudCanvas.width, cloudCanvas.height);

        const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
        cloudTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        cloudTexture.wrapS = THREE.RepeatWrapping;
        cloudTexture.wrapT = THREE.RepeatWrapping;
        cloudTexture.colorSpace = THREE.SRGBColorSpace;

        const cloudMaterial = new THREE.MeshStandardMaterial({
            map: cloudTexture,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
            blending: THREE.NormalBlending,
            roughness: 0.9,
            metalness: 0.1,
        });
        this.cloudsMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
        this.cloudsMesh.name = "Clouds";
        this.scene.add(this.cloudsMesh);
    }

    private generateProceduralCloudTexture(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        const simplexPrimary = new SimplexNoise(Math.random().toString());
        const simplexSecondary = new SimplexNoise(Math.random().toString());
        const simplexWisps = new SimplexNoise(Math.random().toString());

        for (let j = 0; j < height; j++) {
            for (let i = 0; i < width; i++) {
                const index = (j * width + i) * 4;
                const u = i / width;
                const v = j / height;
                const lon = u * 2 * Math.PI;
                const lat = (v - 0.5) * Math.PI;

                const x = Math.cos(lat) * Math.cos(lon);
                const y = Math.cos(lat) * Math.sin(lon);
                const zVal = Math.sin(lat);

                let baseNoise = 0;
                let freq = 1.8;
                let amp = 1.0;
                for(let k=0; k<4; k++) {
                    baseNoise += simplexPrimary.noise3D(x * freq, y * freq, zVal * freq + 10) * amp;
                    freq *= 2.0;
                    amp *= 0.6;
                }
                baseNoise = (baseNoise / 1.8 + 1) / 2;

                let detailNoise = 0;
                freq = 4.5;
                amp = 0.7;
                for(let k=0; k<3; k++) {
                    detailNoise += simplexSecondary.noise3D(x * freq + 5, y * freq + 15, zVal * freq + 25) * amp;
                    freq *= 2.2;
                    amp *= 0.5;
                }
                detailNoise = (detailNoise / 1.5 + 1) / 2;

                let wispNoise = 0;
                freq = 8.0;
                amp = 0.4;
                for(let k=0; k<2; k++) {
                    wispNoise += simplexWisps.noise3D(x * freq - 10, y * freq - 5, zVal * freq - 15) * amp;
                    freq *= 2.5;
                    amp *= 0.4;
                }
                wispNoise = (wispNoise / 1.0 + 1) / 2;

                let combinedNoise = baseNoise;
                combinedNoise = combinedNoise * (0.7 + detailNoise * 0.3);
                combinedNoise = Math.min(1.0, combinedNoise + wispNoise * 0.1);

                const cloudThreshold = 0.50;
                let cloudAlpha = 0;
                if (combinedNoise > cloudThreshold) {
                  cloudAlpha = Math.pow((combinedNoise - cloudThreshold) / (1.0 - cloudThreshold), 1.8);
                  cloudAlpha = Math.min(1.0, cloudAlpha * 1.3);
                }

                const cloudBrightness = 230 + combinedNoise * 25;

                data[index]     = cloudBrightness;
                data[index + 1] = cloudBrightness;
                data[index + 2] = cloudBrightness;
                data[index + 3] = cloudAlpha * 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    private createStarfield(): void {
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xFFFFFF,
            size: 0.02,
            sizeAttenuation: true
        });

        const starVertices = [];
        const starCount = 10000;
        const starfieldRadius = Math.max(200, this.camera.far / 4);

        for (let i = 0; i < starCount; i++) {
            const r = starfieldRadius * (0.8 + Math.random() * 0.4);
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos((Math.random() * 2) - 1);

            starVertices.push(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            );
        }

        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        this.starfield = new THREE.Points(starsGeometry, starsMaterial);
        this.starfield.name = "Starfield";
        this.scene.add(this.starfield);
    }

    private createHexGridVisuals(): void {
        this.hexCellMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
        });
        this.hexCellMeshes.clear();

        const defaultHexMaterial = this.defaultHexMaterial;

        const outlineMaterial = new THREE.LineBasicMaterial({
            color: 0x888888, transparent: true, opacity: 0.3
        });

        this.hexGridManager.cells.forEach(cell => {
            if (cell.verticesWorld.length < 3) return;

            const slightlyElevatedVertices = cell.verticesWorld.map(v => v.clone().normalize().multiplyScalar(VISUAL_EARTH_RADIUS + 0.001));

            const pointsForMesh: THREE.Vector3[] = [];
            const indices: number[] = [];
            const cellCenterProjected = cell.centerPointWorld.clone().normalize().multiplyScalar(VISUAL_EARTH_RADIUS + 0.001);
            pointsForMesh.push(cellCenterProjected);

            for (let i = 0; i < slightlyElevatedVertices.length; i++) {
                pointsForMesh.push(slightlyElevatedVertices[i]);
                indices.push(0, i + 1, (i + 1) % slightlyElevatedVertices.length + 1);
            }

            const geometry = new THREE.BufferGeometry().setFromPoints(pointsForMesh);
            geometry.setIndex(indices);
            geometry.computeVertexNormals();

            // Each hex mesh gets its own material instance initially.
            // This will be updated dynamically in updateCurrentGameState.
            const hexMesh = new THREE.Mesh(geometry, this.defaultHexMaterial.clone());
            hexMesh.name = `HexCell_${cell.id}`;
            hexMesh.userData = { cellId: cell.id, type: 'hex_cell', cellRef: cell };

            this.scene.add(hexMesh);
            this.hexCellMeshes.set(cell.id, hexMesh);

            const outlineGeometry = new THREE.BufferGeometry().setFromPoints([...slightlyElevatedVertices, slightlyElevatedVertices[0]]);
            const outline = new THREE.LineLoop(outlineGeometry, outlineMaterial.clone()); // Clone outline material too
            outline.name = `HexOutline_${cell.id}`;
            hexMesh.add(outline);
        });
        console.log(`[NewGlobeRenderer] Created visuals for ${this.hexCellMeshes.size} hex cells.`);
    }

    // styleHexCell is used for selection highlighting and dynamic updates based on SH properties
    public styleHexCell(
        cellId: string,
        baseMaterial?: THREE.Material, // Material based on faction/biome/default
        pulseColor?: THREE.Color,      // For trust/suspicion pulsing
        pulseIntensity: number = 0,    // 0 to 1 for pulsing effect
        isSelected?: boolean
    ): void {
        const hexMesh = this.hexCellMeshes.get(cellId);
        if (!hexMesh || !(hexMesh.material instanceof THREE.MeshBasicMaterial)) return;

        let targetMaterial = baseMaterial || this.defaultHexMaterial;
        if (isSelected) {
            targetMaterial = this.selectedHexMaterial;
        }

        // Apply base material if different
        if (hexMesh.material.uuid !== targetMaterial.uuid) {
            hexMesh.material = targetMaterial;
        }

        // Pulsing effect: Modulate color and opacity
        if (pulseColor && pulseIntensity > 0 && !isSelected) {
            const baseColor = (targetMaterial as THREE.MeshBasicMaterial).color.clone();
            const finalColor = baseColor.lerp(pulseColor, pulseIntensity * 0.7); // Don't fully override

            // Ensure the material is a unique instance for this cell if pulsing
            if (!hexMesh.userData.isPulsingMaterialUnique) {
                 hexMesh.material = (hexMesh.material as THREE.MeshBasicMaterial).clone();
                 hexMesh.userData.isPulsingMaterialUnique = true;
            }

            (hexMesh.material as THREE.MeshBasicMaterial).color.set(finalColor);
            // Opacity can also be pulsed, e.g., base opacity + pulseIntensity * some_factor
            (hexMesh.material as THREE.MeshBasicMaterial).opacity = (targetMaterial as THREE.MeshBasicMaterial).opacity + pulseIntensity * 0.2;
        } else if (hexMesh.userData.isPulsingMaterialUnique && !isSelected) {
            // Revert to shared material if no longer pulsing and not selected
            hexMesh.material = targetMaterial; // Re-assign to the shared instance
            hexMesh.userData.isPulsingMaterialUnique = false;
        }


        const outline = hexMesh.children.find(c => c instanceof THREE.LineLoop) as THREE.LineLoop;
        if (outline && outline.material instanceof THREE.LineBasicMaterial) {
            const newOutlineColor = isSelected ? new THREE.Color(0xffcc00) : (pulseColor || new THREE.Color(0x888888));
            const newOpacity = isSelected ? 0.9 : (pulseIntensity > 0 ? 0.5 + pulseIntensity * 0.4 : 0.3);

            if (outline.material.color.getHex() !== newOutlineColor.getHex()) {
                outline.material.color.set(newOutlineColor);
            }
            if (outline.material.opacity !== newOpacity) {
                outline.material.opacity = newOpacity;
            }
        }
    }


    public updateCurrentGameState(gameState: GameState): void {
        this.currentGameState = gameState;
        const allEntities = Array.from(gameState.entities.values());
        const currentEntityIds = new Set<string>();

        allEntities.forEach(entity => {
            currentEntityIds.add(entity.id);
            const visual = this.getOrCreateEntityVisual(entity);
            if (visual) {
                this.updateEntityVisual(visual, entity, gameState);
            }
        });

        this.entityVisuals.forEach((visual, entityId) => {
            if (!currentEntityIds.has(entityId)) {
                this.removeEntityVisual(entityId);
            }
        });

        if (this.currentGameState) {
            this.hexGridManager.cells.forEach(cell => {
                const hexMesh = this.hexCellMeshes.get(cell.id);
                if (!hexMesh) return;

                const shProps = (cell as HexCell & {shProps?: HexTileProperties}).shProps;
                let baseMaterial = this.defaultHexMaterial;
                let pulseColor: THREE.Color | undefined = undefined;
                let pulseIntensity = 0;

                if (shProps) {
                    // Determine pulse color and intensity based on trust/suspicion
                    // Green for trust, Red for suspicion. Stronger color for higher value.
                    if (shProps.trust > shProps.suspicion && shProps.trust > 0.5) {
                        pulseColor = new THREE.Color(0x00ff00); // Green for trust
                        pulseIntensity = (shProps.trust - 0.5) * 2; // Scale 0.5-1.0 trust to 0-1 intensity
                    } else if (shProps.suspicion > shProps.trust && shProps.suspicion > 0.3) {
                        pulseColor = new THREE.Color(0xff0000); // Red for suspicion
                        pulseIntensity = (shProps.suspicion - 0.3) * 1.4; // Scale 0.3-1.0 suspicion to 0-1 intensity (approx)
                    }
                    pulseIntensity = Math.min(1, Math.max(0, pulseIntensity)) * (0.3 + Math.sin(Date.now() * 0.005 + cell.id.hashCode()) * 0.2); // Sinusoidal pulse
                }

                // Faction coloring (simplified, assuming player faction has a color)
                // This part can be expanded if multiple factions control hexes.
                // For now, let's assume player faction color if a hex is highly controlled.
                const playerFaction = this.currentGameState.factions.get('player_consortium');
                if (playerFaction && playerFaction.color && shProps && shProps.trust > 0.8) { // Example: player control
                     const factionColorKey = `${playerFaction.color}_${0.45}`; // Opacity for faction layer
                     if (this.factionMaterialsCache.has(factionColorKey)) {
                        baseMaterial = this.factionMaterialsCache.get(factionColorKey)!;
                     } else {
                        const newFactionMaterial = new THREE.MeshBasicMaterial({
                            color: new THREE.Color(playerFaction.color),
                            transparent: true, opacity: 0.45, side: THREE.DoubleSide,
                        });
                        this.factionMaterialsCache.set(factionColorKey, newFactionMaterial);
                        baseMaterial = newFactionMaterial;
                     }
                }

                this.styleHexCell(cell.id, baseMaterial, pulseColor, pulseIntensity, this.selectedHexId === cell.id);
            });
        }
    }


    private getOrCreateEntityVisual(entity: IEntity): THREE.Object3D | null {
        if (this.entityVisuals.has(entity.id)) {
            return this.entityVisuals.get(entity.id)!;
        }

        let newVisual: THREE.Object3D | null = null;
        // Use entity.type (MetamodelType) for Silent Helix entities
        switch (entity.type) {
            case 'scientist':
                newVisual = this.createScientistVisual(entity as ScientistEntity);
                break;
            case 'drone':
                newVisual = this.createDroneVisual(entity as DroneEntity);
                break;
            case 'media_outlet':
                newVisual = this.createMediaOutletVisual(entity as MediaOutletEntity);
                break;
            case 'hospital':
                newVisual = this.createHospitalVisual(entity as HospitalEntity);
                break;
            case 'whistleblower':
                newVisual = this.createWhistleblowerVisual(entity as WhistleblowerEntity);
                break;
            // Legacy entity types (can be removed if not used)
            case 'SatelliteEntity':
                newVisual = this.createSatelliteVisual(entity as SatelliteEntity);
                break;
            case 'CityEntity':
                newVisual = this.createCityVisual(entity as CityEntity);
                break;
            case 'FactoryEntity':
                newVisual = this.createFactoryVisual(entity as FactoryEntity);
                break;
            case 'InfantryUnitEntity': // Legacy
                newVisual = this.createGroundUnitVisual(entity, 'infantry');
                break;
            default:
                // Check for legacy entityType if entity.type is not specific enough
                const legacyEntityType = (entity as any).entityType;
                if (legacyEntityType === 'GenericAirUnit') { // Example for adapting old types
                    newVisual = this.createAirUnitVisual(entity);
                } else if (legacyEntityType === 'GenericSeaUnit') {
                    newVisual = this.createSeaUnitVisual(entity);
                } else {
                    console.warn(`No visual creation logic for entity type: ${entity.type || legacyEntityType}`);
                }
                break;
        }

        if (newVisual) {
            // Use entity.type for Silent Helix
            newVisual.userData = { entityId: entity.id, entityType: entity.type, entityRef: entity, type: 'entity_visual' };

            // Simplified status indicator (e.g. a small dot above the entity)
            // Full health bar might be overkill or depend on specific SH entity properties
            // const statusIndicatorSprite = this.createStatusIndicator(entity);
            // if (statusIndicatorSprite) {
            //     newVisual.add(statusIndicatorSprite);
            // }

            this.entityVisuals.set(entity.id, newVisual);
            this.scene.add(newVisual);

            // Set initial position for surface entities
            if (entity.location.type === EntityLocationType.HexTile && entity.location.hexCellId) {
                const cell = this.hexGridManager.getCellById(entity.location.hexCellId);
                if (cell) {
                    newVisual.position.copy(cell.centerPointWorld.clone().normalize().multiplyScalar(VISUAL_EARTH_RADIUS + ENTITY_VISUAL_SCALE * 0.1)); // Slightly above surface
                    const surfaceNormal = cell.centerPointWorld.clone().normalize();
                    newVisual.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), surfaceNormal);
                }
            }
            return newVisual;
        }
        return null;
    }

    private updateEntityVisual(visual: THREE.Object3D, entity: IEntity, gameState: GameState): void {
        // Update position for mobile entities based on entity.location
        if (entity.location.type === EntityLocationType.HexTile && entity.location.hexCellId) {
            const cell = this.hexGridManager.getCellById(entity.location.hexCellId);
            if (cell) {
                const targetPosition = cell.centerPointWorld.clone().normalize().multiplyScalar(VISUAL_EARTH_RADIUS + ENTITY_VISUAL_SCALE * 0.1);
                // Lerp for smooth movement if desired, or direct set
                visual.position.lerp(targetPosition, 0.1);

                const surfaceNormal = cell.centerPointWorld.clone().normalize();
                const up = new THREE.Vector3(0,1,0);
                visual.quaternion.setFromUnitVectors(up, surfaceNormal);

            }
        }
        // else if entity.location.type === EntityLocationType.Global, position might be fixed or handled differently.

        // Call type-specific update logic
        switch (entity.type) {
            case 'scientist':
                this.updateScientistVisual(visual, entity as ScientistEntity, gameState);
                break;
            case 'drone':
                this.updateDroneVisual(visual, entity as DroneEntity, gameState);
                break;
            // Other Silent Helix entity types...

            // Legacy
            case 'SatelliteEntity':
                const transformCompSat = entity.getComponent<ITransformComponent>(DEFAULT_TRANSFORM_COMPONENT_NAME);
                this.updateSatelliteVisual(visual, entity as SatelliteEntity, transformCompSat);
                break;
            case 'CityEntity':
                 const transformCompCity = entity.getComponent<ITransformComponent>(DEFAULT_TRANSFORM_COMPONENT_NAME);
                this.updateCityVisual(visual, entity as CityEntity, transformCompCity, gameState);
                break;
            // ... other legacy types
        }

        const statusIndicator = visual.children.find(child => child.userData.isStatusIndicator) as THREE.Sprite;
        if (statusIndicator) {
            this.updateStatusIndicator(statusIndicator, entity, gameState);
        }
    }

    private removeEntityVisual(entityId: string): void {
        const visual = this.entityVisuals.get(entityId);
        if (visual) {
            this.scene.remove(visual);
            if (visual instanceof THREE.Mesh) {
                visual.geometry?.dispose();
                if (Array.isArray(visual.material)) {
                    visual.material.forEach(m => m.dispose());
                } else {
                    visual.material?.dispose();
                }
            } else {
                visual.traverse(child => {
                    if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
                        (child as THREE.Mesh).geometry?.dispose();
                        const mat = (child as THREE.Mesh).material;
                        if (Array.isArray(mat)) {
                            mat.forEach(m => m.dispose());
                        } else if (mat) {
                            mat.dispose();
                        }
                    }
                });
            }
            this.entityVisuals.delete(entityId);
        }
    }

    private getSatelliteColor(type: SatelliteType): THREE.Color {
        switch (type) {
            case 'military': return new THREE.Color(0xff0000);
            case 'communication': return new THREE.Color(0x00ff00);
            case 'surveillance': return new THREE.Color(0xffff00);
            case 'weapon': return new THREE.Color(0xff00ff);
            case 'civilian': return new THREE.Color(0x00ffff);
            case 'scientific': return new THREE.Color(0xffa500);
            case 'navigation': return new THREE.Color(0x800080);
            default: return new THREE.Color(0xcccccc);
        }
    }

    private createSatelliteVisual(entity: SatelliteEntity): THREE.Object3D {
        const group = new THREE.Group();
        const dataComp = entity.getComponent<ISatelliteDataComponent>(DEFAULT_SATELLITE_DATA_COMPONENT_NAME);
        const baseColor = dataComp ? this.getSatelliteColor(dataComp.satelliteType) : new THREE.Color(0xcccccc);
        const metalnessValue = 0.8;
        const roughnessValue = 0.3;

        // Main body
        const bodyGeometry = new THREE.BoxGeometry(ENTITY_VISUAL_SCALE * 0.5, ENTITY_VISUAL_SCALE * 0.5, ENTITY_VISUAL_SCALE * 0.9);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: baseColor, roughness: roughnessValue, metalness: metalnessValue });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.name = "satellite_body";
        group.add(body);

        // Solar Panels
        const panelGeometry = new THREE.BoxGeometry(ENTITY_VISUAL_SCALE * 1.6, ENTITY_VISUAL_SCALE * 0.7, ENTITY_VISUAL_SCALE * 0.05); // Give panels some thickness
        const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x222277, side: THREE.DoubleSide, roughness: 0.2, metalness: 0.1 });

        const panel1 = new THREE.Mesh(panelGeometry, panelMaterial);
        panel1.position.x = ENTITY_VISUAL_SCALE * 0.75 + (ENTITY_VISUAL_SCALE * 0.5 / 2); // Attach to side of body
        panel1.rotation.y = Math.PI / 2; // Rotate to be flat panels
        group.add(panel1);

        const panel2 = new THREE.Mesh(panelGeometry, panelMaterial);
        panel2.position.x = -(ENTITY_VISUAL_SCALE * 0.75 + (ENTITY_VISUAL_SCALE * 0.5 / 2)); // Attach to other side
        panel2.rotation.y = Math.PI / 2;
        group.add(panel2);

        // Antenna Dish (simple cone)
        const antennaRadius = ENTITY_VISUAL_SCALE * 0.25;
        const antennaHeight = ENTITY_VISUAL_SCALE * 0.4;
        const antennaGeometry = new THREE.ConeGeometry(antennaRadius, antennaHeight, 8);
        const antennaMaterial = new THREE.MeshStandardMaterial({ color: baseColor.clone().offsetHSL(0, 0, -0.2), roughness: roughnessValue, metalness: metalnessValue });
        const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        antenna.position.z = ENTITY_VISUAL_SCALE * 0.45 + antennaHeight / 2; // Position at one end of the body
        antenna.rotation.x = Math.PI / 2; // Point it "forward" along body's Z
        group.add(antenna);

        // Small sensor pod
        const sensorGeom = new THREE.SphereGeometry(ENTITY_VISUAL_SCALE * 0.15, 8, 8);
        const sensorMat = new THREE.MeshStandardMaterial({color: 0x999999, metalness: 0.9, roughness: 0.1});
        const sensor = new THREE.Mesh(sensorGeom, sensorMat);
        sensor.position.z = -(ENTITY_VISUAL_SCALE * 0.45 + ENTITY_VISUAL_SCALE * 0.1);
        group.add(sensor);


        group.name = `Satellite_${entity.id}`;
        return group;
    }

    private updateSatelliteVisual(visual: THREE.Object3D, entity: SatelliteEntity, transformComp?: ITransformComponent): void {
        const dataComp = entity.getComponent<ISatelliteDataComponent>(DEFAULT_SATELLITE_DATA_COMPONENT_NAME);
        if (!dataComp) return;

        let effectiveColor = this.getSatelliteColor(dataComp.satelliteType);
        visual.visible = true;

        switch (dataComp.status) {
            case 'inactive':
                effectiveColor = new THREE.Color(0x555555);
                break;
            case 'compromised':
                effectiveColor = new THREE.Color(0xff8800); // Orange for compromised
                break;
            case 'destroyed':
                visual.visible = false; // Hide if destroyed
                return; // No further updates needed
            case 'active':
            default:
                // Use base effectiveColor
                break;
        }

        // Update color of main parts based on status
        const bodyMesh = visual.getObjectByName("satellite_body") as THREE.Mesh;
        if (bodyMesh && bodyMesh.material instanceof THREE.MeshStandardMaterial) {
            bodyMesh.material.color.set(effectiveColor);
        }
        const antennaMesh = visual.children.find(c => c instanceof THREE.Mesh && c.geometry instanceof THREE.ConeGeometry) as THREE.Mesh;
        if (antennaMesh && antennaMesh.material instanceof THREE.MeshStandardMaterial) {
            antennaMesh.material.color.set(effectiveColor.clone().offsetHSL(0,0,-0.2));
        }


        if (transformComp) {
            // Satellites should generally point towards the Earth center
            visual.lookAt(this.earthMesh.position);
        }
    }

    private createCityVisual(entity: CityEntity): THREE.Object3D {
        const group = new THREE.Group();
        const factionColor = entity.factionId && this.currentGameState?.factions.has(entity.factionId)
            ? new THREE.Color(this.currentGameState.factions.get(entity.factionId)!.color || 0xaaaaaa)
            : new THREE.Color(0xaaaaaa);

        const baseMaterial = new THREE.MeshStandardMaterial({
            color: factionColor,
            roughness: 0.7,
            metalness: 0.2
        });

        const buildingScales = [
            { r: 0.6, h: 1.0, x: 0, z: 0 },    // Central tower
            { r: 0.4, h: 0.7, x: 0.7, z: 0.1 },
            { r: 0.3, h: 0.5, x: -0.5, z: -0.6 },
            { r: 0.35, h: 0.8, x: 0.2, z: 0.8 },
            { r: 0.25, h: 0.6, x: -0.3, z: 0.5 },
        ];

        buildingScales.forEach(scale => {
            const radius = ENTITY_VISUAL_SCALE * scale.r * 1.2; // Adjusted scale
            const height = ENTITY_VISUAL_SCALE * scale.h * 1.5; // Adjusted scale
            const geom = new THREE.CylinderGeometry(radius * 0.8, radius, height, 8);
            const mesh = new THREE.Mesh(geom, baseMaterial);
            mesh.position.set(
                ENTITY_VISUAL_SCALE * scale.x,
                height / 2, // Positioned on the "ground" of the group
                ENTITY_VISUAL_SCALE * scale.z
            );
            group.add(mesh);
        });

        group.name = `City_${entity.id}`;
        return group;
    }

    private updateCityVisual(visual: THREE.Object3D, entity: CityEntity, transformComp?: ITransformComponent, gameState?: GameState): void {
        if (transformComp) {
            const surfaceNormal = visual.position.clone().normalize();
            visual.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfaceNormal);
        }

        if (gameState && entity.factionId) {
            const faction = gameState.factions.get(entity.factionId);
            if (faction && faction.color) {
                const newColor = new THREE.Color(faction.color);
                visual.children.forEach(child => {
                    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                        if (child.material.color.getHex() !== newColor.getHex()) {
                             child.material.color.set(newColor);
                        }
                    }
                });
            }
        }
    }

    private createFactoryVisual(entity: FactoryEntity): THREE.Object3D {
        const group = new THREE.Group();
        const factionColor = entity.factionId && this.currentGameState?.factions.has(entity.factionId)
            ? new THREE.Color(this.currentGameState.factions.get(entity.factionId)!.color || 0xbbbbbb)
            : new THREE.Color(0xbbbbbb);

        const buildingWidth = ENTITY_VISUAL_SCALE * 1.2;
        const buildingHeight = ENTITY_VISUAL_SCALE * 0.7;
        const buildingDepth = ENTITY_VISUAL_SCALE * 1.0;

        const buildingGeom = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth);
        const buildingMat = new THREE.MeshStandardMaterial({ color: factionColor, roughness: 0.7, metalness: 0.2 });
        const buildingMesh = new THREE.Mesh(buildingGeom, buildingMat);
        group.add(buildingMesh);

        const smokestackRadius = ENTITY_VISUAL_SCALE * 0.2;
        const smokestackHeight = ENTITY_VISUAL_SCALE * 1.5;
        const smokestackGeom = new THREE.CylinderGeometry(smokestackRadius, smokestackRadius * 0.8, smokestackHeight, 6);
        const smokestackMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.1 });
        const smokestackMesh = new THREE.Mesh(smokestackGeom, smokestackMat);
        smokestackMesh.position.set(-buildingWidth * 0.3, buildingHeight * 0.5 + smokestackHeight * 0.5 - buildingHeight*0.5, 0);
        group.add(smokestackMesh);

        group.name = `Factory_${entity.id}`;
        return group;
    }

    private updateFactoryVisual(visual: THREE.Object3D, entity: FactoryEntity, transformComp?: ITransformComponent, gameState?: GameState): void {
        if (transformComp) {
            const surfaceNormal = visual.position.clone().normalize();
            visual.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfaceNormal);
        }
        const buildingMesh = visual.children.find(c => c instanceof THREE.Mesh && c.geometry instanceof THREE.BoxGeometry) as THREE.Mesh;
        if (buildingMesh && buildingMesh.material instanceof THREE.MeshStandardMaterial && gameState && entity.factionId) {
            const faction = gameState.factions.get(entity.factionId);
            if (faction && faction.color) {
                buildingMesh.material.color.set(faction.color);
            }
        }
    }

    private createGroundUnitVisual(entity: IEntity, unitType: 'infantry' | 'vehicle' | 'other'): THREE.Object3D {
        const group = new THREE.Group();
        const factionColor = entity.factionId && this.currentGameState?.factions.has(entity.factionId)
            ? new THREE.Color(this.currentGameState.factions.get(entity.factionId)!.color || 0x999999)
            : new THREE.Color(0x999999);

        const unitMat = new THREE.MeshStandardMaterial({ color: factionColor, roughness: 0.6, metalness: 0.2 });

        if (unitType === 'infantry') {
            const bodyHeight = ENTITY_VISUAL_SCALE * 0.7;
            const bodyWidth = ENTITY_VISUAL_SCALE * 0.3;
            const headRadius = ENTITY_VISUAL_SCALE * 0.15;

            // Simplified humanoid: capsule for body, sphere for head
            const bodyGeom = new THREE.CapsuleGeometry(bodyWidth / 2, bodyHeight - bodyWidth, 4, 8);
            const bodyMesh = new THREE.Mesh(bodyGeom, unitMat);
            bodyMesh.position.y = (bodyHeight - bodyWidth)/2 + bodyWidth/2; // Center the capsule
            group.add(bodyMesh);

            const headGeom = new THREE.SphereGeometry(headRadius, 8, 6);
            const headMesh = new THREE.Mesh(headGeom, unitMat.clone()); // Clone material for potential color variation
            if (headMesh.material instanceof THREE.MeshStandardMaterial) {
                 headMesh.material.color.offsetHSL(0,0,0.1); // Slightly lighter head
            }
            headMesh.position.y = bodyHeight + headRadius * 0.8;
            group.add(headMesh);

        } else { // Default to a generic vehicle box if not infantry
            const unitSize = ENTITY_VISUAL_SCALE * 0.5;
            const vehicleGeom = new THREE.BoxGeometry(unitSize, unitSize * 0.6, unitSize * 0.8);
            const vehicleMesh = new THREE.Mesh(vehicleGeom, unitMat);
            vehicleMesh.position.y = unitSize * 0.3;
            group.add(vehicleMesh);
        }

        group.name = `${unitType}_${entity.id}`;
        return group;
    }

    private updateGroundUnitVisual(visual: THREE.Object3D, entity: IEntity, transformComp?: ITransformComponent, gameState?: GameState, unitType?: string): void {
        if (transformComp) {
            const surfaceNormal = visual.position.clone().normalize();
            // Align the group's Y-axis with the surface normal.
            // The children (body, head) are defined with Y as their up-axis relative to the group.
            visual.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfaceNormal);

            const physicsProps = entity.getComponent<IPhysicsPropertiesComponent>(DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME);
            if (physicsProps && VectorOps.magnitudeSq(physicsProps.velocityMps) > 0.001) {
                const velocityDirection = VectorOps.normalize(physicsProps.velocityMps);
                const tangentVelocity = velocityDirection.clone().projectOnPlane(surfaceNormal).normalize();

                if (tangentVelocity.lengthSq() > 0.5) {
                     // Create a target quaternion that aligns the model's local Z-axis (or X-axis, depending on model)
                     // with the tangentVelocity, while keeping its local Y-axis aligned with surfaceNormal.
                    const targetQuaternion = new THREE.Quaternion();
                    const tempMatrix = new THREE.Matrix4();

                    // Assuming the model's "forward" is local +Z. If it's +X, adjust accordingly.
                    // Y is up (surfaceNormal), Z is forward (tangentVelocity), X is to the right.
                    const right = new THREE.Vector3().crossVectors(surfaceNormal, tangentVelocity).normalize();
                    const forward = new THREE.Vector3().crossVectors(right, surfaceNormal).normalize(); // Re-orthogonalize forward

                    tempMatrix.makeBasis(right, surfaceNormal, forward);
                    targetQuaternion.setFromRotationMatrix(tempMatrix);

                    // Smoothly interpolate to the target rotation if desired, or set directly
                    // visual.quaternion.slerp(targetQuaternion, 0.1); // For smoother turning
                    visual.quaternion.copy(targetQuaternion); // For immediate turning

                }
            }
        }

        // Update faction color for all mesh children
        if (gameState && entity.factionId) {
            const faction = gameState.factions.get(entity.factionId);
            if (faction && faction.color) {
                const newColor = new THREE.Color(faction.color);
                visual.children.forEach(child => {
                    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                         if (child.name === "headMesh" && child.material.color.getHex() !== newColor.clone().offsetHSL(0,0,0.1).getHex()) { // Example for head
                            child.material.color.set(newColor.clone().offsetHSL(0,0,0.1));
                         } else if (child.material.color.getHex() !== newColor.getHex()) {
                            child.material.color.set(newColor);
                         }
                    }
                });
            }
        }
    }

    // Placeholder visual creation methods for Silent Helix Entities
    private createScientistVisual(entity: ScientistEntity): THREE.Object3D {
        const group = new THREE.Group();
        const color = entity.allegiance === 'rogue' ? 0xffa500 : 0x00ddff; // Orange for rogue, cyan for consortium
        const geom = new THREE.CapsuleGeometry(ENTITY_VISUAL_SCALE * 0.2, ENTITY_VISUAL_SCALE * 0.5, 4, 8);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.y = ENTITY_VISUAL_SCALE * 0.25;
        group.add(mesh);
        group.name = `Scientist_${entity.id}`;
        return group;
    }

    private createDroneVisual(entity: DroneEntity): THREE.Object3D {
        const group = new THREE.Group();
        const color = entity.factionId === 'player_consortium' ? 0x00ff00 : 0x888888; // Green for player
        const geom = new THREE.SphereGeometry(ENTITY_VISUAL_SCALE * 0.3, 8, 6);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.6 });
        const mesh = new THREE.Mesh(geom, mat);
        // Add small "wings" or "propellers"
        const wingGeom = new THREE.BoxGeometry(ENTITY_VISUAL_SCALE * 0.8, ENTITY_VISUAL_SCALE * 0.1, ENTITY_VISUAL_SCALE * 0.2);
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const wing1 = new THREE.Mesh(wingGeom, wingMat);
        wing1.position.x = ENTITY_VISUAL_SCALE * 0.3;
        const wing2 = wing1.clone();
        wing2.position.x = -ENTITY_VISUAL_SCALE * 0.3;
        group.add(mesh, wing1, wing2);
        group.name = `Drone_${entity.id}`;
        return group;
    }

    private createMediaOutletVisual(entity: MediaOutletEntity): THREE.Object3D {
        const group = new THREE.Group();
        let color = 0xcccccc; // Neutral default
        if (entity.bias === 'pro-consortium') color = 0x4488ff; // Blueish
        else if (entity.bias === 'anti-consortium') color = 0xff8844; // Orangish
        const geom = new THREE.BoxGeometry(ENTITY_VISUAL_SCALE * 0.6, ENTITY_VISUAL_SCALE * 0.8, ENTITY_VISUAL_SCALE * 0.6);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
        const mesh = new THREE.Mesh(geom, mat);
        // Add a small "antenna"
        const antennaGeom = new THREE.CylinderGeometry(ENTITY_VISUAL_SCALE*0.05, ENTITY_VISUAL_SCALE*0.05, ENTITY_VISUAL_SCALE*0.5, 6);
        const antennaMat = new THREE.MeshStandardMaterial({color: 0x777777});
        const antenna = new THREE.Mesh(antennaGeom, antennaMat);
        antenna.position.y = ENTITY_VISUAL_SCALE * 0.65;
        group.add(mesh, antenna);
        group.name = `MediaOutlet_${entity.id}`;
        return group;
    }

    private createHospitalVisual(entity: HospitalEntity): THREE.Object3D {
        const group = new THREE.Group();
        const color = 0xffffff; // White
        const baseGeom = new THREE.BoxGeometry(ENTITY_VISUAL_SCALE * 0.7, ENTITY_VISUAL_SCALE * 0.5, ENTITY_VISUAL_SCALE * 0.7);
        const baseMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
        const baseMesh = new THREE.Mesh(baseGeom, baseMat);
        // Add a red cross symbol (simplified as a small red box)
        const crossGeom = new THREE.BoxGeometry(ENTITY_VISUAL_SCALE*0.2, ENTITY_VISUAL_SCALE*0.2, ENTITY_VISUAL_SCALE*0.05);
        const crossMat = new THREE.MeshStandardMaterial({color: 0xff0000});
        const crossMesh = new THREE.Mesh(crossGeom, crossMat);
        crossMesh.position.set(0, ENTITY_VISUAL_SCALE*0.15, ENTITY_VISUAL_SCALE*0.36);
        group.add(baseMesh, crossMesh);
        group.name = `Hospital_${entity.id}`;
        return group;
    }

    private createWhistleblowerVisual(entity: WhistleblowerEntity): THREE.Object3D {
        const group = new THREE.Group();
        const color = 0xffdd00; // Yellow/gold
        const geom = new THREE.ConeGeometry(ENTITY_VISUAL_SCALE * 0.2, ENTITY_VISUAL_SCALE * 0.6, 8);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.y = ENTITY_VISUAL_SCALE * 0.3;
        group.add(mesh);
        group.name = `Whistleblower_${entity.id}`;
        return group;
    }


    private createAirUnitVisual(entity: IEntity): THREE.Object3D {
        const group = new THREE.Group();
        const factionColor = entity.factionId && this.currentGameState?.factions.has(entity.factionId)
            ? new THREE.Color(this.currentGameState.factions.get(entity.factionId)!.color || 0x87CEEB)
            : new THREE.Color(0x87CEEB);

        const unitSize = ENTITY_VISUAL_SCALE * 0.6;
        const airUnitGeom = new THREE.ConeGeometry(unitSize * 0.4, unitSize, 4);

        const airUnitMat = new THREE.MeshStandardMaterial({ color: factionColor, roughness: 0.4, metalness: 0.5 });
        const airUnitMesh = new THREE.Mesh(airUnitGeom, airUnitMat);
        airUnitMesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        group.add(airUnitMesh);

        group.name = `AirUnit_${entity.id}`;
        return group;
    }

    private updateAirUnitVisual(visual: THREE.Object3D, entity: IEntity, transformComp?: ITransformComponent, gameState?: GameState): void {
        if (transformComp) {
            const physicsProps = entity.getComponent<IPhysicsPropertiesComponent>(DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME);
            if (physicsProps && VectorOps.magnitudeSq(physicsProps.velocityMps) > 0.01) {
                const velocityDirection = VectorOps.normalize(physicsProps.velocityMps);
                visual.lookAt(VectorOps.add(visual.position, velocityDirection));
            }
        }

        const unitMesh = visual.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh;
         if (unitMesh && unitMesh.material instanceof THREE.MeshStandardMaterial && gameState && entity.factionId) {
            const faction = gameState.factions.get(entity.factionId);
            if (faction && faction.color) {
                unitMesh.material.color.set(new THREE.Color(faction.color).offsetHSL(0, 0.1, 0.1));
            }
        }
    }

    private createSeaUnitVisual(entity: IEntity): THREE.Object3D {
        const group = new THREE.Group();
        const factionColor = entity.factionId && this.currentGameState?.factions.has(entity.factionId)
            ? new THREE.Color(this.currentGameState.factions.get(entity.factionId)!.color || 0x00008B)
            : new THREE.Color(0x00008B);

        const unitSize = ENTITY_VISUAL_SCALE * 0.7;
        const shipGeom = new THREE.BoxGeometry(unitSize * 0.5, unitSize * 0.2, unitSize * 1.5);

        const shipMat = new THREE.MeshStandardMaterial({ color: factionColor, roughness: 0.5, metalness: 0.4 });
        const shipMesh = new THREE.Mesh(shipGeom, shipMat);
        group.add(shipMesh);

        group.name = `SeaUnit_${entity.id}`;
        return group;
    }

    private updateSeaUnitVisual(visual: THREE.Object3D, entity: IEntity, transformComp?: ITransformComponent, gameState?: GameState): void {
        if (transformComp) {
            const surfaceNormal = visual.position.clone().normalize();
            visual.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfaceNormal);

            const physicsProps = entity.getComponent<IPhysicsPropertiesComponent>(DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME);
            if (physicsProps && VectorOps.magnitudeSq(physicsProps.velocityMps) > 0.001) {
                const velocityDirection = VectorOps.normalize(physicsProps.velocityMps);
                const tangentVelocity = velocityDirection.clone().projectOnPlane(surfaceNormal).normalize();

                if (tangentVelocity.lengthSq() > 0.5) {
                    const localForward = new THREE.Vector3(0, 0, 1);
                    const worldForwardProjected = localForward.clone().applyQuaternion(visual.quaternion).projectOnPlane(surfaceNormal).normalize();

                    if (worldForwardProjected.lengthSq() > 0.5) {
                        let angle = worldForwardProjected.angleTo(tangentVelocity);
                        const cross = new THREE.Vector3().crossVectors(worldForwardProjected, tangentVelocity);
                        const sign = Math.sign(cross.dot(surfaceNormal));

                        if (Math.abs(angle) > 0.01) {
                            const deltaRotation = new THREE.Quaternion().setFromAxisAngle(surfaceNormal, angle * sign);
                            visual.quaternion.premultiply(deltaRotation);
                        }
                         // If the model (e.g. box) is defined with its "front" along +Z,
                         // and after alignment it's facing backward relative to velocity,
                         // an additional rotation by PI around the local Y (surfaceNormal) might be needed.
                         // This depends on model definition and initial quaternion.
                         // Example: visual.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(surfaceNormal, Math.PI));
                    }
                }
            }
        }
        const unitMesh = visual.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh;
         if (unitMesh && unitMesh.material instanceof THREE.MeshStandardMaterial && gameState && entity.factionId) {
            const faction = gameState.factions.get(entity.factionId);
            if (faction && faction.color) {
                unitMesh.material.color.set(new THREE.Color(faction.color).offsetHSL(0, -0.1, -0.1));
            }
        }
    }

    // Placeholder update visual methods for Silent Helix Entities
    private updateScientistVisual(visual: THREE.Object3D, entity: ScientistEntity, gameState: GameState): void {
        // Scientist color might change based on allegiance or status
        const newColor = entity.allegiance === 'rogue' ? 0xffa500 : 0x00ddff;
        const bodyMesh = visual.children[0] as THREE.Mesh; // Assuming first child is the main mesh
        if (bodyMesh && bodyMesh.material instanceof THREE.MeshStandardMaterial) {
            if (bodyMesh.material.color.getHex() !== newColor) {
                bodyMesh.material.color.setHex(newColor);
            }
        }
        // TODO: Add animation if moving, or particles if performing action
    }

    private updateDroneVisual(visual: THREE.Object3D, entity: DroneEntity, gameState: GameState): void {
        // TODO: Rotate "propellers", show payload status, visual effect when scouting/delivering
        const bodyMesh = visual.children.find(c => c instanceof THREE.Mesh && c.geometry instanceof THREE.SphereGeometry) as THREE.Mesh;
        if (bodyMesh && bodyMesh.material instanceof THREE.MeshStandardMaterial) {
            // Example: make drone pulse if it has important payload
            if (entity.currentPayload && entity.currentPayload.length > 0) {
                const pulseFactor = Math.sin(Date.now() * 0.01) * 0.2 + 0.8;
                bodyMesh.material.color.setScalar(pulseFactor); // Simple pulse effect on brightness
            } else {
                 const baseColor = entity.factionId === 'player_consortium' ? 0x00ff00 : 0x888888;
                 if (bodyMesh.material.color.getHex() !== baseColor) bodyMesh.material.color.setHex(baseColor);
            }
        }
    }

    private updateMediaOutletVisual(visual: THREE.Object3D, entity: MediaOutletEntity, gameState: GameState): void {
        // Change color based on credibility or if recently hacked
        const bodyMesh = visual.children.find(c => c instanceof THREE.Mesh && c.geometry instanceof THREE.BoxGeometry) as THREE.Mesh;
        if (bodyMesh && bodyMesh.material instanceof THREE.MeshStandardMaterial) {
            let targetColorHex = 0xcccccc; // Neutral default
            if (entity.bias === 'pro-consortium') targetColorHex = 0x4488ff;
            else if (entity.bias === 'anti-consortium') targetColorHex = 0xff8844;

            // If low credibility, make it appear dimmer or "glitchy"
            if (entity.credibility < 0.3) {
                const dimFactor = 0.5 + entity.credibility / 0.3 * 0.5; // Scale 0-0.3 credibility to 0.5-1.0 dimFactor
                const tempColor = new THREE.Color(targetColorHex);
                tempColor.multiplyScalar(dimFactor);
                targetColorHex = tempColor.getHex();
            }
             if (bodyMesh.material.color.getHex() !== targetColorHex) {
                bodyMesh.material.color.setHex(targetColorHex);
            }
        }
    }

    private updateHospitalVisual(visual: THREE.Object3D, entity: HospitalEntity, gameState: GameState): void {
        // Visual cues for funding level or if ARDS outbreak is happening
        const baseMesh = visual.children.find(c => c instanceof THREE.Mesh && c.geometry instanceof THREE.BoxGeometry) as THREE.Mesh;
        if (baseMesh && baseMesh.material instanceof THREE.MeshStandardMaterial) {
            // Example: If very low funding, make it appear slightly greyed out
            if (entity.funding < 0.2) {
                 if (baseMesh.material.color.getHex() !== 0xdddddd) baseMesh.material.color.setHex(0xdddddd);
            } else {
                 if (baseMesh.material.color.getHex() !== 0xffffff) baseMesh.material.color.setHex(0xffffff);
            }
        }
        // TODO: Add particle effect for ARDS outbreak (red flashing)
    }

    private updateWhistleblowerVisual(visual: THREE.Object3D, entity: WhistleblowerEntity, gameState: GameState): void {
        // Could pulse based on exposure risk or information value
        const bodyMesh = visual.children[0] as THREE.Mesh; // Assuming cone is first child
        if (bodyMesh && bodyMesh.material instanceof THREE.MeshStandardMaterial) {
            if (entity.exposureRisk > 0.7) {
                // Fast, intense pulse if high risk
                const pulseFactor = Math.abs(Math.sin(Date.now() * 0.02));
                bodyMesh.material.opacity = 0.6 + pulseFactor * 0.4;
                bodyMesh.material.transparent = true;
            } else {
                bodyMesh.material.opacity = 1.0;
                bodyMesh.material.transparent = false;
            }
        }
    }


    private createUndergroundUnitVisual(entity: IEntity): THREE.Object3D {
        const group = new THREE.Group();
        const factionColor = entity.factionId && this.currentGameState?.factions.has(entity.factionId)
            ? new THREE.Color(this.currentGameState.factions.get(entity.factionId)!.color || 0x8B4513)
            : new THREE.Color(0x8B4513);

        const markerSize = ENTITY_VISUAL_SCALE * 0.4;
        const markerGeom = new THREE.ConeGeometry(markerSize, markerSize * 1.5, 8);
        const markerMat = new THREE.MeshStandardMaterial({ color: factionColor, roughness: 0.7, metalness: 0.1 });
        const markerMesh = new THREE.Mesh(markerGeom, markerMat);

        group.add(markerMesh);
        group.name = `UndergroundUnit_${entity.id}`;
        return group;
    }

    private updateUndergroundUnitVisual(visual: THREE.Object3D, entity: IEntity, transformComp?: ITransformComponent, gameState?: GameState): void {
        if (transformComp) {
            const surfacePositionPhysics = VectorOps.scale(VectorOps.normalize(transformComp.positionMeters), EARTH_RADIUS_METERS);
            const visualSurfacePosition = VectorOps.scale(surfacePositionPhysics, PHYSICS_TO_VISUAL_SCALE);
            visual.position.copy(visualSurfacePosition);

            visual.lookAt(this.earthMesh.position);
            visual.rotateX(Math.PI);
        }

        const unitMesh = visual.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh;
        if (unitMesh && unitMesh.material instanceof THREE.MeshStandardMaterial && gameState && entity.factionId) {
           const faction = gameState.factions.get(entity.factionId);
           if (faction && faction.color) {
               unitMesh.material.color.set(new THREE.Color(faction.color).offsetHSL(0, -0.2, -0.2));
           }
        }
    }

    private createStatusIndicator(entity: IEntity): THREE.Sprite | null {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 32;
        const context = canvas.getContext('2d');
        if (!context) return null;

        context.fillStyle = 'rgba(0, 255, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = 'rgba(0, 100, 0, 0.9)';
        context.lineWidth = 4;
        context.strokeRect(0, 0, canvas.width, canvas.height);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
        const sprite = new THREE.Sprite(material);

        let yOffset = ENTITY_VISUAL_SCALE * 1.2;
        const mainVisual = this.entityVisuals.get(entity.id);

        if (mainVisual) {
            try {
                const boundingBox = new THREE.Box3().setFromObject(mainVisual);
                const size = boundingBox.getSize(new THREE.Vector3());
                yOffset = size.y * 0.5 + ENTITY_VISUAL_SCALE * 0.3;
            } catch (e) {
                // console.warn("Could not get bounding box for status indicator positioning yet", e);
            }
        }

        sprite.scale.set(ENTITY_VISUAL_SCALE * 1.5, ENTITY_VISUAL_SCALE * 0.375, 1);
        sprite.position.set(0, yOffset, 0);

        sprite.name = `StatusIndicator_${entity.id}`;
        sprite.userData = { entityId: entity.id, type: 'status_indicator', isStatusIndicator: true };
        return sprite;
    }

    private updateStatusIndicator(statusSprite: THREE.Sprite, entity: IEntity, gameState: GameState): void {
        const healthComp = entity.getComponent<IHealthComponent>('HealthComponent');

        if (healthComp && statusSprite.material.map) {
            const texture = statusSprite.material.map as THREE.CanvasTexture;
            const canvas = texture.image as HTMLCanvasElement;
            const context = canvas.getContext('2d');
            if (!context) return;

            context.clearRect(0, 0, canvas.width, canvas.height);
            const healthPercentage = Math.max(0, Math.min(1, healthComp.currentHp / healthComp.maxHp));

            // Background for the bar (e.g., dark grey)
            context.fillStyle = 'rgba(50, 50, 50, 0.7)';
            context.fillRect(0, 0, canvas.width, canvas.height);

            // Health bar color based on percentage
            if (healthPercentage > 0.6) {
                context.fillStyle = 'rgba(0, 255, 0, 0.8)'; // Green
            } else if (healthPercentage > 0.3) {
                context.fillStyle = 'rgba(255, 255, 0, 0.8)'; // Yellow
            } else {
                context.fillStyle = 'rgba(255, 0, 0, 0.8)'; // Red
            }
            context.fillRect(2, 2, (canvas.width - 4) * healthPercentage, canvas.height - 4); // Inner bar with padding

            // Border
            context.strokeStyle = 'rgba(20, 20, 20, 0.9)';
            context.lineWidth = 2; // Thinner border
            context.strokeRect(0, 0, canvas.width, canvas.height);

            texture.needsUpdate = true;
            statusSprite.visible = true;
        } else {
            // If no health component, or something is wrong, hide the sprite
            statusSprite.visible = false;
        }

        // Make sprite always face camera
        statusSprite.quaternion.copy(this.camera.quaternion);

        // Adjust Y offset based on the main visual's height dynamically
        // This ensures the status bar is always positioned just above the entity visual.
        const mainVisual = this.entityVisuals.get(entity.id);
        if (mainVisual) {
            try {
                // It's important that the mainVisual has been added to the scene and its matrix world is up to date.
                // If the visual was just created in the same frame, its bounding box might not be accurate yet.
                // For status indicators added as children, their position is relative to the parent.
                // We want the status indicator to be offset in the parent's local space.
                const boundingBox = new THREE.Box3().setFromObject(mainVisual); //This computes world AABB
                const size = boundingBox.getSize(new THREE.Vector3());

                // If mainVisual is a group of meshes, its position is likely (0,0,0) relative to itself.
                // The bounding box size.y will give its height in world units.
                // We need to transform this back to the visual's local scale if ENTITY_VISUAL_SCALE is not uniform
                // or if the visual itself has internal scaling.
                // However, since statusSprite is a child of mainVisual, its y position is local.
                // We need to find the top of the mainVisual in its local space.

                // Re-evaluate local bounding box of the visual's children to set status bar position
                const localBoundingBox = new THREE.Box3();
                mainVisual.traverseVisible(child => {
                    if (child !== statusSprite && child instanceof THREE.Mesh) { // Exclude the status sprite itself
                         localBoundingBox.expandByObject(child);
                    }
                });
                const localSize = localBoundingBox.getSize(new THREE.Vector3());
                const newYOffset = localSize.y + ENTITY_VISUAL_SCALE * 0.2; // Small gap above the tallest part

                if (Math.abs(newYOffset - statusSprite.position.y) > 0.001 && isFinite(newYOffset)) {
                     statusSprite.position.y = newYOffset;
                } else if (!isFinite(newYOffset) && statusSprite.position.y !== ENTITY_VISUAL_SCALE * 1.2) {
                    // Fallback if bounding box is weird (e.g. empty visual)
                    statusSprite.position.y = ENTITY_VISUAL_SCALE * 1.2;
                }

            } catch (e) {
                 // console.warn(`Error calculating bounding box for status indicator on ${entity.id}:`, e);
                 // Fallback if bounding box calculation fails
                 if (statusSprite.position.y !== ENTITY_VISUAL_SCALE * 1.2) {
                    statusSprite.position.y = ENTITY_VISUAL_SCALE * 1.2;
                 }
            }
        }
    }

    private setupControls(): void {
        this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
        this.renderer.domElement.addEventListener('mousemove', this.onMouseMove);
        this.renderer.domElement.addEventListener('mouseup', this.onMouseUp);
        this.renderer.domElement.addEventListener('mouseleave', this.onMouseUp);
        this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    }

    private onMouseDown = (event: MouseEvent): void => {
        this.isDragging = true;
        this.previousMousePosition.x = event.clientX;
        this.previousMousePosition.y = event.clientY;
        this.containerElement.style.cursor = 'grabbing';
    };

    private onMouseMove = (event: MouseEvent): void => {
        this.mouse.x = (event.clientX / this.containerElement.clientWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / this.containerElement.clientHeight) * 2 + 1;

        if (this.isDragging) {
            const deltaMove = {
                x: event.clientX - this.previousMousePosition.x,
                y: event.clientY - this.previousMousePosition.y
            };
            const rotationSpeed = 0.005;

            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

            const yawDelta = deltaMove.x * rotationSpeed;
            const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawDelta);

            const pitchDelta = deltaMove.y * rotationSpeed;
            const pitchQuaternion = new THREE.Quaternion().setFromAxisAngle(right, pitchDelta);

            this.camera.position.applyQuaternion(yawQuaternion);
            this.camera.position.applyQuaternion(pitchQuaternion);

            this.camera.lookAt(this.earthMesh.position);

            this.previousMousePosition.x = event.clientX;
            this.previousMousePosition.y = event.clientY;
        } else {
            // this.checkForHover();
        }
    };

    private onMouseUp = (event: MouseEvent): void => {
        const dragThreshold = 5;
        const dx = event.clientX - this.previousMousePosition.x;
        const dy = event.clientY - this.previousMousePosition.y;
        const dragDistance = Math.sqrt(dx*dx + dy*dy);

        if (this.isDragging && dragDistance < dragThreshold) {
             this.handleRaycasting(event);
        } else if (!this.isDragging) {
            this.handleRaycasting(event);
        }

        this.isDragging = false;
        this.containerElement.style.cursor = 'grab';
    };

    private onWheel = (event: WheelEvent): void => {
        event.preventDefault();
        const zoomSpeed = 0.1;
        const newZ = this.camera.position.z * (1 + (event.deltaY > 0 ? zoomSpeed : -zoomSpeed));
        this.camera.position.z = Math.max(VISUAL_EARTH_RADIUS * 1.2, Math.min(VISUAL_EARTH_RADIUS * 5, newZ));
    };

    private setupEventListeners(): void {
        window.addEventListener('resize', this.onWindowResize);
    }

    private handleRaycasting = (event: MouseEvent): void => {
        this.mouse.x = (event.clientX / this.containerElement.clientWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / this.containerElement.clientHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const clickableObjects: THREE.Object3D[] = [
            ...Array.from(this.hexCellMeshes.values()),
            ...Array.from(this.entityVisuals.values())
        ];

        const intersects = this.raycaster.intersectObjects(clickableObjects, true);

        if (intersects.length > 0) {
            const firstIntersect = intersects[0];
            let clickedObject = firstIntersect.object;

            while (clickedObject && !clickedObject.userData.type && clickedObject.parent) {
                clickedObject = clickedObject.parent;
            }

            if (clickedObject.userData && clickedObject.userData.type) {
                switch (clickedObject.userData.type) {
                    case 'hex_cell':
                        if (this.selectedHexId && this.selectedHexId !== clickedObject.userData.cellId) {
                            this.styleHexCell(this.selectedHexId, this.defaultHexMaterial, undefined, false);
                        }
                        this.styleHexCell(clickedObject.userData.cellId, this.selectedHexMaterial, undefined, true);
                        this.selectedHexId = clickedObject.userData.cellId;
                        if (this.selectedEntityId) this.removeEntityHighlight(this.selectedEntityId); this.selectedEntityId = null;

                        if (this.callbacks.onHexCellClick) {
                            this.callbacks.onHexCellClick(clickedObject.userData.cellRef, event);
                        }
                        return;
                    case 'entity_visual':
                        if (this.selectedEntityId && this.selectedEntityId !== clickedObject.userData.entityId) {
                            this.removeEntityHighlight(this.selectedEntityId);
                        }
                        this.addEntityHighlight(clickedObject.userData.entityId, clickedObject);
                        this.selectedEntityId = clickedObject.userData.entityId;
                        if (this.selectedHexId) this.styleHexCell(this.selectedHexId, this.defaultHexMaterial, undefined, false); this.selectedHexId = null;

                        if (this.callbacks.onEntityClick) {
                            this.callbacks.onEntityClick(clickedObject.userData.entityRef, event);
                        }
                        return;
                }
            }
        } else {
            if (this.selectedHexId) {
                this.styleHexCell(this.selectedHexId, this.defaultHexMaterial, undefined, false);
                this.selectedHexId = null;
            }
            if (this.selectedEntityId) {
                this.removeEntityHighlight(this.selectedEntityId);
                this.selectedEntityId = null;
            }
        }
    };

    private addEntityHighlight(entityId: string, mainVisual: THREE.Object3D): void {
        if (this.highlightVisuals.has(entityId)) return;

        const boundingBox = new THREE.Box3().setFromObject(mainVisual);
        const size = boundingBox.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.z) * 0.7;
        const height = size.y * 0.1;

        const ringGeometry = new THREE.CylinderGeometry(radius, radius, height, 32, 1, true);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xffdd00,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
            depthTest: false
        });
        const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);

        ringMesh.position.copy(mainVisual.position);
        ringMesh.quaternion.copy(mainVisual.quaternion);
        ringMesh.rotateX(Math.PI / 2);

        this.scene.add(ringMesh);
        this.highlightVisuals.set(entityId, ringMesh);
    }

    private removeEntityHighlight(entityId: string): void {
        const highlight = this.highlightVisuals.get(entityId);
        if (highlight) {
            this.scene.remove(highlight);
            if (highlight instanceof THREE.Mesh) {
                highlight.geometry.dispose();
                (highlight.material as THREE.Material).dispose();
            }
            this.highlightVisuals.delete(entityId);
        }
    }

    private onWindowResize = (): void => {
        this.camera.aspect = this.containerElement.clientWidth / this.containerElement.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.containerElement.clientWidth, this.containerElement.clientHeight);
    };

    private animate = (): void => {
        this.animationId = requestAnimationFrame(this.animate);

        if (this.atmosphereMesh && (this.atmosphereMesh.material as THREE.ShaderMaterial).uniforms) {
            (this.atmosphereMesh.material as THREE.ShaderMaterial).uniforms.viewVector.value = this.camera.position;
        }

        this.renderer.render(this.scene, this.camera);
    };

    public dispose(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
        this.renderer.domElement.removeEventListener('mousemove', this.onMouseMove);
        this.renderer.domElement.removeEventListener('mouseup', this.onMouseUp);
        this.renderer.domElement.removeEventListener('mouseleave', this.onMouseUp);
        this.renderer.domElement.removeEventListener('wheel', this.onWheel);
        window.removeEventListener('resize', this.onWindowResize);

        this.entityVisuals.forEach((visual, id) => this.removeEntityVisual(id));
        this.entityVisuals.clear();

        this.hexCellMeshes.forEach(hexMesh => {
            this.scene.remove(hexMesh);
            hexMesh.geometry?.dispose();
            if (hexMesh.material instanceof THREE.Material) {
                hexMesh.material.dispose();
            }
            hexMesh.children.forEach(child => {
                if (child instanceof THREE.Line) {
                    child.geometry?.dispose();
                    if (child.material instanceof THREE.Material) {
                        child.material.dispose();
                    }
                } else if (child instanceof THREE.Sprite) {
                    if (child.material instanceof THREE.Material) {
                        child.material.map?.dispose(); // For Sprites
                        child.material.dispose();
                    }
                }
            });
        });
        this.hexCellMeshes.clear();

        // Dispose cached materials
        this.factionMaterialsCache.forEach(material => material.dispose());
        this.factionMaterialsCache.clear();
        this.biomeMaterialsCache.forEach(material => material.dispose());
        this.biomeMaterialsCache.clear();
        if(this.defaultHexMaterial) this.defaultHexMaterial.dispose();
        if(this.selectedHexMaterial) this.selectedHexMaterial.dispose();

        this.scene.traverse(object => {
            if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line || object instanceof THREE.Sprite) {
                object.geometry?.dispose();
                const material = object.material as THREE.Material | THREE.Material[];
                if (Array.isArray(material)) {
                    material.forEach(m => {
                        if ((m as THREE.SpriteMaterial).map) (m as THREE.SpriteMaterial).map?.dispose();
                        m.dispose();
                    });
                } else if (material) {
                    if ((material as THREE.SpriteMaterial).map) (material as THREE.SpriteMaterial).map?.dispose();
                    material.dispose();
                }
            }
        });
        this.highlightVisuals.forEach(v => {
            this.scene.remove(v);
            if (v instanceof THREE.Mesh) {
                v.geometry.dispose();
                (v.material as THREE.Material).dispose();
            }
        });
        this.highlightVisuals.clear();

        this.renderer.dispose();
        if (this.renderer.domElement.parentElement) {
             this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
        }
        console.log("NewGlobeRenderer disposed.");
    }
}

export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
}
