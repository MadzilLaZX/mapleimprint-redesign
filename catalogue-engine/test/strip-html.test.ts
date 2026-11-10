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

  it('is idempotent -- running it twice never re-decodes or further mangles already-clean text', () => {
    // A real safety property, not just a style preference: fullDescription is read, stripped at
    // export time, and could in principle be re-processed (e.g. a future re-export of data that
    // was already exported once). Running stripHtml on its own output must be a no-op.
    const inputs = [
      'WindWall&trade; fabric with a DWR&reg; finish',
      'men&#039;s fit, a &ldquo;modern&rdquo; cut',
      '<p>Line one</p><p>Line two</p>',
    ];
    for (const input of inputs) {
      const once = stripHtml(input);
      const twice = stripHtml(once);
      expect(twice).toBe(once);
    }
  });

  it('decodes &lt;/&gt; to literal visible characters without resurrecting a stripped tag', () => {
    // Order matters here: real <tag> stripping runs BEFORE &lt;/&gt; decoding, so a supplier's
    // intentional "<old style>" text (entity-encoded so it displays literally, not as a tag)
    // can never be re-interpreted as an actual tag needing removal, and a real <p> tag is already
    // gone by the time this decode step runs.
    const output = stripHtml('<p>Sizes 8&gt;10, compare &lt;old style&gt; vs new</p>');
    expect(output).toBe('Sizes 8>10, compare <old style> vs new');
  });

  it('handles a real S&S-style description (nested list/strong/span tags, already-working entities) without regression', () => {
    // Real rawPayload.description for a Puma Golf polo (S&S Activewear), fetched live
    // 2026-11-10 -- confirms the newly-added entity decoding doesn't disturb S&S's different
    // HTML shape (list/strong/span tags vs. SanMar's flatter nbsp-heavy text), which was already
    // working correctly in production before this fix.
    const real =
      '<ul><li>5.6 oz./yd² (US), 9.4 oz./L yd (CA), 85/15 polyester/cotton</li><li>Subtle heather texture</li></ul><strong><span style="text-decoration: underline;">Responsible Manufacturing</span>:</strong>&nbsp;the company that makes this product is Fair Labor Accredited.';
    const output = stripHtml(real);
    expect(output).not.toMatch(/<[a-zA-Z/]/); // every tag stripped, including nested strong/span
    expect(output).toContain('5.6 oz./yd² (US)');
    expect(output).toContain('Responsible Manufacturing:');
    expect(output).not.toMatch(/&nbsp;|&quot;/); // S&S's own already-handled entities still decode
  });
});
