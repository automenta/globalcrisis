import React, { useState } from 'react';
import { GameState, PlanetaryFacility, WorldRegion } from '../engine/GameEngine';
import { FACILITY_DEFINITIONS, FacilityType, StrategicResourceType, FACILITY_DEFINITIONS as ALL_FACILITY_DEFINITIONS } from '../engine/definitions';
import { TECH_TREE } from '../engine/Technology'; // For checking tech requirements for upgrades

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input'; // For hexagon ID input
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Building, Wrench, PlusCircle, Zap, ShieldCheck, Cpu, Atom, Landmark, MapPin } from 'lucide-react'; // Icons

interface FacilityManagementPanelProps {
  gameState: GameState;
  onBuildFacility: (facilityType: FacilityType, regionId: string, hexagonId?: string) => void;
  onUpgradeFacility: (facilityId: string, toFacilityType: FacilityType) => void;
  onClose: () => void;
  // New props for hex selection interaction
  onInitiateHexSelectionForBuilding: (facilityType: FacilityType) => void;
  targetedHexIdForBuild: string | null; // Provided by App.tsx when a hex is selected
  clearTargetedHexIdForBuild: () => void;
}

export const FacilityManagementPanel: React.FC<FacilityManagementPanelProps> = ({
  gameState,
  onBuildFacility,
  onUpgradeFacility,
  onClose,
  onInitiateHexSelectionForBuilding,
  targetedHexIdForBuild,
  clearTargetedHexIdForBuild,
}) => {
  const [selectedFacilityToBuild, setSelectedFacilityToBuild] = useState<FacilityType | ''>('');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  // targetHexagonId will now be primarily driven by targetedHexIdForBuild prop
  // but keep a local state for direct input fallback or if prop isn't immediately available.
  const [manualHexagonId, setManualHexagonId] = useState<string>('');

  const { activeFacilities, regions, globalResources, unlockedTechs, hexagonStrategicResources } = gameState;
  const unlockedTechsSet = new Set(unlockedTechs);

  const handleBuildFacility = () => {
    if (!selectedFacilityToBuild || !selectedRegionId) {
      alert("Please select a facility type and a region.");
      return;
    }
    const definition = FACILITY_DEFINITIONS[selectedFacilityToBuild];
    if (definition && selectedFacilityToBuild === FacilityType.STRATEGIC_RESOURCE_NODE && !(targetedHexIdForBuild || manualHexagonId)) {
      alert("Please specify or select a Hexagon ID for Strategic Resource Node.");
      return;
    }
    const finalHexId = selectedFacilityToBuild === FacilityType.STRATEGIC_RESOURCE_NODE ? (targetedHexIdForBuild || manualHexagonId) : undefined;
    onBuildFacility(selectedFacilityToBuild, selectedRegionId, finalHexId);

    // Reset form fields after attempt
    setSelectedFacilityToBuild('');
    setSelectedRegionId('');
    setManualHexagonId('');
    clearTargetedHexIdForBuild(); // Clear the targeted hex in App.tsx state
  };

  // Effect to update manualHexagonId when targetedHexIdForBuild changes from App.tsx
  React.useEffect(() => {
    if (targetedHexIdForBuild) {
      setManualHexagonId(targetedHexIdForBuild);
      // Potentially clear it from App.tsx immediately after consuming, or let build action do it.
      // clearTargetedHexIdForBuild(); // Decided to clear on build action
    }
  }, [targetedHexIdForBuild]);

  const getFacilityIcon = (type: FacilityType) => {
    switch (type) {
      case FacilityType.RESEARCH_OUTPOST: return <Cpu className="w-4 h-4 mr-2 text-blue-400" />;
      case FacilityType.ADVANCED_RESEARCH_LAB: return <Cpu className="w-4 h-4 mr-2 text-purple-400" />;
      case FacilityType.RESOURCE_EXTRACTOR: return <Landmark className="w-4 h-4 mr-2 text-yellow-400" />;
      case FacilityType.STRATEGIC_RESOURCE_NODE: return <Atom className="w-4 h-4 mr-2 text-green-400" />;
      case FacilityType.DEFENSE_PLATFORM: return <ShieldCheck className="w-4 h-4 mr-2 text-red-400" />;
      default: return <Building className="w-4 h-4 mr-2 text-gray-400" />;
    }
  };

  // Filter available facilities based on unlocked techs (though GameEngine handles this, UI can be smarter)
  const availableFacilitiesToBuild = Object.entries(ALL_FACILITY_DEFINITIONS)
    .filter(([_, def]) => {
        // This is a simplified check. Some facilities might be unlocked by tech effects.
        // For now, assume all defined facilities are buildable if player can afford them.
        // A more robust check would involve parsing tech tree effects for 'unlockFacility'.
        // The `strategicResourceExploitation` tech unlocks `STRATEGIC_RESOURCE_NODE`.
        if (_ as FacilityType === FacilityType.STRATEGIC_RESOURCE_NODE) {
            return unlockedTechsSet.has("strategicResourceExploitation");
        }
        // Other facilities might have their own tech requirements not explicitly listed here.
        // For now, let's assume other base facilities are available by default unless specifically locked by a tech.
        return true;
    })
    .map(([type, def]) => ({ type: type as FacilityType, def }));


  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl h-[90vh] bg-gray-900/90 border-red-800 text-gray-200 military-font">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-red-400 flex items-center"><Building className="w-6 h-6 mr-2" />FACILITY COMMAND</CardTitle>
            <CardDescription className="text-gray-400">Manage and construct planetary facilities.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-red-400 hover:text-red-200">X</Button>
        </CardHeader>

        <CardContent className="h-[calc(100%-160px)] grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Section 1: Build New Facility */}
          <div className="md:col-span-1 space-y-4 p-3 bg-gray-800/50 rounded-md border border-gray-700">
            <h3 className="text-lg font-semibold text-amber-400 border-b border-amber-600 pb-2 flex items-center">
              <PlusCircle className="w-5 h-5 mr-2"/> Construct New Facility
            </h3>

            <div>
              <Label htmlFor="facility-type" className="text-sm text-gray-300">Facility Type</Label>
              <Select value={selectedFacilityToBuild} onValueChange={(value) => setSelectedFacilityToBuild(value as FacilityType)}>
                <SelectTrigger id="facility-type" className="w-full bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Select facility type" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-red-700 text-white military-font">
                  {availableFacilitiesToBuild.map(({ type, def }) => (
                    <SelectItem key={type} value={type} className="hover:bg-red-700/50 focus:bg-red-700/50">
                      {def.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="region-select" className="text-sm text-gray-300">Target Region</Label>
              <Select value={selectedRegionId} onValueChange={setSelectedRegionId}>
                <SelectTrigger id="region-select" className="w-full bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-red-700 text-white military-font">
                  {regions.map((region: WorldRegion) => (
                    <SelectItem key={region.id} value={region.id} className="hover:bg-red-700/50 focus:bg-red-700/50">
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedFacilityToBuild === FacilityType.STRATEGIC_RESOURCE_NODE && (
              <div className="space-y-1">
                <Label htmlFor="hexagon-id" className="text-sm text-gray-300">Target Hexagon ID</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="hexagon-id"
                    type="text"
                    value={manualHexagonId} // Display the ID from prop or manual input
                    onChange={(e) => {
                        setManualHexagonId(e.target.value);
                        if (targetedHexIdForBuild) clearTargetedHexIdForBuild(); // Clear App-level target if user types manually
                    }}
                    placeholder="Click map or type ID"
                    className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-500"
                    disabled={!!targetedHexIdForBuild} // Disable if hex is selected from map until cleared
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-blue-300 border-blue-500 hover:bg-blue-700/50"
                    onClick={() => {
                        clearTargetedHexIdForBuild(); // Clear any map-selected hex
                        setManualHexagonId(''); // Clear manual input
                        onInitiateHexSelectionForBuilding(FacilityType.STRATEGIC_RESOURCE_NODE);
                        alert("Select a hexagon on the globe for the Strategic Resource Node.");
                    }}
                   >
                    Select on Globe
                  </Button>
                </div>
                {targetedHexIdForBuild && <p className="text-xs text-green-400 mt-1">Hexagon {targetedHexIdForBuild} selected from globe.</p>}
                <p className="text-xs text-gray-400 mt-1">Node must be on a resource hex. Use GeoScan.</p>
              </div>
            )}

            {selectedFacilityToBuild && FACILITY_DEFINITIONS[selectedFacilityToBuild] && (
              <div className="text-xs text-gray-400 space-y-1 p-2 bg-gray-700/50 rounded">
                <p className="font-semibold text-gray-300">Cost:</p>
                {Object.entries(FACILITY_DEFINITIONS[selectedFacilityToBuild].cost).map(([resource, amount]) => (
                  <p key={resource} className="ml-2">
                    {resource.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}: {amount}
                    <span className={(globalResources[resource] || 0) < amount ? 'text-red-500' : 'text-green-500'}>
                      {' '}(Have: {Math.floor(globalResources[resource] || 0)})
                    </span>
                  </p>
                ))}
              </div>
            )}

            <Button onClick={handleBuildFacility} className="w-full bg-red-600 hover:bg-red-500 text-white" disabled={!selectedFacilityToBuild || !selectedRegionId}>
              Initiate Construction
            </Button>
          </div>

          {/* Section 2: Active Facilities List */}
          <div className="md:col-span-2 p-1">
            <h3 className="text-lg font-semibold text-amber-400 border-b border-amber-600 pb-2 mb-3 flex items-center">
              <Zap className="w-5 h-5 mr-2"/> Active Facilities ({activeFacilities.length})
            </h3>
            <ScrollArea className="h-[calc(100%-40px)] pr-3">
              {activeFacilities.length === 0 && (
                <p className="text-gray-500 text-center py-10">No active facilities.</p>
              )}
              <div className="space-y-3">
                {activeFacilities.map((facility: PlanetaryFacility) => {
                  const definition = FACILITY_DEFINITIONS[facility.type];
                  const region = regions.find(r => r.id === facility.regionId);
                  const canUpgrade = definition.upgrades && definition.upgrades.length > 0;

                  return (
                    <Card key={facility.id} className="bg-gray-800/60 border-gray-700 hover:border-red-700/70 transition-all">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex justify-between items-center">
                           <CardTitle className="text-sm text-red-300 flex items-center">
                            {getFacilityIcon(facility.type)}
                            {definition.name}
                           </CardTitle>
                          <Badge variant={facility.operational ? "default" : "secondary"} className={`text-xs ${facility.operational ? 'bg-green-600/80 border-green-500 text-white' : 'bg-yellow-600/80 border-yellow-500 text-white animate-pulse'}`}>
                            {facility.operational ? "Operational" : `Constructing (${facility.constructionTimeLeft?.toFixed(0)}s)`}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs text-gray-400 flex items-center">
                          <MapPin className="w-3 h-3 mr-1 text-gray-500"/> {region?.name || 'Unknown Region'}
                          {facility.hexagonId && <span className="ml-2 text-cyan-400">({facility.hexagonId})</span>}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-xs px-4 pb-3 space-y-1">
                        <p className="text-gray-400">{definition.description}</p>
                        <div>
                          <span className="font-semibold text-gray-300">Effects: </span>
                          {definition.effects.map((effect, idx) => (
                            <span key={idx} className="text-gray-400 mr-2">
                              {effect.resourceYield && Object.entries(effect.resourceYield).map(([res, val]) => `${val > 0 ? '+' : ''}${val} ${res}/s`).join(', ')}
                              {effect.stabilityModifier && `Stability ${effect.stabilityModifier > 0 ? '+' : ''}${effect.stabilityModifier * 100}%`}
                            </span>
                          ))}
                          {facility.type === FacilityType.STRATEGIC_RESOURCE_NODE && facility.hexagonId && hexagonStrategicResources[facility.hexagonId] && (
                            <span className="text-green-400">Yields: {String(hexagonStrategicResources[facility.hexagonId]).replace('_', ' ')}</span>
                          )}
                        </div>
                        {canUpgrade && facility.operational && definition.upgrades?.map(upgrade => {
                           const targetDef = FACILITY_DEFINITIONS[upgrade.toFacilityType];
                           const techMet = !upgrade.techRequired || unlockedTechsSet.has(upgrade.techRequired);
                           let canAffordUpgrade = true;
                           if (upgrade.cost) {
                             for (const resource in upgrade.cost) {
                               if ((globalResources[resource] || 0) < upgrade.cost[resource]) {
                                 canAffordUpgrade = false;
                                 break;
                               }
                             }
                           }
                           const isAbleToUpgrade = techMet && canAffordUpgrade;

                           return (
                            <div key={upgrade.toFacilityType} className="mt-2 pt-2 border-t border-gray-700/50">
                                <p className="text-sm font-semibold text-purple-400">Upgrade to: {targetDef.name}</p>
                                <div className="text-xs text-gray-400">
                                    Cost: {Object.entries(upgrade.cost).map(([res,val]) => `${val} ${res}`).join(', ')}
                                    {upgrade.techRequired && (
                                        <span className={techMet ? "text-green-400" : "text-red-400"}>
                                            {techMet ? ` (Req: ${TECH_TREE[upgrade.techRequired]?.name} - Met)` : ` (Req: ${TECH_TREE[upgrade.techRequired]?.name} - Missing)`}
                                        </span>
                                    )}
                                </div>
                                <Button
                                    size="xs" // Custom size or use sm
                                    variant="outline"
                                    className="mt-1 text-purple-300 border-purple-600 hover:bg-purple-700/50 hover:text-white"
                                    onClick={() => onUpgradeFacility(facility.id, upgrade.toFacilityType)}
                                    disabled={!isAbleToUpgrade}
                                >
                                    <Wrench className="w-3 h-3 mr-1"/> Upgrade {isAbleToUpgrade ? "" : techMet ? "(Insufficient Res.)" : "(Tech Locked)"}
                                </Button>
                            </div>
                           );
                        })}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
        <CardFooter className="text-xs text-gray-500 pt-3 border-t border-red-800/50">
          <p>Facility construction and upgrades require resources and may take time. Select hexagons carefully for resource nodes.</p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default FacilityManagementPanel;
