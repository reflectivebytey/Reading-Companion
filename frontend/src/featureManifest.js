import { HELP_GUIDE } from "./helpGuide.js";

const PATHS = {
  dashboard: "Home",
  library: "Library",
  gems: "Gems",
  memory: "Memory",
  profile: "Profile",
  settings: "Profile → Settings",
  report: "Profile → Report an issue",
};

const TECHNICAL_BACKGROUND = {
  "add-book": "The selected title, author role, chapter list and page numbers are saved with the book on this device and in the signed-in reader's account snapshot when cloud sync is enabled. Contents photos are processed for chapter extraction; they are not reading-session page snapshots.",
  "search-book": "Search uses the book lookup API and the catalogue's public metadata. A reader reviews the selected edition and chapters before the book is saved; a contents image is only sent when the reader asks to scan it.",
  "session-mic": "The microphone state is session-local. When muted, automatic audio, images, Live messages, classifier requests and reconnects stop. After 30 seconds, microphone tracks and the Live connection are released; unmuting reacquires the mic and retries voice. The elapsed session timer continues while muted, so those seconds still count toward the daily allowance and Arena.",
  "session-buttons": "The microphone mute state resets when a new session starts. The message button starts or stops an explicit voice Tap to ask turn. A saved page snapshot remains local context until replaced or the session ends.",
  "camera-options": "The newest page snapshot is kept locally for the active reading context and replaced by the next snapshot. The page-verification endpoint checks the submitted still image before it can be used as reading context.",
  "reader-arena": "Accepted active-reading seconds are sent to the backend in bounded batches and recorded through the reading-usage RPC. The Arena response contains public aggregate name, rank and time only; it excludes private account identifiers and email. Weekly figures use the existing Asia/Kolkata week boundary.",
  "daily-reading-limit": "The account allowance is read and updated through the reading-quota API and the `record_reading_companion_session_usage` RPC. Pending seconds are kept locally until they can be recorded. The unchanged reset follows the UTC date boundary, which is 05:30 IST; muted session seconds continue counting.",
  "gem-detail": "Template, palette and artwork preferences are saved in local storage. Quote cards are rendered in the browser and exported as a 1080 × 1920 PNG; no card-render request is sent to the backend.",
  "contact-developer": "A request is assembled in the browser with `buildDeveloperEmail`; the mail app or browser handles composition and sending. The app cannot force the sending account. Copy is the local fallback; no email is sent automatically.",
  "docs-helper": "The owner-gated Docs screen loads its corpus from `/api/docs/content`; questions are sent to `/api/docs/ask` and matched against published chunks. Docs corpus records are stored in Supabase `docs_content`. The owner access gate is unchanged.",
  "account-sync": "The signed-in Supabase session authenticates cloud snapshot reads and writes. The device keeps its local copy and can continue offline; sync errors remain visible to the reader.",
  notifications: "Push subscription details are stored for the signed-in reader and sent to the app backend when they enable notifications. The operating system controls permission and delivery.",
  updates: "Release notes are read from the app's bundled `release-notes.json`. Update availability and push delivery depend on the app deployment and the reader's notification settings.",
};

const EXTRA_ALIASES = {
  "reader-arena": ["leaderboard", "padhai ranking", "hafte ki race", "is hafte ka rank", "reading race"],
  "daily-reading-limit": ["daily limit", "30 minutes", "roz ki limit", "padhne ki limit", "time limit", "05:30 IST"],
  "contact-developer": ["dev se contact", "developer ko email", "zyada time maangna", "mail to developer"],
  "gem-detail": ["gem card templates", "instagram story", "whatsapp status", "quote card", "twitter card"],
  "session-mic": ["mute mic", "unmute mic", "mic band", "awaaz band", "mic chalu"],
  "add-book": ["manual add book", "contents page", "book ke chapters", "adhyay"],
};

const RELATED = {
  "reader-arena": ["profile", "daily-reading-limit", "settings-data"],
  "daily-reading-limit": ["session-mic", "contact-developer", "reader-arena"],
  "session-mic": ["session-buttons", "camera-options", "daily-reading-limit"],
  "gem-detail": ["gems", "memory", "release-2-5-1"],
  "add-book": ["search-book", "chapters", "session-overview"],
  "search-book": ["add-book", "chapters"],
  "contact-developer": ["daily-reading-limit", "docs-access", "report-issue"],
};

function plainText(value) {
  return String(value || "").replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim();
}

function getSteps(content) {
  const sentences = plainText(content).split(/(?<=[.!?])\s+/u).filter(Boolean);
  return sentences.length ? sentences.slice(0, 6) : [plainText(content)];
}

export const FEATURE_MANIFEST = HELP_GUIDE.map((entry) => ({
  id: entry.id,
  name: entry.title,
  screen: entry.screen,
  where: PATHS[entry.screen] || "Profile",
  purpose: plainText(entry.content),
  steps: getSteps(entry.content),
  technicalBackground: TECHNICAL_BACKGROUND[entry.id] || "The reader guide documents the visible behavior for this section. No additional storage or network behavior is claimed here unless it is stated above.",
  aliases: [...new Set([entry.title, ...(entry.keywords || []), ...(EXTRA_ALIASES[entry.id] || [])])],
  relatedFeatures: RELATED[entry.id] || [],
  animationId: `feature-${entry.id}`,
}));

export function buildFeatureDocsPages(manifest = FEATURE_MANIFEST) {
  return manifest.map((feature) => ({
    id: feature.id,
    title: feature.name,
    group: "Product tour",
    summary: `Find it at ${feature.where}. ${feature.purpose} Search terms: ${feature.aliases.join(", ")}.`,
    aliases: feature.aliases,
    animationId: feature.animationId,
    blocks: [
      { type: "h2", text: "Where to find it" },
      { type: "p", text: feature.where },
      { type: "h2", text: "How to use it" },
      { type: "p", text: feature.steps.join(" ") },
      { type: "h2", text: "Technical background" },
      { type: "p", text: feature.technicalBackground },
    ],
  }));
}