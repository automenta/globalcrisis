// src/engine/components/TradeHubComponent.ts
import { BaseComponent, IComponent } from './BaseComponent';
import type { GameState, Resource } from '../GameEngine';
import type { IResourceStorageComponent } from './ResourceStorageComponent';
import type { IProductionFacilityComponent } from './ProductionFacilityComponent';
import type { IEntity } from '../entities/BaseEntity'; // Added import

export interface TradeOffer {
  resourceId: string;
  amount: number;
  pricePerUnit: number; // Proposed price for this specific offer
  isExport: boolean; // True if offering to sell (export), false if looking to buy (import)
}

export interface ITradeHubComponent extends IComponent {
  tradeRange: number; // Max distance for trade (simplified for now)
  activeExportOffers: Map<string, TradeOffer>; // resourceId -> TradeOffer
  activeImportRequests: Map<string, TradeOffer>; // resourceId -> TradeOffer
  transactionHistory: string[]; // Log of recent trades

  createExportOffer(resourceId: string, amount: number, price: number, storage: IResourceStorageComponent): boolean;
  createImportRequest(resourceId: string, amount: number, maxPrice: number): boolean;
  processTrade(gameState: GameState, otherHub: ITradeHubComponent, offer: TradeOffer, counterOffer?: TradeOffer): boolean;
  getPotentialProfit(resourceId: string, amount: number, marketPrice: number): number;
}

export class TradeHubComponent extends BaseComponent implements ITradeHubComponent {
  public readonly type = 'TradeHubComponent';
  public tradeRange: number;
  public activeExportOffers: Map<string, TradeOffer>;
  public activeImportRequests: Map<string, TradeOffer>;
  public transactionHistory: string[];
  private lastDecisionTime: number = 0;
  private decisionInterval: number = 60; // Evaluate trade opportunities every 60 game seconds

  constructor(tradeRange: number = 1) { // Default range, could be world units
    super();
    this.tradeRange = tradeRange;
    this.activeExportOffers = new Map();
    this.activeImportRequests = new Map();
    this.transactionHistory = [];
  }

  init() {
    // Potentially pre-populate some offers/requests based on entity type or faction strategy
  }

  public update(gameState: GameState, deltaTime: number): void {
    this.lastDecisionTime += deltaTime * gameState.speed;
    if (this.lastDecisionTime >= this.decisionInterval) {
        this.evaluateTradeOpportunities(gameState);
        this.lastDecisionTime = 0;
    }
  }

  private evaluateTradeOpportunities(gameState: GameState): void {
    const entity = gameState.entities.get(this.entityId);
    if (!entity) return;
    const storage = entity.getComponent<IResourceStorageComponent>('ResourceStorageComponent');
    if (!storage) return;
    const prodComp = entity.getComponent<import('./ProductionFacilityComponent').IProductionFacilityComponent>('ProductionFacilityComponent');


    // Basic AI: export surplus, import necessities
    // Make decisions about what to export or import
    gameState.resources.forEach(resource => {
        const currentAmount = storage.getResourceAmount(resource.id);
        const marketPrice = resource.currentPrice || resource.baseValue;

        // Export surplus (e.g., if more than 2x typical production cycle output or a fixed threshold)
        // This is highly simplified logic
        const surplusThreshold = 50; // Example threshold
        if (currentAmount > surplusThreshold && !this.activeExportOffers.has(resource.id)) {
            const amountToExport = Math.floor((currentAmount - surplusThreshold) / 2);
            if (amountToExport > 0) {
                this.createExportOffer(resource.id, amountToExport, marketPrice * 1.1, storage); // Sell slightly above market
            }
        }

        // Import necessities (e.g., if below a certain threshold and it's an input for a factory or food for city)
        const necessityThreshold = 10; // Example threshold
        if (currentAmount < necessityThreshold && !this.activeImportRequests.has(resource.id)) {
           // Check if this resource is an input for any production facility on this entity
           let isNeededForProduction = false;
           if (entity.entityType === "FactoryEntity" && prodComp) { // prodComp is now defined at the start of the method
               if (prodComp.recipeId) {
                   const recipe = gameState.recipes.get(prodComp.recipeId);
                   if (recipe && recipe.inputs.has(resource.id)) {
                       isNeededForProduction = true;
                   }
               }
           }
           // Or if it's food for a city
           const isFoodForCity = entity.entityType === "CityEntity" && resource.id === "food";

           if (isNeededForProduction || isFoodForCity) {
                const amountToImport = necessityThreshold * 2; // Try to stock up a bit
                this.createImportRequest(resource.id, amountToImport, marketPrice * 1.2); // Willing to pay a bit more
           }
        }
    });
  }

