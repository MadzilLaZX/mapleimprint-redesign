// Normalized graphics-asset model (Section 11, "Asset Provider Abstraction"). Studio's Graphics
// panel talks only to this interface, never to a vendor SDK/response shape directly — the same
// principle as SupplierConnector in catalogue-engine. Today exactly one provider is registered:
// MapleAssetProvider, a small set of Maple-owned, hand-built SVG marks (simple geometric icons —
// no photography, no third-party stock). Vexels/Noun Project were researched as candidates and
// deliberately NOT integrated (see PROJECT_NOTES.md's "Studio V2" entry): Vexels has no self-serve
// API and its license doesn't clearly authorize this exact use, Noun Project was scoped as a later
// secondary option. Adding either later means writing one more class implementing AssetProvider —
// nothing in the Studio UI or DesignTemplate model changes.

export interface DesignAsset {
  id: string;
  provider: string;
  providerAssetId: string;
  title: string;
  type: "graphic" | "icon";
  category: string;
  tags: string[];
  previewUrl: string;
  vectorAvailable: boolean;
  /** Whether the customer can recolor this asset in Studio (true for our flat single-path marks). */
  editableColors: boolean;
  licenseMetadata: string;
  /** What actually gets embedded into the DesignObject when placed — for the Maple provider this
   *  is the same as previewUrl (a plain SVG), but a future vendor's production asset might differ
   *  from its lightweight search-preview image (e.g. a low-res JPEG preview vs. a vector master). */
  productionSource: string;
}

export interface AssetProvider {
  id: string;
  name: string;
  search(query: string, category?: string): Promise<DesignAsset[]>;
  categories(): Promise<string[]>;
  getAsset(id: string): Promise<DesignAsset | null>;
}

