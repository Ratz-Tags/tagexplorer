export interface TagCategoryRule {
  category: string;
  keywords: string[];
}

export interface TagCategoryGroup {
  category: string;
  tags: string[];
}

export const TAG_CATEGORY_RULES: TagCategoryRule[];
export function categorizeTags(flatTags: string[], rules?: TagCategoryRule[]): TagCategoryGroup[];
