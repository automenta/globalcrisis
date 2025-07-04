import React from 'react';
import { StrategicResourceType } from '@/engine/definitions'; // Assuming this path is correct after reorg
import { PlanetaryFacility, RegionEvent } from '@/engine/GameEngine'; // Assuming this path

interface HexagonDetails {
  id: string;
  strategicResource?: StrategicResourceType | null;
  facilities: PlanetaryFacility[];
  events: RegionEvent[];
  // Add more relevant details like region name, coordinates later
}

interface HexagonInfoPanelProps {
  hexagon: HexagonDetails | null;
  onClose: () => void;
  position: { x: number; y: number }; // For floating window positioning
}

export const HexagonInfoPanel: React.FC<HexagonInfoPanelProps> = ({ hexagon, onClose, position }) => {
  if (!hexagon) {
    return null;
  }

  // Basic styling for a floating window
  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    minWidth: '250px',
    maxWidth: '350px',
    maxHeight: '400px',
    overflowY: 'auto',
    zIndex: 100, // Ensure it's above other elements like the 3D canvas
  };

  return (
    <div
      className="bg-black/85 border border-blue-700 rounded-lg p-4 shadow-xl backdrop-blur-md text-sm text-gray-300 military-font"
      style={panelStyle}
      onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing it via App's global click listener
    >
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold text-blue-400">Hexagon: {hexagon.id}</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
          aria-label="Close panel"
        >
          &times; {/* Simple X icon */}
        </button>
      </div>

      {/* General Info Section (Placeholder) */}
      {/* <div className="mb-3">
        <h3 className="text-blue-300 font-semibold border-b border-blue-800 pb-1 mb-1">Details</h3>
        <p>Region: {hexagon.regionName || 'N/A'}</p>
        <p>Coordinates: ({hexagon.coordinates?.lat.toFixed(2)}, {hexagon.coordinates?.lon.toFixed(2)})</p>
      </div> */}

      {/* Strategic Resource Section */}
      <div className="mb-3">
        <h3 className="text-green-400 font-semibold border-b border-green-800 pb-1 mb-1">Strategic Resource</h3>
        {hexagon.strategicResource ? (
          <p className="text-green-300">{hexagon.strategicResource.replace('_', ' ').toUpperCase()}</p>
        ) : (
          <p className="text-gray-500">None detected</p>
        )}
      </div>

      {/* Facilities Section */}
      <div className="mb-3">
        <h3 className="text-orange-400 font-semibold border-b border-orange-800 pb-1 mb-1">Facilities ({hexagon.facilities.length})</h3>
        {hexagon.facilities.length > 0 ? (
          <ul className="list-disc list-inside pl-1 space-y-1 text-xs">
            {hexagon.facilities.map(fac => (
              <li key={fac.id}>
                {fac.type.replace('_', ' ').toUpperCase()} (ID: {fac.id.substring(0,6)}) - {fac.operational ? 'Online' : 'Offline/Constructing'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No facilities present</p>
        )}
      </div>

      {/* Active Events Section */}
      <div>
        <h3 className="text-red-400 font-semibold border-b border-red-800 pb-1 mb-1">Active Events ({hexagon.events.length})</h3>
        {hexagon.events.length > 0 ? (
          <ul className="list-disc list-inside pl-1 space-y-1 text-xs">
            {hexagon.events.map(event => (
              <li key={event.id}>
                {event.type.replace('_', ' ').toUpperCase()} (Severity: {(event.severity * 100).toFixed(0)}%)
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No active events</p>
        )}
      </div>
    </div>
  );
};
