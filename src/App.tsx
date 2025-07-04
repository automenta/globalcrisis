import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three'; // For Vector3 type if needed for hexCenter
import { GameEngine, GameState, EventType, WorldRegion, RegionEvent, PlanetaryFacility } from './engine/GameEngine';
import { StrategicResourceType } from './engine/definitions';
import { Earth3D, Satellite, ContextMenu as ContextMenuType } from './components/Earth3D';
import { ContextMenu, TacticalOverlay } from './components/WarRoomUI';
import { HexagonInfoPanel } from './components/HexagonInfoPanel';
import { TechnologyPanel } from './components/TechnologyPanel';
import { FacilityManagementPanel } from './components/FacilityManagementPanel'; // Import FacilityManagementPanel
import { TechId } from './engine/Technology';
import { FacilityType } from './engine/definitions'; // Import FacilityType for handlers
import { Button } from '@/components/ui/button';
import { AlertTriangle, Power, FlaskConical as TechIcon, Building as FacilityIcon } from 'lucide-react'; // Added FacilityIcon

interface HexagonDetailsForPanel {
  id: string;
  strategicResource?: StrategicResourceType | null;
  facilities: PlanetaryFacility[];
  events: RegionEvent[];
  // position: { x: number, y: number }; // Screen position for the panel
}

interface AudioSystem {
  context: AudioContext;
  playAlert: (type: 'warning' | 'critical' | 'success', pan?: number) => void;
  playAmbient: () => void;
  stopAmbient: () => void;
}

class WarRoomAudio {
  private context: AudioContext;
  private ambientGain: GainNode;
  private ambientOscillator: OscillatorNode | null = null;
  
  constructor() {
    this.context = new AudioContext();
    this.ambientGain = this.context.createGain();
    this.ambientGain.connect(this.context.destination);
    this.ambientGain.gain.value = 0.1; // Reduced ambient volume a bit
  }
  
  playAlert(type: 'warning' | 'critical' | 'success', pan: number = 0) {
    // Ensure pan value is within -1 to 1 range
    const effectivePan = Math.max(-1, Math.min(1, pan));

    const frequencies = {
      warning: [800, 1000],
      critical: [400, 600, 800],
      success: [600, 800, 1000]
    };
    
    const freqs = frequencies[type];
    const baseVolume = type === 'critical' ? 0.12 : 0.08; // Slightly louder critical alerts

    freqs.forEach((freq, i) => {
      setTimeout(() => {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const panner = this.context.createStereoPanner();

        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.context.destination);
        
        panner.pan.setValueAtTime(effectivePan, this.context.currentTime);
        osc.frequency.setValueAtTime(freq, this.context.currentTime);
        gain.gain.setValueAtTime(baseVolume, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.35); // Slightly longer tail
        
        osc.start();
        osc.stop(this.context.currentTime + 0.35);
      }, i * (type === 'critical' ? 80 : 100)); // Faster sequence for critical
    });
  }
  
  playAmbient() {
    if (this.ambientOscillator) return;
    
    this.ambientOscillator = this.context.createOscillator();
    this.ambientOscillator.type = 'sine';
    this.ambientOscillator.frequency.setValueAtTime(60, this.context.currentTime);
    this.ambientOscillator.connect(this.ambientGain);
    this.ambientOscillator.start();
  }
  
  stopAmbient() {
    if (this.ambientOscillator) {
      this.ambientOscillator.stop();
      this.ambientOscillator = null;
    }
  }
}

