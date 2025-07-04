import * as THREE from 'three';
import { GameState, WorldRegion, RegionEvent, EventType, PlanetaryFacility } from '../engine/GameEngine'; // Added PlanetaryFacility

// #region Interfaces & Types
export type StandardSatelliteType = 'military' | 'communication' | 'surveillance' | 'weapon' | 'civilian';
export type SpecialSatelliteType = 'geo_scanner' | 'emp_pulser';
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
  mesh: THREE.Group;
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
import { SimplexNoise, fbm as simplexFbm } from '../lib/utils'; // Import SimplexNoise and fbm

// #endregion Interfaces & Types

export class Earth3D {
  // #region Class Properties
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
  private animationId: number = 0;

  // Camera control parameters
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private targetCameraPosition = new THREE.Vector3();
  private targetFocusPoint = new THREE.Vector3(0, 0, 0);
  private currentCameraDistance = 8;
  private minZoomDistance = 0.1;
  private maxZoomDistance = 50;
  private zoomTarget: THREE.Object3D | null = null;

  // Callbacks for interactions
  public onRegionClick?: (region: WorldRegion, x: number, y: number) => void;
  public onSatelliteClick?: (satellite: Satellite, x: number, y: number) => void;
  public onEventClick?: (event: RegionEvent, x: number, y: number) => void;
  public onHexagonClick?: (hexagonId: string, hexagonCenter: THREE.Vector3, x: number, y: number) => void;
  
  // Hexagon grid properties
  private hexagonGrid?: THREE.LineSegments;
  private hexagons: { id: string, center: THREE.Vector3, vertices: THREE.Vector3[] }[] = [];
  private selectedHexagonMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  private selectedHexagonMesh?: THREE.Mesh;
  private strategicResourceMarkers: THREE.Group = new THREE.Group();
  private resourceMarkerMaterials: Record<string, THREE.SpriteMaterial> = {};
  // #endregion Class Properties

  // #region Constructor & Core Setup
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
    this.scene.add(this.strategicResourceMarkers); // Add group to scene
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
    const earthTexture = this._createProceduralTexture(this.createEarthTexture, 2048, 1024); // Higher res for Earth
    const normalTexture = this._createProceduralTexture(this.createNormalMap, 1024, 512);
    const cityLightsTexture = this._createProceduralTexture(this.createCityLightsTexture, 2048, 1024);

    const material = new THREE.MeshPhongMaterial({
      map: earthTexture,
      normalMap: normalTexture,
      normalScale: new THREE.Vector2(0.5, 0.5), // Adjust normal map intensity
      shininess: 5, // Slightly more shininess for water reflections
      transparent: false,
      emissiveMap: cityLightsTexture,
      emissive: new THREE.Color(0xffff00), // Yellowish glow for cities
      emissiveIntensity: 0.7 // Initial intensity for city lights
    });
    
