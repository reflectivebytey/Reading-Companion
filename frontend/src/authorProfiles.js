const NO_BIO = "No bio found. Tap Edit to add one.";
const PLACEHOLDER_AUTHOR = /^(?:editor\s*\/\s*publisher|multiple authors|various authors|unknown|n\/?a)$/i;

export function splitAuthorNames(value) {
  const source = String(value || "").trim();
  if (!source || PLACEHOLDER_AUTHOR.test(source)) return [];
  return [...new Set(source
    .split(/\s*(?:,|&|\band\b|\bwith\b)\s*/i)
    .map((name) => name.trim())
    .filter((name) => name && !PLACEHOLDER_AUTHOR.test(name)))];
}

export function normalizeAuthorName(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function buildAuthorProfiles({ authorName, authorBio, authorPortraits = [], authorPortrait = "" }) {
  const names = splitAuthorNames(authorName);
  const saved = Array.isArray(authorPortraits) ? authorPortraits : [];
  if (!names.length) {
    return [{
      name: String(authorName || "Author").trim(),
      bio: authorBio || NO_BIO,
      dataUrl: authorPortrait || "",
      sourceUrl: null,
      lookupDone: true,
      unsupported: true,
    }];
  }
  return names.map((name, index) => {
    const profile = saved.find((entry) => normalizeAuthorName(entry.name) === normalizeAuthorName(name)) || {};
    return {
      name,
      bio: profile.bio || (names.length === 1 ? authorBio : index === 0 ? authorBio : "") || NO_BIO,
      dataUrl: profile.dataUrl || (names.length === 1 ? authorPortrait : "") || "",
      sourceUrl: profile.sourceUrl || null,
      bioSource: profile.bioSource || "",
      bioSourceUrl: profile.bioSourceUrl || "",
      lookupDone: profile.lookupDone === true,
    };
  });
}

export async function fetchWikipediaAuthor(name, fetchImpl = fetch) {
  const title = String(name || "").trim().replace(/\s+/g, "_");
  if (!title || PLACEHOLDER_AUTHOR.test(title.replace(/_/g, " "))) return null;
  try {
    const response = await fetchImpl(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const page = await response.json();
    const requested = normalizeAuthorName(name);
    const returned = normalizeAuthorName(page?.title);
    const titleMatches = returned === requested || returned.startsWith(`${requested} `);
    const description = String(page?.description || "");
    const extract = String(page?.extract || "");
    const personPage = /\b(author|writer|novelist|poet|philosopher|historian|essayist|journalist|biographer|screenwriter)\b/i.test(`${description} ${extract.slice(0, 600)}`);
    if (page?.type !== "standard" || !titleMatches || !personPage || extract.length < 40) return null;
    const thumbnail = typeof page.thumbnail?.source === "string" && page.thumbnail.source.startsWith("https://") ? page.thumbnail.source : "";
    const bio = extract.split(/(?<=[.!?])\s+/u).slice(0, 3).join(" ").slice(0, 480);
    return {
      bio,
      title: page.title,
      sourceUrl: page.content_urls?.desktop?.page || "https://en.wikipedia.org/wiki/" + encodeURIComponent(page.title.replace(/ /g, "_")),
      thumbnail,
      source: "Wikipedia",
    };
  } catch {
    return null;
  }
}

export { NO_BIO };