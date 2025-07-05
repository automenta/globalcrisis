// This will be a copy of Earth3D.ts, then modified.
// For brevity, I will show the ADDITIONS/MODIFICATIONS section here,
// assuming the rest of the file is identical to the Earth3D.ts content I just read.

// ----- START OF COPIED CONTENT FROM Earth3D.ts (with modifications) -----
import * as THREE from 'three';
// Ensure PhysicsLayer is imported if not already
import { GameState, WorldRegion, RegionEvent, EventType, Faction, Ideology, WeatherCondition, Biome, IEntity, PhysicsLayer } from '../engine/GameEngine';
import SimplexNoise from 'simplex-noise';
import { SatelliteEntity, ISatelliteDataComponent, DEFAULT_SATELLITE_DATA_COMPONENT_NAME } from '../engine/entities/SatelliteEntity';
import { ITransformComponent, DEFAULT_TRANSFORM_COMPONENT_NAME } from '../engine/components/TransformComponent';
import { IPhysicsPropertiesComponent, DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME } from '../engine/components/PhysicsPropertiesComponent';
import { PHYSICS_TO_VISUAL_SCALE, VectorOps, EARTH_RADIUS_METERS } from '../engine/PhysicsManager';

export interface VisualSatellite {
  id: string;
  name: string;
  type: ISatelliteDataComponent['satelliteType'];
  mesh: THREE.Mesh;
}

export interface ContextMenu {
  visible: boolean;
  x: number;
  y: number;
  region: WorldRegion | null;
  type: 'region' | 'satellite' | 'event';
  target: any;
}

let terrainConditionOverlay_v2: THREE.Mesh | null = null; // Renamed for v2
let terrainConditionCanvas_v2: HTMLCanvasElement | null = null; // Renamed for v2
let terrainConditionContext_v2: CanvasRenderingContext2D | null = null; // Renamed for v2
// const TERRAIN_CONDITION_TEXTURE_WIDTH = 1024; // Already defined, keep if same
// const TERRAIN_CONDITION_TEXTURE_HEIGHT = 512;


export class Earth3D_v2 { // Renamed class
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private earth: THREE.Mesh;
  private atmosphere: THREE.Mesh;
  private clouds: THREE.Mesh;
  private cloudMaterial: THREE.MeshStandardMaterial;

  private satelliteMeshes: Map<string, THREE.Mesh> = new Map();
  private undergroundMarkers: Map<string, THREE.Object3D> = new Map();
  private airUnitMeshes: Map<string, THREE.Object3D> = new Map(); // ADDED

  private regionMarkers: THREE.Mesh[] = [];
  private eventMarkers: THREE.Mesh[] = [];
  private factionInfluenceOverlay: THREE.Mesh | null = null;
  private factionHQLayer: THREE.Group = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private controls: any;
  private animationId: number = 0;

  private rainParticles: THREE.Points | null = null;
  private snowParticles: THREE.Points | null = null;
  private rainMaterial: THREE.PointsMaterial | null = null;
  private snowMaterial: THREE.PointsMaterial | null = null;
  private readonly PARTICLE_COUNT = 5000;
  private currentGameState: GameState | null = null;