export default function GlobalCrisisSimulator() {
  const earth3DRef = useRef<Earth3D | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const gameEngineRef = useRef<GameEngine | null>(null);
  const audioRef = useRef<WarRoomAudio | null>(null);
  const animationRef = useRef<number | null>(null);
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuType>({
    visible: false,
    x: 0,
    y: 0,
    region: null,
    satellite: null,
    event: null,
    type: 'region',
    target: null
  });
  const [selectedHexagonDetails, setSelectedHexagonDetails] = useState<HexagonDetailsForPanel | null>(null);
  const [hexagonPanelPosition, setHexagonPanelPosition] = useState({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastEventCount, setLastEventCount] = useState(0);
  const [showTechnologyPanel, setShowTechnologyPanel] = useState(false);
  const [showFacilityPanel, setShowFacilityPanel] = useState(false);
  const [selectingHexForScan, setSelectingHexForScan] = useState<Satellite | null>(null);
  const [selectingHexForBuilding, setSelectingHexForBuilding] = useState<FacilityType | null>(null);
  const [appTargetedHexIdForBuild, setAppTargetedHexIdForBuild] = useState<string | null>(null); // Hex ID selected on map for building

  // Initialize game systems
  useEffect(() => {
    if (!canvasContainerRef.current) return;
    
    try {
      // Initialize game engine
      gameEngineRef.current = new GameEngine();
      const initialState = gameEngineRef.current.createInitialWorld();
      setGameState(initialState);
      
      // Initialize 3D Earth
      earth3DRef.current = new Earth3D(canvasContainerRef.current);
      
      // Initialize audio
      audioRef.current = new WarRoomAudio();
      
      // Setup event handlers
      earth3DRef.current.onRegionClick = (region, x, y) => {
        setContextMenu({
          visible: true,
          x,
          y,
          region,
          satellite: null,
          event: null,
          type: 'region',
          target: region
        });
      };
      
      earth3DRef.current.onSatelliteClick = (satellite, x, y) => {
        setContextMenu({
          visible: true,
          x,
          y,
          region: null,
          satellite,
          event: null,
          type: 'satellite',
          target: satellite
        });
      };
      
      earth3DRef.current.onHexagonClick = (hexagonId, _hexagonCenter, clickX, clickY) => {
        if (!gameState || !gameEngineRef.current) return;

        const strategicResource = gameState.hexagonStrategicResources[hexagonId];
        const facilitiesOnHex = gameState.activeFacilities.filter(f => f.hexagonId === hexagonId);

        // Find events affecting this hexagon. This is an approximation.
        // A more accurate way would be if events stored which hexes they are on,
        // or to use a spatial query. For now, check if event x,y is near hex center.
        // This requires hex center data to be available or passed from Earth3D.
        // For simplicity, we'll pass an empty array for events for now, or use region events.
        // const eventsOnHex = gameState.activeEvents.filter(event => {
        //   // Requires a way to map event x,y to a hex or check proximity to hexCenter
        //   return false; // Placeholder
        // });
        // For now, let's assume events are not hex-specific in this panel, or show region events.
        // This detail needs refinement if hex-specific event display is crucial.

        setSelectedHexagonDetails({
          id: hexagonId,
          strategicResource,
          facilities: facilitiesOnHex,
          events: [], // Placeholder for hex-specific events
        });
        // Position the panel near the click, ensuring it's within bounds
        setHexagonPanelPosition({
            x: Math.min(clickX + 15, window.innerWidth - 300), // Ensure panel doesn't go off-screen right
            y: Math.min(clickY + 15, window.innerHeight - 250) // Ensure panel doesn't go off-screen bottom
        });

        // Close context menu if it's open
        setContextMenu(prev => ({ ...prev, visible: false }));

        // If in "select hex for scan" mode
        if (selectingHexForScan && gameEngineRef.current && gameState) {
          const satellite = selectingHexForScan;
          setSelectingHexForScan(null); // Exit mode
          const res = gameEngineRef.current.performGeoScan(gameState, satellite.id, hexagonId);
          if (res.success && res.newState) {
            setGameState(res.newState);
            audioRef.current?.playAlert('success');
            // Update panel if open for this hex
            if (selectedHexagonDetails && selectedHexagonDetails.id === hexagonId) {
                 setSelectedHexagonDetails(prev => prev ? ({...prev, strategicResource: res.revealedResource }) : null);
            }
          } else {
            audioRef.current?.playAlert('warning');
            alert(`GeoScan failed: ${res.message}`);
          }
          return; // End click handling here for scan mode
        }

        // If in "select hex for building" mode
        if (selectingHexForBuilding && gameEngineRef.current && gameState) {
            console.log(`Hexagon ${hexagonId} selected for building ${selectingHexForBuilding}.`);
            setAppTargetedHexIdForBuild(hexagonId); // Pass this to FacilityManagementPanel via prop
            setSelectingHexForBuilding(null); // Exit mode
            setShowFacilityPanel(true); // Ensure facility panel is open to receive the hex ID
            // Note: The HexagonInfoPanel will still open due to setSelectedHexagonDetails above.
            // This might be okay, or we might want to prevent it if in building selection mode.
            // For now, let's allow both. The user can close the info panel.
            return; // End click handling
        }


      };

      setIsInitialized(true);
      
    } catch (error) {
      console.error('Failed to initialize 3D systems:', error);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (earth3DRef.current) {
        earth3DRef.current.dispose();
      }
      if (audioRef.current) {
        audioRef.current.stopAmbient();
      }
    };
  }, []);
  
  // Game loop & other useEffects that depend on gameState
  useEffect(() => {
    // Update Earth3D visuals when gameState changes, especially for hex resources
    if (earth3DRef.current && gameState) {
      earth3DRef.current.updateHexagonVisuals(gameState.scannedHexes, gameState.hexagonStrategicResources as Record<string, string | null>);
      // Consider if facility visuals also need updating here or if they are handled by their own flow
      // For now, let's assume GameEngine state changes trigger re-renders that pass new props.
      // However, direct calls for imperative updates to Three.js objects are often needed.
      // earth3DRef.current.updateFacilityVisuals(gameState.activeFacilities, earth3DRef.current.getHexagonsData(), gameState.regions);
      // The getHexagonsData() would need to be a new public method in Earth3D if we go this route.
      // For now, focusing on scanned hexes.
    }

    if (!gameState || !gameState.running || !gameEngineRef.current) return;
    
    let lastTime = performance.now();
    
    const gameLoop = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      if (gameEngineRef.current) {
        const newState = gameEngineRef.current.updateWorld(gameState, deltaTime);
        setGameState(newState);
        
        // Update 3D visualization
        if (earth3DRef.current) {
          earth3DRef.current.updateRegionData(newState.regions);
          
          // Add new event markers and play sounds
          newState.activeEvents.forEach(event => {
            if (event.timeLeft === event.duration) { // New event
              earth3DRef.current?.addEventMarker(event);

              // Calculate pan for new event sound
              let pan = 0;
              if (earth3DRef.current) {
                // Convert event x,y (normalized lat/lon-like) to a 3D point on sphere surface
                // Assuming event.x, event.y are similar to region.x, region.y used in GameEngine for positioning
                // These are abstract coordinates; let's assume they map to a sphere of radius ~2.1 like event markers
                const eventWorldPos = new THREE.Vector3().setFromSphericalCoords(
                  2.1, // Approximate radius of event markers
                  Math.PI / 2 - event.y, // Convert y to polar angle (phi)
                  event.x // Convert x to azimuthal angle (theta)
                );
                const screenPos = earth3DRef.current.projectToScreen(eventWorldPos);
                if (screenPos && screenPos.z < 1) { // Check if in front of camera
                  pan = screenPos.x; // Normalized x is -1 to 1
                }
              }
              // Determine alert type (e.g., based on event.type or severity)
              // For now, all new random/spawned events are 'warning'
              // User-triggered events will have their own logic in handleContextMenuAction
              const definition = gameEngineRef.current?.getThreatDefinition(event.type);
              const isPositive = definition && (definition.effects.health && definition.effects.health > 0 || definition.effects.environment && definition.effects.environment > 0);

              audioRef.current?.playAlert(isPositive ? 'success' : 'warning', pan);
            }
          });
        }
        
        // Update lastEventCount after processing all events
        if (newState.activeEvents.length !== lastEventCount) {
             setLastEventCount(newState.activeEvents.length);
        }

      }
      
      if (gameState.running) {
        animationRef.current = requestAnimationFrame(gameLoop);
      }
    };
    
    animationRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState?.running, lastEventCount]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (earth3DRef.current && canvasContainerRef.current) {
        earth3DRef.current.resize(
          canvasContainerRef.current.clientWidth,
          canvasContainerRef.current.clientHeight
        );
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Close context menu and hexagon panel on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside the context menu
      const contextMenuElement = document.querySelector('.fixed.z-50'); // Class from ContextMenu component
      if (contextMenu.visible && contextMenuElement && !contextMenuElement.contains(event.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }

      // Check if the click is outside the hexagon info panel
      const hexPanelElement = document.querySelector('.bg-black\\/85.border-blue-700'); // More specific selector for HexPanel
      if (selectedHexagonDetails && hexPanelElement && !hexPanelElement.contains(event.target as Node)) {
        setSelectedHexagonDetails(null);
      }
    };
    
    // Add listener if either menu or panel is visible
    if (contextMenu.visible || selectedHexagonDetails) {
      document.addEventListener('mousedown', handleClickOutside); // Use mousedown to catch before click on other elements
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.visible, selectedHexagonDetails]);
  
  const handleContextMenuAction = useCallback((action: string, target?: any) => {
    if (!gameEngineRef.current || !gameState || !earth3DRef.current) return;
    
    let currentGameState = { ...gameState }; // Use a mutable copy for this handler
    let pan = 0;
    let alertType: 'warning' | 'critical' | 'success' = 'warning'; // Default alert type

    // Calculate pan based on the target of the action
    if (target) {
        let targetPosition3D: THREE.Vector3 | null = null;
        if (target.type && target.region) { // Deploy action, target is region
            const region = target.region as WorldRegion;
            // Convert region x,y to 3D world coordinates (approximate)
            targetPosition3D = new THREE.Vector3().setFromSphericalCoords(2.0, Math.PI/2 - region.y, region.x);
        } else if (target.mesh && target.mesh.position) { // Satellite action, target has a mesh
            targetPosition3D = target.mesh.position.clone();
        }
        // TODO: Add case for event target if needed for 'counter' or 'amplify'

        if (targetPosition3D) {
            const screenPos = earth3DRef.current.projectToScreen(targetPosition3D);
            if (screenPos && screenPos.z < 1) { // Check if in front of camera
                pan = screenPos.x;
            }
        }
    }
    
    switch (action) {
      case 'deploy':
        if (target?.type && target?.region) {
          const resultState = gameEngineRef.current.triggerEvent(currentGameState, target.type, target.region.id);
          const definition = gameEngineRef.current.getThreatDefinition(target.type as EventType);
          alertType = definition && (definition.effects.health && definition.effects.health > 0 || definition.effects.environment && definition.effects.environment > 0) ? 'success' : 'critical';
          audioRef.current?.playAlert(alertType, pan);
          currentGameState = resultState; // Update currentGameState with the result
        }
        break;

      case 'geo_scan_area': // Assuming this is the action from satellite context menu
        if (target?.id && selectedHexagonDetails?.id) { // target is satellite, selectedHexagonDetails for target hex
            const res = gameEngineRef.current.performGeoScan(currentGameState, target.id, selectedHexagonDetails.id);
            if (res.success && res.newState) {
                currentGameState = res.newState;
                audioRef.current?.playAlert('success', pan);
                // Update HexagonInfoPanel if it's open for the scanned hex
                if (selectedHexagonDetails && selectedHexagonDetails.id === res.newState.scannedHexes?.[res.newState.scannedHexes.length-1]) { // A bit fragile way to check last scanned
                    setSelectedHexagonDetails(prev => prev ? ({
                        ...prev,
                        strategicResource: res.revealedResource
                    }) : null);
                }
                 // Earth3D will be updated by the useEffect watching gameState
            } else {
                audioRef.current?.playAlert('warning', pan);
                // console.warn(res.message); // Optionally show message to user
            }
        } else if (target?.id && !selectedHexagonDetails?.id) {
            // If no hex is selected, prompt user or make it area-based scan
            // For now, requires a selected hex. Could also use onHexagonClick to set a "scanTargetHex" state.
            console.log("GeoScan action initiated by satellite, but no target hexagon selected on map.");
            // TODO: Implement a mode to select a hex for scanning after clicking the button.
            // This might involve setting a state like `isScanningMode = true`
            // For now, set the app state to wait for a hex click
            setSelectingHexForScan(target as Satellite); // target is the satellite
            audioRef.current?.playAlert('success', pan); // Indicate mode change
            alert("GeoScanner Activated: Click on a hexagon on the globe to scan.");
            // Close context menu as the next click is for targeting
            setContextMenu(prev => ({ ...prev, visible: false }));
        } else {
             audioRef.current?.playAlert('warning', pan);
             alert("GeoScan can only be initiated by a GeoScanner satellite.");
        }
        // Do not set currentGameState here, as it will be set after hex selection
        return; // Return early as we are entering a selection mode

      case 'hack':
        if (target && earth3DRef.current) {
          earth3DRef.current.compromiseSatellite(target.id);
          audioRef.current?.playAlert('warning', pan);
        }
        break;
        
      case 'destroy':
        if (target && earth3DRef.current) {
          earth3DRef.current.destroySatellite(target.id);
          audioRef.current?.playAlert('critical', pan);
        }
        break;
        
      case 'restore':
        if (target && earth3DRef.current) {
          // Placeholder: earth3DRef.current.restoreSatellite(target.id);
          audioRef.current?.playAlert('success', pan);
        }
        break;
        
      case 'focus':
        // Focus camera on region - no sound or specific sound?
        break;
        
      case 'counter':
        // Deploy countermeasures
        audioRef.current?.playAlert('success', pan);
        break;
        
      case 'amplify':
        // Amplify event effect
        audioRef.current?.playAlert('critical', pan);
        break;
    }
    
    setGameState(currentGameState); // Set the final state after all actions
  }, [gameState, selectedHexagonDetails]); // Added selectedHexagonDetails as dependency

  const handleStartResearch = useCallback((techId: TechId) => {
    if (!gameEngineRef.current || !gameState) return;
    const result = gameEngineRef.current.startResearch(gameState, techId);
    if (result.success && result.newState) {
      setGameState(result.newState);
      audioRef.current?.playAlert('success');
      // console.log(`Started research on ${techId}`);
    } else {
      audioRef.current?.playAlert('warning');
      // console.warn(`Failed to start research on ${techId}: ${result.message}`);
      // Optionally, show a toast or notification to the user with result.message
    }
  }, [gameState]);

  const handleInitiateHexSelectionForBuilding = useCallback((facilityType: FacilityType) => {
    setSelectingHexForBuilding(facilityType);
    setAppTargetedHexIdForBuild(null); // Clear any previously targeted hex
    // Close other panels that might interfere with map selection
    setShowTechnologyPanel(false);
    setContextMenu(prev => ({ ...prev, visible: false }));
    setSelectedHexagonDetails(null);
    // Alert or UI indication that player should click a hex
    alert(`Select a hexagon on the globe to place the ${facilityType.replace('_', ' ')}.`);
  }, []);

  const handleClearTargetedHexIdForBuild = useCallback(() => {
    setAppTargetedHexIdForBuild(null);
  }, []);

  const handleBuildFacility = useCallback((facilityType: FacilityType, regionId: string, hexagonId?: string) => {
    if (!gameEngineRef.current || !gameState) return;
    const result = gameEngineRef.current.buildFacility(gameState, facilityType, regionId, hexagonId);
    if (result.success && result.newState) {
      setGameState(result.newState);
      audioRef.current?.playAlert('success');
      // console.log(`Building ${facilityType} in ${regionId}` + (hexagonId ? ` on ${hexagonId}` : ""));
    } else {
      audioRef.current?.playAlert('warning');
      // console.warn(`Failed to build ${facilityType}: ${result.message}`);
      // Optionally, show a toast to the user with result.message
    }
  }, [gameState]);

  const handleUpgradeFacility = useCallback((facilityId: string, toFacilityType: FacilityType) => {
    if (!gameEngineRef.current || !gameState) return;
    const result = gameEngineRef.current.upgradeFacility(gameState, facilityId, toFacilityType);
    if (result.success && result.newState) {
      setGameState(result.newState);
      audioRef.current?.playAlert('success');
      // console.log(`Upgraded facility ${facilityId} to ${toFacilityType}`);
    } else {
      audioRef.current?.playAlert('warning');
      // console.warn(`Failed to upgrade facility ${facilityId}: ${result.message}`);
    }
  }, [gameState]);
  
  const handleModeChange = useCallback((mode: 'chaos' | 'peace' | 'neutral') => {
    if (!gameState) return;
    setGameState({ ...gameState, mode });
    audioRef.current?.playAlert('success');
  }, [gameState]);
  
  const handleSpeedChange = useCallback((speed: number) => {
    if (!gameState) return;
    setGameState({ ...gameState, speed });
  }, [gameState]);
  
  const handleTogglePlay = useCallback(() => {
    if (!gameState) return;
    const newRunning = !gameState.running;
    setGameState({ ...gameState, running: newRunning });
    
    if (newRunning) {
      audioRef.current?.playAmbient();
    } else {
      audioRef.current?.stopAmbient();
    }
  }, [gameState]);
  
  const handleReset = useCallback(() => {
    if (!gameEngineRef.current) return;
    const newState = gameEngineRef.current.createInitialWorld();
    setGameState(newState);
    audioRef.current?.stopAmbient();
    audioRef.current?.playAlert('success');
  }, []);
  
  if (!isInitialized || !gameState) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Power className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
          <div className="text-red-400 military-font text-xl mb-2">INITIALIZING COMMAND CENTER</div>
          <div className="text-gray-400 text-sm">Loading 3D Earth Systems...</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* 3D Earth Container */}
      <div 
        ref={canvasContainerRef} 
        className="absolute inset-0 w-full h-full"
        style={{ cursor: 'grab' }}
      />
      
      {/* War Room Interface Overlay */}
      <TacticalOverlay
        gameState={gameState}
        onModeChange={handleModeChange}
        onSpeedChange={handleSpeedChange}
        onTogglePlay={handleTogglePlay}
        onReset={handleReset}
      />
      
      {/* War Room Interface Overlay - moved TacticalOverlay to be wrapped for button */}
      <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none z-10">
        <TacticalOverlay
          gameState={gameState}
          onModeChange={handleModeChange}
          onSpeedChange={handleSpeedChange}
          onTogglePlay={handleTogglePlay}
          onReset={handleReset}
        />
        {/* Button to toggle Technology Panel */}
        <Button
          variant="outline"
          size="default" // Adjusted size for better visibility
          className="absolute top-40 left-4 pointer-events-auto military-font bg-black/70 border-red-700 hover:bg-red-800/70 text-red-300 hover:text-white"
          onClick={() => setShowTechnologyPanel(true)}
        >
          <TechIcon className="w-5 h-5 mr-2" />
          Technology
        </Button>
        {/* Button to toggle Facility Panel */}
        <Button
          variant="outline"
          size="default"
          className="absolute top-52 left-4 pointer-events-auto military-font bg-black/70 border-red-700 hover:bg-red-800/70 text-red-300 hover:text-white"
          onClick={() => setShowFacilityPanel(true)}
        >
          <FacilityIcon className="w-5 h-5 mr-2" />
          Facilities
        </Button>
      </div>

      {/* Context Menu */}
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        region={contextMenu.region || undefined}
        satellite={contextMenu.satellite || undefined}
        event={contextMenu.event || undefined}
        onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))}
        onAction={handleContextMenuAction}
      />

      {/* Hexagon Info Panel */}
      {selectedHexagonDetails && (
        <HexagonInfoPanel
          hexagon={selectedHexagonDetails}
          onClose={() => setSelectedHexagonDetails(null)}
          position={hexagonPanelPosition}
          onBuildFacility={(facilityType, regionId, hexagonId) => { /* TODO: Implement or pass handler */ console.log("Build request from hex panel:", facilityType, regionId, hexagonId);}}
        />
      )}

      {/* Technology Panel */}
      {showTechnologyPanel && gameState && (
        <TechnologyPanel
          gameState={gameState}
          onStartResearch={handleStartResearch}
          onClose={() => setShowTechnologyPanel(false)}
        />
      )}

      {/* Facility Management Panel */}
      {showFacilityPanel && gameState && (
        <FacilityManagementPanel
          gameState={gameState}
          onBuildFacility={handleBuildFacility}
          onUpgradeFacility={handleUpgradeFacility}
          onClose={() => setShowFacilityPanel(false)}
          onInitiateHexSelectionForBuilding={handleInitiateHexSelectionForBuilding}
          targetedHexIdForBuild={appTargetedHexIdForBuild}
          clearTargetedHexIdForBuild={handleClearTargetedHexIdForBuild}
        />
      )}
      
      {/* Emergency Alert System */}
      {gameState.globalSuffering > 80 && (
        <div className="absolute inset-0 pointer-events-none z-30">
          <div className="absolute inset-0 bg-red-500/10 animate-pulse" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="bg-red-900/90 border-2 border-red-500 rounded-lg p-6 text-center backdrop-blur-sm">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-2 animate-bounce" />
              <div className="text-red-400 military-font text-2xl mb-2">GLOBAL CRISIS</div>
              <div className="text-white text-sm">Suffering levels critical: {gameState.globalSuffering.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Scan Lines Effect */}
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent animate-pulse" />
      </div>
    </div>
  );
}
