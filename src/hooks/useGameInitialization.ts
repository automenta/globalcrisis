import { useEffect, useRef, useState } from 'react';
import { GameEngine, GameState, WorldRegion } from '../engine/GameEngine';
import { Earth3D, Satellite } from '../components/Earth3D';
import { WarRoomAudio } from '../audio/WarRoomAudio';
import { FacilityType } from '../engine/definitions';

// Define the structure for context menu state, mirroring its definition in App.tsx
// This might be better placed in a shared types file if used by many hooks/components.
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  region: WorldRegion | null;
  satellite: Satellite | null;
  event: any | null; // Replace 'any' with specific Event type if available
  type: 'region' | 'satellite' | 'event';
  target: any | null; // Replace 'any' with specific target type
}

// Define the structure for selected hexagon details, mirroring its definition in App.tsx
interface HexagonDetailsForPanel {
  id: string;
  strategicResource?: string | null; // Assuming StrategicResourceType is string-based
  facilities: any[]; // Replace 'any' with specific Facility type
  events: any[]; // Replace 'any' with specific Event type
}

interface UseGameInitializationProps {
  canvasContainerRef: React.RefObject<HTMLDivElement>;
  setGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState>>;
  setSelectedHexagonDetails: React.Dispatch<React.SetStateAction<HexagonDetailsForPanel | null>>;
  setHexagonPanelPosition: React.Dispatch<React.SetStateAction<{ x: number, y: number }>>;
  setSelectingHexForScan: React.Dispatch<React.SetStateAction<Satellite | null>>;
  setAppTargetedHexIdForBuild: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectingHexForBuilding: React.Dispatch<React.SetStateAction<FacilityType | null>>;
  setShowFacilityPanel: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface GameInitializationResult {
  gameEngineRef: React.RefObject<GameEngine | null>;
  earth3DRef: React.RefObject<Earth3D | null>;
  audioRef: React.RefObject<WarRoomAudio | null>;
  isInitialized: boolean;
}

export function useGameInitialization({
  canvasContainerRef,
  setGameState,
  setContextMenu,
  setSelectedHexagonDetails,
  setHexagonPanelPosition,
  setSelectingHexForScan,
  setAppTargetedHexIdForBuild,
  setSelectingHexForBuilding,
  setShowFacilityPanel,
}: UseGameInitializationProps): GameInitializationResult {
  const gameEngineRef = useRef<GameEngine | null>(null);
  const earth3DRef = useRef<Earth3D | null>(null);
  const audioRef = useRef<WarRoomAudio | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!canvasContainerRef.current || isInitialized) return; // Prevent re-initialization

    let localEarth3D: Earth3D | null = null;
    let localAudio: WarRoomAudio | null = null;

    try {
      // Initialize game engine
      const engine = new GameEngine();
      gameEngineRef.current = engine;
      const initialState = engine.createInitialWorld();
      setGameState(initialState);

      // Initialize 3D Earth
      localEarth3D = new Earth3D(canvasContainerRef.current);
      earth3DRef.current = localEarth3D;

      // Initialize audio
      localAudio = new WarRoomAudio();
      audioRef.current = localAudio;

      // Setup event handlers for Earth3D
      localEarth3D.onRegionClick = (region, x, y) => {
        setContextMenu({
          visible: true,
          x,
          y,
          region,
          satellite: null,
          event: null,
          type: 'region',
          target: region,
        });
      };

      localEarth3D.onSatelliteClick = (satellite, x, y) => {
        setContextMenu({
          visible: true,
          x,
          y,
          region: null,
          satellite,
          event: null,
          type: 'satellite',
          target: satellite,
        });
      };

      localEarth3D.onHexagonClick = (hexagonId, _hexagonCenter, clickX, clickY) => {
        // Access gameState via a function passed to setGameState to ensure freshest state
        // or ensure this useEffect reruns if gameState identity changes (which it does).
        // For now, this relies on the App.tsx passing down the current gameState,
        // which will be captured by this closure when the hook runs.
        // A more robust way might involve passing a getter for gameState or gameEngineRef.current.
        // This is a common challenge with useEffect and refs.

        // The App.tsx will manage the state reads for these click handlers for now.
        // This hook sets up the click handlers, but the logic within them
        // (reading gameState, calling gameEngineRef.current methods) will be in App.tsx's callbacks.
        // So, onHexagonClick in App.tsx will need access to gameEngineRef.current and gameState.

        // This hook's responsibility is primarily setting up the instance and the raw click listeners.
        // The complex logic inside onHexagonClick (like geo_scan or building placement)
        // will be triggered by App.tsx's version of onHexagonClick, which calls gameEngine methods.

        // Simplified onHexagonClick for initialization hook:
        // It prepares data for App.tsx to handle.
        setGameState(currentGameState => {
          if (!currentGameState || !gameEngineRef.current) return currentGameState;

          const strategicResource = currentGameState.hexagonStrategicResources[hexagonId];
          const facilitiesOnHex = currentGameState.activeFacilities.filter(f => f.hexagonId === hexagonId);

          setSelectedHexagonDetails({
            id: hexagonId,
            strategicResource,
            facilities: facilitiesOnHex,
            events: [], // Placeholder
          });
          setHexagonPanelPosition({
            x: Math.min(clickX + 15, window.innerWidth - 300),
            y: Math.min(clickY + 15, window.innerHeight - 250),
          });
          setContextMenu(prev => ({ ...prev, visible: false }));


          // The following logic needs to be in App.tsx's actual handler that receives these details.
          // This hook just sets up the initial click. The state-dependent logic (selectingHexForScan, etc.)
          // is too tightly coupled with App.tsx's state and handlers.
          // So, onHexagonClick in App.tsx will need to check selectingHexForScan etc.
          // For now, the hook passes the raw click info up.
          // The `App.tsx` will have its own `onHexagonClick` that uses these refs.
          // This is a bit of a dance. Let's adjust: Earth3D's onHexagonClick should just pass data.
          // App.tsx's useEffect will set its own more complex handler on earth3DRef.current.

          // Let's refine this: The hook should set up the *basic* click handlers on Earth3D
          // that then call more complex handlers defined in App.tsx (or another hook).
          // For now, the onHexagonClick in App.tsx will be assigned to earth3DRef.current.onHexagonClick
          // *after* this initialization hook runs.

          return currentGameState; // No state change from this basic setup part
        });
      };

      setIsInitialized(true);
      console.log('Game systems initialized by useGameInitialization.');

    } catch (error) {
      console.error('Failed to initialize game systems in useGameInitialization:', error);
      setIsInitialized(false); // Ensure it's false on error
    }

    return () => {
      console.log('Cleaning up useGameInitialization resources.');
      // The animation frame is managed by useGameLoop or App.tsx's main loop effect.
      // This hook's cleanup focuses on instances it created if they need explicit disposal beyond refs.
      if (localEarth3D) {
        localEarth3D.dispose();
        earth3DRef.current = null;
      }
      if (localAudio) {
        localAudio.dispose(); // Assuming WarRoomAudio has a dispose method
        audioRef.current = null;
      }
      // gameEngineRef might not need explicit disposal unless it holds external resources.
      // setIsInitialized(false); // Reset for potential re-init if component unmounts/remounts
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasContainerRef]); // Only re-run if canvasContainerRef changes (should be stable)
  // Removed other dependencies as they are setters or stable refs for this initialization phase.
  // The complex interactions will be handled by other hooks/effects that depend on gameState.

  return { gameEngineRef, earth3DRef, audioRef, isInitialized };
}
