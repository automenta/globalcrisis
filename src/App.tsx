import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameState, EventType, WorldRegion, RegionEvent, Faction } from './engine/GameEngine';
// import { Earth3D, Satellite, ContextMenu as ContextMenuType } from './components/Earth3D'; // Old import
import { Earth3D_v2, ContextMenu as ContextMenuType } from './components/Earth3D.2'; // New import
import { ContextMenu, TacticalOverlay } from './components/WarRoomUI';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Power } from 'lucide-react';

interface AudioSystem {
  context: AudioContext;
  playAlert: (type: 'warning' | 'critical' | 'success') => void;
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
    this.ambientGain.gain.value = 0.1;
  }
  
  playAlert(type: 'warning' | 'critical' | 'success') {
    const frequencies = {
      warning: [800, 1000],
      critical: [400, 600, 800],
      success: [600, 800, 1000]
    };
    
    const freqs = frequencies[type];
    freqs.forEach((freq, i) => {
      setTimeout(() => {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        
        osc.connect(gain);
        gain.connect(this.context.destination);
        
        osc.frequency.setValueAtTime(freq, this.context.currentTime);
        gain.gain.setValueAtTime(0.1, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);
        
        osc.start();
        osc.stop(this.context.currentTime + 0.3);
      }, i * 100);
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
  const earth3DRef = useRef<Earth3D_v2 | null>(null); // Updated type
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
      earth3DRef.current = new Earth3D_v2(canvasContainerRef.current); // Use Earth3D_v2
      
      // Initialize audio
      audioRef.current = new WarRoomAudio();
      
      // Setup event handlers
      earth3DRef.current.onRegionClick = (region, x, y) => {
        setContextMenu({
          visible: true,
          x,
          y,
          region,
          // satellite: null, // Keep as null for region click
          event: null,
          type: 'region',
          target: region
        });
      };
      
      earth3DRef.current.onSatelliteClick = (satelliteId, satelliteName, satelliteType, x, y) => { // Updated signature
        setContextMenu({
          visible: true,
          x,
          y,
          region: null,
          // satellite: { id: satelliteId, name: satelliteName, type: satelliteType }, // Pass an object if ContextMenu expects it
          event: null,
          type: 'satellite',
          target: { id: satelliteId, name: satelliteName, type: satelliteType } // ContextMenu target now gets this object
        });
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
        const newState = gameEngineRef.current.updateWorld(gameState, deltaTime); // gameState should be the first arg
        setGameState(newState);
        
        // Update 3D visualization
        if (earth3DRef.current) {
          // earth3DRef.current.updateRegionData(newState.regions); // This method might need to be part of updateCurrentGameState
          // earth3DRef.current.updateFactionData(newState.factions, newState.regions); // Same as above
          earth3DRef.current.updateCurrentGameState(newState); // Centralized update
          
          // Add new event markers - this logic might also move into Earth3D_v2 or be driven by it
          newState.activeEvents.forEach(event => {
            // Assuming RegionEvent has a flag or timestamp to indicate if it's new
            // For now, let's assume addEventMarker handles duplicates or is called for new events by engine state change
            // A better way: GameEngine could emit specific "event_created" signals or Earth3D could diff activeEvents.
            // This check `event.timeLeft === event.duration` seems fragile.
            // Let's assume addEventMarker is idempotent or Earth3D_v2 manages this internally.
             if (event.isNew || !earth3DRef.current?.hasEventMarker(event.id)) { // hasEventMarker would be a new method in Earth3D_v2
                 earth3DRef.current?.addEventMarker(event);
             }
          });
        }
        
        // Play audio alerts for new events
        if (newState.activeEvents.length > lastEventCount) {
          audioRef.current?.playAlert('warning');
        }
        setLastEventCount(newState.activeEvents.length);
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
  
  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(prev => ({ ...prev, visible: false }));
    };
    
    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);
  
  const handleContextMenuAction = useCallback((action: string, target?: any) => {
    if (!gameEngineRef.current || !gameState) return;
    
    let newState = { ...gameState };
    
    switch (action) {
      case 'deploy':
        if (target?.type && target?.region) {
          newState = gameEngineRef.current.triggerEvent(newState, target.type, target.region.id);
          audioRef.current?.playAlert(target.type.includes('HEAL') ? 'success' : 'critical');
        }
        break;
        
      case 'hack':
        if (target && earth3DRef.current) {
          earth3DRef.current.compromiseSatellite(target.id);
          audioRef.current?.playAlert('warning');
        }
        break;
        
      case 'destroy':
        if (target && earth3DRef.current) {
          earth3DRef.current.destroySatellite(target.id);
          audioRef.current?.playAlert('critical');
        }
        break;
        
      case 'restore':
        if (target && earth3DRef.current) {
          // Restore satellite functionality
          audioRef.current?.playAlert('success');
        }
        break;
        
      case 'focus':
        // Focus camera on region
        break;
        
      case 'counter':
        // Deploy countermeasures
        audioRef.current?.playAlert('success');
        break;
        
      case 'amplify':
        // Amplify event effect
        audioRef.current?.playAlert('critical');
        break;
    }
    
    setGameState(newState);
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
        factions={gameState.factions} // Pass factions to TacticalOverlay
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
      
      {/* Scan Lines Effect */}
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent animate-pulse" />
      </div>
    </div>
  );
}
