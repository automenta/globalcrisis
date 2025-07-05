// Silent Helix - main.js
// Core game logic will be developed here.

console.log("Silent Helix main.js loaded");

class Entity {
    constructor(id, type, position = { x: 0, y: 0, z: 0 }, state = {}) {
        this.id = id;
        this.type = type;
        this.position = position; // Expected to be {x, y, z} for 3D, or hex tile coords
        this.state = state;       // Arbitrary key-value pairs, e.g., { health: 100, influence: 50 }
        this.behaviors = [];      // Array of functions or identifiers for behaviors
    }

    // Example method to update entity state
    updateState(newState) {
        this.state = { ...this.state, ...newState };
        console.log(`Entity ${this.id} state updated:`, this.state);
    }

    // Example method to add a behavior
    addBehavior(behavior) {
        this.behaviors.push(behavior);
        console.log(`Entity ${this.id} added behavior:`, behavior);
    }

    // Static method to create entities from a template
    // Template example: { type: "scientist", initialState: { speed: 10, expertise: 0.8 }, initialPosition: { hexId: "A1" } }
    static fromTemplate(id, template) {
        const entity = new Entity(
            id,
            template.type,
            template.initialPosition || { x: 0, y: 0, z: 0 },
            template.initialState || {}
        );

        if (template.behaviors && Array.isArray(template.behaviors)) {
            template.behaviors.forEach(b => entity.addBehavior(b));
        }
        console.log(`Entity ${id} created from template:`, template.type);
        return entity;
    }
}

// Placeholder for game initialization
function initGame() {
    console.log("Initializing game...");

    // Example usage of Entity class and fromTemplate
    const scientistTemplate = {
        type: "scientist",
        initialState: { speed: 10, expertise: 0.8, allegiance: "consortium" },
        initialPosition: { hexTile: "H_10_5" } // Example hex tile ID
    };
    const scientist1 = Entity.fromTemplate("sci_001", scientistTemplate);
    scientist1.updateState({ currentAction: "deploying" });

    const regionTemplate = {
        type: "region",
        initialState: { population: 1000000, trust: 0.7, suspicion: 0.1 },
        initialPosition: { hexTile: "R_20_15" }
    };
    const region1 = Entity.fromTemplate("reg_africa_1", regionTemplate);
    region1.updateState({ health: 0.9 });

    console.log(scientist1);
    console.log(region1);
}

class Action {
    constructor(name, config) {
        this.name = name;
        this.trigger = config.trigger; // e.g., "player_click", "ai_timer", "event_condition"
        this.targetType = config.targetType; // e.g., "entity", "hex_tile", "global"
        this.effect = config.effect; // function(actor, target, gameContext) { ... }
        this.cost = config.cost || null; // Optional: resources, time, etc.
        this.conditions = config.conditions || (() => true); // Optional: function(actor, target, gameContext) to check if action is valid
    }

    // Method to execute the action
    execute(actor, target, gameContext) {
        if (typeof this.conditions === 'function' && !this.conditions(actor, target, gameContext)) {
            console.warn(`Action "${this.name}" conditions not met for actor ${actor.id} on target ${target ? target.id : 'global'}.`);
            return false;
        }

        if (typeof this.effect === 'function') {
            console.log(`Executing action "${this.name}" by ${actor.id} on ${target ? target.id : 'global'}.`);
            this.effect(actor, target, gameContext);
            // Optionally handle cost deduction here if gameContext provides resource management
            if (this.cost && gameContext && typeof gameContext.deductCost === 'function') {
                gameContext.deductCost(actor, this.cost);
            }
            return true;
        } else {
            console.error(`Action "${this.name}" has no effect function defined.`);
            return false;
        }
    }

    // Static method to define actions (could be loaded from JSON in a real scenario)
    static definedActions = {};

    staticdefine(actionName, config) {
        Action.definedActions[actionName] = new Action(actionName, config);
        console.log(`Action "${actionName}" defined.`);
    }

    static getAction(actionName) {
        return Action.definedActions[actionName];
    }
}