  public onRegionClick?: (region: WorldRegion, x: number, y: number) => void;
  public onSatelliteClick?: (satelliteId: string, satelliteName: string, satelliteType: ISatelliteDataComponent['satelliteType'], x: number, y: number) => void;
  public onEventClick?: (event: RegionEvent, x: number, y: number) => void;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, (EARTH_RADIUS_METERS * 10) * PHYSICS_TO_VISUAL_SCALE );
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });

    this.setupRenderer(container);
    this.setupCamera();
    this.setupLighting();
    this.createEarth();
    this.createAtmosphere();

    const cloudGeometry = new THREE.SphereGeometry(this.earth.geometry.parameters.radius + 0.03, 64, 32);
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 2048;
    cloudCanvas.height = 1024;
    const cloudCtx = cloudCanvas.getContext('2d')!;
    this.createCloudTexture(cloudCtx, cloudCanvas.width, cloudCanvas.height);
    const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
    cloudTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    cloudTexture.wrapS = THREE.RepeatWrapping;
    cloudTexture.wrapT = THREE.RepeatWrapping;

    this.cloudMaterial = new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.NormalBlending,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.clouds = new THREE.Mesh(cloudGeometry, this.cloudMaterial);
    this.scene.add(this.clouds);

    this.createFactionVisualLayers();
    this.createTerrainConditionOverlay();
    this.createWeatherParticles();
    this.setupControls();
    this.setupEventListeners(container);
    this.animate();
  }

  public updateCurrentGameState(gameState: GameState): void {
    this.currentGameState = gameState;
    const allEntities = Array.from(gameState.entities.values());
    this.updateSatelliteVisuals(allEntities);
    this.updateUndergroundVisuals(allEntities);
    this.updateAirUnitVisuals(allEntities); // ADDED CALL
    this.updateTerrainConditionVisuals(gameState.biomes, gameState.activeDisasters);
  }

  // +++ START OF NEW/MODIFIED METHODS FOR AIR UNITS +++
  private updateAirUnitVisuals(entities: IEntity[]): void {
    const currentAirUnitIds = new Set<string>();

    entities.forEach(entity => {
        if (entity.location?.layer === PhysicsLayer.Air) {
            currentAirUnitIds.add(entity.id);
            const transformComp = entity.getComponent<ITransformComponent>(DEFAULT_TRANSFORM_COMPONENT_NAME);

            if (transformComp) {
                let mesh = this.airUnitMeshes.get(entity.id);
                if (!mesh) {
                    const airUnitGeometry = new THREE.ConeGeometry(0.025, 0.1, 4);
                    airUnitGeometry.rotateX(Math.PI / 2);
                    const airUnitMaterial = new THREE.MeshStandardMaterial({
                        color: 0x90c3d4,
                        emissive: 0x223344,
                        roughness: 0.3,
                        metalness: 0.7,
                    });
                    mesh = new THREE.Mesh(airUnitGeometry, airUnitMaterial);
                    mesh.userData = { id: entity.id, type: 'air_unit', entity }; // Store entity for potential click
                    this.scene.add(mesh);
                    this.airUnitMeshes.set(entity.id, mesh);
                }

                const visualPosition = VectorOps.scale(transformComp.positionMeters, PHYSICS_TO_VISUAL_SCALE);
                mesh.position.copy(visualPosition);

                const physicsProps = entity.getComponent<IPhysicsPropertiesComponent>(DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME);
                if (physicsProps && VectorOps.magnitudeSq(physicsProps.velocityMps) > 0.001) { // Increased threshold
                    const velocityDirectionPhysics = VectorOps.normalize(physicsProps.velocityMps);
                    const lookAtTargetVisual = VectorOps.add(visualPosition, VectorOps.scale(velocityDirectionPhysics, 1.0)); // Look 1 visual unit ahead
                    mesh.lookAt(lookAtTargetVisual.x, lookAtTargetVisual.y, lookAtTargetVisual.z);
                } else {
                    // Default orientation: align with Earth's local "North" (visual positive Y if Earth is at origin)
                    // This keeps the "top" of the cone (its base after rotation) pointing "up" relative to Earth's surface.
                    const surfaceNormal = VectorOps.normalize(visualPosition);
                    const defaultForward = new THREE.Vector3(0,1,0); // Assuming default "North" is along Y in unrotated space
                     if (Math.abs(VectorOps.dot(surfaceNormal, defaultForward)) < 0.99 ) { // if not already aligned with Y (poles)
                        const tangent = VectorOps.normalize(VectorOps.subtract(defaultForward, VectorOps.scale(surfaceNormal, VectorOps.dot(defaultForward, surfaceNormal))));
                        mesh.lookAt(VectorOps.add(visualPosition, tangent));
                    } else { // At poles, look towards X axis or similar
                        mesh.lookAt(visualPosition.x + 1, visualPosition.y, visualPosition.z);
                    }
                }

                (mesh as THREE.Mesh).visible = true;
            }
        }
    });

    this.airUnitMeshes.forEach((mesh, id) => {
        if (!currentAirUnitIds.has(id)) {
            this.scene.remove(mesh);
            if ((mesh as THREE.Mesh).geometry) ((mesh as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
            const mat = (mesh as THREE.Mesh).material;
            if (mat) { (mat instanceof Array ? mat : [mat]).forEach(m => m.dispose());}
            this.airUnitMeshes.delete(id);
        }
    });
  }
  // +++ END OF NEW/MODIFIED METHODS FOR AIR UNITS +++


  private updateUndergroundVisuals(entities: IEntity[]): void {
    const currentUndergroundEntityIds = new Set<string>();

    entities.forEach(entity => {
        if (entity.location?.layer === PhysicsLayer.Underground) {
            currentUndergroundEntityIds.add(entity.id);
            const transformComp = entity.getComponent<ITransformComponent>(DEFAULT_TRANSFORM_COMPONENT_NAME);

            if (transformComp) {
                let marker = this.undergroundMarkers.get(entity.id);
                if (!marker) {
                    const markerGeometry = new THREE.ConeGeometry(0.03, 0.06, 8);
                    const markerMaterial = new THREE.MeshStandardMaterial({
                        color: 0x8B4513,
                        emissive: 0x3a1f0a,
                        roughness: 0.7,
                    });
                    marker = new THREE.Mesh(markerGeometry, markerMaterial);
                    marker.userData = { id: entity.id, type: 'underground_marker', entity };
                    this.scene.add(marker);
                    this.undergroundMarkers.set(entity.id, marker);
                }

                const physicsPosition = transformComp.positionMeters;
                const surfaceProjectionPhysics = VectorOps.scale(VectorOps.normalize(physicsPosition), EARTH_RADIUS_METERS);
                const visualSurfacePosition = VectorOps.scale(surfaceProjectionPhysics, PHYSICS_TO_VISUAL_SCALE);

                marker.position.copy(visualSurfacePosition);

                const lookAtCenter = new THREE.Vector3(0,0,0);
                marker.lookAt(lookAtCenter);
                marker.rotateX(Math.PI);

                (marker as THREE.Mesh).visible = true;
            }
        }
    });

    this.undergroundMarkers.forEach((marker, id) => {
        if (!currentUndergroundEntityIds.has(id)) {
            this.scene.remove(marker);
            if ((marker as THREE.Mesh).geometry) ((marker as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
            const mat = (marker as THREE.Mesh).material;
            if (mat) { (mat instanceof Array ? mat : [mat]).forEach(m => m.dispose());}
            this.undergroundMarkers.delete(id);
        }
    });
}

  private createTerrainConditionOverlay(): void {
    const overlayGeometry = new THREE.SphereGeometry(this.earth.geometry.parameters.radius + 0.005, 64, 32);
    terrainConditionCanvas_v2 = document.createElement('canvas'); // Use v2 variable
    terrainConditionCanvas_v2.width = TERRAIN_CONDITION_TEXTURE_WIDTH;
    terrainConditionCanvas_v2.height = TERRAIN_CONDITION_TEXTURE_HEIGHT;
    terrainConditionContext_v2 = terrainConditionCanvas_v2.getContext('2d'); // Use v2 variable
    if (!terrainConditionContext_v2) {
        console.error("Failed to get 2D context for terrain condition overlay");
        return;
    }
    terrainConditionContext_v2.clearRect(0,0, TERRAIN_CONDITION_TEXTURE_WIDTH, TERRAIN_CONDITION_TEXTURE_HEIGHT);

    const texture = new THREE.CanvasTexture(terrainConditionCanvas_v2);
    texture.needsUpdate = true;

    const overlayMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    terrainConditionOverlay_v2 = new THREE.Mesh(overlayGeometry, overlayMaterial); // Use v2 variable
    this.scene.add(terrainConditionOverlay_v2);
}

  // ... (rest of the file is assumed to be the same as the previously read Earth3D.ts content) ...
  // ... (including createFactionVisualLayers, createParticleTexture, createWeatherParticles, setupRenderer, etc.) ...
  // ... (make sure to replace terrainConditionContext with terrainConditionContext_v2 in updateTerrainConditionVisuals) ...
  // ... (and terrainConditionOverlay with terrainConditionOverlay_v2 in animate and dispose)

  // Make sure this method uses the v2 context and overlay
  private updateTerrainConditionVisuals(biomes: Map<string, Biome>, activeDisasters: RegionEvent[]): void {
    if (!terrainConditionContext_v2 || !terrainConditionOverlay_v2 || !terrainConditionCanvas_v2 || !(terrainConditionOverlay_v2.material instanceof THREE.MeshBasicMaterial) ) return;

    terrainConditionContext_v2.clearRect(0, 0, TERRAIN_CONDITION_TEXTURE_WIDTH, TERRAIN_CONDITION_TEXTURE_HEIGHT);
    let needsTextureUpdate = false;

    if (this.currentGameState && this.currentGameState.worldRegions && terrainConditionContext_v2) {
        this.currentGameState.worldRegions.forEach(region => {
            if (region.biomeId) {
                const biome = biomes.get(region.biomeId);
                if (biome && biome.currentWeather?.description === "Drought") {
                    const u = (region.x + 1) / 2;
                    const v = 1 - ((region.y + 1) / 2);

                    const canvasX = u * TERRAIN_CONDITION_TEXTURE_WIDTH;
                    const canvasY = v * TERRAIN_CONDITION_TEXTURE_HEIGHT;
                    const radiusFactor = 0.05 + Math.random() * 0.05;
                    const radius = radiusFactor * TERRAIN_CONDITION_TEXTURE_WIDTH;

                    const gradient = terrainConditionContext_v2.createRadialGradient(canvasX, canvasY, radius * 0.1, canvasX, canvasY, radius);
                    gradient.addColorStop(0, 'rgba(160, 120, 80, 0.35)');
                    gradient.addColorStop(0.7, 'rgba(160, 120, 80, 0.15)');
                    gradient.addColorStop(1, 'rgba(160, 120, 80, 0.0)');
                    terrainConditionContext_v2.fillStyle = gradient;
                    terrainConditionContext_v2.beginPath();
                    terrainConditionContext_v2.arc(canvasX, canvasY, radius, 0, Math.PI * 2);
                    terrainConditionContext_v2.fill();
                    needsTextureUpdate = true;
                }
            }
        });
    }

    activeDisasters.forEach(disaster => {
        if (disaster.type === EventType.WILDFIRE_EVENT || (disaster as any).type === 'Wildfire') {
            const u = (disaster.location.coordinates.x + 1) / 2;
            const v = 1 - ((disaster.location.coordinates.y + 1) / 2);
            const canvasX = u * TERRAIN_CONDITION_TEXTURE_WIDTH;
            const canvasY = v * TERRAIN_CONDITION_TEXTURE_HEIGHT;

            const disasterRadiusFactor = disaster.radius || 0.05;
            const visualRadius = disasterRadiusFactor * (TERRAIN_CONDITION_TEXTURE_WIDTH / (2 * Math.PI));

            terrainConditionContext_v2.fillStyle = 'rgba(30, 20, 10, 0.6)';
            terrainConditionContext_v2.beginPath();
            terrainConditionContext_v2.arc(canvasX, canvasY, visualRadius, 0, Math.PI * 2);
            terrainConditionContext_v2.fill();
            needsTextureUpdate = true;
        }
    });

    if (needsTextureUpdate && terrainConditionOverlay_v2.material.map) {
        (terrainConditionOverlay_v2.material.map as THREE.CanvasTexture).needsUpdate = true;
    }
  }

  // Ensure animate method rotates the correct overlay
  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    this.earth.rotation.y += 0.0005 * (this.currentGameState?.speed || 1);
    this.atmosphere.rotation.y = this.earth.rotation.y;
    this.clouds.rotation.y += 0.0006 * (this.currentGameState?.speed || 1);

    if (this.factionInfluenceOverlay) this.factionInfluenceOverlay.rotation.copy(this.earth.rotation);
    if (this.factionHQLayer) this.factionHQLayer.rotation.copy(this.earth.rotation);
    if (terrainConditionOverlay_v2) terrainConditionOverlay_v2.rotation.copy(this.earth.rotation); // Use v2

    if (this.currentGameState) {
      this.updateWeatherVisuals(this.currentGameState);
    }

    this.renderer.render(this.scene, this.camera);
  };

  // Ensure dispose method cleans up the correct overlay and new airUnitMeshes
  public dispose() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.renderer.dispose();
    this.rainMaterial?.dispose(); this.snowMaterial?.dispose();
    this.rainParticles?.geometry.dispose(); this.snowParticles?.geometry.dispose();
    this.satelliteMeshes.forEach(mesh => {
        if(mesh.geometry) mesh.geometry.dispose();
        if(mesh.material) (mesh.material as THREE.Material).dispose();
    });
    if (terrainConditionOverlay_v2 && terrainConditionOverlay_v2.material instanceof THREE.MeshBasicMaterial && terrainConditionOverlay_v2.material.map) {
        (terrainConditionOverlay_v2.material.map as THREE.CanvasTexture).dispose();
    }
    if (terrainConditionOverlay_v2?.geometry) terrainConditionOverlay_v2.geometry.dispose();
    this.undergroundMarkers.forEach(marker => {
        if((marker as THREE.Mesh).geometry) ((marker as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
        const mat = (marker as THREE.Mesh).material;
        if (mat) { (mat instanceof Array ? mat : [mat]).forEach(m => m.dispose());}
    });
    this.airUnitMeshes.forEach(mesh => {
        if((mesh as THREE.Mesh).geometry) ((mesh as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
        const mat = (mesh as THREE.Mesh).material;
        if (mat) { (mat instanceof Array ? mat : [mat]).forEach(m => m.dispose());}
    });
  }
  // Ensure all other methods from the original Earth3D.ts are present here
  // For example: setupRenderer, setupCamera, setupLighting, createEarth, createEarthTexture, createNormalMap, createAtmosphere,
  // createCloudTexture (already modified), createFactionVisualLayers, createParticleTexture, createWeatherParticles,
  // setupControls, setupEventListeners, getRegionFromPoint, updateSatelliteVisuals, updateWeatherVisuals,
  // updateRegionData, updateFactionData, addEventMarker, getEventColor, createEventParticles,
  // compromiseSatellite, destroySatellite, resize.
  // The content provided to overwrite_file_with_block should be the *complete* file content.
}

// ----- END OF COPIED CONTENT (with modifications) -----
// Note: This is a conceptual representation. The actual tool call will use the full file content.
// The key is that the class name is Earth3D_v2 and it includes the air unit visualization logic.
// Also, PhysicsLayer needs to be correctly referenced (e.g. from GameEngine if it's exported there).
// I'll assume `CoreGame.PhysicsLayer` was a placeholder and replace with `PhysicsLayer` from `../engine/GameEngine`
// if it's available there, or define/import appropriately.
// For the actual tool call, I will construct the full file content.
// The `terrainConditionOverlay` related variables also need to be consistently named if they were made local to the class or stay global.
// For this version, I made them global but suffixed with _v2 to avoid conflict if both files were somehow loaded.
// The actual implementation will ensure these are class members if appropriate or correctly scoped.
// The IPhysicsPropertiesComponent import is also added.
// The dispose methods for materials are made more robust.
