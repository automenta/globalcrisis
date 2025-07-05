import * as THREE from 'three';

export interface Particle {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    color: THREE.Color;
    opacity: number;
    size: number;
    age: number;
    maxAge: number;
    rotation: number;
    angularVelocity: number;
}

export interface ParticleEmitterConfig {
    particleCount: number;
    emissionRate: number; // particles per second
    particleMaxAge: number;
    particleSize: number;
    particleOpacity: number;
    particleColor: THREE.Color | [THREE.Color, THREE.Color]; // Single color or range for interpolation
    particleVelocity: THREE.Vector3; // Base velocity
    particleVelocityRandomness: THREE.Vector3; // Random deviation for velocity
    particleAcceleration?: THREE.Vector3; // e.g., gravity
    angularVelocityRange?: [number, number];
    sizeOverLifetime?: (ageRatio: number) => number; // Function to control size based on age (0-1)
    opacityOverLifetime?: (ageRatio: number) => number; // Function to control opacity based on age (0-1)
    worldSpaceParticles?: boolean; // Are particles simulated in world space or local to emitter
}

export class ParticleEmitter {
    public particles: Particle[] = [];
    public threePoints: THREE.Points;
    private geometry: THREE.BufferGeometry;
    private material: THREE.PointsMaterial;

    private positions: Float32Array;
    private colors: Float32Array;
    private opacities: Float32Array; // Custom attribute for opacity
    private sizes: Float32Array;    // Custom attribute for size

    private config: ParticleEmitterConfig;
    private timeSinceLastEmission: number = 0;
    public isDead: boolean = false;
    private emitterDuration: number | null = null; // Optional duration for the emitter itself
    private emitterAge: number = 0;

    private parent: THREE.Object3D | null = null; // To handle world space transformations

    constructor(config: ParticleEmitterConfig, initialPosition: THREE.Vector3, parentSceneObject?: THREE.Object3D, duration?: number) {
        this.config = { ...config }; // Shallow copy, deep copy colors if array
        if (Array.isArray(config.particleColor)) {
            this.config.particleColor = [config.particleColor[0].clone(), config.particleColor[1].clone()];
        } else {
            this.config.particleColor = config.particleColor.clone();
        }

        this.emitterDuration = duration ?? null;

        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.config.particleCount * 3);
        this.colors = new Float32Array(this.config.particleCount * 3);
        this.opacities = new Float32Array(this.config.particleCount);
        this.sizes = new Float32Array(this.config.particleCount);

        // Initialize with default values (typically off-screen or invisible)
        for (let i = 0; i < this.config.particleCount; i++) {
            this.positions[i * 3 + 0] = 0;
            this.positions[i * 3 + 1] = 0;
            this.positions[i * 3 + 2] = 0;
            this.colors[i * 3 + 0] = 1;
            this.colors[i * 3 + 1] = 1;
            this.colors[i * 3 + 2] = 1;
            this.opacities[i] = 0;
            this.sizes[i] = 0;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('particleOpacity', new THREE.BufferAttribute(this.opacities, 1));
        this.geometry.setAttribute('particleSize', new THREE.BufferAttribute(this.sizes, 1));

        this.material = new THREE.PointsMaterial({
            size: this.config.particleSize, // Default size, will be overridden by attribute if shader supports it
            vertexColors: true,
            transparent: true,
            opacity: this.config.particleOpacity, // Default opacity
            depthWrite: false, // Common for particles
            blending: THREE.AdditiveBlending, // Common for bright effects
        });

        // Custom shader material to handle individual particle size and opacity
        this.material.onBeforeCompile = shader => {
            shader.vertexShader = `
                attribute float particleOpacity;
                attribute float particleSize;
                varying float vOpacity;
                ${shader.vertexShader}
            `.replace(
                `gl_PointSize = size;`,
                `gl_PointSize = particleSize * size;` // Multiply base size by attribute
            );
            shader.vertexShader = shader.vertexShader.replace(
                `#include <color_vertex>`,
                `#include <color_vertex>
                vOpacity = particleOpacity;`
            );

            shader.fragmentShader = `
                varying float vOpacity;
                ${shader.fragmentShader}
            `.replace(
                `#include <output_fragment>`,
                `#include <output_fragment>
                gl_FragColor = vec4(outgoingLight, diffuseColor.a * vOpacity);` // Apply varying opacity
            );
        };


        this.threePoints = new THREE.Points(this.geometry, this.material);
        this.threePoints.position.copy(initialPosition);

        if (parentSceneObject) {
            this.parent = parentSceneObject;
            if (this.config.worldSpaceParticles === false && this.parent) {
                this.parent.add(this.threePoints); // Add to parent if local space
            }
        }
    }

