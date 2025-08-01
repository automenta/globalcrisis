import React from 'react';
import { WorldRegion, RegionEvent, EventType } from '../engine/GameEngine';
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
  Radio,
  Eye,
  Sword,
  Heart,
  Leaf,
  DollarSign, // For economic prosperity
  Cpu, // For technology level
  Wheat, // For food supply
  Factory, // For infrastructure
  Gem, // For rare earth elements
  Users, // For Factions
  Flag, // For Faction HQ / Influence
  BookOpen // For Ideology
} from 'lucide-react';

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
    <div className=\"space-y-2\">
      <div className=\"border-b border-red-800 pb-2 mb-2\">
        <h3 className=\"font-bold text-red-400 military-font\">{region?.name}</h3>
        <div className=\"grid grid-cols-3 gap-x-2 gap-y-1 text-xs mt-1\">
          <div>Pop: {region?.population ? (region.population / 1000000).toFixed(0) + 'M' : 'N/A'}</div>
          <div>Health: {region?.health?.toFixed(0)}%</div>
          <div>Env: {region?.environment?.toFixed(0)}%</div>
          <div>Stab: {region?.stability?.toFixed(0)}%</div>
          <div className=\"col-span-3 my-1\"><Separator variant=\"dashed\" className=\"border-red-700\"/></div>
          <div className=\"flex items-center\"><Wheat className=\"w-3 h-3 mr-1 text-lime-400\"/>Food: {region?.foodSupply?.toFixed(0)}%</div>
          <div className=\"flex items-center\"><Cpu className=\"w-3 h-3 mr-1 text-orange-400\"/>Tech: {region?.technologyLevel?.toFixed(0)}%</div>
          <div className=\"flex items-center\"><Factory className=\"w-3 h-3 mr-1 text-cyan-400\"/>Infra: {region?.infrastructureQuality?.toFixed(0)}%</div>
          <div className=\"flex items-center col-span-2\"><Gem className=\"w-3 h-3 mr-1 text-pink-400\"/>Rare Earths: {region?.rareEarthElements?.toFixed(0)}%</div>
        </div>
      </div>
      
      <div className=\"space-y-1\">
        <div className=\"text-xs text-red-300 font-semibold mb-1\">DEPLOY THREATS</div>
        <Button
          size=\"sm\"
          variant=\"destructive\"
          className=\"w-full justify-start text-xs\"
          onClick={() => handleAction('deploy', { type: EventType.NUCLEAR_STRIKE, region })}
        >
          <Target className=\"w-3 h-3 mr-1\" />
          Nuclear Strike
        </Button>
        <Button
          size=\"sm\"
          variant=\"destructive\"
          className=\"w-full justify-start text-xs\"
          onClick={() => handleAction('deploy', { type: EventType.BIOLOGICAL_WEAPON, region })}
        >
          <Skull className=\"w-3 h-3 mr-1\" />
          Biological Weapon
        </Button>
        <Button
          size=\"sm\"
          variant=\"destructive\"
          className=\"w-full justify-start text-xs\"
          onClick={() => handleAction('deploy', { type: EventType.CYBER_ATTACK, region })}
        >
          <Zap className=\"w-3 h-3 mr-1\" />
          Cyber Attack
        </Button>
        <Button
          size=\"sm\"
          variant=\"destructive\"
          className=\"w-full justify-start text-xs\"
          onClick={() => handleAction('deploy', { type: EventType.ROGUE_AI, region })}
        >
          <AlertTriangle className=\"w-3 h-3 mr-1\" />
          Rogue AI
        </Button>
        
        <Separator className=\"my-2\" />
        
        <div className=\"text-xs text-green-300 font-semibold mb-1\">DEPLOY AID</div>
        <Button
          size=\"sm\"
          variant=\"default\"
          className=\"w-full justify-start text-xs\"
          onClick={() => handleAction('deploy', { type: EventType.HEALING, region })}
        >
          <Heart className=\"w-3 h-3 mr-1\" />
          Medical Aid
        </Button>
        <Button
          size=\"sm\"
          variant=\"default\"
          className=\"w-full justify-start text-xs\"
          onClick={() => handleAction('deploy', { type: EventType.ENVIRONMENTAL_RESTORATION, region })}
        >
          <Leaf className=\"w-3 h-3 mr-1\" />
          Environmental Aid
        </Button>

        <Separator className=\"my-2\" />
        <div className=\"text-xs text-yellow-300 font-semibold mb-1\">ECONOMIC ACTIONS</div>
        <Button
          size=\"sm\"
          variant=\"outline\"
          className=\"w-full justify-start text-xs border-yellow-700 hover:bg-yellow-700/30\"
          onClick={() => handleAction('deploy', { type: EventType.TRADE_WAR, region })}
        >
          <DollarSign className=\"w-3 h-3 mr-1 text-yellow-400\" />
          Initiate Trade War
        </Button>
        <Button
          size=\"sm\"
          variant=\"outline\"
          className=\"w-full justify-start text-xs border-yellow-700 hover:bg-yellow-700/30\"
          onClick={() => handleAction('deploy', { type: EventType.RESOURCE_DISCOVERY, region })}
        >
          <Gem className=\"w-3 h-3 mr-1 text-yellow-400\" />
          Explore Resources
        </Button>
        <Button
          size=\"sm\"
          variant=\"outline\"
          className=\"w-full justify-start text-xs border-green-700 hover:bg-green-700/30\"
          onClick={() => handleAction('deploy', { type: EventType.TECHNOLOGICAL_LEAP, region })}
        >
          <Cpu className=\"w-3 h-3 mr-1 text-green-400\" />
          Invest in Technology
        </Button>
        
        <Separator className=\"my-2\" />
        
        <Button
          size=\"sm\"
          variant=\"outline\"
          className=\"w-full justify-start text-xs\"
          onClick={() => handleAction('focus', region)}
        >
          <Eye className=\"w-3 h-3 mr-1\" />
          Focus View
        </Button>
      </div>
    </div>
  );

  const renderSatelliteMenu = () => (
    <div className=\"space-y-2\">
      <div className=\"border-b border-blue-800 pb-2 mb-2\">
        <h3 className=\"font-bold text-blue-400 military-font\">{satellite?.name}</h3>
        <div className=\"flex items-center gap-2 text-xs mt-1\">
          <Badge variant={satellite?.active ? 'default' : 'destructive'} className=\"text-xs\">
            {satellite?.active ? 'ACTIVE' : 'OFFLINE'}
          </Badge>
          <Badge variant={satellite?.compromised ? 'destructive' : 'default'} className=\"text-xs\">
            {satellite?.compromised ? 'COMPROMISED' : 'SECURE'}
          </Badge>
        </div>
        <div className=\"text-xs text-gray-300 mt-1\">
          Type: {satellite?.type.toUpperCase()}
        </div>
      </div>
      
      <div className=\"space-y-1\">
        {satellite?.active && !satellite.compromised && (
          <>
            <Button
              size=\"sm\"
              variant=\"destructive\"
              className=\"w-full justify-start text-xs\"
              onClick={() => handleAction('hack', satellite)}
            >
              <Zap className=\"w-3 h-3 mr-1\" />
              Hack Satellite
            </Button>
            <Button
              size=\"sm\"
              variant=\"destructive\"
              className=\"w-full justify-start text-xs\"
              onClick={() => handleAction('destroy', satellite)}
            >
              <Target className=\"w-3 h-3 mr-1\" />
              Destroy
            </Button>
          </>
        )}
        
        {satellite?.compromised && (
          <Button
            size=\"sm\"
            variant=\"default\"
            className=\"w-full justify-start text-xs\"
            onClick={() => handleAction('restore', satellite)}
          >
            <Shield className=\"w-3 h-3 mr-1\" />
            Restore Control
          </Button>
        )}
        
        <Button
          size=\"sm\"
          variant=\"outline\"
          className=\"w-full justify-start text-xs\"
          onClick={() => handleAction('track', satellite)}
        >
          <Eye className=\"w-3 h-3 mr-1\" />
          Track Orbit
        </Button>
      </div>
    </div>
  );

  const renderEventMenu = () => (
    <div className=\"space-y-2\">
      <div className=\"border-b border-orange-800 pb-2 mb-2\">
        <h3 className=\"font-bold text-orange-400 military-font\">{event?.type.replace('_', ' ')}</h3>
        <div className=\"text-xs mt-1\">
          <div>Severity: {event?.severity ? (event.severity * 100).toFixed(0) + '%' : 'N/A'}</div>
          <div>Duration: {event?.timeLeft ? (event.timeLeft / 1000).toFixed(1) + 's' : 'N/A'}</div>
        </div>
      </div>
      
      <div className=\"space-y-1\">
        <Button
          size=\"sm\"
          variant=\"default\"
          className=\"w-full justify-start text-xs\"
          onClick={() => handleAction('counter', event)}
        >
          <Shield className=\"w-3 h-3 mr-1\" />
          Deploy Countermeasures
        </Button>
        <Button
          size=\"sm\"
          variant=\"destructive\"
          className=\"w-full justify-start text-xs\"
          onClick={() => handleAction('amplify', event)}
        >
          <Zap className=\"w-3 h-3 mr-1\" />
          Amplify Effect
        </Button>
        <Button
          size=\"sm\"
          variant=\"outline\"
          className=\"w-full justify-start text-xs\"
          onClick={() => handleAction('analyze', event)}
        >
          <Eye className=\"w-3 h-3 mr-1\" />
          Analyze Impact
        </Button>
      </div>
    </div>
  );

  return (
    <div
      className=\"fixed z-50 bg-black/90 border border-red-900 rounded-lg p-3 min-w-48 shadow-2xl backdrop-blur-sm\"
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
  gameState: any;
  onModeChange: (mode: 'chaos' | 'peace' | 'neutral') => void;
  onSpeedChange: (speed: number) => void;
  onTogglePlay: () => void;
  onReset: () => void;
  factions: any[]; // Added factions to props
}

