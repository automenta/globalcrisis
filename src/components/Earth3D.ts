import * as THREE from 'three';
import { GameState, WorldRegion, RegionEvent, EventType, Faction, Ideology, WeatherCondition, Biome, IEntity } from '../engine/GameEngine';
import SimplexNoise from 'simplex-noise';
import { SatelliteEntity, ISatelliteDataComponent, DEFAULT_SATELLITE_DATA_COMPONENT_NAME } from '../engine/entities/SatelliteEntity';
import { ITransformComponent, DEFAULT_TRANSFORM_COMPONENT_NAME } from '../engine/components/TransformComponent';
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

let terrainConditionOverlay: THREE.Mesh | null = null;
let terrainConditionCanvas: HTMLCanvasElement | null = null;
let terrainConditionContext: CanvasRenderingContext2D | null = null;
const TERRAIN_CONDITION_TEXTURE_WIDTH = 1024;
const TERRAIN_CONDITION_TEXTURE_HEIGHT = 512;


export class Earth3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private earth: THREE.Mesh;
  private atmosphere: THREE.Mesh;
  private clouds: THREE.Mesh;
  private cloudMaterial: THREE.MeshStandardMaterial;

  private satelliteMeshes: Map<string, THREE.Mesh> = new Map();
  private undergroundMarkers: Map<string, THREE.Object3D> = new Map();
  private airUnitMeshes: Map<string, THREE.Object3D> = new Map();

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
    this.updateAirUnitVisuals(allEntities); // Call new method for air units
    this.updateTerrainConditionVisuals(gameState.biomes, gameState.activeDisasters);
  }

  private updateAirUnitVisuals(entities: IEntity[]): void {
    const currentAirUnitIds = new Set<string>();

    entities.forEach(entity => {
        if (entity.location?.layer === CoreGame.PhysicsLayer.Air) {
            currentAirUnitIds.add(entity.id);
            const transformComp = entity.getComponent<ITransformComponent>(DEFAULT_TRANSFORM_COMPONENT_NAME);
            // const physicsProps = entity.getComponent<IPhysicsPropertiesComponent>(DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME); // For velocity vector if needed for orientation

            if (transformComp) {
                let mesh = this.airUnitMeshes.get(entity.id);
                if (!mesh) {
                    // Create a new marker: e.g., a simple wedge or a custom model
                    const airUnitGeometry = new THREE.ConeGeometry(0.02, 0.08, 4); // Simple wedge/pyramid shape
                    airUnitGeometry.rotateX(Math.PI / 2); // Orient it to point forward
                    const airUnitMaterial = new THREE.MeshStandardMaterial({
                        color: 0xadd8e6, // Light blue
                        emissive: 0x446688,
                        roughness: 0.4,
                        metalness: 0.6,
                    });
                    mesh = new THREE.Mesh(airUnitGeometry, airUnitMaterial);
                    mesh.userData = { id: entity.id, type: 'air_unit' };
                    this.scene.add(mesh);
                    this.airUnitMeshes.set(entity.id, mesh);
                }

                const visualPosition = VectorOps.scale(transformComp.positionMeters, PHYSICS_TO_VISUAL_SCALE);
                mesh.position.copy(visualPosition);

                // Orientation: Make the air unit point in the direction of its velocity (if available and significant)
                // This requires IPhysicsPropertiesComponent to be present and velocity to be meaningful
                const physicsProps = entity.getComponent<IPhysicsPropertiesComponent>(DEFAULT_PHYSICS_PROPERTIES_COMPONENT_NAME);
                if (physicsProps && VectorOps.magnitudeSq(physicsProps.velocityMps) > 0.01) {
                    const velocityDirection = VectorOps.normalize(physicsProps.velocityMps);
                    // Create a target point slightly ahead in the direction of velocity
                    const lookAtTarget = VectorOps.add(visualPosition, VectorOps.scale(velocityDirection, 0.1)); // Small offset for lookAt
                    mesh.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);
                } else {
                    // Default orientation if not moving or no velocity data
                    mesh.lookAt(this.earth.position); // Or some other default like facing north
                    mesh.rotateX(Math.PI / 2); // Adjust if necessary based on model
                }

                // Basic visual turbulence in storms (if unit is in a stormy biome)
                // This requires biome data for the air unit's current location.
                // For simplicity, this check is omitted for now but could be added if GameState provides easy lookup.
                // if (isInStormyBiome) {
                //   mesh.position.x += (Math.random() - 0.5) * 0.005;
                //   mesh.position.y += (Math.random() - 0.5) * 0.005;
                //   mesh.rotation.z += (Math.random() - 0.5) * 0.02;
                // }

                (mesh as THREE.Mesh).visible = true;
            }
        }
    });

    // Remove meshes for entities that are no longer air units
    this.airUnitMeshes.forEach((mesh, id) => {
        if (!currentAirUnitIds.has(id)) {
            this.scene.remove(mesh);
            if ((mesh as THREE.Mesh).geometry) (mesh as THREE.Mesh).geometry.dispose();
            if ((mesh as THREE.Mesh).material) ((mesh as THREE.Mesh).material as THREE.Material | THREE.Material[]).dispose();
            this.airUnitMeshes.delete(id);
        }
    });
  }

  private updateUndergroundVisuals(entities: IEntity[]): void {
    const currentUndergroundEntityIds = new Set<string>();

    entities.forEach(entity => {
        if (entity.location?.layer === CoreGame.PhysicsLayer.Underground) {
            currentUndergroundEntityIds.add(entity.id);
            const transformComp = entity.getComponent<ITransformComponent>(DEFAULT_TRANSFORM_COMPONENT_NAME);

            if (transformComp) {
                let marker = this.undergroundMarkers.get(entity.id);
                if (!marker) {
                    // Create a new marker: e.g., a small, downward-pointing cone or a sprite
                    const markerGeometry = new THREE.ConeGeometry(0.03, 0.06, 8); // Small cone
                    const markerMaterial = new THREE.MeshStandardMaterial({
                        color: 0x8B4513, // Brownish
                        emissive: 0x3a1f0a,
                        roughness: 0.7,
                    });
                    marker = new THREE.Mesh(markerGeometry, markerMaterial);
                    marker.userData = { id: entity.id, type: 'underground_marker' };
                    this.scene.add(marker);
                    this.undergroundMarkers.set(entity.id, marker);
                }

                // Calculate surface projection for the marker
                const physicsPosition = transformComp.positionMeters;
                const surfaceProjectionPhysics = VectorOps.scale(VectorOps.normalize(physicsPosition), EARTH_RADIUS_METERS);
                const visualSurfacePosition = VectorOps.scale(surfaceProjectionPhysics, PHYSICS_TO_VISUAL_SCALE);

                marker.position.copy(visualSurfacePosition);

                // Orient the marker (e.g., cone pointing downwards)
                // Create a quaternion that rotates the cone to point towards the center of the Earth
                const lookAtCenter = new THREE.Vector3(0,0,0);
                marker.lookAt(lookAtCenter);
                // Cones point along their positive Y axis by default. We want it to point along negative local Y (towards earth center)
                // So, after lookAt, we might need to rotate it if its default orientation isn't what we want.
                // If the cone's tip is at its positive Y, and base at negative Y, then lookAt(0,0,0) makes the base face earth.
                // To make tip point down, rotate 180 degrees around its local X or Z axis.
                marker.rotateX(Math.PI);


                // Optionally, adjust opacity or add a pulsating effect if desired
                (marker as THREE.Mesh).visible = true; // Ensure it's visible
            }
        }
    });

    // Remove markers for entities that are no longer underground
    this.undergroundMarkers.forEach((marker, id) => {
        if (!currentUndergroundEntityIds.has(id)) {
            this.scene.remove(marker);
            if ((marker as THREE.Mesh).geometry) (marker as THREE.Mesh).geometry.dispose();
            if ((marker as THREE.Mesh).material) ((marker as THREE.Mesh).material as THREE.Material | THREE.Material[]).dispose();
            this.undergroundMarkers.delete(id);
        }
    });
}


  private createTerrainConditionOverlay(): void {
    const overlayGeometry = new THREE.SphereGeometry(this.earth.geometry.parameters.radius + 0.005, 64, 32);
    terrainConditionCanvas = document.createElement('canvas');
    terrainConditionCanvas.width = TERRAIN_CONDITION_TEXTURE_WIDTH;
    terrainConditionCanvas.height = TERRAIN_CONDITION_TEXTURE_HEIGHT;
    terrainConditionContext = terrainConditionCanvas.getContext('2d');
    if (!terrainConditionContext) {
        console.error("Failed to get 2D context for terrain condition overlay");
        return;
    }
    terrainConditionContext.clearRect(0,0, TERRAIN_CONDITION_TEXTURE_WIDTH, TERRAIN_CONDITION_TEXTURE_HEIGHT);

    const texture = new THREE.CanvasTexture(terrainConditionCanvas);
    texture.needsUpdate = true;

    const overlayMaterial = new THREE.MeshBasicMaterial({ // Basic material is fine for a 2D texture overlay
        map: texture,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide, // Render both sides if needed, or FrontSide if view is always external
        depthWrite: false, // Important for overlay effects
    });
    terrainConditionOverlay = new THREE.Mesh(overlayGeometry, overlayMaterial);
    this.scene.add(terrainConditionOverlay);
}
  
  private createFactionVisualLayers() {
    const overlayGeometry = new THREE.SphereGeometry(this.earth.geometry.parameters.radius + 0.01, 32, 32);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const overlayMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    this.factionInfluenceOverlay = new THREE.Mesh(overlayGeometry, overlayMaterial);
    this.scene.add(this.factionInfluenceOverlay);
    this.scene.add(this.factionHQLayer);
  }

  private createParticleTexture(color: string, size: number = 16): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d')!;
    context.beginPath();
    context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private createWeatherParticles(): void {
    const particleSpreadFactor = this.earth.geometry.parameters.radius * 2.5;

    this.rainMaterial = new THREE.PointsMaterial({
      color: 0xaaaaee, size: 0.03, map: this.createParticleTexture('rgba(170,170,238,0.7)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });

    this.snowMaterial = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.04, map: this.createParticleTexture('rgba(255,255,255,0.8)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });

    const createParticleSystem = (material: THREE.PointsMaterial): THREE.Points => {
      const geometry = new THREE.BufferGeometry();
      const vertices: number[] = [];
      for (let i = 0; i < this.PARTICLE_COUNT; i++) {
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos((Math.random() * 2) - 1);
        const r = this.earth.geometry.parameters.radius * 1.5 + Math.random() * particleSpreadFactor;

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        vertices.push(x, y, z);
      }
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      const particles = new THREE.Points(geometry, material);
      particles.visible = false;
      this.scene.add(particles);
      return particles;
    };

    this.rainParticles = createParticleSystem(this.rainMaterial);
    this.snowParticles = createParticleSystem(this.snowMaterial);
  }

  private setupRenderer(container: HTMLElement) {
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);
  }
  
  private setupCamera() {
    this.camera.position.set(0, 0, 8);
    this.camera.lookAt(0, 0, 0);
  }
  
  private setupLighting() {
    const sunLight = new THREE.DirectionalLight(0xffffff, 2);
    sunLight.position.set(5, 3, 5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    this.scene.add(sunLight);
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    this.scene.add(ambientLight);
    
    const earthGlow = new THREE.PointLight(0x4a90ff, 0.5, 20);
    earthGlow.position.set(0, 0, 0);
    this.scene.add(earthGlow);
    
    this.createStarfield();
  }
  
  private createStarfield() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.02 });
    
    const starsVertices = [];
    const starfieldRadius = this.camera.far / 2;
    for (let i = 0; i < 10000; i++) {
      const r = starfieldRadius * (0.5 + Math.random() * 0.5);
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos((Math.random() * 2) - 1);
      starsVertices.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(stars);
  }
  
  private createEarth() {
    const geometry = new THREE.SphereGeometry(2, 64, 64);
    
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    this.createEarthTexture(ctx, canvas.width, canvas.height);
    const earthTexture = new THREE.CanvasTexture(canvas);
    earthTexture.wrapS = THREE.RepeatWrapping;
    earthTexture.wrapT = THREE.RepeatWrapping;
    
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = 512;
    normalCanvas.height = 256;
    const normalCtx = normalCanvas.getContext('2d')!;
    this.createNormalMap(normalCtx, normalCanvas.width, normalCanvas.height);
    const normalTexture = new THREE.CanvasTexture(normalCanvas);
    
    const material = new THREE.MeshPhongMaterial({
      map: earthTexture,
      normalMap: normalTexture,
      shininess: 0.1,
      transparent: false
    });
    
    this.earth = new THREE.Mesh(geometry, material);
    this.earth.receiveShadow = true;
    this.earth.castShadow = true;
    this.scene.add(this.earth);
  }
  
  private createEarthTexture(ctx: CanvasRenderingContext2D, width: number, height: number) {
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

        const temperature = 1 - Math.abs(j - height / 2) / (height / 2);
        
        if (temperature < 0.15 && elevation > 0) {
           elevation = Math.max(elevation, 0.75);
        }
        if (temperature < 0.1 && elevation <= 0.05 ) {
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

  private createNormalMap(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    for (let i = 0; i < width * height; i++) {
      const index = i * 4;
      data[index] = 128; data[index + 1] = 128; data[index + 2] = 255; data[index + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }
  
  private createAtmosphere() {
    const geometry = new THREE.SphereGeometry(this.earth.geometry.parameters.radius + 0.05, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x4a90ff, transparent: true, opacity: 0.15, side: THREE.BackSide
    });
    this.atmosphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.atmosphere);
  }
  
  private createCloudTexture(ctx: CanvasRenderingContext2D, width: number, height: number) {
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
        const z = Math.sin(lat);

        let baseNoise = 0;
        let freq = 1.8;
        let amp = 1.0;
        for(let k=0; k<4; k++) {
            baseNoise += simplexPrimary.noise3D(x * freq, y * freq, z * freq + 10) * amp;
            freq *= 2.0;
            amp *= 0.6;
        }
        baseNoise = (baseNoise / 1.8 + 1) / 2;

        let detailNoise = 0;
        freq = 4.5; amp = 0.7;
        for(let k=0; k<3; k++) {
            detailNoise += simplexSecondary.noise3D(x * freq + 5, y * freq + 15, z * freq + 25) * amp;
            freq *= 2.2;
            amp *= 0.5;
        }
        detailNoise = (detailNoise / 1.5 + 1) / 2;

        let wispNoise = 0;
        freq = 8.0; amp = 0.4;
        for(let k=0; k<2; k++) {
            wispNoise += simplexWisps.noise3D(x * freq - 10, y * freq - 5, z * freq - 15) * amp;
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
  
  private setupControls() {
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      isDragging = true;
      previousMousePosition.x = event.clientX;
      previousMousePosition.y = event.clientY;
    });
    
    this.renderer.domElement.addEventListener('mousemove', (event) => {
      if (isDragging) {
        const deltaMove = {
          x: event.clientX - previousMousePosition.x,
          y: event.clientY - previousMousePosition.y
        };
        const rotationSpeed = 0.005;
        this.earth.rotation.y += deltaMove.x * rotationSpeed;
        this.earth.rotation.x += deltaMove.y * rotationSpeed;
        this.atmosphere.rotation.y = this.earth.rotation.y;
        this.atmosphere.rotation.x = this.earth.rotation.x;
        this.clouds.rotation.y = this.earth.rotation.y * 1.1;
        this.clouds.rotation.x = this.earth.rotation.x * 1.1;
        
        previousMousePosition.x = event.clientX;
        previousMousePosition.y = event.clientY;
      }
    });
    
    this.renderer.domElement.addEventListener('mouseup', () => { isDragging = false; });
    
    this.renderer.domElement.addEventListener('wheel', (event) => {
      const zoomSpeed = 0.1;
      this.camera.position.z *= (1 + (event.deltaY > 0 ? zoomSpeed : -zoomSpeed));
      this.camera.position.clampLength(this.earth.geometry.parameters.radius * 1.5, this.earth.geometry.parameters.radius * 10);
    });
  }
  
  private setupEventListeners(container: HTMLElement) {
    this.renderer.domElement.addEventListener('click', (event) => {
      this.mouse.x = (event.clientX / container.clientWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / container.clientHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      const satelliteMeshesForRaycast = Array.from(this.satelliteMeshes.values());
      const satelliteIntersects = this.raycaster.intersectObjects(satelliteMeshesForRaycast);
      
      if (satelliteIntersects.length > 0) {
        const satelliteMesh = satelliteIntersects[0].object as THREE.Mesh;
        const satelliteId = satelliteMesh.userData.id;
        const satelliteName = satelliteMesh.userData.name;
        const satelliteType = satelliteMesh.userData.type;

        if (satelliteId && this.onSatelliteClick) {
          this.onSatelliteClick(satelliteId, satelliteName, satelliteType, event.clientX, event.clientY);
        }
        return;
      }
      
      const earthIntersects = this.raycaster.intersectObject(this.earth);
      if (earthIntersects.length > 0) {
        const point = earthIntersects[0].point;
        const region = this.getRegionFromPoint(point);
        if (region && this.onRegionClick) {
          this.onRegionClick(region, event.clientX, event.clientY);
        }
      }
    });
  }
  
  private getRegionFromPoint(point: THREE.Vector3): WorldRegion | null {
    const spherePoint = point.clone().normalize().multiplyScalar(2.0);
    const lat = Math.asin(spherePoint.y / 2.0);
    const lon = Math.atan2(spherePoint.x, spherePoint.z);

    if (lon > -2.0 && lon < -0.5 && lat > 0.2 && lat < 1.0) return { id: 'na', name: 'North America' } as WorldRegion;
    return null;
  }
  
  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    
    this.earth.rotation.y += 0.0005 * (this.currentGameState?.speed || 1);
    this.atmosphere.rotation.y = this.earth.rotation.y;
    this.clouds.rotation.y += 0.0006 * (this.currentGameState?.speed || 1);

    if (this.factionInfluenceOverlay) this.factionInfluenceOverlay.rotation.copy(this.earth.rotation);
    if (this.factionHQLayer) this.factionHQLayer.rotation.copy(this.earth.rotation);
    if (terrainConditionOverlay) terrainConditionOverlay.rotation.copy(this.earth.rotation);
    
    if (this.currentGameState) {
      this.updateWeatherVisuals(this.currentGameState);
    }
    
    this.renderer.render(this.scene, this.camera);
  };

  private updateSatelliteVisuals(entities: IEntity[]): void {
    const currentSatelliteIds = new Set<string>();

    entities.forEach(entity => {
      if (entity.entityType === 'SatelliteEntity') {
        currentSatelliteIds.add(entity.id);
        const transformComp = entity.getComponent<ITransformComponent>(DEFAULT_TRANSFORM_COMPONENT_NAME);
        const dataComp = entity.getComponent<ISatelliteDataComponent>(DEFAULT_SATELLITE_DATA_COMPONENT_NAME);

        if (transformComp && dataComp) {
          let mesh = this.satelliteMeshes.get(entity.id);
          if (!mesh) {
            const geometry = new THREE.BoxGeometry(0.05, 0.05, 0.1);
            const color = dataComp.satelliteType === 'military' ? 0xff0000 :
                          dataComp.satelliteType === 'communication' ? 0x00ff00 :
                          dataComp.satelliteType === 'surveillance' ? 0xffff00 : 0xcccccc;
            const material = new THREE.MeshBasicMaterial({ color });
            mesh = new THREE.Mesh(geometry, material);
            mesh.userData = { id: entity.id, name: entity.name, type: dataComp.satelliteType };
            this.scene.add(mesh);
            this.satelliteMeshes.set(entity.id, mesh);
          }

          const visualPosition = VectorOps.scale(transformComp.positionMeters, PHYSICS_TO_VISUAL_SCALE);
          mesh.position.set(visualPosition.x, visualPosition.y, visualPosition.z);
          mesh.lookAt(this.earth.position);

          const material = mesh.material as THREE.MeshBasicMaterial;
          if (dataComp.status === 'destroyed' || dataComp.status === 'inactive') {
            material.color.setHex(0x555555);
            mesh.visible = dataComp.status !== 'destroyed';
          } else if (dataComp.status === 'compromised') {
            material.color.setHex(0xff8800);
            mesh.visible = true;
          } else {
             const color = dataComp.satelliteType === 'military' ? 0xff0000 :
                          dataComp.satelliteType === 'communication' ? 0x00ff00 :
                          dataComp.satelliteType === 'surveillance' ? 0xffff00 : 0xcccccc;
            material.color.setHex(color);
            mesh.visible = true;
          }
        }
      }
    });

    this.satelliteMeshes.forEach((mesh, id) => {
      if (!currentSatelliteIds.has(id)) {
        this.scene.remove(mesh);
        if(mesh.material) (mesh.material as THREE.Material).dispose();
        if(mesh.geometry) mesh.geometry.dispose();
        this.satelliteMeshes.delete(id);
      }
    });
  }


  private updateWeatherVisuals(gameState: GameState): void {
    if (!this.rainParticles || !this.snowParticles || !this.clouds || !this.cloudMaterial) return;

    let totalPrecipitation = 0; let avgTemperature = 0; let activeBiomes = 0;
    let isDroughtGlobally = false;
    let droughtBiomeCount = 0;

    gameState.biomes.forEach(biome => {
      if (biome.currentWeather) {
        totalPrecipitation += biome.currentWeather.precipitation;
        avgTemperature += biome.currentWeather.temperature;
        activeBiomes++;
        if (biome.currentWeather.description === "Drought") {
            droughtBiomeCount++;
        }
      }
    });
    if (activeBiomes > 0 && droughtBiomeCount / activeBiomes > 0.3) {
        isDroughtGlobally = true;
    }

    const avgPrecip = activeBiomes > 0 ? totalPrecipitation / activeBiomes : 0;
    avgTemperature = activeBiomes > 0 ? avgTemperature / activeBiomes : 15;

    let cloudCoverFactor = Math.min(1, avgPrecip / 7);
    if (isDroughtGlobally) {
        cloudCoverFactor *= 0.2;
    }

    this.cloudMaterial.opacity = 0.1 + cloudCoverFactor * 0.6;
    this.cloudMaterial.emissiveIntensity = cloudCoverFactor * 0.05; // Subtle emission based on density


    const earthRadius = this.earth.geometry.parameters.radius;
    const particleVolumeHalfHeight = earthRadius * 3;

    const animateParticles = (particles: THREE.Points, speed: number, deltaTime: number = 0.016 * (this.currentGameState?.speed || 1)) => {
      const positions = particles.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const particlePosition = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
        particlePosition.y -= speed * deltaTime * (Math.random() * 0.5 + 0.5);
        if (particlePosition.length() < earthRadius * 0.8 || particlePosition.y < -particleVolumeHalfHeight) {
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos((Math.random() * 2) - 1);
            const r = earthRadius * 1.5 + Math.random() * particleVolumeHalfHeight * 1.5;
            const newX = r * Math.sin(phi) * Math.cos(theta);
            const newY = particleVolumeHalfHeight * (0.8 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1);
            const newZ = r * Math.sin(phi) * Math.sin(theta);
            positions.setXYZ(i, newX, newY, newZ);
        } else {
            positions.setXYZ(i, particlePosition.x, particlePosition.y, particlePosition.z);
        }
      }
      positions.needsUpdate = true;
    };

    if (avgPrecip > 0.1) {
      if (avgTemperature > 0) {
        this.rainParticles.visible = true; this.snowParticles.visible = false;
        animateParticles(this.rainParticles, 5.0);
      } else {
        this.snowParticles.visible = true; this.rainParticles.visible = false;
        animateParticles(this.snowParticles, 1.5);
      }
    } else {
      this.rainParticles.visible = false; this.snowParticles.visible = false;
    }
  }
  
  public updateRegionData(regions: WorldRegion[]) {
  }

  private updateTerrainConditionVisuals(biomes: Map<string, Biome>, activeDisasters: RegionEvent[]): void {
    if (!terrainConditionContext || !terrainConditionOverlay || !terrainConditionCanvas || !terrainConditionOverlay.material) return;

    terrainConditionContext.clearRect(0, 0, TERRAIN_CONDITION_TEXTURE_WIDTH, TERRAIN_CONDITION_TEXTURE_HEIGHT);
    let needsTextureUpdate = false;

    if (this.currentGameState && this.currentGameState.worldRegions && terrainConditionContext) {
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

                    const gradient = terrainConditionContext.createRadialGradient(canvasX, canvasY, radius * 0.1, canvasX, canvasY, radius);
                    gradient.addColorStop(0, 'rgba(160, 120, 80, 0.35)');
                    gradient.addColorStop(0.7, 'rgba(160, 120, 80, 0.15)');
                    gradient.addColorStop(1, 'rgba(160, 120, 80, 0.0)');
                    terrainConditionContext.fillStyle = gradient;
                    terrainConditionContext.beginPath();
                    terrainConditionContext.arc(canvasX, canvasY, radius, 0, Math.PI * 2);
                    terrainConditionContext.fill();
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
            const visualRadius = disasterRadiusFactor * (TERRAIN_CONDITION_TEXTURE_WIDTH / (2 * Math.PI)); // Adjusted scaling for radius

            terrainConditionContext!.fillStyle = 'rgba(30, 20, 10, 0.6)';
            terrainConditionContext!.beginPath();
            terrainConditionContext!.arc(canvasX, canvasY, visualRadius, 0, Math.PI * 2);
            terrainConditionContext!.fill();
            needsTextureUpdate = true;
        }
    });

    if (needsTextureUpdate && terrainConditionOverlay.material instanceof THREE.MeshStandardMaterial && terrainConditionOverlay.material.map) { // Check for MeshStandardMaterial
        (terrainConditionOverlay.material.map as THREE.CanvasTexture).needsUpdate = true;
    } else if (needsTextureUpdate && terrainConditionOverlay.material instanceof THREE.MeshBasicMaterial && terrainConditionOverlay.material.map) {
         (terrainConditionOverlay.material.map as THREE.CanvasTexture).needsUpdate = true;
    }
}


  public updateFactionData(factions: Faction[], regions: WorldRegion[]) {
    if (!this.factionInfluenceOverlay || !this.factionInfluenceOverlay.material) return;

    const material = this.factionInfluenceOverlay.material as THREE.MeshBasicMaterial;
    const canvas = material.map!.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    const factionColors: Record<string, [number, number, number]> = {};
    factions.forEach((faction, index) => {
      factionColors[faction.id] = [
        (parseInt(faction.id.slice(-2), 16) * 5 + index * 20) % 255,
        (faction.ideology.length * 30 + index * 40 + 50) % 255,
        (faction.powerLevel * 2 + index * 30 + 100) % 255
      ];
    });

    for (let i = 0; i < canvas.width; i++) {
      for (let j = 0; j < canvas.height; j++) {
        const u = i / canvas.width;
        const v = 1 - (j / canvas.height);
        const lonRad = (u - 0.5) * 2 * Math.PI;
        const latRad = (v - 0.5) * Math.PI;

        let rSum = 0, gSum = 0, bSum = 0, totalInfluenceAtPixel = 0;

        regions.forEach(region => {
          const regionLonRad = region.x * Math.PI;
          const regionLatRad = region.y * (Math.PI / 2);

          const deltaLon = Math.abs(lonRad - regionLonRad);
          const deltaLat = Math.abs(latRad - regionLatRad);
          const influenceRadius = 0.5;

          if (deltaLon < influenceRadius && deltaLat < influenceRadius) {
             factions.forEach(faction => {
              const influence = faction.influence.get(region.id) || 0;
              if (influence > 0) {
                const [r, g, b] = factionColors[faction.id];
                const weight = influence / 100;
                rSum += r * weight; gSum += g * weight; bSum += b * weight;
                totalInfluenceAtPixel += weight;
              }
            });
          }
        });

        const pixelIndex = (j * canvas.width + i) * 4;
        if (totalInfluenceAtPixel > 0) {
          data[pixelIndex] = rSum / totalInfluenceAtPixel;
          data[pixelIndex + 1] = gSum / totalInfluenceAtPixel;
          data[pixelIndex + 2] = bSum / totalInfluenceAtPixel;
          data[pixelIndex + 3] = Math.min(255, totalInfluenceAtPixel * 150 + 50);
        } else {
          data[pixelIndex + 3] = 0;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
    material.map!.needsUpdate = true;

    this.factionHQLayer.children.forEach(child => {
        this.scene.remove(child);
        if((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
        if((child as THREE.Mesh).material) ((child as THREE.Mesh).material as THREE.Material).dispose();
    });
    this.factionHQLayer.clear();

    factions.forEach(faction => {
      const hqRegion = regions.find(r => r.id === faction.headquartersRegion);
      if (hqRegion) {
        const color = new THREE.Color().fromArray(factionColors[faction.id].map(c => c/255));
        const hqMarkerGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
        const hqMarkerMat = new THREE.MeshBasicMaterial({ color });
        const hqMarker = new THREE.Mesh(hqMarkerGeo, hqMarkerMat);

        const hqLonRad = hqRegion.x * Math.PI;
        const hqLatRad = hqRegion.y * (Math.PI/2);
        const r = this.earth.geometry.parameters.radius + 0.05;

        hqMarker.position.set(
            r * Math.cos(hqLatRad) * Math.cos(hqLonRad),
            r * Math.sin(hqLatRad),
            r * Math.cos(latRad) * Math.sin(hqLonRad) // Use hqLonRad here
        );
        hqMarker.lookAt(this.earth.position);
        hqMarker.rotateX(Math.PI / 2);
        this.factionHQLayer.add(hqMarker);
      }
    });
  }
  
  public addEventMarker(event: RegionEvent) {
    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
      color: this.getEventColor(event.type), transparent: true, opacity: 0.8
    });
    const marker = new THREE.Mesh(geometry, material);

    const lonRad = event.x * Math.PI;
    const latRad = event.y * (Math.PI/2);
    const r = this.earth.geometry.parameters.radius + 0.1;
    marker.position.set(
        r * Math.cos(latRad) * Math.cos(lonRad),
        r * Math.sin(latRad),
        r * Math.cos(latRad) * Math.sin(lonRad)
    );
    
    this.scene.add(marker);
    this.eventMarkers.push(marker);
    this.createEventParticles(event.type, marker.position.clone(), event.radius);
    
    setTimeout(() => {
      this.scene.remove(marker);
      if (marker.material) (marker.material as THREE.Material).dispose();
      if (marker.geometry) marker.geometry.dispose();
      const index = this.eventMarkers.indexOf(marker);
      if (index > -1) this.eventMarkers.splice(index, 1);
    }, (event.duration || 5000) * (this.currentGameState?.speed || 1) );
  }
  
  private getEventColor(type: EventType): number {
    const colors = {
      [EventType.NUCLEAR_STRIKE]: 0xff0000, [EventType.BIOLOGICAL_WEAPON]: 0x00ff00,
      [EventType.CYBER_ATTACK]: 0x0088ff, [EventType.CLIMATE_DISASTER]: 0xffaa00,
      [EventType.ROGUE_AI]: 0xff00ff, [EventType.SPACE_WEAPON]: 0xffffff,
      [EventType.HEALING]: 0x00ff88, [EventType.ENVIRONMENTAL_RESTORATION]: 0x88ff00,
      [EventType.TRADE_WAR]: 0xffaa00, [EventType.RESOURCE_DISCOVERY]: 0x00ffff,
      [EventType.ECONOMIC_RECESSION]: 0x808080, [EventType.TECHNOLOGICAL_LEAP]: 0xaaaaff,
      [EventType.GLOBAL_TRADE_DEAL]: 0x00aa00,
      [EventType.WILDFIRE_EVENT]: 0xff4500,
    };
    return colors[type] || 0xffffff;
  }

  private createEventParticles(type: EventType, position: THREE.Vector3, eventRadius: number = 0.1) {
    let particleCount = 50;
    let particleSize = 0.05;
    let particleColor = this.getEventColor(type);
    let particleBlending = THREE.AdditiveBlending;

    if (type === EventType.WILDFIRE_EVENT) {
        particleCount = 150;
        particleSize = 0.08;
    }


    const particles = new THREE.BufferGeometry();
    const pMaterial = new THREE.PointsMaterial({
      color: particleColor, size: particleSize, blending: particleBlending,
      transparent: true, depthWrite: false, opacity: 0.9,
    });

    const pVertices = [];
    const visualEventRadius = eventRadius * (this.earth.geometry.parameters.radius / EARTH_RADIUS_METERS) * 10;

    for (let i = 0; i < particleCount; i++) {
        const r = Math.random() * visualEventRadius;
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos((Math.random() * 2) - 1);
        pVertices.push(
            position.x + r * Math.sin(phi) * Math.cos(theta),
            position.y + r * Math.sin(phi) * Math.sin(theta),
            position.z + r * Math.cos(phi)
        );
    }
    particles.setAttribute('position', new THREE.Float32BufferAttribute(pVertices, 3));
    const particleSystem = new THREE.Points(particles, pMaterial);
    this.scene.add(particleSystem);

    let particle_life = 0;
    const animateEventParticles = () => {
      particle_life += 0.01;
      const positions = particles.attributes.position.array as Float32Array;

      if (type === EventType.WILDFIRE_EVENT) {
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3 + 1] += (Math.random() * 0.005 + 0.001) * (this.currentGameState?.speed || 1);
            positions[i * 3 + 0] += (Math.random() - 0.5) * 0.01;
            positions[i * 3 + 2] += (Math.random() - 0.5) * 0.01;
        }
      } else {
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3 + 0] += (Math.random() - 0.5) * 0.02;
            positions[i * 3 + 1] += (Math.random() - 0.5) * 0.02;
            positions[i * 3 + 2] += (Math.random() - 0.5) * 0.02;
        }
      }
      particles.attributes.position.needsUpdate = true;
      pMaterial.opacity = Math.max(0, 0.9 - particle_life * 1.5);

      if (pMaterial.opacity > 0 && particle_life < 1.5) requestAnimationFrame(animateEventParticles);
      else {
        this.scene.remove(particleSystem); particles.dispose(); pMaterial.dispose();
      }
    };
    animateEventParticles();
  }
  
  public compromiseSatellite(satelliteId: string) {
    const mesh = this.satelliteMeshes.get(satelliteId);
    if (mesh) (mesh.material as THREE.MeshBasicMaterial).color.setHex(0xff8800);
  }
  
  public destroySatellite(satelliteId: string) {
    const mesh = this.satelliteMeshes.get(satelliteId);
    if (mesh) {
      mesh.visible = false;
    }
  }
  
  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  public dispose() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.renderer.dispose();
    this.rainMaterial?.dispose(); this.snowMaterial?.dispose();
    this.rainParticles?.geometry.dispose(); this.snowParticles?.geometry.dispose();
    this.satelliteMeshes.forEach(mesh => {
        if(mesh.geometry) mesh.geometry.dispose();
        if(mesh.material) (mesh.material as THREE.Material).dispose();
    });
    if (terrainConditionOverlay && terrainConditionOverlay.material instanceof THREE.MeshBasicMaterial && terrainConditionOverlay.material.map) { // Check type before casting
        (terrainConditionOverlay.material.map as THREE.CanvasTexture).dispose();
    } else if (terrainConditionOverlay && terrainConditionOverlay.material instanceof THREE.MeshStandardMaterial && terrainConditionOverlay.material.map) {
        (terrainConditionOverlay.material.map as THREE.CanvasTexture).dispose();
    }
    if (terrainConditionOverlay?.geometry) terrainConditionOverlay.geometry.dispose();
  }
}