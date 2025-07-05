import { BaseEntity } from './BaseEntity';
import type { GameState, EntityLocation, MetamodelType } from '../GameEngine';

export interface IHospitalEntityOptions {
  funding: number; // 0-1, affects efficiency, misdiagnosis rates
  localTrust: number; // 0-1, how much the local population trusts this specific hospital
  capacity: number; // Patient capacity
  currentLoad?: number; // Current patient load
}

export class HospitalEntity extends BaseEntity {
  public funding: number;
  public localTrust: number;
  public capacity: number;
  public currentLoad: number;

  constructor(
    id: string,
    name: string,
    initialLocation: EntityLocation, // Should be a specific HexTile
    options: IHospitalEntityOptions,
    factionId?: string // Usually neutral or state-controlled, player can influence via funding
  ) {
    super(id, 'hospital' as MetamodelType, initialLocation, name, factionId, 'A healthcare facility.');
    this.funding = options.funding;
    this.localTrust = options.localTrust ?? 0.6;
    this.capacity = options.capacity;
    this.currentLoad = options.currentLoad ?? 0;

    if (initialLocation.type !== 'HexTile') {
        console.warn(`HospitalEntity ${id} created with non-HexTile location type: ${initialLocation.type}. This is usually unexpected.`);
    }
  }

  update(gameState: Readonly<GameState>, deltaTime: number): void {
    // Hospitals are mostly static targets for actions (funding, experiments)
    // or sources of phenomena (misdiagnosis, ARDS).
    // console.log(`Hospital ${this.name} at ${this.location.hexCellId} updating.`);

    // Example: High load + low funding could decrease localTrust or trigger negative events.
    const overloadFactor = this.currentLoad / this.capacity;
    if (overloadFactor > 1 && this.funding < 0.3) {
        this.localTrust = Math.max(0, this.localTrust - 0.005 * deltaTime * gameState.speed * (overloadFactor -1));
        // Potentially trigger a "HospitalOverwhelmed" phenomenon
    }
  }

  administerMRNA(doses: number, type: string): void {
    console.log(`Hospital ${this.name} administering ${doses} of ${type} mRNA.`);
    // This would be an action that affects the local hex tile's population/health/suspicion.
    // Could also increase risk of ARDS if ventilators are used due to side effects.
  }

  // Called when player action "Fund Hospital" targets this entity.
  receiveFunding(amount: number): void {
    this.funding = Math.min(1, this.funding + amount);
    console.log(`Hospital ${this.name} received funding. New funding level: ${this.funding}.`);
    // Increased funding might lead to more misdiagnoses (as per design doc)
    // This could be a direct effect or trigger a phenomenon.
  }
}
