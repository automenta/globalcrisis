import * as THREE from 'three';
import { GameState, WorldRegion, RegionEvent, EventType } from '../engine/GameEngine';

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
  mesh: THREE.Group; // Changed from THREE.Mesh to THREE.Group
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
    this.setupControls();
    this.setupEventListeners(container);
    this.animate();
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
    // Create a procedural earth-like texture
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        const index = (j * width + i) * 4;
        
        // Convert to lat/lon
        const lon = (i / width) * 2 * Math.PI - Math.PI;
        const lat = (j / height) * Math.PI - Math.PI / 2;
        
        // Noise for terrain
        const noise1 = Math.sin(lat * 8) * Math.cos(lon * 6);
        const noise2 = Math.sin(lat * 16) * Math.cos(lon * 12) * 0.5;
        const elevation = noise1 + noise2;
        
        if (elevation > 0.2) {
          // Land - browns and greens
          data[index] = 34 + Math.random() * 40;     // R
          data[index + 1] = 80 + Math.random() * 60; // G
          data[index + 2] = 20 + Math.random() * 30; // B
        } else {
          // Ocean - blues
          data[index] = 10 + Math.random() * 20;     // R
          data[index + 1] = 50 + Math.random() * 40; // G
          data[index + 2] = 120 + Math.random() * 80; // B
        }
        data[index + 3] = 255; // A
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }
  
  private createNormalMap(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Re-generate elevation data using the same noise parameters as in createEarthTexture
    // This is a simplified approach. Ideally, pass elevation data or use a shared noise function.
    const elevations: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));

    const simpleNoise = (x: number, y: number, scale: number, octaves: number, persistence: number) => {
      let total = 0;
      let frequency = scale;
      let amplitude = 1;
      let maxValue = 0;
      for (let i = 0; i < octaves; i++) {
        total += Math.sin(x * frequency) * Math.cos(y * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2;
      }
      return total / maxValue;
    };

    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const u = i / width;
        const v = j / height;
        const nx = u * 20;
        const ny = v * 10;
        let elevation = simpleNoise(nx, ny, 0.5, 4, 0.5);
        elevation += Math.sin(u * Math.PI * 2) * 0.3;
        elevation += Math.cos(v * Math.PI * 3) * 0.2;
        elevations[j][i] = (elevation + 1) / 2; // Store normalized elevation
      }
    }

    const strength = 5.0; // Strength of the normal map effect

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        // Sobel filter or similar to get height differences
        const tl = elevations[Math.max(0, y - 1)][Math.max(0, x - 1)]; // Top-left
        const t  = elevations[Math.max(0, y - 1)][x];                   // Top
        const tr = elevations[Math.max(0, y - 1)][Math.min(width - 1, x + 1)]; // Top-right
        const l  = elevations[y][Math.max(0, x - 1)];                   // Left
        const r  = elevations[y][Math.min(width - 1, x + 1)];           // Right
        const bl = elevations[Math.min(height - 1, y + 1)][Math.max(0, x - 1)]; // Bottom-left
        const b  = elevations[Math.min(height - 1, y + 1)][x];                   // Bottom
        const br = elevations[Math.min(height - 1, y + 1)][Math.min(width - 1, x + 1)]; // Bottom-right

        // Sobel operator
        const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
        const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);

        const normal = new THREE.Vector3(-dX * strength, -dY * strength, 1.0).normalize();

        data[index] = (normal.x * 0.5 + 0.5) * 255;     // R
        data[index + 1] = (normal.y * 0.5 + 0.5) * 255; // G
        data[index + 2] = normal.z * 255;               // B: Z is usually up (blue)
        data[index + 3] = 255;                          // A
      }
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

    // Simple pseudo-random noise function (can be the same as used for Earth texture)
    const simpleNoise = (x: number, y: number, scale: number, octaves: number, persistence: number) => {
      let total = 0;
      let frequency = scale;
      let amplitude = 1;
      let maxValue = 0;
      for (let i = 0; i < octaves; i++) {
        // Using different trig functions or offsets to vary from earth texture noise
        total += Math.cos(x * frequency + i * 0.5) * Math.sin(y * frequency + i * 0.3) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2;
      }
      return total / maxValue;
    };

    for (let j = 0; j < height; j++) { // y
      for (let i = 0; i < width; i++) { // x
        const index = (j * width + i) * 4;
        
        const u = i / width;
        const v = j / height;

        // Sample noise at a couple of different scales (frequencies)
        const noiseVal1 = (simpleNoise(u * 10, v * 5, 1, 3, 0.5) + 1) / 2; // Base cloud shapes (0-1)
        const noiseVal2 = (simpleNoise(u * 25, v * 12, 1, 4, 0.4) + 1) / 2; // Finer details (0-1)

        let cloudAlpha = 0;
        const baseCloudCoverage = 0.4; // Determines how much of the globe is covered
        
        // Combine noise values: make clouds where noiseVal1 is high, add detail with noiseVal2
        if (noiseVal1 > (1 - baseCloudCoverage)) {
            // Modulate by noiseVal2 to create variation and wispiness
            cloudAlpha = (noiseVal1 - (1- baseCloudCoverage)) / baseCloudCoverage; // Intensity of main cloud
            cloudAlpha *= (0.5 + noiseVal2 * 0.5); // Add finer detail, make it less uniform
            cloudAlpha = Math.pow(cloudAlpha, 1.5); // Increase contrast a bit
        }
        
        cloudAlpha = Math.max(0, Math.min(1, cloudAlpha)); // Clamp to 0-1

        const cloudBrightness = 230 + Math.random() * 25; // Slight brightness variation

        data[index] = cloudBrightness;     // R
        data[index + 1] = cloudBrightness; // G
        data[index + 2] = cloudBrightness; // B
        data[index + 3] = cloudAlpha * 255; // Alpha controls cloud density/visibility
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
    const material = new THREE.MeshPhongMaterial({ color, shininess: 50 });
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess: 30 });
    const panelMaterial = new THREE.MeshPhongMaterial({ color: 0x223366, shininess: 10, side: THREE.DoubleSide });

    let bodyGeometry: THREE.BufferGeometry;
    const group = new THREE.Group(); // Use a group to assemble parts

    // Base body (e.g., a box or cylinder)
    const baseBody = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.06), bodyMaterial);
    baseBody.userData.isBody = true;
    group.add(baseBody);

    // Type-specific parts
    let primaryPart: THREE.Mesh;
    switch (type) {
      case 'military':
      case 'weapon':
        primaryPart = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.03, 0.05, 8), material);
        primaryPart.position.z = 0.05;
        this.setOriginalColor(primaryPart, color);
        group.add(primaryPart);

        const milPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.005), panelMaterial);
        milPanel.position.x = 0.05;
        milPanel.userData.isPanel = true;
        const milPanel2 = milPanel.clone().translateX(-0.1);
        milPanel2.userData.isPanel = true;
        group.add(milPanel, milPanel2);
        break;
      case 'communication':
        primaryPart = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.5), material);
        primaryPart.position.z = 0.03;
        primaryPart.rotation.x = Math.PI / 1.5;
        this.setOriginalColor(primaryPart, color);
        group.add(primaryPart);

        const commPanel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.005), panelMaterial);
        commPanel.position.x = 0.08;
        commPanel.userData.isPanel = true;
        const commPanel2 = commPanel.clone().translateX(-0.16);
        commPanel2.userData.isPanel = true;
        group.add(commPanel, commPanel2);
        break;
      case 'surveillance':
        primaryPart = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 16), material);
        primaryPart.position.z = -0.04;
        primaryPart.rotation.x = Math.PI / 2;
        this.setOriginalColor(primaryPart, color);
        group.add(primaryPart);

        const survPanel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.005), panelMaterial);
        survPanel.position.x = 0.06;
        survPanel.userData.isPanel = true;
        const survPanel2 = survPanel.clone().translateX(-0.12);
        survPanel2.userData.isPanel = true;
        group.add(survPanel, survPanel2);
        break;
      case 'civilian':
      default:
        primaryPart = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), material);
        this.setOriginalColor(primaryPart, color);
        // For civilian, the primary part might be the baseBody if it's colored, or a new colored mesh.
        // If baseBody is the colored part:
        // this.setOriginalColor(baseBody, color);
        // baseBody.material = material; // Assign the colored material
        group.add(primaryPart); // If primaryPart is different from baseBody. If baseBody is colored, this line would change.


        const civPanel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.005), panelMaterial);
        civPanel.position.x = 0.07;
        civPanel.userData.isPanel = true;
        const civPanel2 = civPanel.clone().translateX(-0.14);
        civPanel2.userData.isPanel = true;
        group.add(civPanel, civPanel2);
        break;
    }
    
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
      mesh: group, // Assign the group as the mesh
      active: true,
      compromised: false
    };
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
      
      // Update satellite visual status
      satellite.mesh.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshPhongMaterial;
          // Assuming the first material or a specifically named one is the one to change color
          // This is a simplification; a more robust way would be to tag meshes or materials.
          if (!satellite.active) {
            material.color.setHex(0x555555); // Dark grey for inactive
            if (material.emissive) material.emissive.setHex(0x000000);
          } else if (satellite.compromised) {
            material.color.setHex(0xff8800); // Orange for compromised
            if (material.emissive) material.emissive.setHex(0x331100); // Dim emissive orange
          } else {
            // Restore original color - this requires knowing the original color.
            // For now, let's assume the 'material' assigned in createSatellite is the primary one.
            // This part needs a more robust solution if colors are complex.
            // As a placeholder, we find the originally colored part.
            if (child.userData.isPrimaryColorPart) { // We'd need to set this userData in createSatellite
               material.color.setHex(child.userData.originalColor);
               if (material.emissive) material.emissive.setHex(0x000000);
            } else if (child.userData.isPanel) {
              material.color.setHex(0x223366); // Panel color
            } else {
              material.color.setHex(0xaaaaaa); // Default body color
            }
          }
        }
      });
    });
    
    this.renderer.render(this.scene, this.camera);
  };

  // Helper to set original color for restoration
  private setOriginalColor(mesh: THREE.Mesh, color: number) {
    mesh.userData.originalColor = color;
    mesh.userData.isPrimaryColorPart = true;
  }
  
  public updateRegionData(regions: WorldRegion[]) {
    // Update region visualization based on game state
    regions.forEach(region => {
      // Add visual indicators for region health/status
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
    
    // Remove after event duration
    setTimeout(() => {
      this.scene.remove(marker);
      const index = this.eventMarkers.indexOf(marker);
      if (index > -1) this.eventMarkers.splice(index, 1);
    }, event.duration);
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
      [EventType.ENVIRONMENTAL_RESTORATION]: 0x88ff00
    };
    return colors[type] || 0xffffff;
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

  public projectToScreen(worldPosition: THREE.Vector3): THREE.Vector3 | null {
    if (!this.camera || !this.renderer.domElement) return null;

    const screenPosition = worldPosition.clone();
    screenPosition.project(this.camera); // Projects x, y, z to range -1 to 1

    // Check if the point is behind the camera
    // screenPosition.z will be > 1 if behind the camera's near plane after projection
    // A more robust check involves checking distance or dot product with camera forward vector *before* projection.
    // However, for simplicity, if z > 1 after projection, it's likely behind or outside frustum in a way that's not useful.
    // A point exactly on camera plane would be z = -1 (if near plane is 0), or z = 0 (if camera is at origin and point is on near plane).
    // Points in front are -1 < z < 1.

    // A quick check: if the original worldPosition is behind the camera plane
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    const vectorToPoint = worldPosition.clone().sub(this.camera.position);
    if (vectorToPoint.dot(cameraDirection) < 0) { // Point is behind the camera
        // Calculate intersection with a plane slightly in front of the camera, on the edge of the view
        // This is complex, for now, let's return an off-screen value or null
        // For a simpler approach, just return a value that indicates it's off-screen far left/right
        // based on its general direction if it's behind.
        // Or, simply consider it not visible for panning.
      return null; // Treat as not directly pannable if behind camera
    }


    // Convert to pixel coordinates (0,0 is top-left)
    // screenPosition.x = (screenPosition.x + 1) * this.renderer.domElement.clientWidth / 2;
    // screenPosition.y = (-screenPosition.y + 1) * this.renderer.domElement.clientHeight / 2;
    // screenPosition.z = 0; // z is not needed for 2D panning

    // For panning, we only need the normalized x coordinate (-1 to 1)
    return screenPosition; // x will be in [-1, 1] if in frustum
  }
}