// Placeholder for game initialization
function initGame() {
    console.log("Initializing game...");

    // Example usage of Entity class and fromTemplate
    const scientistTemplate = {
        type: "scientist",
        initialState: { speed: 10, expertise: 0.8, allegiance: "consortium", resources: { energy: 100 } },
        initialPosition: { hexTile: "H_10_5" } // Example hex tile ID
    };
    const scientist1 = Entity.fromTemplate("sci_001", scientistTemplate);

    const regionTemplate = {
        type: "region",
        initialState: { population: 1000000, trust: 0.7, suspicion: 0.1 },
        initialPosition: { hexTile: "R_20_15" }
    };
    const region1 = Entity.fromTemplate("reg_africa_1", regionTemplate);

    // Define an example action: "hackMedia"
    Action.define("hackMedia", {
        trigger: "player_command",
        targetType: "entity", // Specifically, a media outlet entity
        conditions: (actor, target) => {
            return actor.type === "scientist" && target.type === "media_outlet" && actor.state.resources.energy >= 10;
        },
        effect: (actor, target, gameContext) => {
            if (target && target.state.suspicion !== undefined) {
                target.updateState({ suspicion: Math.max(0, target.state.suspicion - 0.1) });
                actor.updateState({ resources: { ...actor.state.resources, energy: actor.state.resources.energy - 10 } });
                console.log(`${actor.id} hacked ${target.id}. Suspicion reduced. Energy consumed.`);

                // Example of interacting with a hypothetical gameContext
                if (gameContext && gameContext.logEvent) {
                    gameContext.logEvent(`${actor.id} performed hackMedia on ${target.id}.`);
                }
            } else {
                console.warn("Hack media target is invalid or missing suspicion state.");
            }
        },
        cost: { energy: 10 }
    });

    // Simulate a media outlet entity for testing the action
    const mediaOutletTemplate = {
        type: "media_outlet",
        initialState: { reach: 0.8, bias: "pro-consortium", suspicion: 0.5 },
        initialPosition: { hexTile: "M_5_5" }
    };
    const mediaOutlet1 = Entity.fromTemplate("media_001", mediaOutletTemplate);

    console.log(scientist1);
    console.log(region1);
    console.log(mediaOutlet1);

    // Example of executing the action
    const hackAction = Action.getAction("hackMedia");
    if (hackAction) {
        // Hypothetical gameContext
        const gameContext = {
            logEvent: (message) => console.log(`[Game Event] ${message}`),
            deductCost: (actor, cost) => console.log(`Cost ${JSON.stringify(cost)} deducted from ${actor.id} (simulated)`),
            // ... other game state accessors or modifiers
        };
        hackAction.execute(scientist1, mediaOutlet1, gameContext);
        console.log("Media outlet after hack attempt:", mediaOutlet1.state);
        console.log("Scientist after hack attempt:", scientist1.state);

        // Example of a failed action due to conditions
        const scientist2 = Entity.fromTemplate("sci_002", { ...scientistTemplate, initialState: { ...scientistTemplate.initialState, resources: { energy: 5 } } });
        hackAction.execute(scientist2, mediaOutlet1, gameContext);

    }
}

class Phenomenon {
    constructor(name, config) {
        this.name = name;
        this.scope = config.scope; // "hex_tile", "region", "global"
        // Trigger can be a function that returns true if the phenomenon should activate.
        // It might take the gameContext, and specific target (like a tile or region) as arguments.
        // Example: (gameContext, target) => Math.random() < 0.01 (for probabilistic trigger)
        // Example: (gameContext, target) => target.state.trust < 0.3 (for conditional trigger)
        this.trigger = config.trigger;
        // Effect is a function that applies changes.
        // Example: (gameContext, target) => { target.updateState({ population: target.state.population * 0.99 }); }
        this.effect = config.effect;
        this.isActive = true; // Can be used to enable/disable phenomena
    }

    // Method to check if the phenomenon should trigger and then apply its effect
    // This would typically be called by the SimulationEngine for relevant scopes/targets
    process(gameContext, target) {
        if (!this.isActive) return false;

        let triggered = false;
        if (typeof this.trigger === 'function') {
            triggered = this.trigger(gameContext, target);
        } else {
            console.warn(`Phenomenon "${this.name}" has an invalid trigger.`);
            return false;
        }

        if (triggered) {
            console.log(`Phenomenon "${this.name}" triggered for ${target ? target.id || target.name : this.scope}.`);
            if (typeof this.effect === 'function') {
                this.effect(gameContext, target);
                return true;
            } else {
                console.error(`Phenomenon "${this.name}" has no effect function defined.`);
            }
        }
        return false;
    }

