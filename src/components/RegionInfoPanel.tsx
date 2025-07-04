import React from 'react';
import { WorldRegion, EconomicSectorType, GameState } from '@/engine/GameEngine'; // Assuming GameState is needed for context or future use
import { BiomeType, StrategicResourceType } from '@/engine/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from './ui/badge';

// Icons (example, replace with actual icons as needed)
import { Mountain, Trees, Waves, Sun, Leaf, Snowflake, Users, Factory, DollarSign, TrendingUp, TrendingDown, ShoppingCart, HelpCircle } from 'lucide-react';

interface RegionInfoPanelProps {
  region: WorldRegion | null;
  gameState: GameState; // Pass full gameState to access player resources or global context if needed later
  onClose: () => void;
  // position: { x: number; y: number }; // For floating window, if not a fixed panel
}

const getBiomeIcon = (biome: BiomeType | undefined) => {
  switch (biome) {
    case BiomeType.MOUNTAIN: return <Mountain className="w-4 h-4 mr-1 text-gray-400" />;
    case BiomeType.TROPICAL_RAINFOREST:
    case BiomeType.TEMPERATE_FOREST:
    case BiomeType.BOREAL_FOREST:
    case BiomeType.JUNGLE:
      return <Trees className="w-4 h-4 mr-1 text-green-500" />;
    case BiomeType.OCEAN: return <Waves className="w-4 h-4 mr-1 text-blue-500" />;
    case BiomeType.DESERT: return <Sun className="w-4 h-4 mr-1 text-yellow-500" />;
    case BiomeType.GRASSLAND:
    case BiomeType.PLAINS:
      return <Leaf className="w-4 h-4 mr-1 text-lime-600" />;
    case BiomeType.TUNDRA:
    case BiomeType.POLAR_ICE:
      return <Snowflake className="w-4 h-4 mr-1 text-blue-300" />;
    default: return <HelpCircle className="w-4 h-4 mr-1 text-gray-500"/>;
  }
};

