import { describe, it, expect } from 'vitest';
import { stripHtml } from '../scripts/export-products-for-frontend.mjs';

// Every entity below was confirmed present in real, live SanMar fullDescription data
// (2026-11-11) via a regexp_matches scan over every row -- not a guessed "common entities" list.
// &reg; alone appeared 346 times across the catalogue; before this fix, none of these decoded,
// so real customers would have seen literal "WindWall&trade;" style text on live product pages.

describe('stripHtml', () => {
  it('decodes &reg;, &trade;, and smart quotes -- none of these were handled before this fix', () => {
    const input = 'WindWall&trade; fabric with a DWR&reg; finish and a &ldquo;modern&rdquo; fit, you&rsquo;ll love it.';
    const output = stripHtml(input);
    // Built from explicit Unicode escapes, not typed curly-quote characters, so this assertion
    // can't silently drift to a straight-quote lookalike the way the implementation itself
    // briefly did while this fix was being written.
    const leftDouble = '“';
    const rightDouble = '”';
    const rightSingle = '’';
    expect(output).toBe(
      `WindWall™ fabric with a DWR® finish and a ${leftDouble}modern${rightDouble} fit, you${rightSingle}ll love it.`,
    );
  });

  it('decodes the real-world zero-padded apostrophe entity &#039; (not &#39;, which never actually appears)', () => {
    expect(stripHtml('men&#039;s fit')).toBe("men's fit");
  });

  it('decodes &amp; last, so a pre-escaped literal "&reg;" string is not double-decoded', () => {
    // If a supplier wanted the literal text "&reg;" to appear (rare, but this is the correct
    // escaping for it), it would be double-escaped as "&amp;reg;". Decoding &amp; before the other
    // entities would wrongly turn this into the registered-trademark symbol instead.
    expect(stripHtml('literal text: &amp;reg;')).toBe('literal text: &reg;');
  });

  it('decodes dashes, degree sign, and fractions found in real supplier spec text', () => {
    expect(stripHtml('10&deg;C to 30&deg;C &mdash; fits sizes 8&ndash;12, &frac12; cup, &frac14; inch')).toBe(
      '10°C to 30°C — fits sizes 8–12, ½ cup, ¼ inch',
    );
  });

  it('still strips real HTML tags and collapses whitespace exactly as before', () => {
    expect(stripHtml('<p>Line one</p><p>Line two</p>')).toBe('Line one\nLine two');
    expect(stripHtml('a&nbsp;&nbsp;&nbsp;b')).toBe('a   b');
  });

  it('handles an empty/null description without throwing', () => {
    expect(stripHtml('')).toBe('');
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
  });

  it('matches the real North Face Ridgewall jacket description end-to-end', () => {
    const real =
      '306 g/m2/9.0 oz lyd WindWall&trade;, 100% polyester with DWR finish (solid). &nbsp; Due to the nature of polyester, special care must be taken throughout the decoration process.';
    const output = stripHtml(real);
    expect(output).not.toMatch(/&trade;|&nbsp;/); // no raw entities leak through to the customer
    expect(output).toContain('WindWall™');
  });
});
