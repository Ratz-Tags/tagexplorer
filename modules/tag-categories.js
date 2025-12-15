const DEFAULT_OTHER_CATEGORY = "All Tags";

export const TAG_CATEGORY_RULES = [
  {
    id: "character",
    label: "Characters",
    matcher: (tag) =>
      /^(character:|char:|person:|persona:)/i.test(tag) ||
      tag.includes("(") || // simplistic guess for "Name (Source)"
      [
        "miku",
        "rin",
        "len",
        "luka",
        "kaito",
        "meiko",
        "gumi",
        "ia",
        "yukari",
        "teto",
      ].some((n) => tag.includes(n)),
  },
  {
    id: "artist",
    label: "Artists",
    matcher: (tag) => /^(artist:|art by|by )/i.test(tag),
  },
  {
    id: "copyright",
    label: "Copyright",
    matcher: (tag) =>
      /^(copyright:|series:|source:|game:|anime:|manga:)/i.test(tag) ||
      [
        "vocaloid",
        "project sekai",
        "touhou",
        "genshin",
        "honkai",
        "blue archive",
        "arknights",
        "fate",
        "idolmaster",
        "love live",
        "pokemon",
      ].some((n) => tag.includes(n)),
  },
  {
    id: "meta",
    label: "Meta",
    matcher: (tag) =>
      /^(meta:|rating:|score:|user:|fav:|pool:)/i.test(tag) ||
      ["absurdres", "highres", "translated", "commentary", "check_my_"].some(
        (m) => tag.includes(m)
      ),
  },
  {
    id: "style",
    label: "Style",
    matcher: (tag) =>
      /^(style:|medium:|tool:)/i.test(tag) ||
      [
        "monochrome",
        "greyscale",
        "sketch",
        "traditional",
        "watercolor",
        "pixel art",
        "3d",
      ].some((s) => tag.includes(s)),
  },
  {
    id: "anatomy",
    label: "Anatomy",
    matcher: (tag) =>
      [
        "hair",
        "eyes",
        "skin",
        "legs",
        "arms",
        "breasts",
        "thighs",
        "tail",
        "wings",
        "ears",
        "horns",
      ].some((a) => tag.includes(a)),
  },
];

function normalizeTagName(tag) {
  return String(tag ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function categorizeTags(flatTags, rules = TAG_CATEGORY_RULES) {
  if (!Array.isArray(flatTags)) return [];
  const unique = Array.from(
    new Set(
      flatTags
        .map((tag) => normalizeTagName(tag))
        .filter((tag) => tag.length > 0)
    )
  );

  const categories = rules.map((rule) => ({ category: rule.category, tags: [] }));
  const other = { category: DEFAULT_OTHER_CATEGORY, tags: [] };

  unique.sort((a, b) => a.localeCompare(b));

  for (const tag of unique) {
    let matched = false;
    for (let i = 0; i < rules.length; i += 1) {
      const rule = rules[i];
      if (rule?.keywords?.some((keyword) => tag.includes(keyword))) {
        categories[i].tags.push(tag);
        matched = true;
        break;
      }
    }
    if (!matched) {
      other.tags.push(tag);
    }
  }

  const result = categories.filter((cat) => cat.tags.length > 0);
  result.sort((a, b) => a.category.localeCompare(b.category));
  if (other.tags.length > 0) {
    other.tags.sort((a, b) => a.localeCompare(b));
    result.push(other);
  }
  result.forEach((cat) => cat.tags.sort((a, b) => a.localeCompare(b)));
  return result;
}

export function flattenCategorizedTags(categorized) {
  if (!Array.isArray(categorized)) return [];
  const seen = new Set();
  const flat = [];
  for (const group of categorized) {
    if (!group || !Array.isArray(group.tags)) continue;
    for (const tag of group.tags) {
      const normalized = normalizeTagName(tag);
      if (!seen.has(normalized) && normalized) {
        seen.add(normalized);
        flat.push(normalized);
      }
    }
  }
  flat.sort((a, b) => a.localeCompare(b));
  return flat;
}