export const RegionInfoPanel: React.FC<RegionInfoPanelProps> = ({ region, gameState, onClose }) => {
  if (!region) {
    return null;
  }

  const panelStyle: React.CSSProperties = {
    position: 'fixed', // Or 'absolute' if container is relative
    right: '20px',     // Example positioning: fixed to the right
    top: '150px',    // Example positioning
    width: '350px',   // Fixed width
    maxHeight: 'calc(100vh - 180px)', // Max height, considering top/bottom margins or other UI
    zIndex: 50,      // Ensure it's above other elements like the 3D canvas
  };

  const industrySector = region.economicSectors[EconomicSectorType.INDUSTRY];
  // Determine input resource status (simplified: check energy first if defined, then rare metals)
  let industryInputStatus = "Nominal";
  let primaryInputShortage = "";

  if (industrySector && industrySector.inputResourceNeeds) {
    const energyNeed = industrySector.inputResourceNeeds['energy']; // Assuming 'energy' is a string key
    const rareMetalsNeed = industrySector.inputResourceNeeds[StrategicResourceType.RARE_METALS];

    if (energyNeed !== undefined) {
      const requiredEnergyPerTick = energyNeed * (industrySector.output / 1000); // Approximation
      const availableEnergy = region.resourceProduction['energy' as any] || 0; // Assuming energy is tracked in production
      if (availableEnergy < requiredEnergyPerTick * 0.8) { // If less than 80% of need met
        industryInputStatus = "Energy Shortage";
        primaryInputShortage = `Energy: Need ~${requiredEnergyPerTick.toFixed(1)}, Prod ~${availableEnergy.toFixed(1)}`;
      }
    }
    if (primaryInputShortage === "" && rareMetalsNeed !== undefined) {
      const requiredRareMetalsPerTick = rareMetalsNeed * (industrySector.output / 1000);
      const availableRareMetals = region.resourceProduction[StrategicResourceType.RARE_METALS] || 0;
      if (availableRareMetals < requiredRareMetalsPerTick * 0.8) {
        industryInputStatus = "Rare Metals Shortage";
        primaryInputShortage = `Rare Metals: Need ~${requiredRareMetalsPerTick.toFixed(1)}, Prod ~${availableRareMetals.toFixed(1)}`;
      }
    }
  }


  return (
    <Card
      className="bg-black/85 border border-red-700 text-gray-300 military-font shadow-2xl backdrop-blur-md"
      style={panelStyle}
      onClick={(e) => e.stopPropagation()}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4">
        <div>
          <CardTitle className="text-xl text-red-400">{region.name}</CardTitle>
          <CardDescription className="text-xs text-red-300 flex items-center">
            {getBiomeIcon(region.dominantBiome)}
            {region.dominantBiome.replace('_', ' ').toUpperCase()}
          </CardDescription>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-2xl leading-none"
          aria-label="Close panel"
        >
          &times;
        </button>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ScrollArea style={{ height: 'calc(100vh - 280px)' }} className="pr-2"> {/* Adjusted height */}
          {/* Core Stats */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 text-sm">
            <div><span className="font-semibold text-gray-400">Population:</span> {(region.population / 1000000).toFixed(2)} M</div>
            <div><span className="font-semibold text-gray-400">Stability:</span> {region.stability.toFixed(1)}%</div>
            <div><span className="font-semibold text-gray-400">Health:</span> {region.health.toFixed(1)}%</div>
            <div><span className="font-semibold text-gray-400">Environment:</span> {region.environment.toFixed(1)}%</div>
            <div><span className="font-semibold text-gray-400">GDP:</span> ${(region.gdp / 1000000).toFixed(2)} M</div>
          </div>

          <Separator className="my-3 bg-red-800/50" />

          {/* Demographics */}
          <div className="mb-3">
            <h4 className="text-md font-semibold text-amber-400 mb-1 flex items-center"><Users className="w-4 h-4 mr-2"/>Demographics</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div><span className="text-gray-400">Working Age:</span> {(region.demographics.workingAgePopulation / 1000000).toFixed(2)} M</div>
              <div><span className="text-gray-400">Unemployed:</span> {(region.demographics.unemployedPopulation / 1000000).toFixed(2)} M</div>
              <div><span className="text-gray-400">Education:</span> {region.demographics.educationLevel.toFixed(1)}</div>
              <div className="flex items-center">
                <span className="text-gray-400">Birth Rate:</span>
                <TrendingUp className="w-3 h-3 mx-1 text-green-500"/>
                {(region.demographics.birthRate * 1000).toFixed(1)}/1k
              </div>
              <div className="flex items-center">
                <span className="text-gray-400">Death Rate:</span>
                <TrendingDown className="w-3 h-3 mx-1 text-red-500"/>
                {(region.demographics.deathRate * 1000).toFixed(1)}/1k
              </div>
            </div>
          </div>

          <Separator className="my-3 bg-red-800/50" />

          {/* Economy */}
          <div className="mb-3">
            <h4 className="text-md font-semibold text-green-400 mb-1 flex items-center"><Factory className="w-4 h-4 mr-2"/>Economy</h4>
            {Object.values(region.economicSectors).map(sector => (
              <div key={sector.type} className="text-xs mb-1">
                <span className="font-medium text-gray-300">{sector.type.replace('_', ' ').toUpperCase()}:</span>
                <span className="ml-1">${(sector.output / 1000000).toFixed(2)}M</span>
                <span className="ml-1 text-gray-500">(Eff: {(sector.efficiency * 100).toFixed(0)}%)</span>
                {sector.type === EconomicSectorType.INDUSTRY && (
                   <Badge variant={industryInputStatus.includes("Shortage") ? "destructive" : "secondary"} className="ml-1 text-xs">
                     {industryInputStatus}
                   </Badge>
                )}
              </div>
            ))}
             {industryInputStatus.includes("Shortage") && <p className="text-xs text-yellow-500 mt-1">{primaryInputShortage}</p>}
          </div>

          <Separator className="my-3 bg-red-800/50" />

          {/* Resource Balance (Simplified) */}
          <div>
            <h4 className="text-md font-semibold text-blue-400 mb-1 flex items-center"><ShoppingCart className="w-4 h-4 mr-2"/>Resource Balance</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {Object.values(StrategicResourceType).map(resType => {
              const demand = region.resourceDemand[resType] || 0;
              const production = region.resourceProduction[resType] || 0;
              const balance = production - demand;
              return (
                <div key={resType}>
                  <span className="text-gray-400">{resType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}: </span>
                  <span className={balance >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {balance.toFixed(1)}
                  </span>
                  <span className="text-gray-500 text-xxs"> (P:{production.toFixed(1)}/D:{demand.toFixed(1)})</span>
                </div>
              );
            })}
            </div>
          </div>

          {/* Active Events in Region - if any */}
          {region.events && region.events.filter(e => e.active).length > 0 && (
            <>
              <Separator className="my-3 bg-red-800/50" />
              <div>
                <h4 className="text-md font-semibold text-orange-400 mb-1">Active Events</h4>
                {region.events.filter(e => e.active).map(event => (
                  <div key={event.id} className="text-xs text-orange-300">
                    {event.type.replace('_',' ')} (Severity: {(event.severity*100).toFixed(0)}%)
                  </div>
                ))}
              </div>
            </>
          )}

        </ScrollArea>
      </CardContent>
    </Card>
  );
};
