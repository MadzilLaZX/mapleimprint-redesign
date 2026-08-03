-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SupplierIntegrationType" AS ENUM ('api', 'csv_feed', 'ftp', 'manual');

-- CreateEnum
CREATE TYPE "SupplierIntegrationStatus" AS ENUM ('active', 'degraded', 'disabled', 'not_configured');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('imported', 'needs_review', 'approved', 'published', 'hidden', 'discontinued', 'blocked');

-- CreateEnum
CREATE TYPE "VariantStatus" AS ENUM ('active', 'discontinued', 'no_supplier');

-- CreateEnum
CREATE TYPE "SupplierProductStatus" AS ENUM ('active', 'discontinued_by_supplier');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('unmatched', 'auto_matched', 'needs_review', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "ImageSource" AS ENUM ('supplier', 'maple_imprint');

-- CreateEnum
CREATE TYPE "ImageIngestStatus" AS ENUM ('pending', 'downloaded', 'validated', 'published', 'rejected');

-- CreateEnum
CREATE TYPE "SyncType" AS ENUM ('full_catalogue', 'price_delta', 'inventory', 'images');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('running', 'completed', 'completed_with_warnings', 'failed', 'aborted_safety_stop');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "website" TEXT,
    "integrationType" "SupplierIntegrationType" NOT NULL DEFAULT 'manual',
    "integrationStatus" "SupplierIntegrationStatus" NOT NULL DEFAULT 'not_configured',
    "credentialsRef" TEXT,
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastFailedSyncAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentCategoryId" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterProduct" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "primaryCategoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT,
    "fullDescription" TEXT,
    "productType" TEXT NOT NULL,
    "decorationCompatibility" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PublicationStatus" NOT NULL DEFAULT 'imported',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "masterProductId" TEXT NOT NULL,
    "internalSku" TEXT NOT NULL,
    "colourName" TEXT NOT NULL,
    "normalizedColour" TEXT NOT NULL,
    "colourHex" TEXT,
    "size" TEXT NOT NULL,
    "sizeSortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "VariantStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProduct" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "masterProductId" TEXT,
    "supplierStyleCode" TEXT NOT NULL,
    "supplierBrandName" TEXT NOT NULL,
    "supplierProductName" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "matchStatus" "MatchStatus" NOT NULL DEFAULT 'unmatched',
    "matchConfidence" DOUBLE PRECISION,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "status" "SupplierProductStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierVariantOffer" (
    "id" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "supplierVariantId" TEXT NOT NULL,
    "supplierSku" TEXT NOT NULL,
    "wholesaleCost" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "mapPrice" DECIMAL(10,2),
    "isOrderable" BOOLEAN NOT NULL DEFAULT true,
    "lastPriceSyncAt" TIMESTAMP(3) NOT NULL,
    "lastInventorySyncAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierVariantOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierWarehouseInventory" (
    "id" TEXT NOT NULL,
    "supplierVariantOfferId" TEXT NOT NULL,
    "warehouseCode" TEXT NOT NULL,
    "warehouseName" TEXT,
    "availableQty" INTEGER NOT NULL,
    "incomingQty" INTEGER NOT NULL DEFAULT 0,
    "expectedRestockDate" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierWarehouseInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "masterProductId" TEXT,
    "productVariantId" TEXT,
    "supplierId" TEXT,
    "source" "ImageSource" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "cachedUrl" TEXT,
    "imageType" TEXT NOT NULL,
    "colourName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" TEXT,
    "status" "ImageIngestStatus" NOT NULL DEFAULT 'pending',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchCandidate" (
    "id" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "candidateMasterProductId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "matchSignals" JSONB NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'needs_review',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "printMethod" TEXT NOT NULL,
    "quantityMinimum" INTEGER NOT NULL,
    "quantityMaximum" INTEGER,
    "basePrintCost" DECIMAL(10,2) NOT NULL,
    "additionalLocationCost" DECIMAL(10,2),
    "oneSideCost" DECIMAL(10,2),
    "wrapAroundCost" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkupRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplierId" TEXT,
    "brandId" TEXT,
    "categoryId" TEXT,
    "productType" TEXT,
    "minimumCost" DECIMAL(10,2),
    "maximumCost" DECIMAL(10,2),
    "markupType" TEXT NOT NULL,
    "markupValue" DECIMAL(10,4) NOT NULL,
    "minimumMargin" DECIMAL(10,4),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MarkupRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualPriceAdjustment" (
    "id" TEXT NOT NULL,
    "masterProductId" TEXT,
    "variantId" TEXT,
    "adjustmentType" TEXT NOT NULL,
    "adjustmentValue" DECIMAL(10,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ManualPriceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingSnapshot" (
    "id" TEXT NOT NULL,
    "orderLineItemId" TEXT,
    "quoteLineItemId" TEXT,
    "supplierVariantOfferId" TEXT NOT NULL,
    "supplierUsed" TEXT NOT NULL,
    "wholesaleCostAtCalc" DECIMAL(10,2) NOT NULL,
    "printRuleVersion" TEXT NOT NULL,
    "markupRuleVersion" TEXT NOT NULL,
    "quantityTier" TEXT NOT NULL,
    "printLocations" INTEGER NOT NULL,
    "decorationMethod" TEXT NOT NULL,
    "surcharges" JSONB NOT NULL,
    "discounts" JSONB NOT NULL,
    "finalUnitPrice" DECIMAL(10,2) NOT NULL,
    "finalTotal" DECIMAL(10,2) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierSyncJob" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "syncType" "SyncType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'running',
    "recordsReceived" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "changeSummary" JSONB,
    "errorSummary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MasterProduct_slug_key" ON "MasterProduct"("slug");

-- CreateIndex
CREATE INDEX "MasterProduct_status_isPublished_idx" ON "MasterProduct"("status", "isPublished");

-- CreateIndex
CREATE INDEX "MasterProduct_productType_idx" ON "MasterProduct"("productType");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_internalSku_key" ON "ProductVariant"("internalSku");

-- CreateIndex
CREATE INDEX "ProductVariant_masterProductId_idx" ON "ProductVariant"("masterProductId");

-- CreateIndex
CREATE INDEX "ProductVariant_normalizedColour_size_idx" ON "ProductVariant"("normalizedColour", "size");

-- CreateIndex
CREATE INDEX "SupplierProduct_matchStatus_idx" ON "SupplierProduct"("matchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProduct_supplierId_supplierStyleCode_key" ON "SupplierProduct"("supplierId", "supplierStyleCode");

-- CreateIndex
CREATE INDEX "SupplierVariantOffer_productVariantId_idx" ON "SupplierVariantOffer"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierVariantOffer_supplierProductId_supplierVariantId_key" ON "SupplierVariantOffer"("supplierProductId", "supplierVariantId");

-- CreateIndex
CREATE INDEX "SupplierWarehouseInventory_lastSyncedAt_idx" ON "SupplierWarehouseInventory"("lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierWarehouseInventory_supplierVariantOfferId_warehouse_key" ON "SupplierWarehouseInventory"("supplierVariantOfferId", "warehouseCode");

-- CreateIndex
CREATE INDEX "ProductImage_masterProductId_sortOrder_idx" ON "ProductImage"("masterProductId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductImage_checksum_idx" ON "ProductImage"("checksum");

-- CreateIndex
CREATE INDEX "MatchCandidate_status_idx" ON "MatchCandidate"("status");

-- CreateIndex
CREATE INDEX "PricingRule_productType_printMethod_isActive_idx" ON "PricingRule"("productType", "printMethod", "isActive");

-- CreateIndex
CREATE INDEX "MarkupRule_isActive_priority_idx" ON "MarkupRule"("isActive", "priority");

-- CreateIndex
CREATE INDEX "PricingSnapshot_orderLineItemId_idx" ON "PricingSnapshot"("orderLineItemId");

-- CreateIndex
CREATE INDEX "PricingSnapshot_quoteLineItemId_idx" ON "PricingSnapshot"("quoteLineItemId");

-- CreateIndex
CREATE INDEX "SupplierSyncJob_supplierId_syncType_startedAt_idx" ON "SupplierSyncJob"("supplierId", "syncType", "startedAt");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterProduct" ADD CONSTRAINT "MasterProduct_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterProduct" ADD CONSTRAINT "MasterProduct_primaryCategoryId_fkey" FOREIGN KEY ("primaryCategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "MasterProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "MasterProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierVariantOffer" ADD CONSTRAINT "SupplierVariantOffer_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierVariantOffer" ADD CONSTRAINT "SupplierVariantOffer_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierWarehouseInventory" ADD CONSTRAINT "SupplierWarehouseInventory_supplierVariantOfferId_fkey" FOREIGN KEY ("supplierVariantOfferId") REFERENCES "SupplierVariantOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "MasterProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCandidate" ADD CONSTRAINT "MatchCandidate_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCandidate" ADD CONSTRAINT "MatchCandidate_candidateMasterProductId_fkey" FOREIGN KEY ("candidateMasterProductId") REFERENCES "MasterProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPriceAdjustment" ADD CONSTRAINT "ManualPriceAdjustment_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "MasterProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPriceAdjustment" ADD CONSTRAINT "ManualPriceAdjustment_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingSnapshot" ADD CONSTRAINT "PricingSnapshot_supplierVariantOfferId_fkey" FOREIGN KEY ("supplierVariantOfferId") REFERENCES "SupplierVariantOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSyncJob" ADD CONSTRAINT "SupplierSyncJob_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