    static definedPhenomena = {};

    static define(phenomenonName, config) {
        Phenomenon.definedPhenomena[phenomenonName] = new Phenomenon(phenomenonName, config);
        console.log(`Phenomenon "${phenomenonName}" defined.`);
    }

    static getPhenomenon(phenomenonName) {
        return Phenomenon.definedPhenomena[phenomenonName];
    }
}


// Placeholder for game initialization
function initGame() {
    console.log("Initializing game...");

    // Example usage of Entity class and fromTemplate
    const scientistTemplate = {
        type: "scientist",
        initialState: { speed: 10, expertise: 0.8, allegiance: "consortium", resources: { energy: 100 } },
        initialPosition: { hexTile: "H_10_5" } // Example hex tile ID
    };
    const scientist1 = Entity.fromTemplate("sci_001", scientistTemplate);

    const regionTemplate = {
        type: "region",
        initialState: { population: 1000000, trust: 0.25, suspicion: 0.1, stability: 0.5 }, // Low trust for riot trigger
        initialPosition: { hexTile: "R_20_15" }
    };
    const region1 = Entity.fromTemplate("reg_africa_1", regionTemplate);

    // Define an example action: "hackMedia"
    Action.define("hackMedia", {
        trigger: "player_command",
        targetType: "entity", // Specifically, a media outlet entity
        conditions: (actor, target) => {
            return actor.type === "scientist" && target.type === "media_outlet" && actor.state.resources.energy >= 10;
        },
        effect: (actor, target, gameContext) => {
            if (target && target.state.suspicion !== undefined) {
                target.updateState({ suspicion: Math.max(0, target.state.suspicion - 0.1) });
                actor.updateState({ resources: { ...actor.state.resources, energy: actor.state.resources.energy - 10 } });
                console.log(`${actor.id} hacked ${target.id}. Suspicion reduced. Energy consumed.`);
                if (gameContext && gameContext.logEvent) {
                    gameContext.logEvent(`${actor.id} performed hackMedia on ${target.id}.`);
                }
            } else {
                console.warn("Hack media target is invalid or missing suspicion state.");
            }
        },
        cost: { energy: 10 }
    });

    // Simulate a media outlet entity for testing the action
    const mediaOutletTemplate = {
        type: "media_outlet",
        initialState: { reach: 0.8, bias: "pro-consortium", suspicion: 0.5 },
        initialPosition: { hexTile: "M_5_5" }
    };
    const mediaOutlet1 = Entity.fromTemplate("media_001", mediaOutletTemplate);

    console.log(scientist1);
    console.log(region1);
    console.log(mediaOutlet1);

    // Example of executing the action
    const hackAction = Action.getAction("hackMedia");
    if (hackAction) {
        const gameContext = {
            logEvent: (message) => console.log(`[Game Event] ${message}`),
            deductCost: (actor, cost) => console.log(`Cost ${JSON.stringify(cost)} deducted from ${actor.id} (simulated)`),
            // Example: Access to all entities or regions for global phenomena
            getAllEntitiesOfType: (type) => {
                if (type === 'region') return [region1 /*, other regions... */];
                return [];
            }
        };
        hackAction.execute(scientist1, mediaOutlet1, gameContext);
        console.log("Media outlet after hack attempt:", mediaOutlet1.state);
        console.log("Scientist after hack attempt:", scientist1.state);

        const scientist2 = Entity.fromTemplate("sci_002", { ...scientistTemplate, initialState: { ...scientistTemplate.initialState, resources: { energy: 5 } } });
        hackAction.execute(scientist2, mediaOutlet1, gameContext);


        // Define an example phenomenon: "Riot"
        Phenomenon.define("riot", {
            scope: "region", // Affects a specific region entity
            trigger: (gameCtx, targetRegion) => {
                // Trigger if trust is below 0.3 and stability is below 0.6
                return targetRegion && targetRegion.type === "region" &&
                       targetRegion.state.trust < 0.3 &&
                       targetRegion.state.stability < 0.6 &&
                       Math.random() < 0.05; // 5% chance if conditions met
            },
            effect: (gameCtx, targetRegion) => {
                const पापुलेशन लॉस = targetRegion.state.population * 0.01; // Typo for "populationLoss"
                targetRegion.updateState({
                    population: targetRegion.state.population - पापुलेशन लॉस,
                    stability: Math.max(0, targetRegion.state.stability - 0.1),
                    suspicion: Math.min(1, targetRegion.state.suspicion + 0.05)
                });
                console.log(`Riot in ${targetRegion.id}! Population decreased by ${populationLoss.toFixed(0)}, stability and suspicion affected.`);
                if (gameCtx && gameCtx.logEvent) {
                    gameCtx.logEvent(`Riot occurred in ${targetRegion.id}.`);
                }
            }
        });

        // Example of processing the phenomenon
        const riotPhenomenon = Phenomenon.getPhenomenon("riot");
        if (riotPhenomenon) {
            console.log("Initial region state for riot check:", region1.state);
            // Simulate multiple ticks or checks for the phenomenon
            for (let i = 0; i < 5; i++) { // Check 5 times
                 if(riotPhenomenon.process(gameContext, region1)) {
                     console.log(`Riot occurred during check ${i+1}`);
                 }
            }
            console.log("Region state after riot checks:", region1.state);
        }
    }
}

