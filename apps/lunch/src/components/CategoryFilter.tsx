import { Button } from "@/components/ui/button";
import { FOOD_CATEGORIES, CATEGORY_ICONS, FoodCategory } from "@/types/restaurant";

interface CategoryFilterProps {
  selectedCategory: FoodCategory;
  onSelectCategory: (category: FoodCategory) => void;
}

export function CategoryFilter({ selectedCategory, onSelectCategory }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FOOD_CATEGORIES.map((category) => (
        <Button
          key={category}
          variant={selectedCategory === category ? "categoryActive" : "category"}
          size="sm"
          onClick={() => onSelectCategory(category)}
          className="gap-1.5"
        >
          <span>{CATEGORY_ICONS[category]}</span>
          <span>{category}</span>
        </Button>
      ))}
    </div>
  );
}
