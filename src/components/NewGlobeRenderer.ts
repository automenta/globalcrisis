import * as THREE from 'three';
import SimplexNoise from 'simplex-noise';
import { GameState, WorldRegion, RegionEvent, EventType, Faction, Ideology, WeatherCondition, Biome, IEntity, PhysicsLayer } from '../engine/GameEngine'; // Assuming GameEngine types are needed
import { HexGridManager, HexCell } from '../engine/HexGridManager';
import { SatelliteEntity, ISatelliteDataComponent, DEFAULT_SATELLITE_DATA_COMPONENT_NAME, SatelliteType } from '../engine/entities/SatelliteEntity';
import { ITransformComponent, DEFAULT_TRANSFORM_COMPONENT_NAME } from '../engine/components/TransformComponent';
import { IPhysicsPropertiesComponent, DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME } from '../engine/components/PhysicsPropertiesComponent';
import { PHYSICS_TO_VISUAL_SCALE, VectorOps, EARTH_RADIUS_METERS } from '../engine/PhysicsManager';
import { CityEntity } from '../engine/entities/CityEntity';
import { FactoryEntity } from '../engine/entities/FactoryEntity';


const VISUAL_EARTH_RADIUS = 2;
const ENTITY_VISUAL_SCALE = 0.05;

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
    private defaultHexMaterial = new THREE.MeshBasicMaterial({
        color: 0x222222, transparent: true, opacity: 0.2, side: THREE.DoubleSide,
    });
    private selectedHexMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
    });
    private highlightVisuals: Map<string, THREE.Object3D> = new Map();

    private containerElement: HTMLElement;

    constructor(container: HTMLElement, callbacks: NewGlobeRendererCallbacks = {}) {
        this.containerElement = container;
        this.callbacks = callbacks;

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

            const hexMesh = new THREE.Mesh(geometry, defaultHexMaterial.clone());
            hexMesh.name = `HexCell_${cell.id}`;
            hexMesh.userData = { cellId: cell.id, type: 'hex_cell', cellRef: cell };

            this.scene.add(hexMesh);
            this.hexCellMeshes.set(cell.id, hexMesh);

            const outlineGeometry = new THREE.BufferGeometry().setFromPoints([...slightlyElevatedVertices, slightlyElevatedVertices[0]]);
            const outline = new THREE.LineLoop(outlineGeometry, outlineMaterial.clone());
            outline.name = `HexOutline_${cell.id}`;
            hexMesh.add(outline);
        });
        console.log(`[NewGlobeRenderer] Created visuals for ${this.hexCellMeshes.size} hex cells.`);
    }

    public styleHexCell(cellId: string, newMaterial?: THREE.Material, newOutlineColor?: THREE.Color, isSelected?: boolean): void {
        const hexMesh = this.hexCellMeshes.get(cellId);
        if (hexMesh) {
            let materialToApply = newMaterial;
            if (isSelected) {
                materialToApply = this.selectedHexMaterial;
            } else if (!newMaterial) {
                materialToApply = this.defaultHexMaterial;
            }

            if (materialToApply && hexMesh.material !== materialToApply) {
                if (hexMesh.material !== this.defaultHexMaterial && hexMesh.material !== this.selectedHexMaterial) {
                    (hexMesh.material as THREE.Material).dispose();
                }
                hexMesh.material = materialToApply;
            }
            (hexMesh.material as THREE.Material).needsUpdate = true;

            const outline = hexMesh.children.find(c => c instanceof THREE.LineLoop) as THREE.LineLoop;
            if (outline && outline.material instanceof THREE.LineBasicMaterial) {
                const finalOutlineColor = newOutlineColor ? newOutlineColor.clone() : new THREE.Color(isSelected ? 0xffcc00 : 0x888888);
                outline.material.color.set(finalOutlineColor);
                outline.material.opacity = isSelected ? 0.9 : (newOutlineColor ? 0.7 : 0.3);
                outline.material.needsUpdate = true;
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
            const defaultMaterial = this.defaultHexMaterial;
            const defaultOutlineColor = new THREE.Color(0x888888);

            this.hexGridManager.cells.forEach(cell => {
                let targetMaterial: THREE.Material = defaultMaterial;
                let targetOutlineColor = defaultOutlineColor.clone();

                // Placeholder for accessing faction control data for a hex cell.
                // This needs to be correctly sourced from GameState, for example:
                // const cellDetails = this.currentGameState!.hexCellData?.get(cell.id);
                // const cellOwnerFactionId = cellDetails?.controllingFactionId;
                // For now, using a placeholder as before:
                const cellOwnerFactionId = (cell as any).controllingFactionId;

                if (cellOwnerFactionId) {
                    const faction = this.currentGameState!.factions.get(cellOwnerFactionId);
                    if (faction && faction.color) {
                        const factionMaterial = new THREE.MeshBasicMaterial({
                            color: new THREE.Color(faction.color),
                            transparent: true,
                            opacity: 0.35,
                            side: THREE.DoubleSide,
                        });
                        targetMaterial = factionMaterial;
                        targetOutlineColor.set(faction.color).multiplyScalar(0.7);
                    }
                }

                const hexMesh = this.hexCellMeshes.get(cell.id);
                if (hexMesh) {
                    if (this.selectedHexId === cell.id) {
                        this.styleHexCell(cell.id, undefined, undefined, true);
                    } else {
                        let currentMaterial = hexMesh.material as THREE.MeshBasicMaterial;
                        let currentOutline = hexMesh.children.find(c => c instanceof THREE.LineLoop) as THREE.LineLoop;
                        let needsStyleUpdate = false;

                        if (currentMaterial !== targetMaterial) {
                           if (targetMaterial !== defaultMaterial && targetMaterial !== this.selectedHexMaterial) {
                               if (currentMaterial.color.getHex() !== (targetMaterial as THREE.MeshBasicMaterial).color.getHex() ||
                                   currentMaterial.opacity !== (targetMaterial as THREE.MeshBasicMaterial).opacity) {
                                   needsStyleUpdate = true;
                               }
                           } else if (currentMaterial.uuid !== targetMaterial.uuid) {
                                needsStyleUpdate = true;
                           }
                        }

                        if (currentOutline && (currentOutline.material as THREE.LineBasicMaterial).color.getHex() !== targetOutlineColor.getHex()){
                            needsStyleUpdate = true;
                        }

                        if(needsStyleUpdate){
                             this.styleHexCell(cell.id, targetMaterial, targetOutlineColor, false);
                        }
                    }
                }
            });
        }
    }

    private getOrCreateEntityVisual(entity: IEntity): THREE.Object3D | null {
        if (this.entityVisuals.has(entity.id)) {
            return this.entityVisuals.get(entity.id)!;
        }

        let newVisual: THREE.Object3D | null = null;
        switch (entity.entityType) {
            case 'SatelliteEntity':
                newVisual = this.createSatelliteVisual(entity as SatelliteEntity);
                break;
            case 'CityEntity':
                newVisual = this.createCityVisual(entity as CityEntity);
                break;
            case 'FactoryEntity':
                newVisual = this.createFactoryVisual(entity as FactoryEntity);
                break;
            case 'InfantryUnitEntity':
                newVisual = this.createGroundUnitVisual(entity as IEntity, 'infantry');
                break;
            default:
                if (entity.location.layer === PhysicsLayer.Air) {
                    newVisual = this.createAirUnitVisual(entity);
                } else if (entity.location.layer === PhysicsLayer.Underground) {
                    newVisual = this.createUndergroundUnitVisual(entity);
                } else if (entity.entityType === 'GenericSeaUnit') {
                    newVisual = this.createSeaUnitVisual(entity);
                }
                break;
        }

        if (newVisual) {
            newVisual.userData = { entityId: entity.id, entityType: entity.entityType, entityRef: entity, type: 'entity_visual' };

            const statusIndicatorSprite = this.createStatusIndicator(entity);
            if (statusIndicatorSprite) {
                newVisual.add(statusIndicatorSprite);
            }

            this.entityVisuals.set(entity.id, newVisual);
            this.scene.add(newVisual);
            return newVisual;
        }
        return null;
    }

    private updateEntityVisual(visual: THREE.Object3D, entity: IEntity, gameState: GameState): void {
        const transformComp = entity.getComponent<ITransformComponent>(DEFAULT_TRANSFORM_COMPONENT_NAME);
        if (transformComp) {
            const visualPosition = VectorOps.scale(transformComp.positionMeters, PHYSICS_TO_VISUAL_SCALE);
            visual.position.copy(visualPosition);
        }

        switch (entity.entityType) {
            case 'SatelliteEntity':
                this.updateSatelliteVisual(visual, entity as SatelliteEntity, transformComp);
                break;
            case 'CityEntity':
                this.updateCityVisual(visual, entity as CityEntity, transformComp, gameState);
                break;
            case 'FactoryEntity':
                this.updateFactoryVisual(visual, entity as FactoryEntity, transformComp, gameState);
                break;
            case 'InfantryUnitEntity':
                this.updateGroundUnitVisual(visual, entity as IEntity, transformComp, gameState, 'infantry');
                break;
            default:
                if (entity.location.layer === PhysicsLayer.Air) {
                    this.updateAirUnitVisual(visual, entity, transformComp, gameState);
                } else if (entity.location.layer === PhysicsLayer.Underground) {
                    this.updateUndergroundUnitVisual(visual, entity, transformComp, gameState);
                } else if (entity.entityType === 'GenericSeaUnit') {
                    this.updateSeaUnitVisual(visual, entity, transformComp, gameState);
                }
                break;
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

        const bodyGeometry = new THREE.BoxGeometry(ENTITY_VISUAL_SCALE * 0.5, ENTITY_VISUAL_SCALE * 0.5, ENTITY_VISUAL_SCALE * 0.8);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.5, metalness: 0.8 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        group.add(body);

        const panelGeometry = new THREE.PlaneGeometry(ENTITY_VISUAL_SCALE * 1.5, ENTITY_VISUAL_SCALE * 0.6);
        const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x3333aa, side: THREE.DoubleSide, roughness: 0.2, metalness: 0.1 });

        const panel1 = new THREE.Mesh(panelGeometry, panelMaterial);
        panel1.position.x = ENTITY_VISUAL_SCALE * 0.75;
        panel1.rotation.y = Math.PI / 2;
        group.add(panel1);

        const panel2 = new THREE.Mesh(panelGeometry, panelMaterial);
        panel2.position.x = -ENTITY_VISUAL_SCALE * 0.75;
        panel2.rotation.y = Math.PI / 2;
        group.add(panel2);

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
                effectiveColor = new THREE.Color(0xff8800);
                break;
            case 'destroyed':
                visual.visible = false;
                break;
            case 'active':
            default:
                break;
        }

        const bodyMesh = visual.children.find(c => c instanceof THREE.Mesh && c.geometry instanceof THREE.BoxGeometry) as THREE.Mesh;
        if (bodyMesh && bodyMesh.material instanceof THREE.MeshStandardMaterial) {
            bodyMesh.material.color.set(effectiveColor);
        }

        if (transformComp) {
            visual.lookAt(this.earthMesh.position);
        }
    }

    private createCityVisual(entity: CityEntity): THREE.Object3D {
        const group = new THREE.Group();
        const factionColor = entity.factionId && this.currentGameState?.factions.has(entity.factionId)
            ? new THREE.Color(this.currentGameState.factions.get(entity.factionId)!.color || 0xaaaaaa)
            : new THREE.Color(0xaaaaaa);

        const cityRadius = ENTITY_VISUAL_SCALE * 1.5;
        const cityHeight = ENTITY_VISUAL_SCALE * 0.8;
        const cityGeometry = new THREE.CylinderGeometry(cityRadius, cityRadius * 0.8, cityHeight, 8);
        const cityMaterial = new THREE.MeshStandardMaterial({
            color: factionColor,
            roughness: 0.6,
            metalness: 0.3
        });
        const cityMesh = new THREE.Mesh(cityGeometry, cityMaterial);
        group.add(cityMesh);
        group.name = `City_${entity.id}`;
        return group;
    }

    private updateCityVisual(visual: THREE.Object3D, entity: CityEntity, transformComp?: ITransformComponent, gameState?: GameState): void {
        if (transformComp) {
            const surfaceNormal = visual.position.clone().normalize();
            visual.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfaceNormal);
        }

        const cityMesh = visual.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh;
        if (cityMesh && cityMesh.material instanceof THREE.MeshStandardMaterial && gameState && entity.factionId) {
            const faction = gameState.factions.get(entity.factionId);
            if (faction && faction.color) {
                cityMesh.material.color.set(faction.color);
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

        let unitGeom: THREE.BufferGeometry;
        const unitSize = ENTITY_VISUAL_SCALE * 0.5;

        if (unitType === 'infantry') {
            unitGeom = new THREE.ConeGeometry(unitSize * 0.5, unitSize, 4);
        } else {
            unitGeom = new THREE.BoxGeometry(unitSize, unitSize * 0.6, unitSize * 0.8);
        }

        const unitMat = new THREE.MeshStandardMaterial({ color: factionColor, roughness: 0.6, metalness: 0.2 });
        const unitMesh = new THREE.Mesh(unitGeom, unitMat);
        group.add(unitMesh);
        group.name = `${unitType}_${entity.id}`;
        return group;
    }

    private updateGroundUnitVisual(visual: THREE.Object3D, entity: IEntity, transformComp?: ITransformComponent, gameState?: GameState, unitType?: string): void {
        if (transformComp) {
            const surfaceNormal = visual.position.clone().normalize();
            visual.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfaceNormal); // Align Y up with surface normal

            const physicsProps = entity.getComponent<IPhysicsPropertiesComponent>(DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME);
            if (physicsProps && VectorOps.magnitudeSq(physicsProps.velocityMps) > 0.001) {
                const velocityDirection = VectorOps.normalize(physicsProps.velocityMps);
                const tangentVelocity = velocityDirection.clone().projectOnPlane(surfaceNormal).normalize();

                if (tangentVelocity.lengthSq() > 0.5) { // Ensure projection is valid and non-zero
                    // Project current local forward (Z-axis) onto the tangent plane
                    const localForward = new THREE.Vector3(0, 0, 1);
                    const worldForwardProjected = localForward.clone().applyQuaternion(visual.quaternion).projectOnPlane(surfaceNormal).normalize();

                    if (worldForwardProjected.lengthSq() > 0.5) {
                        // Calculate the angle between the projected forward and the tangent velocity
                        let angle = worldForwardProjected.angleTo(tangentVelocity);

                        // Determine the sign of the angle using cross product with the surface normal
                        const cross = new THREE.Vector3().crossVectors(worldForwardProjected, tangentVelocity);
                        const sign = Math.sign(cross.dot(surfaceNormal));

                        if (Math.abs(angle) > 0.01) { // Only rotate if there's a significant angle
                            const deltaRotation = new THREE.Quaternion().setFromAxisAngle(surfaceNormal, angle * sign);
                            visual.quaternion.premultiply(deltaRotation); // Apply rotation
                        }
                    }
                }
            }
        }
        const unitMesh = visual.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh;
         if (unitMesh && unitMesh.material instanceof THREE.MeshStandardMaterial && gameState && entity.factionId) {
            const faction = gameState.factions.get(entity.factionId);
            if (faction && faction.color) {
                unitMesh.material.color.set(faction.color);
            }
        }
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
        // Example: Update health bar based on a hypothetical HealthComponent
        // const healthComp = entity.getComponent<IHealthComponent>('HealthComponent'); // Define IHealthComponent
        // if (healthComp && statusSprite.material.map) {
        //     const texture = statusSprite.material.map as THREE.CanvasTexture;
        //     const canvas = texture.image as HTMLCanvasElement;
        //     const context = canvas.getContext('2d');
        //     if (!context) return;

        //     context.clearRect(0, 0, canvas.width, canvas.height);
        //     const healthPercentage = Math.max(0, Math.min(1, healthComp.currentHealth / healthComp.maxHealth));

        //     context.fillStyle = healthPercentage > 0.6 ? 'rgba(0, 255, 0, 0.7)' :
        //                         healthPercentage > 0.3 ? 'rgba(255, 165, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)';
        //     context.fillRect(0, 0, canvas.width * healthPercentage, canvas.height);

        //     context.strokeStyle = 'rgba(50, 50, 50, 0.9)';
        //     context.lineWidth = 4;
        //     context.strokeRect(0, 0, canvas.width, canvas.height);

        //     texture.needsUpdate = true;
        // }

        statusSprite.quaternion.copy(this.camera.quaternion);

        const mainVisual = this.entityVisuals.get(entity.id);
        if (mainVisual && statusSprite.position.y === ENTITY_VISUAL_SCALE * 1.2) {
             try {
                const boundingBox = new THREE.Box3().setFromObject(mainVisual);
                const size = boundingBox.getSize(new THREE.Vector3());
                const newYOffset = size.y * 0.5 + ENTITY_VISUAL_SCALE * 0.3;
                if (Math.abs(newYOffset - statusSprite.position.y) > 0.01) {
                    statusSprite.position.y = newYOffset;
                }
            } catch (e) { /* ignore if bounding box fails temporarily */ }
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
                        child.material.map?.dispose();
                        child.material.dispose();
                    }
                }
            });
        });
        this.hexCellMeshes.clear();

        this.scene.traverse(object => {
            if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line || object instanceof THREE.Sprite) {
                object.geometry?.dispose();
                const material = object.material as THREE.Material | THREE.Material[];
                if (Array.isArray(material)) {
                    material.forEach(m => {
                        if (m instanceof THREE.SpriteMaterial) m.map?.dispose();
                        m.dispose();
                    });
                } else if (material) {
                    if (material instanceof THREE.SpriteMaterial) material.map?.dispose();
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
