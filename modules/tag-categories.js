const DEFAULT_OTHER_CATEGORY = "All Tags";

export const TAG_CATEGORY_RULES = [];

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
