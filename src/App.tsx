/// <reference types="vitest" />
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
import { WarRoomAudio } from './audio/WarRoomAudio';
import { useGameInitialization } from './hooks/useGameInitialization';

interface HexagonDetailsForPanel {
  id: string;
  strategicResource?: StrategicResourceType | null;
  facilities: PlanetaryFacility[];
  events: RegionEvent[];
  // position: { x: number, y: number }; // Screen position for the panel
}

// AudioSystem interface and WarRoomAudio class were moved to src/audio/WarRoomAudio.ts

export default function GlobalCrisisSimulator() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
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
  // isInitialized is now managed by useGameInitialization
  const [lastEventCount, setLastEventCount] = useState(0);
  const [showTechnologyPanel, setShowTechnologyPanel] = useState(false);
  const [showFacilityPanel, setShowFacilityPanel] = useState(false);
  const [selectingHexForScan, setSelectingHexForScan] = useState<Satellite | null>(null);
  const [selectingHexForBuilding, setSelectingHexForBuilding] = useState<FacilityType | null>(null);
  const [appTargetedHexIdForBuild, setAppTargetedHexIdForBuild] = useState<string | null>(null);

  const { gameEngineRef, earth3DRef, audioRef, isInitialized } = useGameInitialization({
    canvasContainerRef,
    setGameState,
    setContextMenu,
    setSelectedHexagonDetails,
    setHexagonPanelPosition,
    // Pass down setters for the hook to potentially use or for context,
    // though primary logic for these states might remain in App.tsx's handlers.
    setSelectingHexForScan: setSelectingHexForScan,
    setAppTargetedHexIdForBuild: setAppTargetedHexIdForBuild,
    setSelectingHexForBuilding: setSelectingHexForBuilding,
    setShowFacilityPanel: setShowFacilityPanel,
  });

  // Effect to set up complex Earth3D click handlers that depend on App.tsx state,
  // once the game systems are initialized by the hook.
  useEffect(() => {
    if (isInitialized && earth3DRef.current && gameEngineRef.current && audioRef.current) {
      const earth3D = earth3DRef.current;
      const gameEngine = gameEngineRef.current;
      const audio = audioRef.current; // Capture current ref value for use in callbacks

      // Basic click handlers (onRegionClick, onSatelliteClick) are set by useGameInitialization
      // to call setContextMenu. Here we set up the more complex onHexagonClick.

      earth3D.onHexagonClick = (hexagonId, _hexagonCenter, clickX, clickY) => {
        setGameState(currentGS => {
          if (!currentGS || !gameEngineRef.current) { // Ensure gameEngineRef is valid inside callback
            return currentGS;
          }

          const strategicResource = currentGS.hexagonStrategicResources[hexagonId];
          const facilitiesOnHex = currentGS.activeFacilities.filter(f => f.hexagonId === hexagonId);

          setSelectedHexagonDetails({
            id: hexagonId, strategicResource, facilities: facilitiesOnHex, events: [],
          });
          setHexagonPanelPosition({
            x: Math.min(clickX + 15, window.innerWidth - 300),
            y: Math.min(clickY + 15, window.innerHeight - 250),
          });
          setContextMenu(prev => ({ ...prev, visible: false }));

          let nextGameState = currentGS;

          if (selectingHexForScan) {
            const satelliteForScan = selectingHexForScan;
            setSelectingHexForScan(null);
            const res = gameEngine.performGeoScan(currentGS, satelliteForScan.id, hexagonId);
            if (res.success && res.newState) {
              nextGameState = res.newState;
              audio.playAlert('success');
              setSelectedHexagonDetails(prev => (prev && prev.id === hexagonId && res.revealedResource !== undefined) ? {...prev, strategicResource: res.revealedResource } : prev);
            } else {
              audio.playAlert('warning');
              alert(`GeoScan failed: ${res.message}`);
            }
            return nextGameState;
          }

          if (selectingHexForBuilding) {
            const facilityTypeToBuild = selectingHexForBuilding;
            console.log(`Hexagon ${hexagonId} selected for building ${facilityTypeToBuild}.`);
            setAppTargetedHexIdForBuild(hexagonId);
            setSelectingHexForBuilding(null);
            setShowFacilityPanel(true);
          }
          return nextGameState;
        });
      };
    }
  }, [
    isInitialized, earth3DRef, gameEngineRef, audioRef,
    setGameState,
    setSelectedHexagonDetails, setHexagonPanelPosition, setContextMenu,
    selectingHexForScan, setSelectingHexForScan,
    selectingHexForBuilding, setSelectingHexForBuilding,
    setAppTargetedHexIdForBuild, setShowFacilityPanel
  ]);
  
  // Game loop & other useEffects that depend on gameState
  useEffect(() => {
    // Update Earth3D visuals when gameState changes, especially for hex resources
    if (isInitialized && earth3DRef.current && gameState) {
      earth3DRef.current.updateHexagonVisuals(gameState.scannedHexes, gameState.hexagonStrategicResources as Record<string, string | null>);
      // TODO: Consider adding earth3DRef.current.updateFacilityVisuals if/when available and needed
    }

    // Ensure all refs and necessary gameState properties are available before starting loop logic
    if (!isInitialized || !gameState || !gameState.running || !gameEngineRef.current || !earth3DRef.current || !audioRef.current) return;
    
    let lastTime = performance.now();
    
    function gameLoop(currentTime: number) {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      // Check refs inside the loop as well, though they should be stable after initialization
      // and gameState is also available.
      if (gameEngineRef.current && earth3DRef.current && audioRef.current && gameState) {
        // Use a local variable for gameState to ensure consistency within this iteration of the loop
        const currentGameState = gameState;
        const newState = gameEngineRef.current.updateWorld(currentGameState, deltaTime);
        setGameState(newState); // This triggers re-render and updates gameState for next cycle/other effects
        
        // Update ambient audio based on the new state
        audioRef.current.updateAmbient(newState);

        earth3DRef.current.updateRegionData(newState.regions);
          
        newState.activeEvents.forEach(event => {
          if (event.timeLeft === event.duration) { // New event
            earth3DRef.current?.addEventMarker(event);

            let pan = 0;
            const earth3D = earth3DRef.current; // Already confirmed not null
            if (earth3D) { // Still, good practice for safety if used in further nested closures
                // Convert event x,y (normalized lat/lon-like) to a 3D point on sphere surface
                // Assuming event.x, event.y are similar to region.x, region.y used in GameEngine for positioning
                // These are abstract coordinates; let's assume they map to a sphere of radius ~2.1 like event markers
                const eventWorldPos = new THREE.Vector3().setFromSphericalCoords(
                  2.1, // Approximate radius of event markers
                  Math.PI / 2 - event.y, // Convert y to polar angle (phi)
                  event.x // Convert x to azimuthal angle (theta)
                );
                const screenPos = earth3D.projectToScreen(eventWorldPos);
                if (screenPos && screenPos.z < 1) { // Check if in front of camera
                  pan = screenPos.x; // Normalized x is -1 to 1
                }
              }
              // Determine alert type (e.g., based on event.type or severity)
              // For now, all new random/spawned events are 'warning'
              // User-triggered events will have their own logic in handleContextMenuAction
              const gameEngine = gameEngineRef.current; // Already confirmed
              const audio = audioRef.current; // Already confirmed

              const definition = gameEngine?.getThreatDefinition(event.type);
              const isPositive = definition && (definition.effects.health && definition.effects.health > 0 || definition.effects.environment && definition.effects.environment > 0);

              audio?.playAlert(isPositive ? 'success' : 'warning', pan);
            }
          });
        
          if (newState.activeEvents.length !== lastEventCount) {
              setLastEventCount(newState.activeEvents.length);
          }
        }
      }
      
      // Check gameState again before queueing next frame, as it might have changed
      if (gameState && gameState.running) {
        animationRef.current = requestAnimationFrame(gameLoop);
      }
    }
    
    // Start the loop only if all conditions are met
    if (isInitialized && gameState && gameState.running && gameEngineRef.current && earth3DRef.current && audioRef.current) {
        animationRef.current = requestAnimationFrame(gameLoop);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isInitialized, gameState, gameEngineRef, earth3DRef, audioRef, lastEventCount]); // Added all relevant dependencies
  
  // Handle window resize
  useEffect(() => {
    // Ensure a resize handler is setup only once and when necessary
    if (!isInitialized || !earth3DRef.current || !canvasContainerRef.current) return;

    const earth3D = earth3DRef.current; // Capture current ref value
    const canvasContainer = canvasContainerRef.current; // Capture current ref value

    const handleResize = () => {
      if (earth3D && canvasContainer) { // Check if refs are still valid in closure
        earth3D.resize(
          canvasContainer.clientWidth,
          canvasContainer.clientHeight
        );
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isInitialized, earth3DRef, canvasContainerRef]); // Dependencies ensure this effect runs correctly
  
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
    // Ensure all refs are valid and isInitialized is true before proceeding
    if (!isInitialized || !gameEngineRef.current || !earth3DRef.current || !audioRef.current) return;

    const gameEngine = gameEngineRef.current;
    const earth3D = earth3DRef.current;
    const audio = audioRef.current;
    
    // Use setGameState with a callback to ensure operations on the latest state
    setGameState(currentGS => {
      if (!currentGS) return null; // Should be caught by outer isInitialized/gameState check, but good for safety

      let nextGameState = { ...currentGS }; // Start with a copy of the current state
      let pan = 0;
      let alertType: 'warning' | 'critical' | 'success' = 'warning';

      // Calculate pan based on the target of the action (if any)
      if (target) {
          let targetPosition3D: THREE.Vector3 | null = null;
          if (target.type && target.region) { // Action on a region
              const region = target.region as WorldRegion;
              targetPosition3D = new THREE.Vector3().setFromSphericalCoords(2.0, Math.PI/2 - region.y, region.x);
          } else if (target.mesh && target.mesh.position) { // Action on a satellite (has a mesh)
              targetPosition3D = target.mesh.position.clone();
          }
          // TODO: Handle event targets if they have positions for panning

          if (targetPosition3D) {
              const screenPos = earth3D.projectToScreen(targetPosition3D);
              if (screenPos && screenPos.z < 1) { // Check if in front of camera
                  pan = screenPos.x; // Normalized screen x for panning
              }
          }
      }

      switch (action) {
        case 'deploy':
          if (target?.type && target?.region) {
            const resultState = gameEngine.triggerEvent(nextGameState, target.type as EventType, target.region.id);
            const definition = gameEngine.getThreatDefinition(target.type as EventType);
            alertType = definition && (definition.effects.health && definition.effects.health > 0 || definition.effects.environment && definition.effects.environment > 0) ? 'success' : 'critical';
            audio.playAlert(alertType, pan);
            nextGameState = resultState;
          }
          break;

        case 'geo_scan_area':
          if (target?.id && selectedHexagonDetails?.id) { // target is satellite, selectedHexagonDetails for target hex
              const res = gameEngine.performGeoScan(nextGameState, target.id, selectedHexagonDetails.id);
              if (res.success && res.newState) {
                  nextGameState = res.newState;
                  audio.playAlert('success', pan);
                  // Update HexagonInfoPanel if it's open for the scanned hex
                  setSelectedHexagonDetails(prev => (prev && prev.id === selectedHexagonDetails.id && res.revealedResource !== undefined) ? { ...prev, strategicResource: res.revealedResource } : prev);
              } else {
                  audio.playAlert('warning', pan);
                  alert(`GeoScan failed: ${res.message}`); // Show user feedback
              }
          } else if (target?.id && !selectedHexagonDetails?.id) { // Satellite initiated scan, but no hex selected yet
              setSelectingHexForScan(target as Satellite); // Enter mode to select a hex
              audio.playAlert('success', pan); // Indicate mode change
              alert("GeoScanner Activated: Click on a hexagon on the globe to scan.");
              setContextMenu(prev => ({ ...prev, visible: false })); // Close menu, next click is for target
              // No direct game state change here, so return currentGS
              return currentGS;
          } else { // Invalid conditions for geo_scan
               audio.playAlert('warning', pan);
               alert("GeoScan can only be initiated by a GeoScanner satellite and requires a target or selection mode.");
          }
          break;

        case 'hack':
          if (target?.id) earth3D.compromiseSatellite(target.id); // target should be a satellite
          audio.playAlert('warning', pan);
          // Note: Hacking might need to update gameState if satellite status is part of it.
          // For now, assuming Earth3D handles visual state.
          break;

        case 'destroy':
          if (target?.id) earth3D.destroySatellite(target.id); // target should be a satellite
          audio.playAlert('critical', pan);
          // TODO: Game state should reflect destroyed satellite if it impacts game logic
          break;

        case 'restore':
          if (target?.id) {
            // earth3D.restoreSatellite(target.id); // Assuming this method exists and handles visuals
            // Placeholder for actual restoration logic
            console.log(`Restoring satellite ${target.id}`);
          }
          audio.playAlert('success', pan);
          // TODO: Game state update if satellite status is restored
          break;

        case 'focus':
          // Camera focus logic is typically handled by Earth3D directly or via its methods.
          // if (target?.mesh?.position && earth3DRef.current) {
          //   earth3DRef.current.zoomToTarget(target.mesh.position, 3); // Example distance
          // } else if (target?.region && earth3DRef.current) {
          //   const regionCenter = new THREE.Vector3().setFromSphericalCoords(2.0, Math.PI/2 - target.region.y, target.region.x);
          //   earth3DRef.current.zoomToTarget(regionCenter, 4);
          // }
          break;
        
        case 'counter':
        case 'amplify':
          // These actions might trigger new events or modify existing ones.
          // This logic should ideally be in GameEngine.
          // For now, just playing a sound as a placeholder.
          // nextGameState = gameEngine.handleEventAction(action, target, nextGameState);
          audio.playAlert(action === 'counter' ? 'success' : 'critical', pan);
          break;
        default:
          console.warn(`Unhandled context menu action: ${action}`);
          break;
      }
      return nextGameState; // Return the potentially modified state
    });
  }, [isInitialized, gameEngineRef, earth3DRef, audioRef, selectedHexagonDetails, setSelectedHexagonDetails, setSelectingHexForScan, setContextMenu, setGameState]); // gameState removed from deps, using setter form

  const handleStartResearch = useCallback((techId: TechId) => {
    if (!isInitialized || !gameEngineRef.current || !audioRef.current) return;
    const gameEngine = gameEngineRef.current;
    const audio = audioRef.current;
    setGameState(currentGS => {
      if (!currentGS) return null;
      const result = gameEngine.startResearch(currentGS, techId);
      if (result.success && result.newState) {
        audio.playAlert('success');
        return result.newState;
      } else {
        audio.playAlert('warning');
        // console.warn(`Failed to start research on ${techId}: ${result.message}`);
        return currentGS;
      }
    });
  }, [isInitialized, gameEngineRef, audioRef, setGameState]); // gameState removed

  const handleInitiateHexSelectionForBuilding = useCallback((facilityType: FacilityType) => {
    setSelectingHexForBuilding(facilityType);
    setAppTargetedHexIdForBuild(null);
    setShowTechnologyPanel(false);
    setContextMenu(prev => ({ ...prev, visible: false }));
    setSelectedHexagonDetails(null);
    alert(`Select a hexagon on the globe to place the ${facilityType.replace('_', ' ')}.`);
  }, [setSelectingHexForBuilding, setAppTargetedHexIdForBuild, setShowTechnologyPanel, setContextMenu, setSelectedHexagonDetails]); // No game state dependencies here

  const handleClearTargetedHexIdForBuild = useCallback(() => {
    setAppTargetedHexIdForBuild(null);
  }, [setAppTargetedHexIdForBuild]); // No game state dependencies

  const handleBuildFacility = useCallback((facilityType: FacilityType, regionId: string, hexagonId?: string) => {
    if (!isInitialized || !gameEngineRef.current || !audioRef.current) return;
    const gameEngine = gameEngineRef.current;
    const audio = audioRef.current;
    setGameState(currentGS => {
      if (!currentGS) return null;
      const result = gameEngine.buildFacility(currentGS, facilityType, regionId, hexagonId);
      if (result.success && result.newState) {
        audio.playAlert('success');
        return result.newState;
      } else {
        audio.playAlert('warning');
        // console.warn(`Failed to build ${facilityType}: ${result.message}`);
        return currentGS;
      }
    });
  }, [isInitialized, gameEngineRef, audioRef, setGameState]); // gameState removed

  const handleUpgradeFacility = useCallback((facilityId: string, toFacilityType: FacilityType) => {
    if (!isInitialized || !gameEngineRef.current || !audioRef.current) return;
    const gameEngine = gameEngineRef.current;
    const audio = audioRef.current;
    setGameState(currentGS => {
      if (!currentGS) return null;
      const result = gameEngine.upgradeFacility(currentGS, facilityId, toFacilityType);
      if (result.success && result.newState) {
        audio.playAlert('success');
        return result.newState;
      } else {
        audio.playAlert('warning');
        // console.warn(`Failed to upgrade facility ${facilityId}: ${result.message}`);
        return currentGS;
      }
    });
  }, [isInitialized, gameEngineRef, audioRef, setGameState]); // gameState removed
  
  const handleModeChange = useCallback((mode: 'chaos' | 'peace' | 'neutral') => {
    if (!isInitialized || !audioRef.current) return;
    setGameState(gs => gs ? { ...gs, mode } : null);
    audioRef.current?.playAlert('success');
  }, [isInitialized, audioRef, setGameState]); // gameState removed
  
  const handleSpeedChange = useCallback((speed: number) => {
    if (!isInitialized) return;
    setGameState(gs => gs ? { ...gs, speed } : null);
  }, [isInitialized, setGameState]); // gameState removed
  
  const handleTogglePlay = useCallback(() => {
    if (!isInitialized || !audioRef.current) return;
    const audio = audioRef.current;
    setGameState(gs => {
      if (!gs) return null;
      const newRunning = !gs.running;
      if (newRunning) audio.playAmbient();
      else audio.stopAmbient();
      return { ...gs, running: newRunning };
    });
  }, [isInitialized, audioRef, setGameState]); // gameState removed
  
  const handleReset = useCallback(() => {
    if (!isInitialized || !gameEngineRef.current || !audioRef.current) return;
    const gameEngine = gameEngineRef.current;
    const audio = audioRef.current;
    const newState = gameEngine.createInitialWorld();
    setGameState(newState);
    audio.stopAmbient();
    audio.playAlert('success');
  }, [isInitialized, gameEngineRef, audioRef, setGameState]); // gameState removed
  
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
