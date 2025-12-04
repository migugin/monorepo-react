import { useState, useMemo, useEffect, useCallback } from "react";
import { LocationDisplay } from "@/components/LocationDisplay";
import { CategoryFilter } from "@/components/CategoryFilter";
import { RandomPicker } from "@/components/RandomPicker";
import { RestaurantCard } from "@/components/RestaurantCard";
import { mockRestaurants } from "@/data/mockRestaurants";
import { FoodCategory, Restaurant } from "@/types/restaurant";
import { UtensilsCrossed, Loader2, RefreshCw } from "lucide-react";
import { searchRestaurantsByAddress } from "@/services/naverApi";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

const DEFAULT_ADDRESS = "서울 강남구";

const Index = () => {
  // localStorage에서 주소 불러오기
  const [officeAddress, setOfficeAddress] = useState(() => {
    const saved = localStorage.getItem("officeAddress");
    return saved || DEFAULT_ADDRESS;
  });

  const [selectedCategory, setSelectedCategory] = useState<FoodCategory>("전체");
  const [pickedRestaurant, setPickedRestaurant] = useState<Restaurant | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingApi, setIsUsingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // 주소 변경 핸들러
  const handleAddressChange = useCallback((address: string) => {
    setOfficeAddress(address);
    localStorage.setItem("officeAddress", address);
  }, []);

  // API를 사용하여 식당 검색
  const fetchRestaurants = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    
    try {
      const results = await searchRestaurantsByAddress(
        officeAddress,
        selectedCategory === "전체" ? undefined : selectedCategory
      );
      
      if (results.length === 0) {
        setRestaurants(mockRestaurants);
        setIsUsingApi(false);
        toast({
          title: "검색 결과 없음",
          description: "해당 지역에서 식당을 찾을 수 없습니다. 모킹 데이터를 표시합니다.",
        });
      } else {
        setRestaurants(results);
        setIsUsingApi(true);
        toast({
          title: "검색 완료",
          description: `${results.length}개의 식당을 찾았습니다.`,
        });
      }
    } catch (error) {
      console.error("식당 검색 실패:", error);
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
      setApiError(errorMessage);
      setRestaurants(mockRestaurants);
      setIsUsingApi(false);
      
      toast({
        title: "검색 실패",
        description: "네이버 API 호출에 실패했습니다. 모킹 데이터를 표시합니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [officeAddress, selectedCategory]);

  // 컴포넌트 마운트 시 및 주소/카테고리 변경 시 검색
  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  const filteredRestaurants = useMemo(() => {
    if (selectedCategory === "전체" || isUsingApi) {
      return restaurants;
    }
    return restaurants.filter((r) => r.category === selectedCategory);
  }, [restaurants, selectedCategory, isUsingApi]);

  const handlePick = (restaurant: Restaurant) => {
    setPickedRestaurant(restaurant);
    // Auto scroll to picked restaurant
    setTimeout(() => {
      const element = document.getElementById(`restaurant-${restaurant.id}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">점심 뭐먹지?</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {isUsingApi && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                실시간 데이터
              </span>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchRestaurants}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="space-y-6">
          {/* API Error Notice */}
          {apiError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
              <p className="text-sm text-destructive font-semibold">⚠️ API 연결 오류</p>
              <p className="text-xs text-muted-foreground mt-1">
                {apiError}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                프록시 서버가 실행 중인지 확인하거나 .env 파일의 API 키를 확인해주세요.
              </p>
            </div>
          )}

          {/* Location */}
          <LocationDisplay
            address={officeAddress}
            onAddressChange={handleAddressChange}
          />

          {/* Random Picker */}
          <RandomPicker
            restaurants={filteredRestaurants}
            onPick={handlePick}
          />

          {/* Category Filter */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              카테고리
            </h2>
            <CategoryFilter
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>

          {/* Restaurant List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                주변 식당
              </h2>
              <span className="text-sm text-muted-foreground">
                {filteredRestaurants.length}개
              </span>
            </div>
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  주변 식당을 검색하고 있습니다...
                </p>
              </div>
            ) : filteredRestaurants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <p className="text-sm text-muted-foreground">
                  식당을 찾을 수 없습니다.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredRestaurants.map((restaurant) => (
                  <div key={restaurant.id} id={`restaurant-${restaurant.id}`}>
                    <RestaurantCard
                      restaurant={restaurant}
                      isHighlighted={pickedRestaurant?.id === restaurant.id}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>© 2024 점심 뭐먹지? All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Index;
