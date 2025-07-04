import React from 'react';
import { TECH_TREE, TechNode, TechId, arePrerequisitesMet } from '../engine/Technology';
import { GameState } from '../engine/GameEngine'; // Assuming GameState is needed for unlockedTechs, currentResearch
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress'; // For research progress
import { CheckCircle, Hourglass, Lock } from 'lucide-react'; // Icons

interface TechnologyPanelProps {
  gameState: GameState;
  onStartResearch: (techId: TechId) => void; // Callback to App.tsx or parent to handle research start
  onClose: () => void;
}

export const TechnologyPanel: React.FC<TechnologyPanelProps> = ({ gameState, onStartResearch, onClose }) => {
  const { unlockedTechs, currentResearch, globalResources } = gameState;
  const unlockedTechsSet = new Set(unlockedTechs);

  const handleResearchClick = (techId: TechId) => {
    onStartResearch(techId);
  };

  // Simple grid layout for now. A real tree might use absolute positioning based on uiPosition.
  // Sort techs by tier (number of prerequisites) and then by name for a somewhat organized view.
  const sortedTechs = Object.values(TECH_TREE).sort((a, b) => {
    const tierA = a.prerequisites.length;
    const tierB = b.prerequisites.length;
    if (tierA !== tierB) {
      return tierA - tierB;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-[90vh] bg-gray-900/90 border-red-800 text-gray-200 military-font">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-red-400">TECHNOLOGY TREE</CardTitle>
            <CardDescription className="text-gray-400">Unlock new abilities and facilities.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-red-400 hover:text-red-200">X</Button>
        </CardHeader>
        <CardContent className="h-[calc(100%-160px)]"> {/* Adjusted height for header and footer */}
          <ScrollArea className="h-full pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedTechs.map((tech: TechNode) => {
                const isUnlocked = unlockedTechsSet.has(tech.id);
                const isResearching = currentResearch?.techId === tech.id;
                const prereqsMet = arePrerequisitesMet(tech.id, unlockedTechsSet);

                let canResearch = !isUnlocked && !isResearching && prereqsMet;
                // Check resource costs (only research points for now, can be expanded)
                if (tech.cost.research > (globalResources.research || 0) && canResearch) {
                  // This check is for upfront cost. If research is consumed over time, this might be different.
                  // For now, let's assume the button is disabled if not enough current research points for the *total* cost.
                  // This might need adjustment based on how GameEngine handles research point deduction.
                  // The provided GameEngine seems to deduct over time, so this check might be too strict or misinterpreted.
                  // Let's assume the player needs to have enough to start, or it's illustrative.
                  // For a "cost over time" system, this check might be removed or changed to "can afford first tick".
                  // GameEngine.startResearch doesn't check resource amount, only prerequisites.
                  // So, canResearch should not depend on globalResources.research for *starting*.
                  // The progress will depend on it.
                }

                let statusIcon = <Lock className="w-4 h-4 text-gray-500" />;
                if (isUnlocked) statusIcon = <CheckCircle className="w-4 h-4 text-green-400" />;
                else if (isResearching) statusIcon = <Hourglass className="w-4 h-4 text-yellow-400 animate-spin" />;
                else if (prereqsMet) statusIcon = <CheckCircle className="w-4 h-4 text-blue-400" />; // Can be researched

                return (
                  <Card key={tech.id} className={`bg-gray-800/70 border-gray-700 hover:border-red-700 transition-all
                    ${isUnlocked ? 'border-green-600' : ''}
                    ${isResearching ? 'border-yellow-600 animate-pulse' : ''}
                  `}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-sm text-red-300 flex items-center">
                          {statusIcon}
                          <span className="ml-2">{tech.name}</span>
                        </CardTitle>
                        {isUnlocked && <Badge variant="outline" className="text-xs border-green-500 text-green-400">Unlocked</Badge>}
                        {isResearching && <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-400">Researching</Badge>}
                      </div>
                      <CardDescription className="text-xs text-gray-400 pt-1">{tech.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs space-y-2">
                      <div>
                        <span className="font-semibold text-gray-300">Cost: </span>
                        {Object.entries(tech.cost).map(([resource, amount]) => (
                          <span key={resource} className="mr-2 text-amber-400">{amount} {resource}</span>
                        ))}
                      </div>
                      {tech.prerequisites.length > 0 && (
                        <div>
                          <span className="font-semibold text-gray-300">Requires: </span>
                          {tech.prerequisites.map(prereqId => {
                            const prereqTech = TECH_TREE[prereqId];
                            const met = unlockedTechsSet.has(prereqId);
                            return (
                              <Badge key={prereqId} variant={met ? "default" : "destructive"} className={`text-xs mr-1 ${met ? 'bg-blue-600' : 'bg-red-700'}`}>
                                {prereqTech?.name || prereqId}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      {tech.effects.length > 0 && (
                        <div>
                          <span className="font-semibold text-gray-300">Effects:</span>
                          <ul className="list-disc list-inside pl-1 text-gray-400">
                            {tech.effects.map((effect, index) => (
                              <li key={index} className="text-xs">
                                {effect.unlockFacility && `Unlocks Facility: ${effect.unlockFacility.replace('_', ' ')}`}
                                {effect.globalResourceModifier && `Global ${effect.globalResourceModifier.resource} x${effect.globalResourceModifier.modifier}`}
                                {effect.eventResistance && `${effect.eventResistance.eventType} resistance`}
                                {/* Add more effect descriptions here */}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {isResearching && currentResearch && tech.cost.research > 0 && (
                        <div>
                          <Progress value={(currentResearch.progress / tech.cost.research) * 100} className="h-2 mt-1 bg-gray-700 border border-yellow-700" indicatorClassName="bg-yellow-500" />
                          <p className="text-center text-xs text-yellow-300 mt-0.5">
                            {Math.floor(currentResearch.progress)} / {tech.cost.research} RP
                          </p>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => handleResearchClick(tech.id)}
                        disabled={!canResearch || isUnlocked || isResearching}
                        variant={prereqsMet && !isUnlocked && !isResearching ? "default" : "outline"}
                      >
                        {isUnlocked ? "Unlocked" : isResearching ? "Researching..." : prereqsMet ? "Start Research" : "Locked (Prereqs)"}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="text-xs text-gray-500 pt-3 border-t border-red-800/50">
          <p>Current Research Points: <span className="text-amber-300 font-mono">{Math.floor(globalResources.research || 0)}</span>. Research progress depends on available research points and active research facilities.</p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default TechnologyPanel;
