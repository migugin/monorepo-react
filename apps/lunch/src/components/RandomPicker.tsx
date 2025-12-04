import { useState, useEffect, useCallback } from "react";
import { Shuffle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Restaurant, CATEGORY_ICONS, FoodCategory } from "@/types/restaurant";

interface RandomPickerProps {
  restaurants: Restaurant[];
  onPick: (restaurant: Restaurant) => void;
}

export function RandomPicker({ restaurants, onPick }: RandomPickerProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayedRestaurant, setDisplayedRestaurant] = useState<Restaurant | null>(null);
  const [spinCount, setSpinCount] = useState(0);

  const spin = useCallback(() => {
    if (restaurants.length === 0) return;

    setIsSpinning(true);
    setSpinCount(0);

    const totalSpins = 20;
    const spinInterval = setInterval(() => {
      setSpinCount((prev) => {
        const next = prev + 1;
        const randomIndex = Math.floor(Math.random() * restaurants.length);
        setDisplayedRestaurant(restaurants[randomIndex]);

        if (next >= totalSpins) {
          clearInterval(spinInterval);
          setIsSpinning(false);
          const finalPick = restaurants[Math.floor(Math.random() * restaurants.length)];
          setDisplayedRestaurant(finalPick);
          onPick(finalPick);
        }

        return next;
      });
    }, 100 + spinCount * 10);
  }, [restaurants, onPick, spinCount]);

  const categoryIcon = displayedRestaurant
    ? CATEGORY_ICONS[displayedRestaurant.category as FoodCategory] || "🍽️"
    : "🎰";

  return (
    <div className="gradient-warm rounded-2xl p-6 shadow-elevated">
      <div className="text-center">
        <h2 className="text-xl font-bold text-primary-foreground mb-4 flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5" />
          오늘의 점심은?
        </h2>

        <div
          className={`bg-card/95 backdrop-blur rounded-xl p-6 mb-4 min-h-[120px] flex flex-col items-center justify-center transition-all duration-200 ${
            isSpinning ? "animate-pulse" : ""
          }`}
        >
          <span className="text-4xl mb-2 transition-transform duration-100">
            {categoryIcon}
          </span>
          {displayedRestaurant ? (
            <>
              <p className="text-lg font-bold text-foreground">
                {displayedRestaurant.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {displayedRestaurant.category} · {displayedRestaurant.distance}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              버튼을 눌러 랜덤 선택!
            </p>
          )}
        </div>

        <Button
          onClick={spin}
          disabled={isSpinning || restaurants.length === 0}
          size="xl"
          className="bg-card text-foreground hover:bg-card/90 shadow-soft font-bold"
        >
          <Shuffle className={`h-5 w-5 mr-2 ${isSpinning ? "animate-spin" : ""}`} />
          {isSpinning ? "선택 중..." : "랜덤 선택"}
        </Button>
      </div>
    </div>
  );
}
