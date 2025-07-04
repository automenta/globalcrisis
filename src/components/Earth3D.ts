import * as THREE from 'three';
import { GameState, WorldRegion, RegionEvent, EventType, Faction, Ideology } from '../engine/GameEngine'; // Added Faction, Ideology
import SimplexNoise from 'simplex-noise';

export interface Satellite {
  id: string;
  name: string;
  type: 'military' | 'communication' | 'surveillance' | 'weapon' | 'civilian';
  orbit: {
    radius: number;
    inclination: number;
    speed: number;
    phase: number;
  };
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  active: boolean;
  compromised: boolean;
}

export interface ContextMenu {
  visible: boolean;
  x: number;
  y: number;
  region: WorldRegion | null;
  type: 'region' | 'satellite' | 'event';
  target: any;
}

export class Earth3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private earth: THREE.Mesh;
  private atmosphere: THREE.Mesh;
  private clouds: THREE.Mesh;
  private satellites: Satellite[] = [];
  private regionMarkers: THREE.Mesh[] = [];
  private eventMarkers: THREE.Mesh[] = [];
  private factionInfluenceOverlay: THREE.Mesh | null = null; // For faction visualization
  private factionHQLayer: THREE.Group = new THREE.Group(); // Group for HQ markers
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private controls: any;
  private animationId: number = 0;
  
  public onRegionClick?: (region: WorldRegion, x: number, y: number) => void;
  public onSatelliteClick?: (satellite: Satellite, x: number, y: number) => void;
  public onEventClick?: (event: RegionEvent, x: number, y: number) => void;
  
  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 10000);
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
    this.createClouds();
    this.createSatellites();
    this.createFactionVisualLayers(); // Initialize faction layers
    this.setupControls();
    this.setupEventListeners(container);
    this.animate();
  }
  
  private createFactionVisualLayers() {
    // Faction Influence Overlay (transparent sphere)
    const overlayGeometry = new THREE.SphereGeometry(2.01, 32, 32); // Slightly above earth surface
    // The material will be a canvas texture that gets updated
    const canvas = document.createElement('canvas');
    canvas.width = 1024; // Texture resolution for influence map
    canvas.height = 512;
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const overlayMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.3, // Adjust for desired visibility
      side: THREE.DoubleSide, // Render both sides if needed
    });
    this.factionInfluenceOverlay = new THREE.Mesh(overlayGeometry, overlayMaterial);
    this.scene.add(this.factionInfluenceOverlay);

    // Add faction HQ layer to the scene
    this.scene.add(this.factionHQLayer);
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
    // Main sun light
    const sunLight = new THREE.DirectionalLight(0xffffff, 2);
    sunLight.position.set(5, 3, 5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    this.scene.add(sunLight);
    
    // Ambient space light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    this.scene.add(ambientLight);
    
    // Earth's glow
    const earthGlow = new THREE.PointLight(0x4a90ff, 0.5, 20);
    earthGlow.position.set(0, 0, 0);
    this.scene.add(earthGlow);
    
    // Stars background
    this.createStarfield();
  }
  
  private createStarfield() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 2 });
    
    const starsVertices = [];
    for (let i = 0; i < 10000; i++) {
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 2000;
      const z = (Math.random() - 0.5) * 2000;
      starsVertices.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(stars);
  }
  
  private createEarth() {
    const geometry = new THREE.SphereGeometry(2, 64, 64);
    
    // Create detailed earth material with multiple textures
    const textureLoader = new THREE.TextureLoader();
    
    // We'll create procedural textures since we can't load external images
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Create earth-like texture procedurally
    this.createEarthTexture(ctx, canvas.width, canvas.height);
    const earthTexture = new THREE.CanvasTexture(canvas);
    earthTexture.wrapS = THREE.RepeatWrapping;
    earthTexture.wrapT = THREE.RepeatWrapping;
    
    // Create normal map
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

    // Helper function to map noise value to color
    const getColor = (elevation: number, moisture: number) => {
      if (elevation < -0.1) { // Deep Ocean
        return [10, 20, 80 + elevation * 200]; // Darker blue
      } else if (elevation < 0.05) { // Shallow Ocean / Coast
        return [20, 80, 150 + elevation * 400]; // Lighter blue
      } else if (elevation < 0.15) { // Beach / Lowland
        if (moisture > 0.3) return [139, 178, 102]; // Lush Lowland Green
        return [210, 180, 140]; // Tan sand
      } else if (elevation < 0.4) { // Plains / Forests
        if (moisture > 0.5) return [34, 139, 34]; // Forest Green
        if (moisture > 0.1) return [124, 252, 0]; // Grassland Green
        return [188, 143, 143]; // Dry plains / light brown
      } else if (elevation < 0.6) { // Hills / Light Mountains
        if (moisture > 0.3) return [85, 107, 47]; // Dark Olive Green (Forested Hills)
        return [139, 119, 101]; // Brownish grey rock
      } else if (elevation < 0.8) { // Mountains
        return [100, 100, 100]; // Grey rock
      } else { // Snowy Peaks
        return [220, 220, 220]; // White snow
      }
    };

    for (let j = 0; j < height; j++) { // y, latitude
      for (let i = 0; i < width; i++) { // x, longitude
        const index = (j * width + i) * 4;

        // Convert pixel coordinates to 3D coordinates on a sphere for noise input
        // This gives better results than direct lat/lon for simplex noise on a sphere
        const u = i / width;
        const v = j / height;
        const lon = u * 2 * Math.PI;
        const lat = (v - 0.5) * Math.PI;

        // Sphere mapping for noise (prevents pinching at poles)
        const x = Math.cos(lat) * Math.cos(lon);
        const y = Math.cos(lat) * Math.sin(lon);
        const z = Math.sin(lat);
        
        // Multiple octaves of Simplex noise for elevation
        let elevation = 0;
        let frequency = 2.5; // Base frequency for continents
        let amplitude = 1;
        let lacunarity = 2.0; // How much detail is added with each octave
        let persistence = 0.5; // How much amplitude is reduced for each octave

        for (let o = 0; o < 6; o++) { // 6 octaves of noise
          elevation += simplex.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
          frequency *= lacunarity;
          amplitude *= persistence;
        }
        // Normalize elevation to roughly -1 to 1, then scale for desired features
        elevation = elevation / 1.8; // Adjust divisor based on observed noise range

        // Moisture map (another layer of noise)
        let moisture = 0;
        frequency = 1.5;
        amplitude = 1;
        for (let o = 0; o < 4; o++) {
            moisture += simplex.noise3D(x * frequency + 100, y * frequency + 100, z * frequency + 100) * amplitude;
            frequency *= lacunarity;
            amplitude *= persistence;
        }
        moisture = (moisture / 1.5 + 1) / 2; // Normalize to 0-1

        // Temperature based on latitude (simple gradient)
        const temperature = 1 - Math.abs(j - height / 2) / (height / 2); // 1 at equator, 0 at poles
        
        // Adjust elevation for polar ice caps
        if (temperature < 0.15 && elevation > 0) { // Cold regions with land
           elevation = Math.max(elevation, 0.75); // Force snowy peaks for ice caps
        }
        if (temperature < 0.1 && elevation <= 0.05 ) { // Cold regions with ocean
            elevation = 0.75; // Ice sheets over ocean
        }


        const [r, g, b] = getColor(elevation, moisture);
        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        data[index + 3] = 255; // Alpha
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  private createNormalMap(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    for (let i = 0; i < width * height; i++) {
      const index = i * 4;
      data[index] = 128;     // R
      data[index + 1] = 128; // G
      data[index + 2] = 255; // B
      data[index + 3] = 255; // A
    }
    
    ctx.putImageData(imageData, 0, 0);
  }
  
  private createAtmosphere() {
    const geometry = new THREE.SphereGeometry(2.05, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x4a90ff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide
    });
    
    this.atmosphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.atmosphere);
  }
  
  private createClouds() {
    const geometry = new THREE.SphereGeometry(2.02, 32, 32);
    
    // Create procedural cloud texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    this.createCloudTexture(ctx, canvas.width, canvas.height);
    const cloudTexture = new THREE.CanvasTexture(canvas);
    
    const material = new THREE.MeshBasicMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.4
    });
    
    this.clouds = new THREE.Mesh(geometry, material);
    this.scene.add(this.clouds);
  }
  
  private createCloudTexture(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    const simplex = new SimplexNoise(); // Re-initialize for clouds or pass instance if preferred

    for (let j = 0; j < height; j++) { // y, latitude
      for (let i = 0; i < width; i++) { // x, longitude
        const index = (j * width + i) * 4;

        const u = i / width;
        const v = j / height;
        const lon = u * 2 * Math.PI;
        const lat = (v - 0.5) * Math.PI;

        // Sphere mapping for noise
        const x = Math.cos(lat) * Math.cos(lon);
        const y = Math.cos(lat) * Math.sin(lon);
        const z = Math.sin(lat);

        // Simplex noise for cloud patterns
        let cloudNoise = 0;
        let frequency = 3.0; // Different frequency for clouds
        let amplitude = 1;
        for (let o = 0; o < 5; o++) { // Fewer octaves for softer clouds
          cloudNoise += simplex.noise3D(x * frequency, y * frequency, z * frequency + 50) * amplitude; // Offset z for different pattern
          frequency *= 2.0;
          amplitude *= 0.5;
        }
        cloudNoise = (cloudNoise / 1.5 + 1) / 2; // Normalize to 0-1

        const cloudValue = cloudNoise > 0.6 ? (cloudNoise - 0.6) / 0.4 * 200 + 55 : 0; // Threshold and scale for opacity
        
        data[index] = 255; // R - white clouds
        data[index + 1] = 255; // G
        data[index + 2] = 255; // B
        data[index + 3] = Math.max(0, Math.min(255, cloudValue)); // Alpha - cloud density
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  private createSatellites() {
    const satelliteTypes = [
      { type: 'military', count: 8, color: 0xff0000, radius: 3.5 },
      { type: 'surveillance', count: 12, color: 0xffff00, radius: 4.0 },
      { type: 'communication', count: 15, color: 0x00ff00, radius: 6.0 },
      { type: 'weapon', count: 6, color: 0xff00ff, radius: 3.2 },
      { type: 'civilian', count: 20, color: 0x0088ff, radius: 5.0 }
    ];
    
    satelliteTypes.forEach(({ type, count, color, radius }) => {
      for (let i = 0; i < count; i++) {
        const satellite = this.createSatellite(type as any, color, radius, i, count);
        this.satellites.push(satellite);
        this.scene.add(satellite.mesh);
      }
    });
  }
  
  private createSatellite(type: Satellite['type'], color: number, orbitRadius: number, index: number, total: number): Satellite {
    const geometry = new THREE.BoxGeometry(0.05, 0.05, 0.1);
    const material = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    
    // Add solar panels
    const panelGeometry = new THREE.PlaneGeometry(0.1, 0.03);
    const panelMaterial = new THREE.MeshBasicMaterial({ color: 0x333366 });
    const panel1 = new THREE.Mesh(panelGeometry, panelMaterial);
    const panel2 = new THREE.Mesh(panelGeometry, panelMaterial);
    panel1.position.set(0.08, 0, 0);
    panel2.position.set(-0.08, 0, 0);
    mesh.add(panel1, panel2);
    
    const satellite: Satellite = {
      id: `${type}_${index}`,
      name: `${type.toUpperCase()}-${index + 1}`,
      type,
      orbit: {
        radius: orbitRadius,
        inclination: (Math.random() - 0.5) * Math.PI / 3,
        speed: 0.001 + Math.random() * 0.002,
        phase: (index / total) * Math.PI * 2
      },
      position: new THREE.Vector3(),
      mesh,
      active: true,
      compromised: false
    };
    
    return satellite;
  }
  
  private setupControls() {
    // Manual orbit controls implementation
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
    
    this.renderer.domElement.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    this.renderer.domElement.addEventListener('wheel', (event) => {
      const zoomSpeed = 0.1;
      this.camera.position.multiplyScalar(1 + (event.deltaY > 0 ? zoomSpeed : -zoomSpeed));
      this.camera.position.clampLength(3, 50);
    });
  }
  
  private setupEventListeners(container: HTMLElement) {
    this.renderer.domElement.addEventListener('click', (event) => {
      this.mouse.x = (event.clientX / container.clientWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / container.clientHeight) * 2 + 1;
      
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      // Check satellite intersections
      const satelliteMeshes = this.satellites.map(s => s.mesh);
      const satelliteIntersects = this.raycaster.intersectObjects(satelliteMeshes);
      
      if (satelliteIntersects.length > 0) {
        const satellite = this.satellites.find(s => s.mesh === satelliteIntersects[0].object);
        if (satellite && this.onSatelliteClick) {
          this.onSatelliteClick(satellite, event.clientX, event.clientY);
        }
        return;
      }
      
      // Check earth intersections for regions
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
    // Convert 3D point to lat/lon and determine region
    const lat = Math.asin(point.y / 2);
    const lon = Math.atan2(point.z, point.x);
    
    // Simple region mapping based on coordinates
    if (lon < -Math.PI/3 && lon > -2*Math.PI/3 && lat > 0) return { id: 'na', name: 'North America' } as WorldRegion;
    if (lon < -Math.PI/6 && lon > -Math.PI/2 && lat < 0) return { id: 'sa', name: 'South America' } as WorldRegion;
    if (lon > -Math.PI/6 && lon < Math.PI/3 && lat > 0) return { id: 'eu', name: 'Europe' } as WorldRegion;
    if (lon > -Math.PI/6 && lon < Math.PI/3 && lat < 0) return { id: 'af', name: 'Africa' } as WorldRegion;
    if (lon > Math.PI/3) return { id: 'as', name: 'Asia' } as WorldRegion;
    if (lon < -2*Math.PI/3 && lat < -Math.PI/6) return { id: 'oc', name: 'Oceania' } as WorldRegion;
    
    return null;
  }
  
  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    
    // Rotate earth slowly
    this.earth.rotation.y += 0.001;
    this.atmosphere.rotation.y += 0.001;
    this.clouds.rotation.y += 0.0012;
    if (this.factionInfluenceOverlay) {
      this.factionInfluenceOverlay.rotation.copy(this.earth.rotation);
    }
    if (this.factionHQLayer) {
      this.factionHQLayer.rotation.copy(this.earth.rotation);
    }
    
    // Update satellite positions
    this.satellites.forEach(satellite => {
      const { orbit } = satellite;
      orbit.phase += orbit.speed;
      
      const x = Math.cos(orbit.phase) * orbit.radius;
      const y = Math.sin(orbit.phase) * Math.sin(orbit.inclination) * orbit.radius;
      const z = Math.sin(orbit.phase) * Math.cos(orbit.inclination) * orbit.radius;
      
      satellite.position.set(x, y, z);
      satellite.mesh.position.copy(satellite.position);
      satellite.mesh.lookAt(0, 0, 0);
      
      // Update satellite color based on status
      const material = satellite.mesh.material as THREE.MeshBasicMaterial;
      if (!satellite.active) {
        material.color.setHex(0x666666);
      } else if (satellite.compromised) {
        material.color.setHex(0xff8800);
      }
    });
    
    this.renderer.render(this.scene, this.camera);
  };
  
  public updateRegionData(regions: WorldRegion[]) {
    // Update region visualization based on game state
    // This could be expanded to show region-specific data markers if needed
  }

  public updateFactionData(factions: Faction[], regions: WorldRegion[]) {
    if (!this.factionInfluenceOverlay) return;

    const material = this.factionInfluenceOverlay.material as THREE.MeshBasicMaterial;
    const canvas = material.map!.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear previous drawing

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    const factionColors: Record<string, [number, number, number]> = {};
    factions.forEach((faction, index) => {
      // Generate a unique color for each faction (can be improved)
      factionColors[faction.id] = [
        (parseInt(faction.id.slice(-2), 16) * 5) % 255,
        (faction.ideology.length * 30 + index * 40) % 255,
        (faction.powerLevel * 2) % 255
      ];
    });

    // Blend influences per pixel
    for (let i = 0; i < canvas.width; i++) { // u (longitude)
      for (let j = 0; j < canvas.height; j++) { // v (latitude)
        const lon = (i / canvas.width) * 2 * Math.PI - Math.PI;
        const lat = (j / canvas.height) * Math.PI - Math.PI / 2;

        let rSum = 0, gSum = 0, bSum = 0, totalInfluenceAtPixel = 0;

        regions.forEach(region => {
          // Determine if pixel is within this region (simplified, needs better mapping)
          // This is a very rough approximation. A proper UV to region mapping or SDF would be better.
          const regionLon = region.x * Math.PI; // Assuming x,y are normalized lon/lat multipliers
          const regionLat = region.y * (Math.PI / 2);
          const dist = Math.sqrt(Math.pow(lon - regionLon, 2) + Math.pow(lat - regionLat, 2));

          if (dist < 0.5) { // Pixel is "close" to region center
             factions.forEach(faction => {
              const influence = faction.influence.get(region.id) || 0;
              if (influence > 0) {
                const [r, g, b] = factionColors[faction.id];
                const weight = influence / 100;
                rSum += r * weight;
                gSum += g * weight;
                bSum += b * weight;
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
          data[pixelIndex + 3] = Math.min(255, totalInfluenceAtPixel * 100 + 50); // Alpha based on total influence
        } else {
          data[pixelIndex + 3] = 0; // Transparent if no influence
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
    material.map!.needsUpdate = true;

    // Update HQ Markers
    this.factionHQLayer.children.forEach(child => child.removeFromParent()); // Clear old markers
    this.factionHQLayer.clear();

    factions.forEach(faction => {
      const hqRegion = regions.find(r => r.id === faction.headquartersRegion);
      if (hqRegion) {
        const color = new THREE.Color().fromArray(factionColors[faction.id].map(c => c/255));
        const hqMarkerGeo = new THREE.ConeGeometry(0.05, 0.15, 8); // Cone for HQ
        const hqMarkerMat = new THREE.MeshBasicMaterial({ color });
        const hqMarker = new THREE.Mesh(hqMarkerGeo, hqMarkerMat);

        const spherical = new THREE.Spherical().setFromCartesianCoords(
          hqRegion.x * 2, // This x,y to 3D needs proper conversion based on how regions are defined
          hqRegion.y * 2,
          Math.sqrt(4 - (hqRegion.x*2)**2 - (hqRegion.y*2)**2) // Assuming x,y are on a sphere of radius 2
        );
        // A better way: convert region's representative lat/lon to Cartesian for sphere of radius 2.05
        const cartesianPos = new THREE.Vector3().setFromSphericalCoords(
            2.05, // radius slightly above Earth surface
            Math.PI / 2 - (hqRegion.y * Math.PI / 2), // Convert normalized Y to latitude (phi)
            hqRegion.x * Math.PI // Convert normalized X to longitude (theta)
        );
        hqMarker.position.copy(cartesianPos);
        hqMarker.lookAt(this.earth.position); // Point cone away from Earth center
        hqMarker.rotateX(Math.PI / 2); // Orient cone upwards
        this.factionHQLayer.add(hqMarker);
      }
    });
  }
  
  public addEventMarker(event: RegionEvent) {
    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
      color: this.getEventColor(event.type),
      transparent: true,
      opacity: 0.8
    });
    
    const marker = new THREE.Mesh(geometry, material);
    // Position based on event coordinates
    marker.position.setFromSphericalCoords(2.1, Math.PI/2 - event.y, event.x);
    
    this.scene.add(marker);
    this.eventMarkers.push(marker);

    // Trigger particle effect for the event
    this.createEventParticles(event.type, marker.position.clone());
    
    // Remove marker after event duration (visual only, actual event handled by engine)
    setTimeout(() => {
      this.scene.remove(marker);
      // Ensure material and geometry are disposed if they are unique per marker
      if (marker.material) (marker.material as THREE.Material).dispose();
      if (marker.geometry) marker.geometry.dispose();
      const index = this.eventMarkers.indexOf(marker);
      if (index > -1) this.eventMarkers.splice(index, 1);
    }, event.duration); // Match visual duration to game logic duration
  }
  
  private getEventColor(type: EventType): number {
    const colors = {
      [EventType.NUCLEAR_STRIKE]: 0xff0000,
      [EventType.BIOLOGICAL_WEAPON]: 0x00ff00,
      [EventType.CYBER_ATTACK]: 0x0088ff,
      [EventType.CLIMATE_DISASTER]: 0xffaa00,
      [EventType.ROGUE_AI]: 0xff00ff,
      [EventType.SPACE_WEAPON]: 0xffffff,
      [EventType.HEALING]: 0x00ff88,
      [EventType.ENVIRONMENTAL_RESTORATION]: 0x88ff00,
      // New Economic Event Colors
      [EventType.TRADE_WAR]: 0xffaa00, // Orange/Yellow
      [EventType.RESOURCE_DISCOVERY]: 0x00ffff, // Cyan
      [EventType.ECONOMIC_RECESSION]: 0x808080, // Grey
      [EventType.TECHNOLOGICAL_LEAP]: 0xaaaaff, // Light Blue/Purple
      [EventType.GLOBAL_TRADE_DEAL]: 0x00aa00, // Green
    };
    return colors[type] || 0xffffff;
  }

  // Method to create specific particle effects for events (can be expanded)
  private createEventParticles(type: EventType, position: THREE.Vector3) {
    const particleCount = 50;
    const particles = new THREE.BufferGeometry();
    const pMaterial = new THREE.PointsMaterial({
      color: this.getEventColor(type),
      size: 0.05,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    const pVertices = [];
    for (let i = 0; i < particleCount; i++) {
      pVertices.push(position.x, position.y, position.z);
    }
    particles.setAttribute('position', new THREE.Float32BufferAttribute(pVertices, 3));

    const particleSystem = new THREE.Points(particles, pMaterial);
    this.scene.add(particleSystem);

    // Animate particles
    let particle_life = 0;
    const animateParticles = () => {
      particle_life += 0.01;
      const positions = particles.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 0] += (Math.random() - 0.5) * 0.02;
        positions[i * 3 + 1] += (Math.random() - 0.5) * 0.02;
        positions[i * 3 + 2] += (Math.random() - 0.5) * 0.02;
      }
      particles.attributes.position.needsUpdate = true;
      pMaterial.opacity = Math.max(0, 1 - particle_life * 2);

      if (pMaterial.opacity > 0) {
        requestAnimationFrame(animateParticles);
      } else {
        this.scene.remove(particleSystem);
        particles.dispose();
        pMaterial.dispose();
      }
    };
    animateParticles();
  }
  
  public compromiseSatellite(satelliteId: string) {
    const satellite = this.satellites.find(s => s.id === satelliteId);
    if (satellite) {
      satellite.compromised = true;
    }
  }
  
  public destroySatellite(satelliteId: string) {
    const satellite = this.satellites.find(s => s.id === satelliteId);
    if (satellite) {
      satellite.active = false;
      this.scene.remove(satellite.mesh);
    }
  }
  
  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  public dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.renderer.dispose();
  }
}