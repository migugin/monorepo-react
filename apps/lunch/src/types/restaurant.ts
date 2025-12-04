export interface Restaurant {
  id: string;
  name: string;
  category: string;
  address: string;
  distance: string;
  rating?: number;
  imageUrl?: string;
  tel?: string;
}

export interface NaverApiConfig {
  clientId: string;
  clientSecret: string;
}

export type FoodCategory = 
  | "전체"
  | "한식"
  | "중식"
  | "일식"
  | "양식"
  | "분식"
  | "카페"
  | "패스트푸드";

export const FOOD_CATEGORIES: FoodCategory[] = [
  "전체",
  "한식",
  "중식",
  "일식",
  "양식",
  "분식",
  "카페",
  "패스트푸드",
];

export const CATEGORY_ICONS: Record<FoodCategory, string> = {
  "전체": "🍽️",
  "한식": "🍚",
  "중식": "🥢",
  "일식": "🍣",
  "양식": "🍝",
  "분식": "🍜",
  "카페": "☕",
  "패스트푸드": "🍔",
};
