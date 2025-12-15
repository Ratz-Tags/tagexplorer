const DEFAULT_OTHER_CATEGORY = "All Tags";

// Generic tag categories (for non-kink tags)
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

// Kink/sexual tag categories
export const KINK_CATEGORY_RULES = [
  {
    id: "domination",
    label: "Domination & Power Dynamics",
    matcher: (tag) =>
      [
        "assertive_female",
        "bdsm",
        "dominatrix",
        "femdom",
        "forced",
        "humiliation",
        "punishment_game",
        "reverse_rape",
        "sadism",
        "dominant",
        "submissive",
        "power_dynamic",
        "master",
        "mistress",
        "slave",
      ].some((k) => tag.includes(k)),
  },
  {
    id: "bondage",
    label: "Bondage & Restraints",
    matcher: (tag) =>
      [
        "blindfold",
        "bondage",
        "bound",
        "bound_arms",
        "bound_legs",
        "bound_wrists",
        "chain_leash",
        "chains",
        "collar",
        "handcuffs",
        "hogtie",
        "immobilization",
        "leash",
        "restrained",
        "restraints",
        "rope",
        "rope_bondage",
        "shibari",
        "spreader_bar",
        "tied_up",
        "viewer_on_leash",
        "cuffs",
        "gag",
        "gagged",
      ].some((k) => tag.includes(k)),
  },
  {
    id: "chastity",
    label: "Chastity & Orgasm Control",
    matcher: (tag) =>
      [
        "chastity_belt",
        "chastity_cage",
        "chastity_cage_emission",
        "flat_chastity_cage",
        "holding_key",
        "orgasm_denial",
        "ruined_orgasm",
        "premature_ejaculation",
        "handsfree_ejaculation",
        "ejaculating_while_penetrated",
      ].some((k) => tag.includes(k)),
  },
  {
    id: "feminization",
    label: "Feminization & Transformation",
    matcher: (tag) =>
      [
        "bimbofication",
        "crossdressing",
        "feminization",
        "forced_feminization",
        "genderswap",
        "genderswap_(mtf)",
        "otoko_no_ko",
        "trap",
        "crossdressing_(mtf)",
        "before_and_after",
      ].some((k) => tag.includes(k)),
  },
  {
    id: "humiliation",
    label: "Humiliation & Degradation",
    matcher: (tag) =>
      [
        "annoyed",
        "assisted_exposure",
        "body_writing",
        "bullying",
        "clothed_female_nude_male",
        "cumdump",
        "embarrassed",
        "exhibitionism",
        "forced_exposure",
        "humiliation",
        "nude",
        "public_nudity",
        "public_use",
        "small_penis",
        "small_penis_humiliation",
        "crying",
        "begging",
        "drooling",
        "ahegao",
        "messy",
        "covered_in_cum",
        "shamed",
        "public_sex",
        "voyeurism",
      ].some((k) => tag.includes(k)),
  },
  {
    id: "mind_control",
    label: "Mind Control & Hypnosis",
    matcher: (tag) =>
      [
        "brainwashing",
        "hypnosis",
        "hypnotic_eyes",
        "mind_break",
        "mind_control",
        "spiral_eyes",
      ].some((k) => tag.includes(k)),
  },
  {
    id: "anal_pegging",
    label: "Anal Play & Pegging",
    matcher: (tag) =>
      [
        "anal",
        "anal_fingering",
        "anal_fisting",
        "anal_object_insertion",
        "pegging",
        "male_penetrated",
        "prostate_milking",
        "object_insertion",
        "object_insertion_from_behind",
        "large_insertion",
        "huge_dildo",
      ].some((k) => tag.includes(k)),
  },
  {
    id: "oral",
    label: "Oral & Swallowing",
    matcher: (tag) =>
      [
        "oral",
        "fellatio",
        "irrumatio",
        "cum_in_mouth",
        "swallowing",
        "gokkun",
        "drinking_from_condom",
        "pouring_from_condom",
      ].some((k) => tag.includes(k)),
  },
  {
    id: "cum",
    label: "Cum & Ejaculation",
    matcher: (tag) =>
      [
        "cum",
        "cum_in_ass",
        "cum_in_mouth",
        "covered_in_cum",
        "precum",
        "cumdump",
        "stomach_bulge",
      ].some((k) => tag.includes(k)),
  },
  {
    id: "toys",
    label: "Sex Toys & Equipment",
    matcher: (tag) =>
      [
        "sex_toy",
        "dildo",
        "dildo_riding",
        "huge_dildo",
        "milking_machine",
        "hand_milking",
        "penis_milking",
        "prostate_milking",
        "condom",
      ].some((k) => tag.includes(k)),
  },
  {
    id: "fetish",
    label: "Fetish & Roleplay",
    matcher: (tag) =>
      [
        "pet_play",
        "maid",
        "nurse",
        "latex",
        "leather",
        "lingerie",
        "foot_worship",
        "lactation",
        "knotting",
        "pubic_hair",
        "dark_skin",
        "nipple_piercing",
      ].some((k) => tag.includes(k)),
  },
  {
    id: "cuckoldry",
    label: "Cuckoldry & Relationship Betrayal",
    matcher: (tag) =>
      [
        "netorare",
        "netorase",
        "cheating_(relationship)",
        "cuckold",
        "cuckoldry",
        "cuck",
        "cucking",
        "felching",
        "cleaning_up",
        "cleanup",
        "licking_clean",
        "licking_cum",
        "cum_cleanup",
        "used_condom",
        "drinking_from_condom",
        "pouring_from_condom",
        "watching",
        "forced_to_watch",
        "made_to_watch",
        "watching_couple",
        "cuckold_anilingus",
        "cuckold_femdom",
        "cuckold_pegging",
        "cuckold_oral",
        "bull",
        "bull_(cuckold)",
        "hotwife",
        "wife_sharing",
        "wife_swapping",
        "before_and_after",
        "comparison",
        "size_comparison",
        "small_penis",
        "small_penis_humiliation",
        "denied",
        "denied_while_watching",
        "locked_while_watching",
        "chastity_while_watching",
        "caged_while_watching",
        "humiliated_while_watching",
        "crying_while_watching",
        "jealous",
        "jealousy",
        "ntr",
        "ntr_(netorare)",
      ].some((k) => tag.includes(k)),
  },
  {
    id: "non_consent",
    label: "Non-Consent & Forced",
    matcher: (tag) =>
      [
        "rape",
        "forced",
        "forced_feminization",
        "forced_exposure",
      ].some((k) => tag.includes(k)),
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

  const categories = rules.map((rule) => ({ category: rule.label || rule.id, tags: [] }));
  const other = { category: DEFAULT_OTHER_CATEGORY, tags: [] };

  unique.sort((a, b) => a.localeCompare(b));

  for (const tag of unique) {
    let matched = false;
    for (let i = 0; i < rules.length; i += 1) {
      const rule = rules[i];
      // Use matcher function if available, otherwise fallback to keywords
      if (rule.matcher && typeof rule.matcher === 'function') {
        if (rule.matcher(tag)) {
          categories[i].tags.push(tag);
          matched = true;
          break;
        }
      } else if (rule?.keywords?.some((keyword) => tag.includes(keyword))) {
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
