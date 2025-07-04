import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three'; // For Vector3 type if needed for hexCenter
import { GameEngine, GameState, EventType, WorldRegion, RegionEvent, PlanetaryFacility } from './engine/GameEngine';
import { StrategicResourceType } from './engine/definitions';
import { Earth3D, Satellite, ContextMenu as ContextMenuType } from './components/Earth3D';
import { ContextMenu, TacticalOverlay } from './components/WarRoomUI';
import { HexagonInfoPanel } from './components/HexagonInfoPanel'; // Import the new panel
import { Button } from '@/components/ui/button';
import { AlertTriangle, Power } from 'lucide-react';

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
  
  // Game loop
  useEffect(() => {
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
    
    let newState = { ...gameState };
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
          newState = gameEngineRef.current.triggerEvent(newState, target.type, target.region.id);
          const definition = gameEngineRef.current.getThreatDefinition(target.type as EventType);
          alertType = definition && (definition.effects.health && definition.effects.health > 0 || definition.effects.environment && definition.effects.environment > 0) ? 'success' : 'critical';
          audioRef.current?.playAlert(alertType, pan);
        }
        break;
        
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
    
    setGameState(newState);
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
