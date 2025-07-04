import React from 'react';
import { WorldRegion, RegionEvent, EventType, GameState } from '../engine/GameEngine'; // Imported GameState
import { Satellite } from '../components/Earth3D';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Target, 
  Satellite as SatelliteIcon, 
  Shield, 
  Zap, 
  Skull, 
  AlertTriangle,
  Eye,
  Heart,
  Leaf,
  ScanSearch,
  WifiOff,
  Coins,
  FlaskConical,
  Atom,
  Diamond,
  Boxes,
  Droplets,
  Sparkles
} from 'lucide-react';
import { StrategicResourceType } from '../engine/definitions';

interface ContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  region?: WorldRegion;
  satellite?: Satellite;
  event?: RegionEvent;
  onClose: () => void;
  onAction: (action: string, target?: any) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  x,
  y,
  region,
  satellite,
  event,
  onClose,
  onAction
}) => {
  if (!visible) return null;

  const handleAction = (action: string, target?: any) => {
    onAction(action, target);
    onClose();
  };

  const renderRegionMenu = () => (
    <div className="space-y-2">
      <div className="border-b border-red-800 pb-2 mb-2">
        <h3 className="font-bold text-red-400 military-font">{region?.name}</h3>
        <div className="grid grid-cols-2 gap-2 text-xs mt-1">
          <div>Pop: {region?.population ? (region.population / 1000000).toFixed(0) + 'M' : 'N/A'}</div>
          <div>Health: {region?.health?.toFixed(0)}%</div>
          <div>Env: {region?.environment?.toFixed(0)}%</div>
          <div>Stab: {region?.stability?.toFixed(0)}%</div>
        </div>
      </div>
      
      <div className="space-y-1">
        <div className="text-xs text-red-300 font-semibold mb-1">DEPLOY THREATS</div>
        <Button
          size="sm"
          variant="destructive"
          className="w-full justify-start text-xs"
          onClick={() => handleAction('deploy', { type: EventType.NUCLEAR_STRIKE, region })}
        >
          <Target className="w-3 h-3 mr-1" />
          Nuclear Strike
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="w-full justify-start text-xs"
          onClick={() => handleAction('deploy', { type: EventType.BIOLOGICAL_WEAPON, region })}
        >
          <Skull className="w-3 h-3 mr-1" />
          Biological Weapon
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="w-full justify-start text-xs"
          onClick={() => handleAction('deploy', { type: EventType.CYBER_ATTACK, region })}
        >
          <Zap className="w-3 h-3 mr-1" />
          Cyber Attack
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="w-full justify-start text-xs"
          onClick={() => handleAction('deploy', { type: EventType.ROGUE_AI, region })}
        >
          <AlertTriangle className="w-3 h-3 mr-1" />
          Rogue AI
        </Button>
        
        <Separator className="my-2" />
        
        <div className="text-xs text-green-300 font-semibold mb-1">DEPLOY AID</div>
        <Button
          size="sm"
          variant="default"
          className="w-full justify-start text-xs"
          onClick={() => handleAction('deploy', { type: EventType.HEALING, region })}
        >
          <Heart className="w-3 h-3 mr-1" />
          Medical Aid
        </Button>
        <Button
          size="sm"
          variant="default"
          className="w-full justify-start text-xs"
          onClick={() => handleAction('deploy', { type: EventType.ENVIRONMENTAL_RESTORATION, region })}
        >
          <Leaf className="w-3 h-3 mr-1" />
          Environmental Aid
        </Button>
        
        <Separator className="my-2" />
        
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start text-xs"
          onClick={() => handleAction('focus', region)}
        >
          <Eye className="w-3 h-3 mr-1" />
          Focus View
        </Button>
      </div>
    </div>
  );

  const renderSatelliteMenu = () => (
    <div className="space-y-2">
      <div className="border-b border-blue-800 pb-2 mb-2">
        <h3 className="font-bold text-blue-400 military-font">{satellite?.name}</h3>
        <div className="flex items-center gap-2 text-xs mt-1">
          <Badge variant={satellite?.active ? 'default' : 'destructive'} className="text-xs">
            {satellite?.active ? 'ACTIVE' : 'OFFLINE'}
          </Badge>
          <Badge variant={satellite?.compromised ? 'destructive' : 'default'} className="text-xs">
            {satellite?.compromised ? 'COMPROMISED' : 'SECURE'}
          </Badge>
        </div>
        <div className="text-xs text-gray-300 mt-1">
          Type: {satellite?.type.toUpperCase()}
        </div>
      </div>
      
      <div className="space-y-1">
        {satellite?.active && !satellite.compromised && (
          <>
            <Button
              size="sm"
              variant="destructive"
              className="w-full justify-start text-xs"
              onClick={() => handleAction('hack', satellite)}
            >
              <Zap className="w-3 h-3 mr-1" />
              Hack Satellite
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="w-full justify-start text-xs"
              onClick={() => handleAction('destroy', satellite)}
            >
              <Target className="w-3 h-3 mr-1" />
              Destroy
            </Button>

            {/* Special satellite actions */}
            {satellite.type === 'geo_scanner' && (
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start text-xs text-cyan-400 border-cyan-700 hover:bg-cyan-900"
                onClick={() => handleAction('geo_scan_area', satellite)}
              >
                <ScanSearch className="w-3 h-3 mr-1" />
                Scan Area Resources
              </Button>
            )}
            {satellite.type === 'emp_pulser' && (
              <Button
                size="sm"
                variant="destructive"
                className="w-full justify-start text-xs"
                onClick={() => handleAction('emp_pulse_region', satellite)}
              >
                <WifiOff className="w-3 h-3 mr-1" />
                Fire EMP Pulse
              </Button>
            )}
          </>
        )}
        
        {satellite?.compromised && (
          <Button
            size="sm"
            variant="default"
            className="w-full justify-start text-xs"
            onClick={() => handleAction('restore', satellite)}
          >
            <Shield className="w-3 h-3 mr-1" />
            Restore Control
          </Button>
        )}
        
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start text-xs"
          onClick={() => handleAction('track', satellite)}
        >
          <Eye className="w-3 h-3 mr-1" />
          Track Orbit
        </Button>
      </div>
    </div>
  );

  const renderEventMenu = () => (
    <div className="space-y-2">
      <div className="border-b border-orange-800 pb-2 mb-2">
        <h3 className="font-bold text-orange-400 military-font">{event?.type.replace('_', ' ')}</h3>
        <div className="text-xs mt-1">
          <div>Severity: {event?.severity ? (event.severity * 100).toFixed(0) + '%' : 'N/A'}</div>
          <div>Duration: {event?.timeLeft ? (event.timeLeft / 1000).toFixed(1) + 's' : 'N/A'}</div>
        </div>
      </div>
      
      <div className="space-y-1">
        <Button
          size="sm"
          variant="default"
          className="w-full justify-start text-xs"
          onClick={() => handleAction('counter', event)}
        >
          <Shield className="w-3 h-3 mr-1" />
          Deploy Countermeasures
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="w-full justify-start text-xs"
          onClick={() => handleAction('amplify', event)}
        >
          <Zap className="w-3 h-3 mr-1" />
          Amplify Effect
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start text-xs"
          onClick={() => handleAction('analyze', event)}
        >
          <Eye className="w-3 h-3 mr-1" />
          Analyze Impact
        </Button>
      </div>
    </div>
  );

  return (
    <div
      className="fixed z-50 bg-black/90 border border-red-900 rounded-lg p-3 min-w-48 shadow-2xl backdrop-blur-sm"
      style={{ 
        left: Math.min(x, window.innerWidth - 200), 
        top: Math.min(y, window.innerHeight - 300),
        maxHeight: '300px',
        overflowY: 'auto'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {region && renderRegionMenu()}
      {satellite && renderSatelliteMenu()}
      {event && renderEventMenu()}
    </div>
  );
};

interface TacticalOverlayProps {
  gameState: GameState; // Changed from any to GameState
  onModeChange: (mode: 'chaos' | 'peace' | 'neutral') => void;
  onSpeedChange: (speed: number) => void;
  onTogglePlay: () => void;
  onReset: () => void;
}

export const TacticalOverlay: React.FC<TacticalOverlayProps> = ({
  gameState,
  onModeChange,
  onSpeedChange,
  onTogglePlay,
  onReset
}) => {
  return (
    <>
      {/* Top HUD */}
      <div className=\"absolute top-4 left-4 right-4 z-40 pointer-events-none\">
        <div className=\"flex justify-between items-start\">
          <div className=\"bg-black/80 border border-red-900 rounded-lg p-4 backdrop-blur-sm pointer-events-auto\">
            <h1 className=\"text-xl font-bold text-red-400 military-font mb-2\">
              GLOBAL COMMAND CENTER
            </h1>
            <div className=\"grid grid-cols-2 md:grid-cols-3 gap-4 text-sm\">
              <div>
                <div className=\"text-blue-400 font-semibold\">Population</div>
                <div className=\"text-white font-mono\">{(gameState.globalPopulation / 1000000000).toFixed(2)}B</div>
              </div>
              <div>
                <div className=\"text-green-400 font-semibold\">Health</div>
                <div className=\"text-white font-mono\">{gameState.globalHealth?.toFixed(1)}%</div>
              </div>
              <div>
                <div className=\"text-yellow-400 font-semibold\">Environment</div>
                <div className=\"text-white font-mono\">{gameState.globalEnvironment?.toFixed(1)}%</div>
              </div>
              <div>
                <div className=\"text-red-400 font-semibold\">Suffering</div>
                <div className=\"text-white font-mono\">{gameState.globalSuffering?.toFixed(1)}%</div>
              </div>

              {/* Global Resources Display */}
              <div className=\"col-span-2 md:col-span-3 mt-2 pt-2 border-t border-red-800/50\">
                <h3 className=\"text-sm font-semibold text-amber-400 mb-1 flex items-center\"><Atom className=\"w-4 h-4 mr-1\" /> Global Resources</h3>
                <div className=\"grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs\">
                  {gameState.globalResources && (
                    <>
                      <div>
                        <span className=\"text-gray-300 flex items-center\"><Coins className=\"w-3 h-3 mr-1 text-yellow-500\" /> Credits:</span>
                        <span className=\"text-white font-mono ml-1\">{Math.floor(gameState.globalResources.credits || 0)}</span>
                      </div>
                      <div>
                        <span className=\"text-gray-300 flex items-center\"><FlaskConical className=\"w-3 h-3 mr-1 text-purple-400\" /> Research:</span>
                        <span className=\"text-white font-mono ml-1\">{Math.floor(gameState.globalResources.research || 0)}</span>
                      </div>
                      {Object.values(StrategicResourceType).map(resourceType => (
                        <div key={resourceType}>
                          <span className=\"text-gray-300 flex items-center\">
                            {resourceType === StrategicResourceType.RARE_METALS && <Diamond className=\"w-3 h-3 mr-1 text-sky-400\" />}
                            {resourceType === StrategicResourceType.ANTIMATTER_CELLS && <Sparkles className=\"w-3 h-3 mr-1 text-red-500\" />}
                            {resourceType === StrategicResourceType.EXOTIC_ISOTOPES && <Sparkles className=\"w-3 h-3 mr-1 text-lime-400\" />}
                            {resourceType === StrategicResourceType.DATA_CONDUITS && <Boxes className=\"w-3 h-3 mr-1 text-blue-400\" />}
                            {resourceType === StrategicResourceType.BIOPRECURSORS && <Droplets className=\"w-3 h-3 mr-1 text-green-400\" />}
                            {![StrategicResourceType.RARE_METALS, StrategicResourceType.ANTIMATTER_CELLS, StrategicResourceType.EXOTIC_ISOTOPES, StrategicResourceType.DATA_CONDUITS, StrategicResourceType.BIOPRECURSORS].includes(resourceType as StrategicResourceType) && <Atom className="w-3 h-3 mr-1 text-gray-400" />}
                            {`${resourceType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}:`}
                          </span>
                          <span className=\"text-white font-mono ml-1\">{parseFloat(String(gameState.globalResources[resourceType] || 0)).toFixed(2)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Orbital Status Panel - Unchanged but shown for context */}
          <div className=\"bg-black/80 border border-red-900 rounded-lg p-4 backdrop-blur-sm pointer-events-auto\">
            <div className=\"flex items-center gap-2 mb-2\">
              <SatelliteIcon className=\"w-4 h-4 text-blue-400\" />
              <span className=\"text-sm font-semibold text-blue-400\">ORBITAL STATUS</span>
            </div>
            <div className=\"text-xs space-y-1\">
              <div className=\"flex justify-between\">
                <span>Military:</span>
                <span className=\"text-red-400\">8 ACTIVE</span>
              </div>
              <div className=\"flex justify-between\">
                <span>Surveillance:</span>
                <span className=\"text-yellow-400\">12 ACTIVE</span>
              </div>
              <div className=\"flex justify-between\">
                <span>Communication:</span>
                <span className=\"text-green-400\">15 ACTIVE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Panel */}
      <div className=\"absolute bottom-4 left-4 right-4 z-40 pointer-events-none\">
        <div className=\"bg-black/80 border border-red-900 rounded-lg p-4 backdrop-blur-sm pointer-events-auto\">
          <div className=\"flex items-center justify-between\">
            <div className=\"flex items-center gap-4\">
              <div className=\"flex items-center gap-2\">
                <span className=\"text-sm text-gray-300 military-font\">MODE:</span>
                <Button
                  size=\"sm\"
                  variant={gameState.mode === 'chaos' ? 'destructive' : 'outline'}
                  onClick={() => onModeChange('chaos')}
                  className=\"military-font\"
                >
                  <Skull className=\"w-3 h-3 mr-1\" />
                  CHAOS
                </Button>
                <Button
                  size=\"sm\"
                  variant={gameState.mode === 'neutral' ? 'secondary' : 'outline'}
                  onClick={() => onModeChange('neutral')}
                  className=\"military-font\"
                >
                  <Eye className=\"w-3 h-3 mr-1\" />
                  OBSERVE
                </Button>
                <Button
                  size=\"sm\"
                  variant={gameState.mode === 'peace' ? 'default' : 'outline'}
                  onClick={() => onModeChange('peace')}
                  className=\"military-font\"
                >
                  <Shield className=\"w-3 h-3 mr-1\" />
                  PEACE
                </Button>
              </div>
              
              <Separator orientation=\"vertical\" className=\"h-6\" />
              
              <div className=\"flex items-center gap-2\">
                <span className=\"text-sm text-gray-300 military-font\">SPEED:</span>
                <Button
                  size=\"sm\"
                  variant={gameState.speed === 0.5 ? 'secondary' : 'outline'}
                  onClick={() => onSpeedChange(0.5)}
                  className=\"military-font\"
                >
                  0.5x
                </Button>
                <Button
                  size=\"sm\"
                  variant={gameState.speed === 1 ? 'secondary' : 'outline'}
                  onClick={() => onSpeedChange(1)}
                  className=\"military-font\"
                >
                  1x
                </Button>
                <Button
                  size=\"sm\"
                  variant={gameState.speed === 2 ? 'secondary' : 'outline'}
                  onClick={() => onSpeedChange(2)}
                  className=\"military-font\"
                >
                  2x
                </Button>
              </div>
            </div>
            
            <div className=\"flex items-center gap-2\">
              <Button
                size=\"sm\"
                variant={gameState.running ? 'destructive' : 'default'}
                onClick={onTogglePlay}
                className=\"military-font\"
              >
                {gameState.running ? 'PAUSE' : 'START'}
              </Button>
              <Button
                size=\"sm\"
                variant=\"outline\"
                onClick={onReset}
                className=\"military-font\"
              >
                RESET
              </Button>
            </div>
            
            <div className=\"text-sm text-gray-400 font-mono\">
              T+{(gameState.time / 1000).toFixed(1)}s
            </div>
          </div>
        </div>
      </div>

      {/* Active Events Panel */}
      {gameState.activeEvents?.length > 0 && (
        <div className=\"absolute top-4 right-4 z-40 pointer-events-none\">
          <div className=\"bg-black/80 border border-orange-900 rounded-lg p-4 backdrop-blur-sm pointer-events-auto max-w-xs\">
            <h3 className=\"text-orange-400 font-bold military-font mb-2\">ACTIVE THREATS</h3>
            <div className=\"space-y-2 max-h-64 overflow-y-auto\">
              {gameState.activeEvents.slice(0, 5).map((event: RegionEvent) => (
                <div key={event.id} className=\"bg-red-900/20 border border-red-800 rounded p-2 text-xs\">
                  <div className=\"font-semibold text-red-400\">{event.type.replace('_', ' ')}</div>
                  <div className=\"text-gray-300\">
                    Severity: {(event.severity * 100).toFixed(0)}% | 
                    {(event.timeLeft / 1000).toFixed(1)}s remaining
                  </div>
                </div>
              ))}
              {gameState.activeEvents.length > 5 && (
                <div className=\"text-xs text-gray-500 text-center\">
                  +{gameState.activeEvents.length - 5} more threats...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};