// Public API surface of the catalogue-engine package. Import from here (`@mapleimprint/catalogue-engine`)
// rather than reaching into individual src/ files, so internal reorganization doesn't break callers.

export type {
  SupplierConnector,
  RawSupplierProduct,
  RawSupplierVariant,
  RawSupplierImage,
  RawInventoryRecord,
  RawPriceRecord,
  LiveAvailability,
  SupplierOrderRequest,
  SupplierOrderResult,
  ShipmentStatus,
  HealthCheckResult,
} from './integrations/suppliers/contract.js';
export { NotImplementedError } from './integrations/suppliers/contract.js';
export { MockConnector, type MockCatalogueFixture } from './integrations/suppliers/mock/MockConnector.js';
export {
  SSActivewearConnector,
  type SSActivewearCredentials,
} from './integrations/suppliers/ssactivewear/SSActivewearConnector.js';
export { FilteredCatalogueConnector } from './integrations/suppliers/filtered/FilteredCatalogueConnector.js';

export {
  diffRecords,
  evaluateSafetyStop,
  DEFAULT_SAFETY_THRESHOLDS,
  type ExistingRecord,
  type IncomingRecord,
  type ChangeSummary,
  type SafetyStopThresholds,
  type SafetyStopResult,
} from './sync/change-detection.js';
export { runPriceSync, isSyncLocked, type RunPriceSyncOptions, type RunPriceSyncResult } from './sync/orchestrator.js';
export {
  runCatalogueImport,
  type RunCatalogueImportOptions,
  type RunCatalogueImportResult,
} from './sync/catalogue-import.js';
export { buildSyncReport, type SyncReportInput, type SyncReport } from './sync/report.js';
export {
  matchProduct,
  scoreMatch,
  computeMatchSignals,
  nameSimilarity,
  AUTO_APPROVE_THRESHOLD,
  REVIEW_THRESHOLD,
  type MatchableSupplierProduct,
  type MatchableMasterProduct,
  type MatchSignals,
  type MatchResult,
} from './sync/dedup/matcher.js';
export { recordMatchResult, approveMatch, rejectMatch } from './sync/dedup/review-queue.js';

export {
  calculatePrice,
  type ProductType,
  type MarkupType,
  type MarkupAppliesTo,
  type MarkupRuleInput,
  type Surcharge,
  type PriceCalculationInput,
  type PriceBreakdown,
} from './pricing/engine.js';
export { buildPricingSnapshot, type BuildSnapshotInput, type PricingSnapshotPayload } from './pricing/snapshot.js';
export {
  APPAREL_PRINT_TIERS,
  HAT_PRINT_TIERS,
  MUG_PRINT_TIERS,
  findTier,
  PRINT_RULE_VERSION,
} from './pricing/rules/seed-data.js';

export {
  getSupplierOverview,
  getCatalogueReviewCounts,
  getSyncActivity,
  getPricingRisks,
  getInventoryRisks,
  type SupplierOverviewRow,
  type CatalogueReviewCounts,
  type SyncActivitySummary,
  type PricingRisks,
  type InventoryRisks,
} from './admin/dashboard-queries.js';

export { validateImage, isDuplicateImage, type ImageValidationOptions, type ImageValidationResult } from './images/validate.js';
export { ingestImage, fetchImageBytes, type ImageFetcher, type IngestImageResult, type IngestImageOptions } from './images/ingest.js';

export {
  checkOrderAvailability,
  type OrderLineItem,
  type LineAvailability,
  type OrderAvailabilityResult,
} from './checkout/availability.js';

export {
  transitionProductStatus,
  isValidTransition,
  PRODUCT_STATUS_TRANSITIONS,
  type TransitionResult,
} from './catalogue/curation.js';
export {
  promoteSupplierProductToCatalogue,
  type PromoteToCatalogueOptions,
  type PromoteToCatalogueResult,
} from './catalogue/promote.js';
