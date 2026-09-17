// One-off extraction script — NOT part of the app's runtime or build. Reads a curated list of
// real, individually-verified MIT-licensed SVGs out of @tabler/icons / heroicons / bootstrap-icons
// (installed as ordinary devDependencies) and writes their raw path data into a generated
// TypeScript module. Run manually with `node scripts/extract-open-source-icons.mjs` whenever the
// curated list changes; the three source packages can be uninstalled afterward without affecting
// the app, since only the extracted output is ever imported at runtime.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const TABLER_FILLED = path.join(root, "node_modules/@tabler/icons/icons/filled");
const TABLER_OUTLINE = path.join(root, "node_modules/@tabler/icons/icons/outline");
const HEROICONS = path.join(root, "node_modules/heroicons/24/solid");
const BOOTSTRAP = path.join(root, "node_modules/bootstrap-icons/icons");

// Curated selection only (STUDIO V4 brief: "Do not bulk import everything... approximately
// 100-250 GOOD assets, not 70,000"). Every filename below was verified to exist before being
// added — see the conversation's own existence-check pass; nothing here is guessed.
const TABLER_FILLED_LIST = [
  ["briefcase", "Briefcase", "business", ["business", "work", "office"]],
  ["presentation", "Presentation", "business", ["business", "meeting", "chart"]],
  ["coin", "Coin", "business", ["business", "money", "finance"]],
  ["trophy", "Trophy", "sports-teams", ["sports", "win", "award"]],
  ["school", "School", "schools", ["school", "education"]],
  ["book", "Book", "schools", ["school", "book", "education"]],
  ["car", "Car", "automotive", ["automotive", "car", "vehicle"]],
  ["engine", "Engine", "automotive", ["automotive", "engine", "mechanic"]],
  ["gas-station", "Gas Station", "automotive", ["automotive", "fuel"]],
  ["steering-wheel", "Steering Wheel", "automotive", ["automotive", "car", "drive"]],
  ["pizza", "Pizza", "food-cafe", ["food", "pizza", "cafe"]],
  ["bread", "Bread", "food-cafe", ["food", "bakery", "cafe"]],
  ["chef-hat", "Chef Hat", "food-cafe", ["food", "chef", "cafe"]],
  ["leaf", "Leaf", "nature", ["nature", "leaf", "eco"]],
  ["sun", "Sun", "nature", ["nature", "sun", "weather"]],
  ["flower", "Flower", "nature", ["nature", "flower"]],
  ["cloud", "Cloud", "nature", ["nature", "weather", "cloud"]],
  ["barbell", "Barbell", "fitness", ["fitness", "gym", "workout"]],
  ["sparkles", "Sparkles", "minimal", ["minimal", "sparkle", "shine"]],
  ["check", "Check", "arrows-symbols", ["symbol", "check", "done"]],
  ["plus", "Plus", "arrows-symbols", ["symbol", "plus", "add"]],
  ["thumb-up", "Thumbs Up", "social", ["social", "like", "thumb"]],
  ["message-circle", "Message", "social", ["social", "chat", "message"]],
  ["bell", "Bell", "social", ["social", "notification", "bell"]],
  ["camera", "Camera", "social", ["social", "photo", "camera"]],
  ["calendar-event", "Calendar", "events", ["events", "calendar", "date"]],
  ["ticket", "Ticket", "events", ["events", "ticket", "admission"]],
  ["microphone", "Microphone", "events", ["events", "mic", "speak"]],
  ["confetti", "Confetti", "events", ["events", "party", "celebration"]],
  ["dots", "Dots", "decorative-elements", ["decorative", "dots", "pattern"]],
  ["gift", "Gift", "events", ["events", "gift", "birthday"]],
  ["balloon", "Balloon", "events", ["events", "balloon", "party"]],
  ["flame", "Flame", "decorative-elements", ["decorative", "fire", "flame"]],
  ["diamond", "Diamond Icon", "decorative-elements", ["decorative", "diamond", "gem"]],
  ["crown", "Crown", "decorative-elements", ["decorative", "crown", "royal"]],
  ["compass", "Compass Icon", "trades", ["trades", "outdoor", "compass"]],
  ["map-pin", "Map Pin", "decorative-elements", ["decorative", "location", "pin"]],
  ["bulb", "Idea Bulb", "minimal", ["minimal", "idea", "bulb"]],
  ["paw", "Paw", "nature", ["nature", "animal", "paw"]],
  ["feather", "Feather", "decorative-elements", ["decorative", "feather"]],
];
const TABLER_OUTLINE_LIST = [
  ["hammer", "Hammer", "trades", ["trades", "tools", "hammer"]],
  ["helmet", "Hard Hat", "trades", ["trades", "safety", "helmet"]],
  ["building", "Building", "business", ["business", "building", "office"]],
  ["arrow-right", "Arrow Right", "arrows-symbols", ["symbol", "arrow"]],
  ["arrow-up", "Arrow Up", "arrows-symbols", ["symbol", "arrow"]],
];
const HEROICONS_LIST = [
  ["briefcase", "Briefcase Solid", "business", ["business", "work"]],
  ["building-office", "Office Building", "business", ["business", "building"]],
  ["presentation-chart-bar", "Chart Presentation", "business", ["business", "chart"]],
  ["trophy", "Trophy Solid", "sports-teams", ["sports", "win"]],
  ["academic-cap", "Graduation Cap", "schools", ["school", "graduation"]],
  ["book-open", "Open Book", "schools", ["school", "book"]],
  ["wrench-screwdriver", "Wrench & Screwdriver", "trades", ["trades", "tools"]],
  ["truck", "Truck", "automotive", ["automotive", "truck", "delivery"]],
  ["cake", "Cake", "events", ["events", "birthday", "cake"]],
  ["gift", "Gift Solid", "events", ["events", "gift"]],
  ["fire", "Fire", "decorative-elements", ["decorative", "fire"]],
  ["bell", "Bell Solid", "social", ["social", "notification"]],
  ["camera", "Camera Solid", "social", ["social", "photo"]],
  ["calendar", "Calendar Solid", "events", ["events", "calendar"]],
  ["ticket", "Ticket Solid", "events", ["events", "ticket"]],
  ["microphone", "Microphone Solid", "events", ["events", "mic"]],
  ["sparkles", "Sparkles Solid", "minimal", ["minimal", "sparkle"]],
  ["bolt", "Bolt", "fitness", ["fitness", "energy", "bolt"]],
  ["sun", "Sun Solid", "nature", ["nature", "sun"]],
  ["cloud", "Cloud Solid", "nature", ["nature", "cloud"]],
  ["heart", "Heart Solid", "decorative-elements", ["decorative", "heart", "love"]],
  ["star", "Star Solid", "decorative-elements", ["decorative", "star"]],
  ["check-circle", "Check Circle", "arrows-symbols", ["symbol", "check"]],
  ["arrow-right", "Arrow Right Solid", "arrows-symbols", ["symbol", "arrow"]],
  ["arrow-up", "Arrow Up Solid", "arrows-symbols", ["symbol", "arrow"]],
  ["plus-circle", "Plus Circle", "arrows-symbols", ["symbol", "plus"]],
  ["share", "Share", "social", ["social", "share"]],
  ["hand-thumb-up", "Thumb Up Solid", "social", ["social", "like"]],
  ["chat-bubble-left", "Chat Bubble", "social", ["social", "chat"]],
  ["musical-note", "Musical Note", "events", ["events", "music"]],
  ["beaker", "Beaker", "schools", ["school", "science"]],
  ["globe-alt", "Globe", "minimal", ["minimal", "globe", "world"]],
  ["puzzle-piece", "Puzzle Piece", "minimal", ["minimal", "puzzle"]],
  ["shield-check", "Shield Check", "trades", ["trades", "safety", "shield"]],
  ["rocket-launch", "Rocket", "decorative-elements", ["decorative", "rocket"]],
  ["light-bulb", "Light Bulb", "minimal", ["minimal", "idea"]],
];
const BOOTSTRAP_LIST = [
  ["briefcase-fill", "Briefcase Fill", "business", ["business", "work"]],
  ["building-fill", "Building Fill", "business", ["business", "building"]],
  ["trophy-fill", "Trophy Fill", "sports-teams", ["sports", "win"]],
  ["mortarboard-fill", "Mortarboard", "schools", ["school", "graduation"]],
  ["book-fill", "Book Fill", "schools", ["school", "book"]],
  ["wrench-adjustable", "Adjustable Wrench", "trades", ["trades", "tools"]],
  ["truck-front-fill", "Truck Fill", "automotive", ["automotive", "truck"]],
  ["cup-hot-fill", "Hot Cup", "food-cafe", ["food", "coffee", "cafe"]],
  ["cake2-fill", "Cake Fill", "events", ["events", "birthday", "cake"]],
  ["gift-fill", "Gift Fill", "events", ["events", "gift"]],
  ["fire", "Fire Icon", "decorative-elements", ["decorative", "fire"]],
  ["bell-fill", "Bell Fill", "social", ["social", "notification"]],
  ["camera-fill", "Camera Fill", "social", ["social", "photo"]],
  ["calendar-event-fill", "Calendar Event", "events", ["events", "calendar"]],
  ["ticket-perforated-fill", "Ticket Fill", "events", ["events", "ticket"]],
  ["mic-fill", "Mic Fill", "events", ["events", "mic"]],
  ["stars", "Stars", "minimal", ["minimal", "sparkle", "stars"]],
  ["sun-fill", "Sun Fill", "nature", ["nature", "sun"]],
  ["cloud-fill", "Cloud Fill", "nature", ["nature", "cloud"]],
  ["heart-fill", "Heart Fill", "decorative-elements", ["decorative", "heart"]],
  ["star-fill", "Star Fill", "decorative-elements", ["decorative", "star"]],
  ["check-circle-fill", "Check Circle Fill", "arrows-symbols", ["symbol", "check"]],
  ["arrow-right-circle-fill", "Arrow Right Circle", "arrows-symbols", ["symbol", "arrow"]],
  ["arrow-up-circle-fill", "Arrow Up Circle", "arrows-symbols", ["symbol", "arrow"]],
  ["plus-circle-fill", "Plus Circle Fill", "arrows-symbols", ["symbol", "plus"]],
  ["share-fill", "Share Fill", "social", ["social", "share"]],
  ["hand-thumbs-up-fill", "Thumbs Up Fill", "social", ["social", "like"]],
  ["chat-dots-fill", "Chat Dots", "social", ["social", "chat"]],
  ["music-note-beamed", "Music Note", "events", ["events", "music"]],
  ["globe", "Globe Icon", "minimal", ["minimal", "globe"]],
  ["puzzle-fill", "Puzzle Fill", "minimal", ["minimal", "puzzle"]],
  ["shield-fill-check", "Shield Check Fill", "trades", ["trades", "safety"]],
  ["rocket-takeoff-fill", "Rocket Takeoff", "decorative-elements", ["decorative", "rocket"]],
  ["lightbulb-fill", "Lightbulb Fill", "minimal", ["minimal", "idea"]],
  ["snow", "Snowflake", "events", ["events", "winter", "seasonal"]],
  ["balloon-fill", "Balloon Fill", "events", ["events", "party"]],
  ["flower1", "Flower Icon", "nature", ["nature", "flower"]],
  ["tree-fill", "Tree Fill", "nature", ["nature", "tree"]],
];

