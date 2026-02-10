// User profile types
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: "user" | "professional";
  created_at: string;
}

// Portfolio types
export interface Portfolio {
  id: string;
  title: string;
  description: string;
  images: string[];
  style: InteriorStyle;
  space_type: SpaceType;
  area_size?: number;
  budget?: string;
  professional_id: string;
  created_at: string;
  likes_count: number;
}

// Professional types
export interface Professional {
  id: string;
  user_id: string;
  company_name: string;
  introduction: string;
  specialties: InteriorStyle[];
  service_areas: string[];
  career_years: number;
  rating: number;
  review_count: number;
  portfolio_count: number;
  created_at: string;
}

// Community post types
export interface Post {
  id: string;
  title: string;
  content: string;
  images?: string[];
  category: PostCategory;
  author_id: string;
  author_name: string;
  created_at: string;
  comments_count: number;
  likes_count: number;
}

// Enums
export type InteriorStyle =
  | "modern"
  | "minimal"
  | "natural"
  | "classic"
  | "nordic"
  | "industrial"
  | "vintage"
  | "korean";

export type SpaceType =
  | "living_room"
  | "bedroom"
  | "kitchen"
  | "bathroom"
  | "office"
  | "commercial"
  | "whole_house";

export type PostCategory =
  | "interior_tips"
  | "product_review"
  | "question"
  | "before_after"
  | "free_talk";
