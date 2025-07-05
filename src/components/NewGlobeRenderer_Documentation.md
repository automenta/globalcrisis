# NewGlobeRenderer.ts Documentation

## 1. Purpose

`NewGlobeRenderer.ts` is a Three.js based rendering component responsible for visualizing a 3D interactive globe, including a hexagonal grid, various types of game entities, and dynamic updates based on the simulation's game state. It aims to provide a rich visual representation of the "Global Crisis Simulator."

This component replaces or redesigns previous rendering logic to offer more detailed and interactive visualizations.

## 2. Key Features

*   **3D Globe**: Renders a textured Earth, atmosphere, clouds, and a starfield.
*   **Hexagonal Grid**: Visualizes a procedurally generated hexagonal grid on the globe's surface.
    *   Hex cells are interactive (clickable).
    *   Hex cells can be dynamically styled based on game state (e.g., faction control).
*   **Entity Rendering**: Supports visualization of various entity types across different physical layers:
    *   **Satellites**: Distinct visuals with status representation.
    *   **Surface Entities**: Cities, Factories, Ground Units (e.g., Infantry).
    *   **Air Units**.
    *   **Sea Units** (basic placeholder).
    *   **Underground Units** (represented by surface markers).
*   **Interactivity**:
    *   Mouse controls for globe rotation and zoom.
    *   Click detection for hex cells and entities.
    *   Callback system (`NewGlobeRendererCallbacks`) for click events.
*   **Feedback and Indicators**:
    *   Selection highlighting for hex cells and entities.
    *   Basic status indicators (e.g., placeholder health bars) for entities.
*   **Dynamic Updates**: Visuals are updated in real-time based on changes in the `GameState`.

## 3. Core Classes/Interfaces

*   **`NewGlobeRenderer`**: The main class that manages the Three.js scene, objects, and rendering loop.
    *   `constructor(container: HTMLElement, callbacks: NewGlobeRendererCallbacks = {})`
    *   `updateCurrentGameState(gameState: GameState)`: Primary method to feed new state to the renderer.
    *   `dispose()`: Cleans up Three.js resources.
*   **`NewGlobeRendererCallbacks`**: Interface for defining callback functions for user interactions.
    *   `onHexCellClick?: (cell: HexCell, event: MouseEvent) => void;`
    *   `onEntityClick?: (entity: IEntity, event: MouseEvent) => void;`

## 4. Integration with GameState

The renderer expects `GameState` (defined in `src/engine/GameEngine.ts`) to provide data for visualization:

*   **`gameState.entities: Map<string, IEntity>`**: Used to get all active entities, their types, locations (including `PhysicsLayer`), and components (e.g., `TransformComponent`, `ISatelliteDataComponent`, `IPhysicsPropertiesComponent`).
*   **`gameState.factions: Map<string, Faction>`**: Used for styling hex cells and entities based on faction control. It's assumed that `Faction` objects have a `color: string` property (e.g., `'#RRGGBB'`).
*   **Hex Cell Data (Important Assumption)**:
    *   The renderer currently uses a placeholder `(cell as any).controllingFactionId` to determine faction ownership of a hex cell within `updateCurrentGameState`.
    *   **Ideal Implementation**: The `GameEngine` should update `HexCell` objects (managed by `HexGridManager` and accessible via `this.hexGridManager.cells`) to include properties like `controllingFactionId: string | undefined`, `biomeId: string | undefined`, etc. Alternatively, `GameState` could provide a dedicated map like `hexCellData: Map<string, { controllingFactionId?: string; /* other data */ }>` that the renderer can query using `cell.id`. This needs to be properly implemented in the game engine for dynamic hex styling to function correctly.

## 5. Entity Rendering

*   **Adding New Entity Types**:
    1.  Add a new `case` for the `entity.entityType` string in the `switch` statement within `getOrCreateEntityVisual`. Call a new `create[YourEntityType]Visual(entity)` method.
    2.  Implement `create[YourEntityType]Visual(entity)` to return a `THREE.Object3D` representing the entity.
    3.  Add a corresponding `case` in `updateEntityVisual`. Call a new `update[YourEntityType]Visual(visual, entity, transformComp, gameState)` method.
    4.  Implement `update[YourEntityType]Visual` to update the visual's properties (e.g., orientation, color based on status, animations) based on the entity's current state and components.
*   **Visual Representations**: Currently, entities are represented by simple procedural primitives (boxes, cones, cylinders). These can be replaced with more complex loaded 3D models within their respective `create...Visual` methods.

## 6. Styling and Customization

*   **Hex Cells**:
    *   `styleHexCell(cellId: string, newMaterial?: THREE.Material, newOutlineColor?: THREE.Color, isSelected?: boolean)`: Can be used externally for ad-hoc styling, but primary dynamic styling occurs in `updateCurrentGameState`.
    *   Faction colors are automatically applied if data is available (see Section 4).
    *   `defaultHexMaterial` and `selectedHexMaterial` define base and selection appearances.
*   **Entities**:
    *   Faction colors are used for base entity coloring. Specific entity types/layers might have color variations (e.g., air units are slightly lighter, sea units darker).
    *   Selection highlighting for entities is a yellow ring at their base.
*   **Status Indicators**:
    *   Basic sprite-based indicators are added as children to entity visuals.
    *   The `createStatusIndicator` and `updateStatusIndicator` methods contain placeholder logic for drawing (e.g., a green bar) and commented-out logic for dynamic updates based on a hypothetical `HealthComponent`. This needs to be fleshed out with actual game data.

## 7. Known Assumptions/Placeholders

*   **`GenericSeaUnit`**: A hypothetical `entityType` used for sea unit rendering. This should be replaced with the actual type defined in the game engine.
*   **`HealthComponent`**: Assumed for status indicators; actual component name and properties (`currentHealth`, `maxHealth`) must be used.
*   **Hex Cell Data Source**: The `(cell as any).controllingFactionId` is a placeholder. See Section 4.
*   **Faction Color Property**: Assumes `Faction` objects have a `.color` string.

## 8. Future Enhancements

*   Loading and using detailed 3D models for entities.
*   More sophisticated status indicators (e.g., icons, text).
*   Advanced visual effects for events, combat, and environmental conditions (e.g., particle systems, shaders).
*   Performance optimizations for very large numbers of entities or hexes (e.g., instancing, LODs).
*   Integration of more game state variables for richer hex cell visualization (biomes, resources, disaster impacts).
*   More nuanced lighting and shadow effects.
*   Customizable themes or visual styles.