function extractSvg(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const viewBoxMatch = raw.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24";
  const inner = raw
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .trim();
  return { viewBox, inner };
}

const records = [];

function addBatch(list, dir, providerId, providerLabel, licenseUrl, sourceUrlBase) {
  for (const [file, title, category, tags] of list) {
    const full = path.join(dir, `${file}.svg`);
    const { viewBox, inner } = extractSvg(full);
    records.push({
      id: `${providerId}-${file}`,
      provider: providerId,
      providerLabel,
      providerAssetId: file,
      title,
      category,
      tags,
      viewBox,
      inner,
      licenseType: "MIT",
      licenseUrl,
      sourceUrl: `${sourceUrlBase}${file}`,
    });
  }
}

addBatch(
  TABLER_FILLED_LIST,
  TABLER_FILLED,
  "tabler",
  "Tabler Icons",
  "https://github.com/tabler/tabler-icons/blob/main/LICENSE",
  "https://tabler.io/icons/icon/",
);
addBatch(
  TABLER_OUTLINE_LIST,
  TABLER_OUTLINE,
  "tabler",
  "Tabler Icons",
  "https://github.com/tabler/tabler-icons/blob/main/LICENSE",
  "https://tabler.io/icons/icon/",
);
addBatch(
  HEROICONS_LIST,
  HEROICONS,
  "heroicons",
  "Heroicons",
  "https://github.com/tailwindlabs/heroicons/blob/master/LICENSE",
  "https://heroicons.com/",
);
addBatch(
  BOOTSTRAP_LIST,
  BOOTSTRAP,
  "bootstrap-icons",
  "Bootstrap Icons",
  "https://github.com/twbs/icons/blob/main/LICENSE",
  "https://icons.getbootstrap.com/icons/",
);

const header = `// GENERATED FILE — do not hand-edit. Produced by scripts/extract-open-source-icons.mjs from
// real, individually-curated MIT-licensed SVGs in @tabler/icons, heroicons, and bootstrap-icons
// (STUDIO V4 brief's free/open-source asset architecture). Every record's licenseType/licenseUrl/
// sourceUrl is real and verifiable — none of this is invented metadata. Re-run the script to
// regenerate after editing the curated list there.
import type { OpenSourceIconRecord } from "./assetProviders";

export const OPEN_SOURCE_ICONS: OpenSourceIconRecord[] = ${JSON.stringify(records, null, 2)};
`;

writeFileSync(path.join(root, "src/lib/studio/openSourceIcons.generated.ts"), header);
console.log(`Wrote ${records.length} icon records.`);
