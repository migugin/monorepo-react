import { MapPin, Star, Phone } from "lucide-react";
import { Restaurant, CATEGORY_ICONS, FoodCategory } from "@/types/restaurant";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RestaurantCardProps {
  restaurant: Restaurant;
  isHighlighted?: boolean;
}

export function RestaurantCard({ restaurant, isHighlighted }: RestaurantCardProps) {
  const categoryIcon = CATEGORY_ICONS[restaurant.category as FoodCategory] || "🍽️";

  return (
    <Card
      className={`overflow-hidden transition-all duration-300 hover:shadow-elevated hover:-translate-y-1 ${
        isHighlighted
          ? "ring-2 ring-primary shadow-glow animate-bounce-in"
          : "shadow-soft"
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-2xl">
            {categoryIcon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">
                {restaurant.name}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {restaurant.category}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{restaurant.address}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-primary">
                {restaurant.distance}
              </span>
              {restaurant.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                  <span className="text-sm font-medium">{restaurant.rating}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
