const DEFAULT_OTHER_CATEGORY = "Other";

export const TAG_CATEGORY_RULES = [
  {
    category: "Bondage & Restraints",
    keywords: [
      "bondage",
      "bound",
      "hogtie",
      "restraints",
      "restrained",
      "leash",
      "spreader_bar",
      "shibari",
      "immobilization",
    ],
  },
  {
    category: "Chastity & Control",
    keywords: [
      "chastity_cage",
      "flat_chastity_cage",
      "chastity_cage_emission",
      "holding_key",
      "orgasm_denial",
    ],
  },
  {
    category: "Feminization & Gender Play",
    keywords: [
      "feminization",
      "forced_feminization",
      "bimbofication",
      "crossdressing",
      "crossdressing_(mtf)",
      "trap",
    ],
  },
  {
    category: "Humiliation & Degradation",
    keywords: [
      "humiliation",
      "bullying",
      "small_penis",
      "small_penis_humiliation",
      "public_nudity",
      "body_writing",
      "cumdump",
      "viewer_on_leash",
    ],
  },
  {
    category: "Mind Control & Hypnosis",
    keywords: ["mind_control", "mind_break", "hypnosis"],
  },
  {
    category: "Anal Play",
    keywords: ["anal_", "pegging"],
  },
  {
    category: "Oral & Fellatio",
    keywords: ["fellatio", "oral", "irrumatio", "gokkun", "swallowing"],
  },
  {
    category: "Domination & Control",
    keywords: ["femdom", "dominatrix", "assertive_female", "forced", "sadism"],
  },
  {
    category: "Toys & Machines",
    keywords: ["sex_toy", "sex_machine", "milking_machine", "dildo", "strap-on", "huge_dildo"],
  },
  {
    category: "Penetration & Insertion",
    keywords: ["insertion", "penetrated", "stomach_bulge", "large_insertion", "urethral_insertion", "sounding"],
  },
  {
    category: "Fetishes & Kinks",
    keywords: ["foot_", "toe_", "sockjob", "lactation", "pet_play", "spanking", "gag", "gagged"],
  },
  {
    category: "Fluids & Emission",
    keywords: ["cum", "precum", "ejaculating", "milking", "pussy_juice", "premature_ejaculation", "handsfree_ejaculation"],
  },
  {
    category: "Relationship Dynamics",
    keywords: ["netorare", "netorase", "cheating", "clothed_female_nude_male"],
  },
  {
    category: "Fantasy & Tentacles",
    keywords: ["tentacle", "futanari", "knotting"],
  },
  {
    category: "Anal & Object Play",
    keywords: [
      "anal_fingering",
      "anal_fisting",
      "anal_object_insertion",
      "object_insertion",
      "object_insertion_from_behind",
      "large_insertion",
      "sounding",
      "urethral_insertion",
      "dildo_riding",
      "huge_dildo",
      "strap-on",
      "pegging",
      "sex_toy",
      "sex_machine",
      "milking_machine",
      "penis_milking",
      "prostate_milking",
      "hand_milking",
      "handsfree_ejaculation",
    ],
  },
  {
    category: "Domination, Power & Sadism",
    keywords: [
      "femdom",
      "dominatrix",
      "sadism",
      "assertive_female",
      "pet_play",
      "cbt",
      "punishment",
      "boot_worship",
      "trample",
    ],
  },
  {
    category: "Feet & Legs",
    keywords: ["foot_worship", "toe_sucking", "sockjob"],
  },
  {
    category: "Tentacles & Monsters",
    keywords: ["tentacle_sex", "tentacle_pit", "knotting"],
  },
  {
    category: "Cum, Fluids & Orifices",
    keywords: [
      "cum",
      "cum_in_ass",
      "cum_in_mouth",
      "precum",
      "swallowing",
      "gokkun",
      "drinking_from_condom",
      "pouring_from_condom",
      "used_condom",
      "pussy_juice",
      "lactation",
    ],
  },
  {
    category: "Mind, Hypnosis & Control",
    keywords: ["hypnosis", "mind_break", "mind_control"],
  },
  {
    category: "Public, Cheating & Social",
    keywords: [
      "before_and_after",
      "annoyed",
      "cheating_(relationship)",
      "clothed_female_nude_male",
      "public_nudity",
    ],
  },
  {
    category: "Body & Skin",
    keywords: ["dark_skin", "nipple_piercing", "pubic_hair", "lactation", "stomach_bulge"],
  },
  {
    category: "Oral & Face",
    keywords: ["fellatio", "oral", "sitting_on_face"],
  },
  {
    category: "Orgasm & Denial",
    keywords: ["orgasm_denial", "forced_orgasm", "ruined_orgasm", "premature_ejaculation"],
  },
  {
    category: "Nonconsensual & Extreme",
    keywords: ["rape", "netorare", "netorase"],
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
