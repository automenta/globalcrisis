import * as THREE from 'three';
import { GameState, WorldRegion, RegionEvent, EventType } from '../engine/GameEngine';

export type StandardSatelliteType = 'military' | 'communication' | 'surveillance' | 'weapon' | 'civilian';
export type SpecialSatelliteType = 'geo_scanner' | 'emp_pulser'; // New types
export type SatelliteType = StandardSatelliteType | SpecialSatelliteType;

export interface Satellite {
  id: string;
  name: string;
  type: SatelliteType;
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
  private facilityMarkers: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  // private controls: any; // Will replace with more integrated controls
  private animationId: number = 0;

  // Camera control parameters
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private targetCameraPosition = new THREE.Vector3();
  private targetFocusPoint = new THREE.Vector3(0, 0, 0); // What the camera should look at
  private currentCameraDistance = 8; // Initial distance
  private minZoomDistance = 0.1; // For close-up views (e.g., hexagon level)
  private maxZoomDistance = 50;  // For planetary view
  private zoomTarget: THREE.Object3D | null = null; // Optional object to focus on (e.g. selected hex)

  public onRegionClick?: (region: WorldRegion, x: number, y: number) => void;
  public onSatelliteClick?: (satellite: Satellite, x: number, y: number) => void;
  public onEventClick?: (event: RegionEvent, x: number, y: number) => void;
  public onHexagonClick?: (hexagonId: string, hexagonCenter: THREE.Vector3, x: number, y: number) => void;
  
  private hexagonGrid?: THREE.LineSegments;
  private hexagons: { id: string, center: THREE.Vector3, vertices: THREE.Vector3[] }[] = [];
  private selectedHexagonMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  private selectedHexagonMesh?: THREE.Mesh;


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
    this.createHexagonGridData(2); // Adjust detail level as needed
    this.visualizeHexagonGrid();
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
    const satelliteTypes: { type: SatelliteType, count: number, color: number, radius: number }[] = [
      { type: 'military', count: 6, color: 0xff0000, radius: 3.5 },
      { type: 'surveillance', count: 10, color: 0xffff00, radius: 4.0 },
      { type: 'communication', count: 12, color: 0x00ff00, radius: 6.0 },
      { type: 'weapon', count: 4, color: 0xff00ff, radius: 3.2 },
      { type: 'civilian', count: 15, color: 0x0088ff, radius: 5.0 },
      { type: 'geo_scanner', count: 3, color: 0x00ffff, radius: 4.5 }, // Cyan color for geo_scanner
      { type: 'emp_pulser', count: 2, color: 0xff8800, radius: 3.8 }   // Orange color for emp_pulser
    ];
    