    private spawnParticle(index: number): void {
        const p = this.particles[index] || {} as Particle;

        p.position = new THREE.Vector3(0,0,0); // Relative to emitter position

        p.velocity = this.config.particleVelocity.clone().add(
            new THREE.Vector3(
                (Math.random() - 0.5) * 2 * this.config.particleVelocityRandomness.x,
                (Math.random() - 0.5) * 2 * this.config.particleVelocityRandomness.y,
                (Math.random() - 0.5) * 2 * this.config.particleVelocityRandomness.z
            )
        );

        if (Array.isArray(this.config.particleColor)) {
            p.color = this.config.particleColor[0].clone().lerp(this.config.particleColor[1], Math.random());
        } else {
            p.color = this.config.particleColor.clone();
        }

        p.opacity = this.config.particleOpacity;
        p.size = this.config.particleSize;
        p.age = 0;
        p.maxAge = this.config.particleMaxAge * (0.75 + Math.random() * 0.5); // Randomize maxAge slightly

        p.rotation = Math.random() * Math.PI * 2;
        if(this.config.angularVelocityRange) {
            p.angularVelocity = THREE.MathUtils.lerp(this.config.angularVelocityRange[0], this.config.angularVelocityRange[1], Math.random());
        } else {
            p.angularVelocity = 0;
        }


        this.particles[index] = p;

        // Update initial attributes
        this.updateParticleAttributes(index, p);
    }

    private updateParticleAttributes(index: number, particle: Particle): void {
        const ageRatio = particle.age / particle.maxAge;

        this.positions[index * 3 + 0] = particle.position.x;
        this.positions[index * 3 + 1] = particle.position.y;
        this.positions[index * 3 + 2] = particle.position.z;

        this.colors[index * 3 + 0] = particle.color.r;
        this.colors[index * 3 + 1] = particle.color.g;
        this.colors[index * 3 + 2] = particle.color.b;

        this.opacities[index] = this.config.opacityOverLifetime
            ? particle.opacity * this.config.opacityOverLifetime(ageRatio)
            : particle.opacity * (1 - ageRatio); // Default: fade out

        this.sizes[index] = this.config.sizeOverLifetime
            ? this.config.particleSize * this.config.sizeOverLifetime(ageRatio)
            : this.config.particleSize * (1 - ageRatio); // Default: shrink
    }

    update(deltaTime: number): void {
        if (this.isDead) return;

        this.emitterAge += deltaTime;
        if (this.emitterDuration !== null && this.emitterAge >= this.emitterDuration) {
            // Emitter has expired, stop emitting new particles
            // It will become dead once all existing particles die
        } else {
            // Emission logic
            this.timeSinceLastEmission += deltaTime;
            const emissionInterval = 1.0 / this.config.emissionRate;
            let particlesToEmit = Math.floor(this.timeSinceLastEmission / emissionInterval);
            this.timeSinceLastEmission -= particlesToEmit * emissionInterval;

            let emittedThisFrame = 0;
            for (let i = 0; i < this.config.particleCount && emittedThisFrame < particlesToEmit; i++) {
                if (!this.particles[i] || this.particles[i].age >= this.particles[i].maxAge) {
                    this.spawnParticle(i);
                    emittedThisFrame++;
                }
            }
        }


        let activeParticles = 0;
        for (let i = 0; i < this.config.particleCount; i++) {
            const p = this.particles[i];
            if (p && p.age < p.maxAge) {
                p.age += deltaTime;
                if (p.age >= p.maxAge) {
                    this.opacities[i] = 0; // Make dead particles invisible
                    this.sizes[i] = 0;
                    continue;
                }

                p.velocity.add(
                    (this.config.particleAcceleration || new THREE.Vector3(0,0,0)).clone().multiplyScalar(deltaTime)
                );
                p.position.add(p.velocity.clone().multiplyScalar(deltaTime));
                p.rotation += p.angularVelocity * deltaTime;

                this.updateParticleAttributes(i, p);
                activeParticles++;
            }
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.particleOpacity.needsUpdate = true;
        this.geometry.attributes.particleSize.needsUpdate = true;

        if (activeParticles === 0 && (this.emitterDuration !== null && this.emitterAge >= this.emitterDuration)) {
            this.isDead = true;
        }
    }

    dispose(): void {
        this.geometry.dispose();
        this.material.dispose();
        if (this.threePoints.parent && this.config.worldSpaceParticles !== false) {
             this.threePoints.parent.remove(this.threePoints);
        }
        // If particles are local space, parent removal handles it.
    }
}

export class ParticleManager {
    private emitters: ParticleEmitter[] = [];
    private scene: THREE.Scene; // Scene to add world-space emitters to

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    addEmitter(
        config: ParticleEmitterConfig,
        initialPosition: THREE.Vector3,
        duration?: number, // Optional duration for the emitter itself
        parentObject?: THREE.Object3D // For local-space particles; if undefined and worldSpaceParticles=false, uses scene
    ): ParticleEmitter {
        const effectiveParent = config.worldSpaceParticles === false ? (parentObject || this.scene) : null;
        const emitter = new ParticleEmitter(config, initialPosition, effectiveParent || undefined, duration);

        if (config.worldSpaceParticles !== false) {
            this.scene.add(emitter.threePoints); // Add to main scene if world space
        }
        // If local space, it's already added to its parent in ParticleEmitter constructor

        this.emitters.push(emitter);
        return emitter;
    }

    removeEmitter(emitter: ParticleEmitter): void {
        const index = this.emitters.indexOf(emitter);
        if (index > -1) {
            this.emitters.splice(index, 1);
            emitter.dispose();
        }
    }

    update(deltaTime: number): void {
        for (let i = this.emitters.length - 1; i >= 0; i--) {
            const emitter = this.emitters[i];
            emitter.update(deltaTime);
            if (emitter.isDead) {
                this.removeEmitter(emitter);
            }
        }
    }

    dispose(): void {
        this.emitters.forEach(emitter => emitter.dispose());
        this.emitters = [];
    }
}