export const TacticalOverlay: React.FC<TacticalOverlayProps> = ({
  gameState,
  onModeChange,
  onSpeedChange,
  onTogglePlay,
  onReset,
  factions // Consumed factions
}) => {
  return (
    <>
      {/* Top HUD */}
      <div className=\"absolute top-4 left-4 right-4 z-40 pointer-events-none flex flex-col space-y-4\">
        <div className=\"flex justify-between items-start space-x-4\">
          {/* Global Command Center */}
          <div className=\"bg-black/80 border border-red-900 rounded-lg p-4 backdrop-blur-sm pointer-events-auto flex-grow\">
            <h1 className=\"text-lg font-bold text-red-400 military-font mb-2 flex items-center\">
              <Target className=\"w-5 h-5 mr-2\"/>GLOBAL COMMAND CENTER
            </h1>
            <div className=\"grid grid-cols-3 gap-x-6 gap-y-3 text-sm\">
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
                <div className=\"text-purple-400 font-semibold\">Stability</div>
                <div className=\"text-white font-mono\">{gameState.globalStability?.toFixed(1)}%</div>
              </div>
              <div>
                <div className=\"text-red-400 font-semibold\">Suffering</div>
                <div className=\"text-white font-mono\">{gameState.globalSuffering?.toFixed(1)}%</div>
              </div>
              <div className=\"col-span-3 my-1\"><Separator /></div>
              <div>
                <div className=\"text-teal-400 font-semibold flex items-center\"><DollarSign className=\"w-3 h-3 mr-1\"/>Prosperity</div>
                <div className=\"text-white font-mono\">{gameState.globalEconomicProsperity?.toFixed(1)}%</div>
              </div>
              <div>
                <div className=\"text-orange-400 font-semibold flex items-center\"><Cpu className=\"w-3 h-3 mr-1\"/>Tech Level</div>
                <div className=\"text-white font-mono\">{gameState.globalTechnologyLevel?.toFixed(1)}%</div>
              </div>
              <div>
                <div className=\"text-lime-400 font-semibold flex items-center\"><Wheat className=\"w-3 h-3 mr-1\"/>Food Supply</div>
                <div className=\"text-white font-mono\">{gameState.globalFoodSupply?.toFixed(1)}%</div>
              </div>
              <div>
                <div className=\"text-cyan-400 font-semibold flex items-center\"><Factory className=\"w-3 h-3 mr-1\"/>Infrastructure</div>
                <div className=\"text-white font-mono\">{gameState.globalInfrastructureQuality?.toFixed(1)}%</div>
              </div>
              <div>
                <div className=\"text-pink-400 font-semibold flex items-center\"><Gem className=\"w-3 h-3 mr-1\"/>Rare Earths</div>
                <div className=\"text-white font-mono\">{gameState.globalRareEarthElements?.toFixed(1)}%</div>
              </div>
            </div>
          </div>
          
          {/* Orbital Status Panel */}
          <div className=\"bg-black/80 border border-red-900 rounded-lg p-4 backdrop-blur-sm pointer-events-auto w-72 flex-shrink-0\">
            <div className=\"flex items-center gap-2 mb-2\">
              <SatelliteIcon className=\"w-4 h-4 text-blue-400\" />
              <span className=\"text-sm font-semibold text-blue-400 military-font\">ORBITAL STATUS</span>
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

        {/* Factions Panel */}
        {factions && factions.length > 0 && (
          <div className=\"bg-black/80 border border-purple-700 rounded-lg p-4 backdrop-blur-sm pointer-events-auto\">
            <h2 className=\"text-lg font-bold text-purple-400 military-font mb-3 flex items-center\">
              <Users className=\"w-5 h-5 mr-2\" />
              GLOBAL FACTIONS OVERVIEW
            </h2>
            <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs max-h-48 overflow-y-auto pr-2\">
              {factions.map((faction: any) => (
                <div key={faction.id} className=\"bg-purple-900/30 border border-purple-800 p-2 rounded\">
                  <div className=\"font-semibold text-purple-300 truncate\" title={faction.name}>
                    {faction.name}
                  </div>
                  <div className=\"text-gray-400 flex items-center\">
                    <BookOpen className=\"w-3 h-3 mr-1 text-purple-500\" /> {faction.ideology}
                  </div>
                  <div className=\"text-gray-400\">
                    Power: <span className=\"font-mono text-purple-400\">{faction.powerLevel?.toFixed(0)}%</span>
                  </div>
                  <div className=\"text-gray-400 flex items-center\">
                    <Flag className=\"w-3 h-3 mr-1 text-purple-500\" /> HQ: {faction.headquartersRegion.toUpperCase()}
                  </div>
                  {/* Optional: Display top 2 relations */}
                  {/* <div className=\"text-xxs text-gray-500 mt-1\">
                    Relations: {Array.from(faction.relations.entries()).sort(([,a],[,b]) => b-a).slice(0,1).map(([id, val]) => `${id.substring(0,3)}:${val}`).join(', ')}
                  </div> */}
                </div>
              ))}
            </div>
          </div>
        )}
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