class SimulationEngine {
    constructor() {
        this.entities = new Map(); // Store entities by ID
        this.phenomena = []; // Store active phenomenon instances or definitions
        // Actions are mostly event-driven, but engine might hold action definitions
        // or facilitate contexts for them. For now, Action.definedActions is separate.

        this.gameTime = 0; // Total game time elapsed
        this.lastTimestamp = 0; // For calculating delta time
        this.isPaused = false;
        this.animationFrameId = null;

        this.gameContext = {
            logEvent: (message) => console.log(`[Sim Event] ${message}`),
            deductCost: (actor, cost) => console.log(`[Sim Cost] Cost ${JSON.stringify(cost)} deducted from ${actor.id} (simulated by engine)`),
            getAllEntitiesOfType: (type) => {
                const matchingEntities = [];
                this.entities.forEach(entity => {
                    if (entity.type === type) {
                        matchingEntities.push(entity);
                    }
                });
                return matchingEntities;
            },
            getEntityById: (id) => this.entities.get(id),
            // Potentially add access to global state variables if any are managed by the engine
        };
    }

    addEntity(entity) {
        this.entities.set(entity.id, entity);
        console.log(`[SimEngine] Entity added: ${entity.id} (${entity.type})`);
    }

    removeEntity(entityId) {
        if (this.entities.has(entityId)) {
            this.entities.delete(entityId);
            console.log(`[SimEngine] Entity removed: ${entityId}`);
        }
    }

    registerPhenomenon(phenomenon) {
        this.phenomena.push(phenomenon);
        console.log(`[SimEngine] Phenomenon registered: ${phenomenon.name}`);
    }

    // The main game loop tick
    tick(timestamp) {
        if (this.isPaused) {
            this.animationFrameId = requestAnimationFrame(this.tick.bind(this));
            return;
        }

        const deltaTime = (timestamp - this.lastTimestamp) / 1000; // Delta time in seconds
        this.lastTimestamp = timestamp;
        this.gameTime += deltaTime;

        // 1. Update entities
        this.entities.forEach(entity => {
            if (typeof entity.update === 'function') {
                entity.update(deltaTime, this.gameTime, this.gameContext);
            }
        });

        // 2. Process phenomena
        this.phenomena.forEach(phenomenon => {
            // Determine target(s) based on phenomenon scope
            if (phenomenon.scope === "global") {
                phenomenon.process(this.gameContext, null); // No specific target for global
            } else if (phenomenon.scope === "region" || phenomenon.scope === "hex_tile") {
                // Iterate over relevant entities (regions or tiles)
                const relevantEntities = this.gameContext.getAllEntitiesOfType(phenomenon.scope); // Assuming type matches scope
                relevantEntities.forEach(targetEntity => {
                    phenomenon.process(this.gameContext, targetEntity);
                });
            }
            // Could add more sophisticated targeting based on phenomenon needs
        });

        // 3. Handle other game logic (e.g., checking win/loss conditions - not yet defined)

        // console.log(`[SimEngine] Tick - Game Time: ${this.gameTime.toFixed(2)}s, Delta: ${deltaTime.toFixed(3)}s`);

        this.animationFrameId = requestAnimationFrame(this.tick.bind(this));
    }