  public createExportOffer(resourceId: string, amount: number, price: number, storage: IResourceStorageComponent): boolean {
    if (amount <= 0 || price <= 0) return false;
    if (!storage.hasResource(resourceId, amount)) {
      // console.warn(`Entity ${this.entityId}: Cannot create export offer for ${resourceId}, insufficient amount.`);
      return false;
    }
    this.activeExportOffers.set(resourceId, { resourceId, amount, pricePerUnit: price, isExport: true });
    // console.log(`Entity ${this.entityId}: Created export offer for ${amount} of ${resourceId} at ${price} each.`);
    return true;
  }

  public createImportRequest(resourceId: string, amount: number, maxPrice: number): boolean {
    if (amount <= 0 || maxPrice <= 0) return false;
    this.activeImportRequests.set(resourceId, { resourceId, amount, pricePerUnit: maxPrice, isExport: false });
    // console.log(`Entity ${this.entityId}: Created import request for ${amount} of ${resourceId} at max price ${maxPrice}.`);
    return true;
  }

  // processTrade will be called by EconomyManager or a similar system
  // This is a simplified version where one hub is told to trade with another
  public processTrade(gameState: GameState, otherHub: ITradeHubComponent, offerToAccept: TradeOffer, counterOfferToAccept?: TradeOffer): boolean {
    const thisEntity = gameState.entities.get(this.entityId);
    const otherEntity = gameState.entities.get(otherHub.entityId);
    if (!thisEntity || !otherEntity) return false;

    const thisStorage = thisEntity.getComponent<IResourceStorageComponent>('ResourceStorageComponent');
    const otherStorage = otherEntity.getComponent<IResourceStorageComponent>('ResourceStorageComponent');
    if (!thisStorage || !otherStorage) return false;

    // This simplified version assumes 'offerToAccept' is an export from 'otherHub' that 'thisHub' wants to import
    // OR 'offerToAccept' is an import request from 'otherHub' that 'thisHub' wants to export to.

    const resourceId = offerToAccept.resourceId;
    let amountToTrade = 0;
    let agreedPrice = 0;

    if (offerToAccept.isExport) { // This hub is IMPORTING from otherHub (accepting otherHub's EXPORT offer)
        const myImportRequest = this.activeImportRequests.get(resourceId);
        if (!myImportRequest || !otherHub.activeExportOffers.has(resourceId)) return false; // No matching request or offer disappeared

        const theirExportOffer = otherHub.activeExportOffers.get(resourceId)!;
        if (myImportRequest.pricePerUnit < theirExportOffer.pricePerUnit) return false; // Too expensive

        amountToTrade = Math.min(myImportRequest.amount, theirExportOffer.amount);
        agreedPrice = theirExportOffer.pricePerUnit; // Importer accepts exporter's price if it's within their max

        if (!otherStorage.hasResource(resourceId, amountToTrade)) return false; // Exporter doesn't have it anymore

        // Transaction
        if (this.transferResourcesAndFunds(gameState, otherEntity, thisEntity, resourceId, amountToTrade, agreedPrice, otherStorage, thisStorage)) {
            // Update offers
            theirExportOffer.amount -= amountToTrade;
            if (theirExportOffer.amount <= 0) otherHub.activeExportOffers.delete(resourceId);
            myImportRequest.amount -= amountToTrade;
            if (myImportRequest.amount <= 0) this.activeImportRequests.delete(resourceId);

            this.logTransaction(gameState, `Imported ${amountToTrade} ${resourceId} from ${otherEntity.name} for ${agreedPrice * amountToTrade}`);
            otherHub.logTransaction(gameState, `Exported ${amountToTrade} ${resourceId} to ${thisEntity.name} for ${agreedPrice * amountToTrade}`);
            return true;
        }

    } else { // This hub is EXPORTING to otherHub (accepting otherHub's IMPORT request)
        const myExportOffer = this.activeExportOffers.get(resourceId);
        if (!myExportOffer || !otherHub.activeImportRequests.has(resourceId)) return false;

        const theirImportRequest = otherHub.activeImportRequests.get(resourceId)!;
        if (myExportOffer.pricePerUnit > theirImportRequest.pricePerUnit) return false; // They won't pay my price

        amountToTrade = Math.min(myExportOffer.amount, theirImportRequest.amount);
        agreedPrice = myExportOffer.pricePerUnit; // Exporter's price is accepted if within importer's max

        if (!thisStorage.hasResource(resourceId, amountToTrade)) return false;

        if (this.transferResourcesAndFunds(gameState, thisEntity, otherEntity, resourceId, amountToTrade, agreedPrice, thisStorage, otherStorage)) {
            myExportOffer.amount -= amountToTrade;
            if (myExportOffer.amount <= 0) this.activeExportOffers.delete(resourceId);
            theirImportRequest.amount -= amountToTrade;
            if (theirImportRequest.amount <= 0) otherHub.activeImportRequests.delete(resourceId);

            this.logTransaction(gameState, `Exported ${amountToTrade} ${resourceId} to ${otherEntity.name} for ${agreedPrice * amountToTrade}`);
            otherHub.logTransaction(gameState, `Imported ${amountToTrade} ${resourceId} from ${thisEntity.name} for ${agreedPrice * amountToTrade}`);
            return true;
        }
    }
    return false;
  }