    satelliteTypes.forEach(({ type, count, color, radius }) => {
      for (let i = 0; i < count; i++) {
        const satellite = this.createSatellite(type, color, radius, i, count);
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
    let panel1: THREE.Mesh, panel2: THREE.Mesh;

    switch (type) {
      case 'military':
      case 'weapon':
        primaryPart = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.03, 0.05, 8), material);
        primaryPart.position.z = 0.05;
        panel1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.005), panelMaterial);
        panel1.position.x = 0.05;
        panel2 = panel1.clone().translateX(-0.1);
        break;
      case 'communication':
        primaryPart = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.5), material);
        primaryPart.position.z = 0.03;
        primaryPart.rotation.x = Math.PI / 1.5;
        panel1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.005), panelMaterial);
        panel1.position.x = 0.08;
        panel2 = panel1.clone().translateX(-0.16);
        break;
      case 'surveillance':
        primaryPart = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 16), material);
        primaryPart.position.z = -0.04;
        primaryPart.rotation.x = Math.PI / 2;
        panel1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.005), panelMaterial);
        panel1.position.x = 0.06;
        panel2 = panel1.clone().translateX(-0.12);
        break;
      case 'geo_scanner': // Uses surveillance look with different color by default
        primaryPart = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 16), material); // Slightly thicker
        primaryPart.position.z = -0.045;
        primaryPart.rotation.x = Math.PI / 2;
        panel1 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.005), panelMaterial);
        panel1.position.x = 0.07;
        panel2 = panel1.clone().translateX(-0.14);
        break;
      case 'emp_pulser': // Uses weapon look with different color by default
        primaryPart = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), material); // Sphere instead of cylinder
        primaryPart.position.z = 0.04;
        panel1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.005), panelMaterial); // Smaller, squarish panels
        panel1.position.x = 0.04;
        panel2 = panel1.clone().translateX(-0.08);
        break;
      case 'civilian':
      default: // Default to civilian look
        primaryPart = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), material);
        panel1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.005), panelMaterial);
        panel1.position.x = 0.07;
        panel2 = panel1.clone().translateX(-0.14);
        break;
    }

    this.setOriginalColor(primaryPart, color);
    group.add(primaryPart);

    if (panel1 && panel2) {
        panel1.userData.isPanel = true;
        panel2.userData.isPanel = true;
        group.add(panel1, panel2);
    }
    
    const satellite: Satellite = {
      id: `${type}_${index}`,
      name: `${type.toUpperCase().replace('_', ' ')}-${index + 1}`,
      type,
      orbit: {
        radius: orbitRadius,
        inclination: (Math.random() - 0.5) * Math.PI / 3,
        speed: 0.001 + Math.random() * 0.002,
        phase: (index / total) * Math.PI * 2
      },
      position: new THREE.Vector3(),
      mesh: group,
      active: true,
      compromised: false
    };
    
    return satellite;
  }
  
  private setupControls() {
    this.targetCameraPosition.copy(this.camera.position);
    this.currentCameraDistance = this.camera.position.length();

    this.renderer.domElement.addEventListener('mousedown', (event) => {
      if (event.button === 0) { // Left mouse button
        this.isDragging = true;
        this.previousMousePosition.x = event.clientX;
        this.previousMousePosition.y = event.clientY;
      }
    });
    
    this.renderer.domElement.addEventListener('mousemove', (event) => {
      if (this.isDragging) {
        const deltaMove = {
          x: event.clientX - this.previousMousePosition.x,
          y: event.clientY - this.previousMousePosition.y
        };
        
        // Create a quaternion for rotation based on mouse movement
        const rotationSpeed = 0.005;
        const deltaRotationQuaternion = new THREE.Quaternion()
          .setFromEuler(new THREE.Euler(
            deltaMove.y * rotationSpeed,
            deltaMove.x * rotationSpeed,
            0,
            'XYZ' // Order of rotation
          ));
        
        // Apply this rotation to the target camera position relative to the target focus point
        this.targetCameraPosition.sub(this.targetFocusPoint);
        this.targetCameraPosition.applyQuaternion(deltaRotationQuaternion);
        this.targetCameraPosition.add(this.targetFocusPoint);

        // Also rotate the earth group if we are not focused on a specific target
        if (!this.zoomTarget) {
            // This part needs careful consideration:
            // Rotating the Earth itself vs. just moving the camera around it.
            // For a typical orbit control, the camera moves. The Earth might have its own axial tilt and rotation.
            // Let's assume camera moves around a fixed (or slowly rotating) earth for now.
            // The earth's own rotation is handled in the animate loop.
            // This drag should rotate our view around the earth.
        }

        this.previousMousePosition.x = event.clientX;
        this.previousMousePosition.y = event.clientY;
      }
    });
    
    this.renderer.domElement.addEventListener('mouseup', (event) => {
      if (event.button === 0) {
        this.isDragging = false;
      }
    });

    this.renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault()); // Prevent context menu on right click

    this.renderer.domElement.addEventListener('dblclick', (event) => {
      // Check if the double click was on the Earth or empty space
      this.mouse.x = (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const intersects = this.raycaster.intersectObject(this.earth);
      const satelliteIntersects = this.raycaster.intersectObjects(this.satellites.map(s => s.mesh));


      if (intersects.length > 0 || satelliteIntersects.length === 0) { // Clicked on earth or empty space
        // Zoom out to planetary view
        this.zoomToTarget(new THREE.Vector3(0, 0, 0), this.maxZoomDistance / 2); // Or a default planetary distance
        this.zoomTarget = null;
        this.highlightHexagon(null); // Clear selection
      }
      // If double-clicked on a satellite or other specific object, could have different behavior.
    });

    this.renderer.domElement.addEventListener('wheel', (event) => {
      event.preventDefault();
      const zoomSpeed = 0.1;
      const zoomDirection = event.deltaY > 0 ? 1 : -1;

      // Calculate new distance
      let newDistance = this.currentCameraDistance * (1 + zoomDirection * zoomSpeed);
      newDistance = Math.max(this.minZoomDistance, Math.min(this.maxZoomDistance, newDistance));

      this.currentCameraDistance = newDistance;

      // Update target camera position based on new distance along the view vector
      const direction = new THREE.Vector3().subVectors(this.targetCameraPosition, this.targetFocusPoint).normalize();
      this.targetCameraPosition.copy(this.targetFocusPoint).addScaledVector(direction, this.currentCameraDistance);

    }, { passive: false }); // passive:false to allow preventDefault
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
        const intersectPoint = earthIntersects[0].point;

        // Try to find a hexagon first
        const hexagon = this.getHexagonFromPoint(intersectPoint);
        if (hexagon) {
          this.highlightHexagon(hexagon);
          // Auto-zoom to selected hexagon
          const hexViewDistance = 0.5; // Adjust this for desired closeness to hexagon
          this.zoomToTarget(hexagon.center, hexViewDistance);
          this.zoomTarget = this.selectedHexagonMesh; // Set the focused object

          if (this.onHexagonClick) {
            this.onHexagonClick(hexagon.id, hexagon.center, event.clientX, event.clientY);
          }
        } else {
          // Fallback to region click if no specific hexagon is identified
          // Or if clicking on empty globe space, maybe zoom out or clear target
          this.zoomTarget = null;
          // Or if you want to clear hexagon selection when clicking elsewhere on globe:
          this.highlightHexagon(null);
          const region = this.getRegionFromPoint(intersectPoint);
          if (region && this.onRegionClick) {
            this.onRegionClick(region, event.clientX, event.clientY);
          }
        }
      } else {
         // Clicked outside the earth, clear hexagon selection
        this.highlightHexagon(null);
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
    const delta = 0.05; // Smoothing factor for camera movement (lower is slower/smoother)

    // Smoothly interpolate camera position
    this.camera.position.lerp(this.targetCameraPosition, delta);
    
    // Smoothly interpolate focus point (though camera.lookAt is immediate,
    // if targetFocusPoint changes smoothly, the lookAt will follow smoothly)
    // For more advanced controls, one might also lerp a separate "currentFocusPoint"
    // and then call camera.lookAt(currentFocusPoint).
    this.camera.lookAt(this.targetFocusPoint);
    
    // Update currentCameraDistance based on actual position,
    // in case of external changes or to ensure consistency.
    this.currentCameraDistance = this.camera.position.distanceTo(this.targetFocusPoint);

    // Control hexagon grid visibility based on zoom
    if (this.hexagonGrid) {
      const hexGridVisibleDistance = 4; // Show grid if camera is closer than this
      if (this.currentCameraDistance < hexGridVisibleDistance) {
        this.hexagonGrid.visible = true;
        // Potentially adjust opacity based on distance for a fade-in/out effect
        const opacityFactor = Math.max(0, 1 - (this.currentCameraDistance - (hexGridVisibleDistance / 2)) / (hexGridVisibleDistance / 2));
        (this.hexagonGrid.material as THREE.LineBasicMaterial).opacity = Math.min(0.25, 0.05 + opacityFactor * 0.2); // subtle fade
      } else {
        this.hexagonGrid.visible = false;
      }
    }


    // Rotate earth slowly (axial tilt and spin)
    // This should be independent of camera controls.
    // For simplicity, let's assume a simple y-axis rotation for now.
    this.earth.rotation.y += 0.0005;
    this.atmosphere.rotation.y += 0.0005;
    // Clouds can rotate slightly faster or with some parallax
    this.clouds.rotation.y += 0.0006;

    // Update satellite positions (relative to the Earth's group if they orbit it)
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

  public zoomToTarget(targetPointOnGlobe: THREE.Vector3, distance: number, instant: boolean = false) {
    this.targetFocusPoint.copy(targetPointOnGlobe);

    // Calculate the direction from the target point back to the current camera position (or a default direction)
    // This maintains the current viewing angle if possible, or resets to a sensible default.
    let direction = new THREE.Vector3().subVectors(this.camera.position, this.targetFocusPoint).normalize();

    // If the direction is zero (e.g., camera is already AT the targetFocusPoint, highly unlikely for different points)
    // or if the new target is very different, we might want a default orientation.
    // For instance, always look "down" from a point directly above the target.
    if (direction.lengthSq() < 0.001) {
      // Default direction: from directly above the target point, relative to globe center
      direction.copy(targetPointOnGlobe).normalize();
    }

    this.targetCameraPosition.copy(this.targetFocusPoint).addScaledVector(direction, distance);
    this.currentCameraDistance = distance; // Update the stored distance

    if (instant) {
      this.camera.position.copy(this.targetCameraPosition);
      this.camera.lookAt(this.targetFocusPoint);
    }
    // The animate loop will handle smooth transition if not instant
  }

  // Helper to set original color for restoration
  private setOriginalColor(mesh: THREE.Mesh, color: number) {
    mesh.userData.originalColor = color;
    mesh.userData.isPrimaryColorPart = true;
  }

  private createHexagonGridData(detail: number = 2) {
    const earthRadius = 2; // Must match earth sphere geometry radius
    const icosahedron = new THREE.IcosahedronGeometry(earthRadius, detail);
    const vertices = icosahedron.attributes.position;
    const uniqueVertices = new Map<string, THREE.Vector3>();

    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i);
      const y = vertices.getY(i);
      const z = vertices.getZ(i);
      const key = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
      if (!uniqueVertices.has(key)) {
        uniqueVertices.set(key, new THREE.Vector3(x, y, z));
      }
    }

    let hexId = 0;
    uniqueVertices.forEach(vertex => {
      // For a true hexagonal grid, we'd need dual polyhedron (truncated icosahedron)
      // or more complex sphere tiling algorithms (e.g., Voronoi on sphere).
      // As a simplification, we'll consider each vertex of the subdivided icosahedron
      // as a "center" of a conceptual tile/hexagon.
      // The "vertices" of this hexagon would then be derived, e.g., by finding midpoints
      // to adjacent uniqueVertices or using a fixed angular distance.
      // This is a placeholder for a more robust hex generation.

      // Placeholder for actual hexagon vertices - for now, just use the center.
      // A real implementation would calculate 6 surrounding points on the sphere.
      const placeholderHexVertices: THREE.Vector3[] = [];
      const numSides = 6;
      const angleStep = (Math.PI * 2) / numSides;
      const arbitraryNormal = vertex.clone().cross(new THREE.Vector3(0,1,0)).normalize(); // An arbitrary tangent
      if (arbitraryNormal.lengthSq() === 0) arbitraryNormal.set(1,0,0); // Handle case where vertex is (0,1,0)

      const tangent = arbitraryNormal;
      const bitangent = vertex.clone().cross(tangent).normalize();

      // Approximate size of hexagon - this is tricky and depends on subdivision level
      const hexRadius = earthRadius * (Math.PI / (10 * (detail + 1))); // very rough approximation

      for(let i=0; i<numSides; ++i) {
        const angle = i * angleStep;
        const displacedPoint = tangent.clone().multiplyScalar(Math.cos(angle) * hexRadius)
                                .add(bitangent.clone().multiplyScalar(Math.sin(angle) * hexRadius));
        const hexVertex = vertex.clone().add(displacedPoint).normalize().multiplyScalar(earthRadius + 0.001); // slightly above surface
        placeholderHexVertices.push(hexVertex);
      }


      this.hexagons.push({
        id: `hex_${hexId++}`,
        center: vertex.clone().normalize().multiplyScalar(earthRadius + 0.001), // Ensure it's on the surface for picking
        vertices: placeholderHexVertices, // These would define the hexagon shape
      });
    });
    icosahedron.dispose();
  }

  private visualizeHexagonGrid() {
    if (this.hexagonGrid) {
      this.scene.remove(this.hexagonGrid);
      this.hexagonGrid.geometry.dispose();
      (this.hexagonGrid.material as THREE.Material).dispose();
    }

    const points = [];
    this.hexagons.forEach(hex => {
      // To draw lines for hexagons, we need proper vertices for each hex.
      // The current placeholder `hex.vertices` is a rough approximation.
      // For simplicity, let's draw a small marker at each hex center for now,
      // or if vertices are somewhat valid, draw edges.
      if (hex.vertices.length === 6) {
        for (let i = 0; i < hex.vertices.length; i++) {
          points.push(hex.vertices[i]);
          points.push(hex.vertices[(i + 1) % hex.vertices.length]);
        }
      } else { // Fallback: draw a small cross or dot at the center
        const center = hex.center;
        const d = 0.02; // size of marker
        points.push(center.clone().add(new THREE.Vector3(-d,0,0)));
        points.push(center.clone().add(new THREE.Vector3(d,0,0)));
        points.push(center.clone().add(new THREE.Vector3(0,-d,0)));
        points.push(center.clone().add(new THREE.Vector3(0,d,0)));
      }
    });

    if (points.length === 0) return;

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,  // White grid lines
      transparent: true,
      opacity: 0.15 // Make them subtle
    });

    this.hexagonGrid = new THREE.LineSegments(geometry, material);
    this.hexagonGrid.name = "HexagonGrid";
    this.scene.add(this.hexagonGrid);
  }

  private getHexagonFromPoint(pointOnSphere: THREE.Vector3): { id: string, center: THREE.Vector3, vertices: THREE.Vector3[] } | null {
    if (this.hexagons.length === 0) return null;

    let closestHex = null;
    let minDistanceSq = Infinity;

    // Normalize the point on sphere to match hexagon center altitudes if necessary
    // (currently they should both be at earthRadius + 0.001)
    const normalizedPoint = pointOnSphere.clone().normalize().multiplyScalar(this.earth.geometry.parameters.radius + 0.001);


    this.hexagons.forEach(hex => {
      const distanceSq = hex.center.distanceToSquared(normalizedPoint);
      if (distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq;
        closestHex = hex;
      }
    });

    // Add a threshold to ensure the click is reasonably close to a center
    // This threshold depends on the density of your grid.
    // For an icosahedron subdivision, distance between centers is somewhat regular.
    // Let's say if it's further than an approximate hex radius, it's not a valid click.
    // This needs tuning based on `detail` level.
    const approxHexRadiusSq = Math.pow( (this.earth.geometry.parameters.radius * Math.PI) / (10 * (2+1) * 2), 2); // very rough
    if (minDistanceSq > approxHexRadiusSq * 2) { // Heuristic, may need adjustment
       // console.log("Clicked too far from any hex center", minDistanceSq, approxHexRadiusSq);
       // return null;
    }


    return closestHex;
  }

  public highlightHexagon(hex: { id: string, center: THREE.Vector3, vertices: THREE.Vector3[] } | null) {
    if (!this.selectedHexagonMesh) {
      // Create the mesh once
      const initialGeometry = new THREE.BufferGeometry(); // Empty initially
      this.selectedHexagonMesh = new THREE.Mesh(initialGeometry, this.selectedHexagonMaterial);
      this.selectedHexagonMesh.name = "SelectedHexagon";
      this.selectedHexagonMesh.visible = false; // Start hidden
      this.scene.add(this.selectedHexagonMesh);
    }

    if (hex && hex.vertices.length === 6) {
      const vertices = [];
      for (let i = 0; i < hex.vertices.length; ++i) {
        vertices.push(hex.vertices[i].x, hex.vertices[i].y, hex.vertices[i].z);
      }

      const indices = [];
      // Create a triangle fan for the hexagon face (assuming convex and ordered vertices)
      for (let i = 1; i < hex.vertices.length - 1; i++) {
        indices.push(0, i, i + 1);
      }

      // Update geometry
      this.selectedHexagonMesh.geometry.dispose(); // Dispose old geometry attributes
      const newGeometry = new THREE.BufferGeometry();
      newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      newGeometry.setIndex(indices);
      // newGeometry.computeVertexNormals(); // Not strictly necessary for MeshBasicMaterial without lighting

      this.selectedHexagonMesh.geometry = newGeometry;
      this.selectedHexagonMesh.visible = true;
    } else {
      this.selectedHexagonMesh.visible = false;
    }
  }
  
  public updateRegionData(regions: WorldRegion[]) {
    // Clear existing region markers
    this.regionMarkers.forEach(marker => this.scene.remove(marker));
    this.regionMarkers = [];

    const earthRadius = this.earth.geometry.parameters.radius;

    regions.forEach(region => {
      // Simple spherical coordinates to Cartesian for marker placement
      // region.x and region.y are expected to be normalized [-1, 1] style or lat/lon
      // Assuming region.x is longitude-like, region.y is latitude-like from GameEngine
      // Convert to spherical coordinates: phi (polar, from y-axis), theta (azimuthal, around y-axis)
      // Three.js Spherical: radius, phi (polar angle from positive Y axis), theta (equatorial angle around Y axis from positive Z axis)
      // Typical geographic: lat (angle from equatorial plane), lon (angle from prime meridian)
      // If region.x = lon, region.y = lat (in radians for calculation)
      // phi = PI/2 - lat
      // theta = lon
      // The GameEngine uses x,y in a way that seems to be normalized screen/map like.
      // Let's assume region.x and region.y from GameEngine are somewhat like normalized projection coordinates.
      // For a simple marker at the region's "center" as defined in GameEngine:
      // We need to map these x, y to a point on the sphere.
      // If region.x, region.y are [-1,1] for x and [-0.5, 0.5] for y (approx based on GameEngine values)
      // This is a bit abstract. Let's use a simpler conversion for visualization for now.
      // A better way would be for GameEngine regions to have explicit lat/lon centers.
      // Using the existing x,y as direct mapping to sphere points for visualization if they are already somewhat spherical.
      // The current GameEngine region x,y are: x: -0.6 to 0.8, y: -0.5 to 0.4. These look like normalized XY plane coords.
      // We need to project these onto the sphere.
      // Let's assume these are longitude (scaled) and latitude (scaled) for simplicity of visualization.
      const phi = Math.PI / 2 - region.y; // Assuming region.y is like latitude
      const theta = region.x; // Assuming region.x is like longitude

      const position = new THREE.Vector3().setFromSphericalCoords(earthRadius + 0.05, phi, theta);

      // Create a simple marker (e.g., a small sphere or sprite)
      const markerGeometry = new THREE.SphereGeometry(0.05, 16, 16); // Small sphere
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(...(region.color || [1,1,1])), // Use region color or default white
        transparent: true,
        opacity: 0.7
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.copy(position);
      marker.userData.regionId = region.id;
      marker.name = `RegionMarker_${region.id}`;

      this.scene.add(marker);
      this.regionMarkers.push(marker);
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

  public updateFacilityVisuals(facilities: PlanetaryFacility[], allHexagons: { id: string, center: THREE.Vector3 }[], regions: WorldRegion[]) {
    this.facilityMarkers.forEach(marker => this.scene.remove(marker));
    this.facilityMarkers = [];
    const earthRadius = this.earth.geometry.parameters.radius;

    facilities.forEach(facility => {
      let position: THREE.Vector3 | null = null;
      if (facility.hexagonId) {
        const hex = allHexagons.find(h => h.id === facility.hexagonId);
        if (hex) {
          position = hex.center.clone().normalize().multiplyScalar(earthRadius + 0.02); // Slightly above surface
        }
      }

      if (!position) {
        // Fallback to region center if no hexagonId or hex not found
        const region = regions.find(r => r.id === facility.regionId);
        if (region) {
          // Approx. region center logic (same as region markers, maybe refactor to a helper)
          const phi = Math.PI / 2 - region.y;
          const theta = region.x;
          position = new THREE.Vector3().setFromSphericalCoords(earthRadius + 0.05, phi, theta);
        }
      }

      if (position) {
        // TODO: Use facility.type to get definition and visual key from FACILITY_DEFINITIONS
        // For now, a generic marker
        let color = 0x999999; // Default color
        if (facility.type === 'research_outpost') color = 0x00ffff;
        else if (facility.type === 'resource_extractor') color = 0xffaa00;
        else if (facility.type === 'defense_platform') color = 0xff00ff;

        const markerGeom = new THREE.BoxGeometry(0.06, 0.06, 0.1); // Simple box for now
        const markerMat = new THREE.MeshPhongMaterial({ color });
        const marker = new THREE.Mesh(markerGeom, markerMat);
        marker.position.copy(position);
        marker.lookAt(this.earth.position); // Orient "up" from earth center

        // Visual cue for construction vs operational
        if (facility.constructionTimeLeft && facility.constructionTimeLeft > 0) {
          markerMat.opacity = 0.5;
          markerMat.transparent = true;
        } else if (!facility.operational) { // Not yet started construction or errored (though not modeled yet)
            markerMat.opacity = 0.3;
            markerMat.transparent = true;
        } else {
            markerMat.opacity = 1.0;
            markerMat.transparent = false;
        }

        marker.userData = { facilityId: facility.id, type: 'facility' };
        marker.name = `FacilityMarker_${facility.id}`;
        this.scene.add(marker);
        this.facilityMarkers.push(marker);
      }
    });
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