function svgDataUrl(inner: string, fill = "#171412"): string {
  // A few marks (laurel, compass, snowflake, banner) hardcode their stroke colour rather than
  // inheriting the root `fill` — swap those too so "Colour" recolors the whole mark consistently.
  const recoloured = fill === "#171412" ? inner : inner.replaceAll("#171412", fill);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="${fill}">${recoloured}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Hand-built, deliberately simple single-path/shape marks — generic enough (a leaf, a star, a
// shield) that they read as basic geometric iconography rather than anyone's illustration style.
// `path` is kept separate from the rendered previewUrl so GraphicsPanel can recolor the preview
// live against `fill` without regenerating the whole asset list.
const MAPLE_GRAPHICS: { id: string; title: string; category: string; tags: string[]; path: string }[] = [
  { id: "maple-leaf", title: "Maple Leaf", category: "canadian", tags: ["canada", "leaf", "maple"], path: '<path d="M50 8 L58 30 L78 22 L68 40 L92 42 L72 54 L84 74 L60 66 L58 92 L50 72 L42 92 L40 66 L16 74 L28 54 L8 42 L32 40 L22 22 L42 30 Z"/>' },
  { id: "star-burst", title: "Star", category: "minimal", tags: ["star", "award", "badge"], path: '<path d="M50 6 L61 38 L94 38 L67 58 L78 90 L50 70 L22 90 L33 58 L6 38 L39 38 Z"/>' },
  { id: "shield", title: "Shield", category: "sports-teams", tags: ["team", "crest", "badge"], path: '<path d="M50 6 L88 20 V48 C88 72 72 88 50 96 C28 88 12 72 12 48 V20 Z"/>' },
  { id: "laurel", title: "Laurel Badge", category: "vintage", tags: ["vintage", "award", "wreath"], path: '<circle cx="50" cy="50" r="30" fill="none" stroke-width="5" stroke="#171412"/><path d="M20 50 Q10 30 20 15 M80 50 Q90 30 80 15" fill="none" stroke-width="5" stroke="#171412"/>' },
  { id: "bolt", title: "Bolt", category: "sports-teams", tags: ["energy", "sport", "fast"], path: '<path d="M56 4 L20 56 H44 L38 96 L82 40 H56 Z"/>' },
  { id: "heart", title: "Heart", category: "birthday", tags: ["love", "birthday", "event"], path: '<path d="M50 88 C10 62 6 34 26 20 C38 12 48 20 50 30 C52 20 62 12 74 20 C94 34 90 62 50 88 Z"/>' },
  { id: "mountain", title: "Mountain", category: "streetwear", tags: ["outdoor", "nature", "streetwear"], path: '<path d="M6 82 L34 34 L50 58 L64 36 L94 82 Z"/>' },
  { id: "wave", title: "Wave", category: "minimal", tags: ["water", "wave", "minimal"], path: '<path d="M4 60 Q25 40 50 60 T96 60 V90 H4 Z"/>' },
  { id: "compass", title: "Compass", category: "trades", tags: ["direction", "travel", "outdoor"], path: '<circle cx="50" cy="50" r="40" fill="none" stroke-width="5" stroke="#171412"/><path d="M50 24 L58 50 L50 76 L42 50 Z"/>' },
  { id: "wrench-gear", title: "Wrench & Gear", category: "automotive", tags: ["mechanic", "trades", "automotive"], path: '<circle cx="38" cy="62" r="18" fill="none" stroke-width="6" stroke="#171412"/><path d="M60 20 L92 52 L82 62 L50 30 Z"/>' },
  { id: "coffee-cup", title: "Coffee Cup", category: "food-cafe", tags: ["cafe", "coffee", "food"], path: '<path d="M20 30 H68 V60 C68 78 54 88 44 88 C34 88 20 78 20 60 Z"/><path d="M68 38 H80 C88 38 88 58 80 58 H68" fill="none" stroke-width="6" stroke="#171412"/>' },
  { id: "graduation-cap", title: "Graduation Cap", category: "schools", tags: ["school", "grad", "education"], path: '<path d="M50 20 L92 38 L50 56 L8 38 Z"/><path d="M28 46 V66 C28 74 68 74 72 66 V46" fill="none" stroke-width="5" stroke="#171412"/>' },
  { id: "crown", title: "Crown", category: "streetwear", tags: ["crown", "royal", "streetwear"], path: '<path d="M10 40 L28 60 L50 24 L72 60 L90 40 L84 78 H16 Z"/>' },
  { id: "paw", title: "Paw Print", category: "sports-teams", tags: ["mascot", "animal", "team"], path: '<circle cx="30" cy="34" r="10"/><circle cx="70" cy="34" r="10"/><circle cx="18" cy="58" r="8"/><circle cx="82" cy="58" r="8"/><ellipse cx="50" cy="72" rx="24" ry="18"/>' },
  { id: "snowflake", title: "Snowflake", category: "events", tags: ["winter", "seasonal", "event"], path: '<g stroke="#171412" stroke-width="6" fill="none"><path d="M50 6 V94 M12 28 L88 72 M12 72 L88 28"/></g>' },
  { id: "banner-ribbon", title: "Ribbon Banner", category: "business", tags: ["ribbon", "label", "business"], path: '<path d="M6 30 H94 L84 50 L94 70 H6 L16 50 Z" fill="none" stroke-width="5" stroke="#171412"/>' },
  { id: "hammer", title: "Hammer", category: "trades", tags: ["trades", "construction", "tools"], path: '<path d="M18 82 L52 48" stroke="#171412" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M40 26 L74 8 L92 26 L74 44 L58 40 L44 54 Z"/>' },
  { id: "paint-roller", title: "Paint Roller", category: "trades", tags: ["painting", "trades", "renovation"], path: '<rect x="16" y="20" width="68" height="26" rx="6"/><rect x="42" y="46" width="8" height="20" fill="#171412"/><rect x="30" y="66" width="32" height="22" rx="4" fill="none" stroke="#171412" stroke-width="5"/>' },
  { id: "lightning", title: "Lightning Bolt", category: "trades", tags: ["electrical", "power", "trades"], path: '<path d="M58 4 L22 54 H44 L38 96 L82 42 H56 Z"/>' },
  { id: "roof-house", title: "Roof / House", category: "trades", tags: ["roofing", "construction", "house"], path: '<path d="M6 52 L50 12 L94 52 Z"/><rect x="20" y="52" width="60" height="38" fill="none" stroke="#171412" stroke-width="6"/>' },
  { id: "fan-hvac", title: "HVAC Fan", category: "trades", tags: ["hvac", "cooling", "trades"], path: '<circle cx="50" cy="50" r="42" fill="none" stroke="#171412" stroke-width="5"/><path d="M50 50 Q70 20 50 8 Q40 30 50 50 Q80 60 92 42 Q68 38 50 50 Q80 80 60 92 Q52 66 50 50 Q20 66 8 48 Q34 46 50 50 Q20 30 32 10 Q46 32 50 50 Z"/>' },
  { id: "car-silhouette", title: "Car Silhouette", category: "automotive", tags: ["car", "automotive", "garage"], path: '<path d="M8 62 L18 38 Q26 30 40 30 H62 Q76 30 84 38 L94 62 V72 H82 A12 12 0 1 1 58 72 H42 A12 12 0 1 1 18 72 H8 Z"/><circle cx="30" cy="72" r="9" fill="#F6F1E9"/><circle cx="70" cy="72" r="9" fill="#F6F1E9"/>' },
  { id: "checkered-flag", title: "Checkered Flag", category: "automotive", tags: ["racing", "motorsport", "automotive"], path: '<rect x="16" y="10" width="12" height="84" fill="#171412"/><g fill="#171412"><rect x="28" y="10" width="12" height="12"/><rect x="52" y="10" width="12" height="12"/><rect x="40" y="22" width="12" height="12"/><rect x="64" y="22" width="12" height="12"/><rect x="28" y="34" width="12" height="12"/><rect x="52" y="34" width="12" height="12"/></g>' },
  { id: "basketball", title: "Basketball", category: "sports-teams", tags: ["basketball", "sports", "team"], path: '<circle cx="50" cy="50" r="42" fill="none" stroke="#171412" stroke-width="5"/><path d="M8 50 H92 M50 8 V92 M17 20 Q50 50 17 80 M83 20 Q50 50 83 80" fill="none" stroke="#171412" stroke-width="4"/>' },
  { id: "soccer-ball", title: "Soccer Ball", category: "sports-teams", tags: ["soccer", "football", "sports", "team"], path: '<circle cx="50" cy="50" r="42" fill="none" stroke="#171412" stroke-width="5"/><path d="M50 26 L68 40 L61 62 H39 L32 40 Z"/><path d="M50 26 V10 M68 40 L84 30 M61 62 L72 82 M39 62 L28 82 M32 40 L16 30" stroke="#171412" stroke-width="4" fill="none"/>' },
  { id: "hockey-stick", title: "Hockey Sticks", category: "sports-teams", tags: ["hockey", "sports", "team"], path: '<path d="M20 10 L34 74 Q36 84 46 84 H58" stroke="#171412" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M80 10 L66 74 Q64 84 54 84 H42" stroke="#171412" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="50" cy="60" r="7"/>' },
  { id: "baseball", title: "Baseball", category: "sports-teams", tags: ["baseball", "sports", "team"], path: '<circle cx="50" cy="50" r="42" fill="none" stroke="#171412" stroke-width="5"/><path d="M22 22 Q50 40 22 78" stroke="#171412" stroke-width="4" fill="none"/><path d="M78 22 Q50 40 78 78" stroke="#171412" stroke-width="4" fill="none"/>' },
  { id: "volleyball", title: "Volleyball", category: "sports-teams", tags: ["volleyball", "sports", "team"], path: '<circle cx="50" cy="50" r="42" fill="none" stroke="#171412" stroke-width="5"/><path d="M50 8 Q76 30 50 50 Q24 70 50 92 M8 50 Q34 40 50 50 Q66 60 92 50" stroke="#171412" stroke-width="4" fill="none"/>' },
  { id: "whistle", title: "Coach Whistle", category: "sports-teams", tags: ["coach", "sports", "team", "staff"], path: '<circle cx="34" cy="58" r="26" fill="none" stroke="#171412" stroke-width="6"/><rect x="56" y="30" width="34" height="20" rx="8"/><circle cx="34" cy="58" r="7"/>' },
  { id: "coffee-bean", title: "Coffee Bean", category: "food-cafe", tags: ["coffee", "cafe", "bean"], path: '<ellipse cx="50" cy="50" rx="34" ry="46" transform="rotate(20 50 50)"/><path d="M50 8 Q60 50 50 92" stroke="#F6F1E9" stroke-width="5" fill="none" transform="rotate(20 50 50)"/>' },
  { id: "pizza-slice", title: "Pizza Slice", category: "food-cafe", tags: ["pizza", "food", "restaurant"], path: '<path d="M50 10 L90 88 H10 Z"/><circle cx="50" cy="50" r="5" fill="#F6F1E9"/><circle cx="40" cy="68" r="5" fill="#F6F1E9"/><circle cx="60" cy="68" r="5" fill="#F6F1E9"/>' },
  { id: "croissant", title: "Bakery / Croissant", category: "food-cafe", tags: ["bakery", "pastries", "food", "cafe"], path: '<path d="M10 60 Q20 20 50 24 Q80 20 90 60 Q70 50 60 62 Q50 74 40 62 Q30 50 10 60 Z"/>' },
  { id: "burger", title: "Burger", category: "food-cafe", tags: ["burger", "food", "restaurant"], path: '<path d="M10 40 Q50 10 90 40 Z"/><rect x="10" y="44" width="80" height="10"/><rect x="10" y="58" width="80" height="10"/><path d="M14 74 Q50 92 86 74 L82 82 Q50 96 18 82 Z"/>' },
  { id: "food-truck", title: "Food Truck", category: "food-cafe", tags: ["food truck", "restaurant", "food"], path: '<rect x="8" y="32" width="58" height="34" rx="4"/><path d="M66 40 H86 L94 54 V66 H66 Z"/><circle cx="26" cy="72" r="9" fill="#F6F1E9" stroke="#171412" stroke-width="4"/><circle cx="78" cy="72" r="9" fill="#F6F1E9" stroke="#171412" stroke-width="4"/><rect x="16" y="40" width="16" height="12" fill="#F6F1E9"/>' },
  { id: "briefcase", title: "Briefcase", category: "business", tags: ["business", "office", "staff", "professional"], path: '<rect x="14" y="36" width="72" height="48" rx="6"/><path d="M38 36 V24 Q38 16 46 16 H54 Q62 16 62 24 V36" fill="none" stroke="#171412" stroke-width="6"/><rect x="44" y="56" width="12" height="10" fill="#F6F1E9"/>' },
  { id: "handshake", title: "Handshake", category: "business", tags: ["business", "service", "team", "trust"], path: '<path d="M6 46 L28 30 L48 44 L58 34 Q66 26 76 34 L94 48 L80 62 L72 56 L56 70 Q48 76 40 70 L14 54 Z" />' },
  { id: "book-open", title: "Open Book", category: "schools", tags: ["school", "education", "student", "club"], path: '<path d="M10 20 Q30 12 50 22 V84 Q30 74 10 82 Z"/><path d="M90 20 Q70 12 50 22 V84 Q70 74 90 82 Z"/>' },
  { id: "graduation-hat-2", title: "Grad Tassel Cap", category: "schools", tags: ["graduation", "grad", "class of", "school"], path: '<path d="M50 18 L92 38 L50 58 L8 38 Z"/><path d="M28 46 V66 C28 74 68 74 72 66 V46" fill="none" stroke-width="5" stroke="#171412"/><path d="M84 38 V60" stroke="#171412" stroke-width="4"/><circle cx="84" cy="64" r="4"/>' },
  { id: "balloon", title: "Balloons", category: "events", tags: ["birthday", "party", "event", "celebration"], path: '<ellipse cx="34" cy="34" rx="22" ry="26"/><ellipse cx="70" cy="30" rx="18" ry="22"/><path d="M34 60 L30 90 M70 52 L74 84" stroke="#171412" stroke-width="3" fill="none"/>' },
  { id: "confetti", title: "Confetti Burst", category: "events", tags: ["party", "celebration", "event", "fundraiser"], path: '<g><rect x="46" y="10" width="8" height="14"/><rect x="76" y="26" width="8" height="14" transform="rotate(30 80 33)"/><rect x="80" y="60" width="8" height="14" transform="rotate(60 84 67)"/><rect x="46" y="78" width="8" height="14"/><rect x="14" y="60" width="8" height="14" transform="rotate(-60 18 67)"/><rect x="12" y="26" width="8" height="14" transform="rotate(-30 16 33)"/><circle cx="50" cy="50" r="14"/></g>' },
  { id: "maple-flag", title: "Canadian Flag Block", category: "canadian", tags: ["canada", "flag", "canadian"], path: '<rect x="6" y="20" width="88" height="60" rx="4" fill="none" stroke="#171412" stroke-width="4"/><path d="M50 32 L55 45 L68 42 L61 53 L74 56 L60 62 L64 76 L50 68 L36 76 L40 62 L26 56 L39 53 L32 42 L45 45 Z"/>' },
  { id: "family-group", title: "Family Group", category: "family", tags: ["family", "reunion", "group"], path: '<circle cx="26" cy="26" r="12"/><circle cx="74" cy="26" r="12"/><circle cx="50" cy="34" r="10"/><path d="M10 90 Q10 60 26 60 Q42 60 42 90 Z"/><path d="M58 90 Q58 60 74 60 Q90 60 90 90 Z"/><path d="M32 90 Q32 66 50 66 Q68 66 68 90 Z"/>' },
  { id: "fundraiser-heart-hands", title: "Giving Hands", category: "fundraisers", tags: ["fundraiser", "charity", "volunteer", "community"], path: '<path d="M50 34 C40 18 14 24 14 46 C14 66 50 90 50 90 C50 90 86 66 86 46 C86 24 60 18 50 34 Z"/><path d="M20 60 L36 60 L44 52 L52 62 L60 50 L68 60 L80 60" fill="none" stroke="#F6F1E9" stroke-width="4"/>' },
  { id: "club-badge", title: "Club Badge", category: "clubs", tags: ["club", "society", "badge", "crest"], path: '<path d="M50 6 L90 22 V50 C90 74 72 90 50 96 C28 90 10 74 10 50 V22 Z" fill="none" stroke="#171412" stroke-width="5"/><circle cx="50" cy="46" r="16" fill="#171412"/>' },
  { id: "flame", title: "Flame", category: "streetwear", tags: ["streetwear", "urban", "bold", "fire"], path: '<path d="M50 4 C30 30 20 44 20 62 C20 82 34 96 50 96 C66 96 80 82 80 62 C80 50 74 44 68 40 C70 54 60 58 56 50 C52 42 58 30 50 4 Z" /><path d="M50 50 C44 60 44 72 50 80 C56 72 56 60 50 50 Z" fill="#F6F1E9"/>' },
  { id: "wings", title: "Memorial Wings", category: "memorial", tags: ["memorial", "in memory", "remembrance", "wings"], path: '<path d="M50 30 C36 14 8 16 4 38 C22 34 34 40 42 50 C34 48 22 52 12 62 C30 62 40 66 48 76 L50 92 L52 76 C60 66 70 62 88 62 C78 52 66 48 58 50 C66 40 78 34 96 38 C92 16 64 14 50 30 Z"/>' },
  // --- Added for the "Creative" logo-style template collection (individually-editable, reused
  // like every other mark above — see templates.ts's CREATIVE_SPECS) ---
  { id: "trophy", title: "Trophy", category: "sports-teams", tags: ["trophy", "champion", "sports", "award"], path: '<path d="M32 14 H68 V38 C68 54 58 64 50 64 C42 64 32 54 32 38 Z"/><path d="M32 20 H16 C16 36 24 42 32 42 M68 20 H84 C84 36 76 42 68 42" fill="none" stroke="#171412" stroke-width="6"/><rect x="44" y="64" width="12" height="16"/><rect x="30" y="80" width="40" height="10" rx="3"/>' },
  { id: "gear", title: "Gear", category: "trades", tags: ["gear", "mechanic", "trades", "industrial"], path: '<path d="M50 14 L56 26 L70 22 L68 36 L82 42 L72 52 L82 62 L68 68 L70 82 L56 78 L50 90 L44 78 L30 82 L32 68 L18 62 L28 52 L18 42 L32 36 L30 22 L44 26 Z"/><circle cx="50" cy="52" r="16" fill="#F6F1E9"/>' },
  { id: "pine-tree", title: "Pine Tree", category: "canadian", tags: ["outdoors", "nature", "canada", "tree", "forest"], path: '<path d="M50 6 L70 40 H60 L78 68 H64 L84 96 H16 L36 68 H22 L40 40 H30 Z"/><rect x="44" y="90" width="12" height="10"/>' },
  { id: "sun", title: "Sun", category: "canadian", tags: ["outdoors", "sun", "summer", "nature"], path: '<circle cx="50" cy="50" r="22"/><g stroke="#171412" stroke-width="6" stroke-linecap="round"><path d="M50 8 V20 M50 80 V92 M8 50 H20 M80 50 H92 M18 18 L27 27 M73 73 L82 82 M82 18 L73 27 M27 73 L18 82"/></g>' },
  { id: "wheel", title: "Wheel", category: "automotive", tags: ["automotive", "wheel", "tire", "racing"], path: '<circle cx="50" cy="50" r="42" fill="none" stroke="#171412" stroke-width="8"/><circle cx="50" cy="50" r="14"/><g stroke="#171412" stroke-width="6"><path d="M50 36 V22 M50 64 V78 M36 50 H22 M64 50 H78 M40 40 L30 30 M60 60 L70 70 M60 40 L70 30 M40 60 L30 70"/></g>' },
  { id: "speed-lines", title: "Speed Lines", category: "automotive", tags: ["automotive", "racing", "speed", "motion"], path: '<g stroke="#171412" stroke-width="7" stroke-linecap="round"><path d="M6 30 H56 M6 50 H76 M6 70 H44"/></g>' },
  { id: "torch", title: "Torch", category: "schools", tags: ["torch", "graduation", "school", "academic"], path: '<path d="M42 40 Q30 20 50 6 Q70 20 58 40 Q66 46 66 58 Q66 70 50 74 Q34 70 34 58 Q34 46 42 40 Z"/><rect x="42" y="74" width="16" height="22" rx="3"/>' },
  { id: "rings", title: "Wedding Rings", category: "events", tags: ["wedding", "rings", "event", "celebration"], path: '<circle cx="38" cy="58" r="24" fill="none" stroke="#171412" stroke-width="7"/><circle cx="62" cy="58" r="24" fill="none" stroke="#171412" stroke-width="7"/>' },
  { id: "chef-hat", title: "Chef Hat", category: "food-cafe", tags: ["chef", "restaurant", "kitchen", "food"], path: '<path d="M26 46 C18 46 12 40 12 32 C12 24 18 18 26 18 C28 10 36 4 44 4 C48 4 52 6 54 8 C58 4 64 2 70 4 C78 6 84 14 82 22 C90 24 94 30 94 38 C94 46 88 52 80 52 H26 Z"/><rect x="26" y="52" width="54" height="34" rx="4"/>' },
  { id: "wheat", title: "Wheat", category: "food-cafe", tags: ["bakery", "wheat", "grain", "food"], path: '<path d="M50 10 V90" stroke="#171412" stroke-width="5" fill="none"/><g><ellipse cx="38" cy="24" rx="9" ry="14" transform="rotate(-30 38 24)"/><ellipse cx="62" cy="24" rx="9" ry="14" transform="rotate(30 62 24)"/><ellipse cx="38" cy="44" rx="9" ry="14" transform="rotate(-30 38 44)"/><ellipse cx="62" cy="44" rx="9" ry="14" transform="rotate(30 62 44)"/><ellipse cx="38" cy="64" rx="9" ry="14" transform="rotate(-30 38 64)"/><ellipse cx="62" cy="64" rx="9" ry="14" transform="rotate(30 62 64)"/></g>' },
  { id: "crossed-tools", title: "Crossed Tools", category: "trades", tags: ["trades", "tools", "handyman", "workshop"], path: '<path d="M12 88 L58 42" stroke="#171412" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M46 20 L80 2 L98 20 L80 38 L64 34 L50 48 Z"/><path d="M88 88 L42 42" stroke="#171412" stroke-width="8" stroke-linecap="round" fill="none"/><circle cx="34" cy="34" r="12" fill="none" stroke="#171412" stroke-width="6"/>' },
  { id: "abstract-diamond", title: "Abstract Diamond", category: "streetwear", tags: ["streetwear", "abstract", "geometric", "urban"], path: '<path d="M50 4 L96 50 L50 96 L4 50 Z" fill="none" stroke="#171412" stroke-width="6"/><path d="M50 26 L74 50 L50 74 L26 50 Z"/>' },
  { id: "puck", title: "Hockey Puck", category: "sports-teams", tags: ["hockey", "puck", "sports", "team"], path: '<ellipse cx="50" cy="58" rx="40" ry="14"/><rect x="10" y="46" width="80" height="14" rx="7"/>' },
  { id: "monogram-frame", title: "Monogram Frame", category: "business", tags: ["monogram", "frame", "business", "elegant"], path: '<rect x="8" y="8" width="84" height="84" fill="none" stroke="#171412" stroke-width="4"/><rect x="18" y="18" width="64" height="64" fill="none" stroke="#171412" stroke-width="2"/>' },
];

export const MAPLE_ASSETS: DesignAsset[] = MAPLE_GRAPHICS.map((g) => ({
  id: `maple-${g.id}`,
  provider: "maple",
  providerAssetId: g.id,
  title: g.title,
  type: "graphic",
  category: g.category,
  tags: g.tags,
  previewUrl: svgDataUrl(g.path),
  vectorAvailable: true,
  editableColors: true,
  licenseMetadata: "Maple Imprint — original mark, free to use on Maple Imprint orders.",
  productionSource: svgDataUrl(g.path),
}));

export const MapleAssetProvider: AssetProvider = {
  id: "maple",
  name: "Maple",
  async categories() {
    return [...new Set(MAPLE_GRAPHICS.map((g) => g.category))];
  },
  async search(query: string, category?: string) {
    const q = query.trim().toLowerCase();
    return MAPLE_ASSETS.filter((a) => {
      const matchesCategory = !category || category === "all" || a.category === category;
      const matchesQuery = !q || a.title.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q));
      return matchesCategory && matchesQuery;
    });
  },
  async getAsset(id: string) {
    return MAPLE_ASSETS.find((a) => a.id === id) ?? null;
  },
};

/** Recolors a Maple graphic's SVG data URL — used by GraphicsPanel/inspector "Colour" control
 *  since the flat single-path marks above are otherwise fixed at their #171412 default fill. */
export function recolorMapleAsset(providerAssetId: string, fill: string): string | null {
  const g = MAPLE_GRAPHICS.find((x) => x.id === providerAssetId);
  return g ? svgDataUrl(g.path, fill) : null;
}

// A second provider now exists — OpenIconProvider (Tabler Icons / Heroicons / Bootstrap Icons, all
// MIT-licensed; see openIconProvider.ts) — kept in its own sibling file rather than imported here,
// so this file's only responsibility stays "the Maple provider + the shared AssetProvider model"
// per its top comment. GraphicsPanel.tsx queries both providers directly and merges their results;
// this array is left as the single-provider list it always was (nothing currently reads it).
export const ASSET_PROVIDERS: AssetProvider[] = [MapleAssetProvider];
