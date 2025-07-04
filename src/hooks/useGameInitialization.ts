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
  setSelectedRegionForPanel, // Added setter for selected region panel
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

      // The primary click handlers (onRegionClick, onSatelliteClick, onHexagonClick)
      // will now be assigned in App.tsx's useEffect hook. This hook, useGameInitialization,
      // is responsible for creating the Earth3D instance. App.tsx will then take
      // that instance (earth3DRef.current) and attach its own state-aware handlers to it.
      // This avoids stale closure issues with handlers defined directly in this hook's useEffect,
      // especially for handlers that need to read the latest App.tsx state like 'selectingHexForScan'
      // or 'gameState'.

      // Placeholder for any truly basic, non-state-dependent handlers if needed in Earth3D,
      // but for this project, most interaction logic resides in App.tsx.
      // For example, if Earth3D had an internal 'onHover' that only changed its own internal state
      // without needing App.tsx's state, it could be set here.
      // localEarth3D.onSomeBasicEvent = () => console.log("Basic Earth3D event triggered");

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