    this.earth = new THREE.Mesh(geometry, material);
    this.earth.receiveShadow = true;
    this.earth.castShadow = true;
    this.scene.add(this.earth);
  }
  
  private createAtmosphere() {
    const atmosphereGeometry = new THREE.SphereGeometry(2.05, 64, 64); // Increased segments for smoother look

    // These imports would ideally be at the top of the file
    // For now, assuming they are available or will be added by a build step
    // import atmosphereVertexShader from '../shaders/atmosphereVertex.glsl';
    // import atmosphereFragmentShader from '../shaders/atmosphereFragment.glsl';

    // Placeholder for shader content if direct import isn't set up for strings
    const atmosphereVertexShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const atmosphereFragmentShader = `
      uniform vec3 uSunPosition;
      uniform vec3 uCameraPosition;
      varying vec3 vNormal;
      varying vec3 vPosition;

      const vec3 kRayleighCoefficients = vec3(0.105, 0.224, 0.469); // Adjusted for less green
      const float kScatteringStrength = 5.5; // Slightly increased strength

      void main() {
        vec3 rayDir = normalize(vPosition - uCameraPosition);
        vec3 atmosphereOrigin = vec3(0.0); // Assuming atmosphere is centered at origin
        vec3 normalToAtmosphereCenter = normalize(vPosition - atmosphereOrigin);

        float viewNormalDot = dot(rayDir, normalToAtmosphereCenter);
        // We want the effect to be strongest at the limb (grazing angles)
        // viewNormalDot is close to 0 at limb, -1 when looking straight at center from outside, 1 if inside looking at center.
        // Let's use (1.0 - abs(viewNormalDot)) for limb effect strength, or smoothstep for falloff.

        // A simpler approach for limb effect: use vNormal (vertex normal) against camera direction
        float limbFactor = 1.0 - dot(vNormal, -normalize(uCameraPosition - vPosition));
        limbFactor = pow(limbFactor, 2.5); // Enhance the effect at the very edge

        vec3 sunDir = normalize(uSunPosition); // Assume sun is directional (very far away)
        float sunAngle = max(0.0, dot(normalToAtmosphereCenter, sunDir)); // How much this part of atmosphere is lit

        vec3 scatteredLight = kRayleighCoefficients * kScatteringStrength * limbFactor;
        scatteredLight *= (sunAngle * 0.8 + 0.2); // Modulate by sun, ensure some ambient on dark side

        float alpha = limbFactor * 0.7 + 0.05; // More opaque at limb
        alpha = clamp(alpha, 0.0, 1.0);

        // Fade out if we are looking at the back faces of the sphere from outside
        if (dot(vNormal, normalize(uCameraPosition - vPosition)) < 0.0) {
             alpha = 0.0;
        }

        gl_FragColor = vec4(scatteredLight, alpha);
      }
    `;

    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      uniforms: {
        uSunPosition: { value: new THREE.Vector3(5, 3, 5) }, // Default, should be updated from light source
        uCameraPosition: { value: this.camera.position },
        // uAtmosphereRadius: { value: 2.05 }, // If needed by shader
        // uEarthRadius: { value: 2.0 }, // If needed by shader
      },
      transparent: true,
      side: THREE.FrontSide, // Render front side for this effect to work correctly when view from outside
      // blending: THREE.AdditiveBlending, // Optional: for a more glowy effect, but can be too bright
    });

    this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    this.scene.add(this.atmosphere);
  }

  private createClouds() {
    const geometry = new THREE.SphereGeometry(2.02, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      map: this._createProceduralTexture(this.createCloudTexture), // Use helper
      transparent: true,
      opacity: 0.4
    });
    this.clouds = new THREE.Mesh(geometry, material);
    this.scene.add(this.clouds);
  }
  // #endregion Celestial Body Creation

  // #region Procedural Texture Generation
  /** Helper to reduce boilerplate for creating canvas-based textures. */
  private _createProceduralTexture(
    painter: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
    width: number = 1024, // Default width for general textures
    height: number = 512  // Default height for general textures
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    painter(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; // Default wrapping
    texture.wrapT = THREE.RepeatWrapping; // Default wrapping
    return texture;
  }

  private createEarthTexture(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    const simplex = new SimplexNoise('earth_texture_seed'); // Consistent seed for all noise calls here

    // Helper for FBM using the single simplex instance
    const fbm = (x: number, y: number, octaves: number, persistence: number, lacunarity: number, scale: number) => {
        return simplexFbm(simplex, x, y, octaves, persistence, lacunarity, scale);
    };

    // Generate elevation, temperature, and moisture maps
    const elevationMap: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
    const temperatureMap: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
    const moistureMap: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));

    for (let j_map = 0; j_map < height; j_map++) { // Renamed to avoid conflict with loop var 'j' if any
      for (let i_map = 0; i_map < width; i_map++) { // Renamed to avoid conflict
        // Elevation: multiple layers of noise for continents, mountains, and roughness
        const continentNoise = fbm(i_map, j_map, 4, 0.6, 2.0, width * 0.8); // Large features (scaled to texture width)
        const mountainNoise = fbm(i_map, j_map, 5, 0.5, 2.2, width * 0.2);  // Medium features
        const detailNoise = fbm(i_map, j_map, 3, 0.4, 2.5, width * 0.05); // Fine details
        let elev = continentNoise * 0.6 + mountainNoise * 0.3 + detailNoise * 0.1;
        elev = Math.pow(elev, 1.2); // Enhance contrast for landmasses
        elevationMap[j_map][i_map] = elev;

        // Temperature: primarily latitude-based, with some noise variation
        const normalizedLat = j_map / height; // 0 (north pole) to 1 (south pole)
        let temp = 1.0 - Math.abs(normalizedLat - 0.5) * 2; // Equator hot, poles cold (0 to 1)
        temp = Math.pow(temp, 1.5); // Exaggerate equatorial heat
        temp -= elev * 0.1; // Higher elevation is colder (small effect)
        temp += (fbm(i_map, j_map, 2, 0.5, 2.0, width * 0.1) - 0.5) * 0.1; // Small random variation
        temperatureMap[j_map][i_map] = Math.max(0, Math.min(1, temp));

        // Moisture: influenced by proximity to oceans (from elevation) and some noise
        const isOcean = elev < 0.42; // Ocean threshold (same as later)
        let moist = isOcean ? 0.9 : 0.3;
        moist += (fbm(i_map, j_map, 3, 0.5, 2.0, width * 0.08) - 0.5) * 0.4;
        if (!isOcean && elev > 0.45) {
            moist += (fbm(i_map, j_map, 2, 0.6, 2.0, width * 0.5) - 0.5) * 0.3;
        }
        moistureMap[j_map][i_map] = Math.max(0, Math.min(1, moist));
      }
    }

    // Biome determination and coloring
    for (let j_color = 0; j_color < height; j_color++) { // Renamed loop variable
      for (let i_color = 0; i_color < width; i_color++) { // Renamed loop variable
        const index = (j_color * width + i_color) * 4;
        const elev = elevationMap[j_color][i_color];
        const temp = temperatureMap[j_color][i_color];
        const moist = moistureMap[j_color][i_color];

        let r_col=0, g_col=0, b_col=0; // Renamed r,g,b to avoid conflict

        // Determine biome (simplified Whittaker diagram logic)
        if (elev < 0.42) { // Ocean
          r_col = 10 + elev * 40; g_col = 50 + elev * 80; b_col = 120 + elev * 120;
          if (temp < 0.15 && elev > 0.35) {
            r_col = 180 + temp * 50; g_col = 200 + temp * 50; b_col = 220 + temp * 30;
          }
        } else { // Land
          if (temp < 0.1) {
            r_col = 230 + (1-elev)*25; g_col = 235 + (1-elev)*20; b_col = 240 + (1-elev)*15;
            if (temp > 0.05 && moist > 0.2) {
              r_col = 160 + moist*20; g_col = 170 + moist*20; b_col = 150 + moist*20;
            }
          } else if (temp < 0.3) {
            r_col = 60 + moist*20; g_col = 100 + moist*30; b_col = 70 + moist*20;
            if (elev > 0.7) { r_col=100; g_col=90; b_col=80; }
          } else if (temp < 0.7) {
            if (moist > 0.6) {
              r_col = 34 + elev*20; g_col = 120 - elev*30; b_col = 40 + elev*10;
            } else if (moist > 0.3) {
              r_col = 100 + elev*20; g_col = 130 - elev*20; b_col = 60;
            } else {
              r_col = 180 + elev*10; g_col = 160 + elev*10; b_col = 120;
            }
             if (elev > 0.75) { r_col=120; g_col=110; b_col=100; }
          } else {
            if (moist > 0.65) {
              r_col = 20 + temp*10; g_col = 90 + temp*20; b_col = 30 + temp*10;
            } else if (moist > 0.3) {
              r_col = 160 + temp*20; g_col = 140 - temp*10; b_col = 50;
            } else {
              r_col = 210 + temp*10; g_col = 180 + temp*5; b_col = 100;
            }
             if (elev > 0.7) { r_col=150; g_col=130; b_col=110; }
          }
        }

        const colorNoise = (simplex.noise2D(i_color * 0.1, j_color * 0.1) + 1) / 2 * 15;
        data[index] = Math.max(0, Math.min(255, r_col + colorNoise));
        data[index + 1] = Math.max(0, Math.min(255, g_col + colorNoise));
        data[index + 2] = Math.max(0, Math.min(255, b_col + colorNoise));
        data[index + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  private createNormalMap(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    const elevations: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
    const simplex = new SimplexNoise('normal_map_seed_v2'); // Changed seed to ensure different noise pattern if desired

    const fbm = (x: number, y: number, octaves: number, persistence: number, lacunarity: number, scale: number) => {
        return simplexFbm(simplex, x, y, octaves, persistence, lacunarity, scale);
    };

    // Re-generate elevation map for normal map using the same logic as createEarthTexture's new elevation
    for (let j_map = 0; j_map < height; j_map++) {
      for (let i_map = 0; i_map < width; i_map++) {
        const continentNoise = fbm(i_map, j_map, 4, 0.6, 2.0, width * 0.8);
        const mountainNoise = fbm(i_map, j_map, 5, 0.5, 2.2, width * 0.2);
        const detailNoise = fbm(i_map, j_map, 3, 0.4, 2.5, width * 0.05);
        let elev = continentNoise * 0.6 + mountainNoise * 0.3 + detailNoise * 0.1;
        elev = Math.pow(elev, 1.2);
        elevations[j_map][i_map] = elev;
      }
    }

    const strength = 2.0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        // Sobel filter for edge detection (approximating derivatives)
        const tl = elevations[Math.max(0, y - 1)][Math.max(0, x - 1)], t  = elevations[Math.max(0, y - 1)][x], tr = elevations[Math.max(0, y - 1)][Math.min(width - 1, x + 1)];
        const l  = elevations[y][Math.max(0, x - 1)], r  = elevations[y][Math.min(width - 1, x + 1)];
        const bl = elevations[Math.min(height - 1, y + 1)][Math.max(0, x - 1)], b  = elevations[Math.min(height - 1, y + 1)][x], br = elevations[Math.min(height - 1, y + 1)][Math.min(width - 1, x + 1)];
        const dX = (tr + 2 * r + br) - (tl + 2 * l + bl), dY = (bl + 2 * b + br) - (tl + 2 * t + tr);
        const normal = new THREE.Vector3(-dX * strength, -dY * strength, 1.0).normalize();
        data[index] = (normal.x * 0.5 + 0.5) * 255; data[index + 1] = (normal.y * 0.5 + 0.5) * 255; data[index + 2] = normal.z * 255; data[index + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  private createCloudTexture(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    // Another simple noise function for clouds
    const simpleNoise = (x: number, y: number, scale: number, octaves: number, persistence: number) => {
      let total = 0, frequency = scale, amplitude = 1, maxValue = 0;
      for (let i = 0; i < octaves; i++) {
        total += Math.cos(x * frequency + i * 0.5) * Math.sin(y * frequency + i * 0.3) * amplitude;
        maxValue += amplitude; amplitude *= persistence; frequency *= 2;
      }
      return total / maxValue;
    };
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const index = (j * width + i) * 4;
        const u = i / width, v = j / height;
        const noiseVal1 = (simpleNoise(u * 10, v * 5, 1, 3, 0.5) + 1) / 2;
        const noiseVal2 = (simpleNoise(u * 25, v * 12, 1, 4, 0.4) + 1) / 2;
        let cloudAlpha = 0; const baseCloudCoverage = 0.4;
        if (noiseVal1 > (1 - baseCloudCoverage)) {
          cloudAlpha = (noiseVal1 - (1- baseCloudCoverage)) / baseCloudCoverage;
          cloudAlpha *= (0.5 + noiseVal2 * 0.5); cloudAlpha = Math.pow(cloudAlpha, 1.5);
        }
        cloudAlpha = Math.max(0, Math.min(1, cloudAlpha));
        const cloudBrightness = 230 + Math.random() * 25;
        data[index] = cloudBrightness; data[index + 1] = cloudBrightness; data[index + 2] = cloudBrightness;
        data[index + 3] = cloudAlpha * 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  private createCityLightsTexture(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Re-use noise functions if they are accessible, or redefine locally for encapsulation
    const pseudoRandom = (x: number, y: number, seed: number) => {
        let val = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
        val = val - Math.floor(val);
        return val;
    };
    const noise = (x: number, y: number, seed: number, scale: number) => {
        const ix = Math.floor(x / scale);
        const iy = Math.floor(y / scale);
        const fx = (x / scale) - ix;
        const fy = (y / scale) - iy;
        const a = pseudoRandom(ix, iy, seed);
        const b = pseudoRandom(ix + 1, iy, seed);
        const c = pseudoRandom(ix, iy + 1, seed);
        const d = pseudoRandom(ix + 1, iy + 1, seed);
        const ux = fx * fx * (3.0 - 2.0 * fx);
        const uy = fy * fy * (3.0 - 2.0 * fy);
        return a * (1-ux) * (1-uy) + b * ux * (1-uy) + c * (1-ux) * uy + d * ux * uy;
    };
    const fbm = (x: number, y: number, seed: number, initialScale: number, octaves: number, persistence: number, lacunarity: number) => {
        let total = 0, frequency = 1, amplitude = 1, maxValue = 0, scale = initialScale;
        for(let i = 0; i < octaves; i++) {
            total += noise(x * frequency, y * frequency, seed + i, scale) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        return total / maxValue;
    };

    // Use the main landmass FBM to hint where cities might be (more lights on land)
    const landFBM = (x: number, y: number) => fbm(x, y, 100, 128, 5, 0.5, 2.0); // Same as in createEarthTexture

    for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
            const index = (j * width + i) * 4;

            const landMassValue = landFBM(i,j);
            let intensity = 0;

            if (landMassValue > 0.42) { // Only generate lights on land areas
                // Noise for city clustering and intensity
                const cityClusterNoise = fbm(i, j, 300, 64, 4, 0.4, 2.5);
                const fineDetailNoise = fbm(i, j, 400, 8, 2, 0.5, 3.0);

                if (cityClusterNoise > 0.6) { // Threshold for major city areas
                    intensity = (cityClusterNoise - 0.6) / 0.4; // Normalize
                    intensity = Math.pow(intensity, 2); // Make bright spots more prominent
                    intensity *= (0.5 + fineDetailNoise * 0.5); // Add some finer variations

                    // Reduce lights in extreme latitudes (less dense population)
                    const v = j / height; // 0 to 1
                    const latFactor = 1.0 - Math.pow(Math.abs(v - 0.5) * 2, 3); // Strong falloff towards poles
                    intensity *= latFactor;
                }
            }

            intensity = Math.max(0, Math.min(1, intensity)) * 255;

            // City lights are typically yellowish-orange
            data[index] = intensity; // R
            data[index + 1] = intensity * 0.8; // G (make it a bit orange/yellow)
            data[index + 2] = intensity * 0.3; // B
            data[index + 3] = 255; // Alpha
        }
    }
    ctx.putImageData(imageData, 0, 0);
  }
  // #endregion Procedural Texture Generation
  
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

    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 0) { this.isDragging = true; this.previousMousePosition = { x: event.clientX, y: event.clientY }; }
    };
    const onMouseMove = (event: MouseEvent) => {
      if (this.isDragging) {
        const deltaMove = { x: event.clientX - this.previousMousePosition.x, y: event.clientY - this.previousMousePosition.y };
        const rotationSpeed = 0.005;
        const deltaRotationQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(deltaMove.y * rotationSpeed, deltaMove.x * rotationSpeed, 0, 'XYZ'));
        this.targetCameraPosition.sub(this.targetFocusPoint).applyQuaternion(deltaRotationQuaternion).add(this.targetFocusPoint);
        this.previousMousePosition = { x: event.clientX, y: event.clientY };
      }
    };
    const onMouseUp = (event: MouseEvent) => { if (event.button === 0) this.isDragging = false; };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    const onDoubleClick = (event: MouseEvent) => {
      this.mouse.set((event.clientX / this.renderer.domElement.clientWidth) * 2 - 1, -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1);
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersectsEarth = this.raycaster.intersectObject(this.earth).length > 0;
      const intersectsSatellite = this.raycaster.intersectObjects(this.satellites.map(s => s.mesh)).length > 0;
      if (intersectsEarth || !intersectsSatellite) {
        this.zoomToTarget(new THREE.Vector3(0, 0, 0), this.maxZoomDistance / 2); this.zoomTarget = null; this.highlightHexagon(null);
      }
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const zoomSpeed = 0.1; const zoomDirection = event.deltaY > 0 ? 1 : -1;
      let newDistance = this.currentCameraDistance * (1 + zoomDirection * zoomSpeed);
      newDistance = Math.max(this.minZoomDistance, Math.min(this.maxZoomDistance, newDistance));
      this.currentCameraDistance = newDistance;
      const direction = new THREE.Vector3().subVectors(this.targetCameraPosition, this.targetFocusPoint).normalize();
      this.targetCameraPosition.copy(this.targetFocusPoint).addScaledVector(direction, this.currentCameraDistance);
    };

    this.renderer.domElement.addEventListener('mousedown', onMouseDown);
    this.renderer.domElement.addEventListener('mousemove', onMouseMove);
    this.renderer.domElement.addEventListener('mouseup', onMouseUp);
    this.renderer.domElement.addEventListener('contextmenu', onContextMenu);
    this.renderer.domElement.addEventListener('dblclick', onDoubleClick);
    this.renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  }
  
  private setupEventListeners(container: HTMLElement) { // container might not be needed if renderer.domElement is used
    const onClick = (event: MouseEvent) => {
      this.mouse.set((event.clientX / this.renderer.domElement.clientWidth) * 2 - 1, -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1);
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const satelliteIntersects = this.raycaster.intersectObjects(this.satellites.map(s => s.mesh), true); // Added recursive true
      if (satelliteIntersects.length > 0) {
        let clickedSatelliteObject = satelliteIntersects[0].object;
        // Traverse up to find the parent Group that is the satellite's mesh
        while(clickedSatelliteObject.parent && clickedSatelliteObject.parent !== this.scene) {
            if (this.satellites.some(s => s.mesh === clickedSatelliteObject)) {
                break;
            }
            clickedSatelliteObject = clickedSatelliteObject.parent;
        }
        const satellite = this.satellites.find(s => s.mesh === clickedSatelliteObject);
        if (satellite && this.onSatelliteClick) { this.onSatelliteClick(satellite, event.clientX, event.clientY); return; }
      }

      const earthIntersects = this.raycaster.intersectObject(this.earth);
      if (earthIntersects.length > 0) {
        const intersectPoint = earthIntersects[0].point;
        const hexagon = this.getHexagonFromPoint(intersectPoint);
        if (hexagon) {
          this.highlightHexagon(hexagon);
          this.zoomToTarget(hexagon.center, 0.5);
          this.zoomTarget = this.selectedHexagonMesh;
          if (this.onHexagonClick) { this.onHexagonClick(hexagon.id, hexagon.center, event.clientX, event.clientY); }
        } else {
          this.zoomTarget = null; this.highlightHexagon(null);
          const region = this.getRegionFromPoint(intersectPoint);
          if (region && this.onRegionClick) { this.onRegionClick(region, event.clientX, event.clientY); }
        }
      } else {
        this.highlightHexagon(null);
      }
    };
    this.renderer.domElement.addEventListener('click', onClick);
  }
  
  private getRegionFromPoint(point: THREE.Vector3): WorldRegion | null {
    // Convert 3D point to normalized lat/lon. Earth radius is 2.
    // Note: This is a simplified mapping and might not accurately reflect complex region boundaries.
    // A more robust solution would involve point-in-polygon tests on spherical polygons
    // or using a library for geopolitical data.
    const lat = Math.asin(point.y / this.earth.geometry.parameters.radius); // Use actual radius for accuracy
    const lon = Math.atan2(point.z, point.x);
    
    // Example simplified region mapping (adjust thresholds as needed)
    // These would need to be defined based on the game's specific map and region definitions.
    if (lon > -Math.PI * 2/3 && lon < -Math.PI / 3 && lat > 0) return { id: 'na', name: 'North America' } as WorldRegion; // Placeholder
    // ... add other region definitions here ...
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
          if (!satellite.active) {
            material.color.setHex(0x555555);
            if (material.emissive) material.emissive.setHex(0x000000);
          } else if (satellite.compromised) {
            material.color.setHex(0xff8800);
            if (material.emissive) material.emissive.setHex(0x331100);
          } else {
            if (child.userData.isPrimaryColorPart) {
               material.color.setHex(child.userData.originalColor);
               if (material.emissive) material.emissive.setHex(0x000000);
            } else if (child.userData.isPanel) {
              material.color.setHex(0x223366);
            } else {
              material.color.setHex(0xaaaaaa);
            }
          }
        }
      });
    });

    // Update atmosphere shader uniforms
    if (this.atmosphere.material instanceof THREE.ShaderMaterial) {
      this.atmosphere.material.uniforms.uCameraPosition.value.copy(this.camera.position);
      // If sun position is dynamic, update it here as well:
      // this.atmosphere.material.uniforms.uSunPosition.value.copy(this.sunLight.position); // Assuming sunLight is accessible
    }
    
    this.renderer.render(this.scene, this.camera);
  };

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  public dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    // TODO: Dispose geometries, materials, textures to free up GPU memory
    // Example: this.earth.geometry.dispose(); (this.earth.material as THREE.Material).dispose();
    // Iterate over scene children and dispose them if they have dispose methods.
    this.renderer.dispose();
  }

  /**
   * Projects a 3D world position to normalized screen coordinates and checks if it's in front of the camera.
   * @param worldPosition The THREE.Vector3 position in world space.
   * @returns A THREE.Vector3 with x, y in [-1, 1] normalized screen space, and z indicating depth relative to camera.
   *          Returns null if the point is behind the camera plane.
   */
  public projectToScreen(worldPosition: THREE.Vector3): THREE.Vector3 | null {
    if (!this.camera || !this.renderer.domElement) return null;

    // Check if the point is behind the camera's near plane using a dot product.
    // This is more reliable than checking projected z > 1, which can be ambiguous.
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    const vectorToPoint = worldPosition.clone().sub(this.camera.position);

    if (vectorToPoint.dot(cameraDirection) < 0) {
      // Point is behind the camera (more accurately, behind the plane the camera is on, facing its direction)
      return null;
    }

    const screenPosition = worldPosition.clone();
    screenPosition.project(this.camera); // Projects x, y, z to range -1 to 1 if in frustum

    // screenPosition.z will be < 1 if in front of the camera's far plane and > -1 if behind near plane.
    // For panning, we mainly care about x and y, but z < 1 is a good check it's generally in view.
    return screenPosition;
  }
  // #endregion Main Loop & Lifecycle
}

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