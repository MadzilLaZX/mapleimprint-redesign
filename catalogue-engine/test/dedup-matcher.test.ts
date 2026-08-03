import { describe, it, expect } from 'vitest';
import {
  matchProduct,
  scoreMatch,
  computeMatchSignals,
  nameSimilarity,
  AUTO_APPROVE_THRESHOLD,
  type MatchableMasterProduct,
  type MatchableSupplierProduct,
} from '../src/sync/dedup/matcher.js';

const bellaCanvasSSOffer: MatchableSupplierProduct = {
  brandName: 'Bella+Canvas',
  styleCode: '3001',
  productName: 'Bella+Canvas Unisex Jersey T-Shirt',
  material: 'Cotton',
  colours: ['Black', 'Navy', 'White'],
  sizes: ['S', 'M', 'L', 'XL'],
};

const bellaCanvasMaster: MatchableMasterProduct = {
  id: 'master-1',
  brandName: 'Bella+Canvas',
  styleCode: '3001',
  name: 'Bella+Canvas Unisex Jersey Tee',
  material: 'Cotton',
  colours: ['Black', 'Navy', 'White', 'Red'],
  sizes: ['S', 'M', 'L', 'XL', '2XL'],
};

const ganttMaster: MatchableMasterProduct = {
  id: 'master-2',
  brandName: 'Gildan',
  styleCode: '5000',
  name: 'Gildan Heavy Cotton Tee',
  material: 'Cotton',
  colours: ['Black', 'White'],
  sizes: ['S', 'M', 'L'],
};

describe('nameSimilarity', () => {
  it('scores identical strings at 1', () => {
    expect(nameSimilarity('Bella+Canvas Tee', 'Bella+Canvas Tee')).toBe(1);
  });

  it('scores completely unrelated strings near 0', () => {
    expect(nameSimilarity('Bella+Canvas Jersey Tee', 'Yeti Tumbler 20oz')).toBe(0);
  });
});

describe('scoreMatch — exact brand+style is high confidence, auto-approvable', () => {
  it('brand + style number match scores at or above the auto-approve threshold', () => {
    const signals = computeMatchSignals(bellaCanvasSSOffer, bellaCanvasMaster);
    const confidence = scoreMatch(signals);
    expect(confidence).toBeGreaterThanOrEqual(AUTO_APPROVE_THRESHOLD);
  });

  it('brand + UPC match (no style number) also scores at or above auto-approve', () => {
    const signals = computeMatchSignals(
      { ...bellaCanvasSSOffer, styleCode: '', upc: '012345678905' },
      { ...bellaCanvasMaster, styleCode: undefined, upc: '012345678905' },
    );
    const confidence = scoreMatch(signals);
    expect(confidence).toBeGreaterThanOrEqual(AUTO_APPROVE_THRESHOLD);
  });
});

describe('scoreMatch — weak signals never reach auto-approve', () => {
  it('different brand caps confidence hard regardless of name similarity', () => {
    const nearIdenticalName: MatchableSupplierProduct = {
      ...bellaCanvasSSOffer,
      brandName: 'SomeOtherBrand',
      productName: bellaCanvasMaster.name, // deliberately identical name, different brand
    };
    const signals = computeMatchSignals(nearIdenticalName, bellaCanvasMaster);
    const confidence = scoreMatch(signals);
    expect(confidence).toBeLessThan(AUTO_APPROVE_THRESHOLD);
    expect(confidence).toBeLessThanOrEqual(0.4);
  });

  it('same brand but no style/UPC match and weak overlap lands in the review band, not auto-approve', () => {
    const vagueOffer: MatchableSupplierProduct = {
      brandName: 'Bella+Canvas',
      styleCode: '9999', // different style
      productName: 'Bella+Canvas Something Else Entirely',
      material: 'Polyester',
      colours: ['Purple'],
      sizes: ['XS'],
    };
    const signals = computeMatchSignals(vagueOffer, bellaCanvasMaster);
    const confidence = scoreMatch(signals);
    expect(confidence).toBeLessThan(AUTO_APPROVE_THRESHOLD);
  });
});

describe('matchProduct', () => {
  it('picks the best-scoring candidate among several, and marks it auto_approved when confidence is high', () => {
    const result = matchProduct(bellaCanvasSSOffer, [ganttMaster, bellaCanvasMaster]);
    expect(result).not.toBeNull();
    expect(result!.masterProductId).toBe('master-1');
    expect(result!.status).toBe('auto_approved');
  });

  it('returns null when nothing clears even the review threshold', () => {
    const totallyUnrelated: MatchableSupplierProduct = {
      brandName: 'Yeti',
      styleCode: 'YT-20OZ',
      productName: 'Yeti Rambler Tumbler 20oz',
      colours: ['Stainless'],
      sizes: ['20oz'],
    };
    const result = matchProduct(totallyUnrelated, [bellaCanvasMaster, ganttMaster]);
    expect(result).toBeNull();
  });
});