    start() {
        if (this.animationFrameId) {
            console.log("[SimEngine] Already running.");
            return;
        }
        this.isPaused = false;
        this.lastTimestamp = performance.now(); // Use performance.now() for higher precision
        this.animationFrameId = requestAnimationFrame(this.tick.bind(this));
        console.log("[SimEngine] Started.");
    }

    pause() {
        this.isPaused = true;
        // We don't cancel the animation frame, tick will just not update game state.
        // To truly stop it, one might use cancelAnimationFrame(this.animationFrameId) and set it to null.
        // For pausing, letting the loop run but skip updates is fine.
        console.log("[SimEngine] Paused.");
    }

    resume() {
        if (!this.animationFrameId) { // If it was fully stopped
            this.start();
        } else { // If it was just paused
            this.isPaused = false;
            this.lastTimestamp = performance.now(); // Reset lastTimestamp to avoid large deltaTime jump
            console.log("[SimEngine] Resumed.");
        }
    }

    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isPaused = true; // Ensure it's marked as paused
        console.log("[SimEngine] Stopped.");
    }
}

// Graphics related variables
let scene, camera, renderer, earthMesh;

function initGraphics() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a); // Dark space background

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5; // Pull camera back to see the sphere

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        gameContainer.appendChild(renderer.domElement);
    } else {
        console.error("Error: game-container div not found in HTML.");
        document.body.appendChild(renderer.domElement); // Fallback
    }


    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 1.5); // Soft white light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    // Earth Sphere
    const earthGeometry = new THREE.SphereGeometry(2, 32, 32); // Radius 2, 32 segments
    const earthMaterial = new THREE.MeshPhongMaterial({ color: 0x2288ff }); // Blueish color
    earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earthMesh);

    // Basic render loop for graphics
    function animateGraphics() {
        requestAnimationFrame(animateGraphics);

        // Example animation: Rotate the Earth
        if (earthMesh) {
            earthMesh.rotation.y += 0.005;
            // earthMesh.rotation.x += 0.001; // Optional tilt
        }

        renderer.render(scene, camera);
    }
    animateGraphics();

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }, false);

    console.log("Three.js graphics initialized.");
}