  private transferResourcesAndFunds(
    gameState: GameState,
    exporterEntity: IEntity,
    importerEntity: IEntity,
    resourceId: string,
    amount: number,
    pricePerUnit: number,
    exporterStorage: IResourceStorageComponent,
    importerStorage: IResourceStorageComponent
  ): boolean {
    const totalCost = amount * pricePerUnit;
    const importerFaction = gameState.factions.get(importerEntity.factionId!);
    const exporterFaction = gameState.factions.get(exporterEntity.factionId!);

    if (!importerFaction || !exporterFaction) return false; // Factions needed for funds

    // Initialize balance if not present
    if (importerFaction.balance === undefined) importerFaction.balance = 10000; // Starting balance
    if (exporterFaction.balance === undefined) exporterFaction.balance = 10000;

    if (importerFaction.balance < totalCost) return false; // Importer can't afford
    if (!exporterStorage.removeResource(resourceId, amount)) return false; // Exporter issue

    importerStorage.addResource(resourceId, amount);
    importerFaction.balance -= totalCost;
    exporterFaction.balance += totalCost;

    return true;
  }

  public logTransaction(gameState: GameState, message: string): void {
    const logMessage = `[Tick ${gameState.time.toFixed(0)}] ${message}`;
    this.transactionHistory.unshift(logMessage);
    if (this.transactionHistory.length > 20) { // Keep last 20 transactions
      this.transactionHistory.pop();
    }
  }

  // Placeholder for a more complex profit calculation
  public getPotentialProfit(resourceId: string, amount: number, marketPrice: number): number {
    // This is naive, real profit depends on cost of production / acquisition
    return amount * marketPrice;
  }
}
