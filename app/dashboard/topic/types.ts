// 选题工作台相关类型（从 page.tsx 抽离）

export interface TopicHistory {
  id: string;
  content?: string;
  result?: string;
  created_at: string;
}

export interface Profile {
  id: string;
  industry?: string;
  positioning?: string;
  style?: string;
  targetAudience?: string;
  priceRange?: string;
  city?: string;
  profile_name?: string;
  account_platform?: string[];
  account_track?: string[];
  account_stage?: string;
  fans_level?: string;
  target_age?: string[];
  target_gender?: string;
  target_occupation?: string[];
  target_pain_points?: string[];
  target_needs?: string[];
  content_category?: string[];
  content_style?: string[];
  content_format?: string[];
  content_value?: string;
  unique_selling_point?: string;
}

export interface Positioning {
  id: string;
  title?: string;
  industry?: string;
  positioning?: string;
  positioning_name?: string;
  full_content?: string;
  contentDirection?: string;
  targetGroup?: string;
  style?: string;
  differentiationTag?: string;
  strategy_summary?: string;
}