// Placeholder for game initialization
function initGame() {
    console.log("Initializing game...");

    // Initialize Graphics first
    initGraphics();

    // Create Simulation Engine Instance
    const simEngine = new SimulationEngine();

    // Example usage of Entity class and fromTemplate
    const scientistTemplate = {
        type: "scientist",
        initialState: { speed: 10, expertise: 0.8, allegiance: "consortium", resources: { energy: 100 } },
        initialPosition: { hexTile: "H_10_5" } // Example hex tile ID
    };
    // const scientist1 = Entity.fromTemplate("sci_001", scientistTemplate);
    // simEngine.addEntity(scientist1); // Add to engine

    const regionTemplate = {
        type: "region",
        initialState: { population: 1000000, trust: 0.25, suspicion: 0.1, stability: 0.5 }, // Low trust for riot trigger
        initialPosition: { hexTile: "R_20_15" }
    };
    const region1 = Entity.fromTemplate("reg_africa_1", regionTemplate);
    simEngine.addEntity(region1); // Add to engine

    // Define an example action: "hackMedia"
    Action.define("hackMedia", {
        trigger: "player_command",
        targetType: "entity", // Specifically, a media outlet entity
        conditions: (actor, target) => {
            return actor.type === "scientist" && target.type === "media_outlet" && actor.state.resources.energy >= 10;
        },
        effect: (actor, target, gameContext) => {
            if (target && target.state.suspicion !== undefined) {
                target.updateState({ suspicion: Math.max(0, target.state.suspicion - 0.1) });
                actor.updateState({ resources: { ...actor.state.resources, energy: actor.state.resources.energy - 10 } });
                console.log(`${actor.id} hacked ${target.id}. Suspicion reduced. Energy consumed.`);
                if (gameContext && gameContext.logEvent) {
                    gameContext.logEvent(`${actor.id} performed hackMedia on ${target.id}.`);
                }
            } else {
                console.warn("Hack media target is invalid or missing suspicion state.");
            }
        },
        cost: { energy: 10 }
    });

    // Simulate a media outlet entity for testing the action
    const mediaOutletTemplate = {
        type: "media_outlet",
        initialState: { reach: 0.8, bias: "pro-consortium", suspicion: 0.5 },
        initialPosition: { hexTile: "M_5_5" }
    };
    const mediaOutlet1 = Entity.fromTemplate("media_001", mediaOutletTemplate);
    simEngine.addEntity(mediaOutlet1); // Add to engine

    // Create a scientist and add to engine AFTER simEngine is created so gameContext is available
    const scientist1 = Entity.fromTemplate("sci_001", scientistTemplate);
    simEngine.addEntity(scientist1);


    console.log(scientist1);
    console.log(region1);
    console.log(mediaOutlet1);

    // Example of executing the action using the engine's gameContext
    const hackAction = Action.getAction("hackMedia");
    if (hackAction) {
        // const gameContext = { ... }; // Now provided by simEngine
        hackAction.execute(scientist1, mediaOutlet1, simEngine.gameContext);
        console.log("Media outlet after hack attempt:", mediaOutlet1.state);
        console.log("Scientist after hack attempt:", scientist1.state);

        const scientist2 = Entity.fromTemplate("sci_002", { ...scientistTemplate, initialState: { ...scientistTemplate.initialState, resources: { energy: 5 } } });
        simEngine.addEntity(scientist2);
        hackAction.execute(scientist2, mediaOutlet1, simEngine.gameContext);


        // Define an example phenomenon: "Riot"
        Phenomenon.define("riot", {
            scope: "region", // Affects a specific region entity
            trigger: (gameCtx, targetRegion) => {
                return targetRegion && targetRegion.type === "region" &&
                       targetRegion.state.trust < 0.3 &&
                       targetRegion.state.stability < 0.6 &&
                       Math.random() < 0.05; // 5% chance if conditions met
            },
            effect: (gameCtx, targetRegion) => {
                const populationLoss = targetRegion.state.population * 0.01;
                targetRegion.updateState({
                    population: targetRegion.state.population - populationLoss,
                    stability: Math.max(0, targetRegion.state.stability - 0.1),
                    suspicion: Math.min(1, targetRegion.state.suspicion + 0.05)
                });
                console.log(`Riot in ${targetRegion.id}! Population decreased by ${populationLoss.toFixed(0)}, stability and suspicion affected.`);
                if (gameCtx && gameCtx.logEvent) {
                    gameCtx.logEvent(`Riot occurred in ${targetRegion.id}.`);
                }
            }
        });
        simEngine.registerPhenomenon(Phenomenon.getPhenomenon("riot")); // Register with engine


        // Example of processing the phenomenon - now handled by engine's tick
        // const riotPhenomenon = Phenomenon.getPhenomenon("riot");
        // if (riotPhenomenon) {
        //     console.log("Initial region state for riot check:", region1.state);
        //     for (let i = 0; i < 5; i++) {
        //          if(riotPhenomenon.process(simEngine.gameContext, region1)) {
        //              console.log(`Riot occurred during check ${i+1}`);
        //          }
        //     }
        //     console.log("Region state after riot checks:", region1.state);
        // }

        // Start the simulation engine
        simEngine.start();

        // Example: Pause and resume the engine after a few seconds
        setTimeout(() => {
            simEngine.pause();
            console.log("Region state after 3s (paused):", region1.state);
        }, 3000);

        setTimeout(() => {
            simEngine.resume();
        }, 5000);

        setTimeout(() => {
            simEngine.stop();
            console.log("Region state after 7s (stopped):", region1.state);
        }, 7000);
    }
}

// Start the game initialization process
initGame();
