import { Restaurant } from "@/types/restaurant";

// 네이버 로컬 검색 API 응답 타입
export interface NaverLocalItem {
  title: string;
  link: string;
  category: string;
  description: string;
  telephone: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
}

export interface NaverLocalResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverLocalItem[];
}

/**
 * 네이버 로컬 검색 API를 프록시 서버를 통해 호출합니다.
 * 네이버 API는 한 번에 최대 5개만 반환하므로 여러 번 호출합니다.
 */
export async function searchLocalRestaurants(
  query: string,
  totalCount: number = 20
): Promise<NaverLocalResponse> {
  // 프록시 서버 URL
  const PROXY_URL = import.meta.env.VITE_PROXY_URL || "http://localhost:3001";
  const API_ENDPOINT = `${PROXY_URL}/api/naver/local`;
  
  try {
    const PER_PAGE = 5; // 네이버 API는 한 번에 5개까지만 반환
    const pages = Math.ceil(totalCount / PER_PAGE);
    const allItems: NaverLocalItem[] = [];
    
    // 여러 페이지를 순차적으로 호출
    for (let page = 0; page < pages; page++) {
      const start = page * PER_PAGE + 1;
      
      const params = new URLSearchParams({
        query,
        display: PER_PAGE.toString(),
        start: start.toString(),
        sort: "comment", // random 대신 comment(리뷰순) 사용하여 일관된 결과
      });

      const response = await fetch(`${API_ENDPOINT}?${params}`, {
        method: "GET",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `API 호출 실패: ${response.status}`
        );
      }

      const data: NaverLocalResponse = await response.json();
      allItems.push(...data.items);
      
      // total보다 많이 가져왔거나 결과가 더 이상 없으면 중단
      if (allItems.length >= data.total || data.items.length === 0) {
        break;
      }
    }

    // 마지막 응답 기준으로 메타데이터 생성
    return {
      lastBuildDate: new Date().toISOString(),
      total: allItems.length,
      start: 1,
      display: allItems.length,
      items: allItems.slice(0, totalCount), // 요청한 개수만큼만 반환
    };
  } catch (error) {
    console.error("네이버 API 호출 중 오류:", error);
    throw error;
  }
}

/**
 * 거리 계산 (Haversine 공식)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // 지구 반지름 (미터)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // 미터 단위
}

/**
 * 미터를 사람이 읽기 쉬운 형식으로 변환
 */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * 네이버 카테고리를 앱 카테고리로 매핑
 */
function mapNaverCategoryToAppCategory(naverCategory: string): string {
  const categoryMap: Record<string, string> = {
    "한식": "한식",
    "중식": "중식",
    "일식": "일식",
    "양식": "양식",
    "분식": "분식",
    "카페": "카페",
    "패스트푸드": "패스트푸드",
    "치킨": "패스트푸드",
    "피자": "패스트푸드",
    "버거": "패스트푸드",
  };

  // 카테고리 문자열에서 매핑되는 것 찾기
  for (const [key, value] of Object.entries(categoryMap)) {
    if (naverCategory.includes(key)) {
      return value;
    }
  }

  // 기본값
  return "한식";
}

/**
 * HTML 태그 제거
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * 네이버 좌표계를 WGS84로 변환 (간단한 근사치)
 * 실제로는 Katec -> WGS84 변환이 필요하지만, 거리 표시용으로 간단히 처리
 */
function convertNaverCoords(mapx: string, mapy: string): { lat: number; lng: number } {
  const x = parseInt(mapx);
  const y = parseInt(mapy);
  
  // 네이버 지도 좌표계 변환 (대략적)
  const lng = x / 10000000;
  const lat = y / 10000000;
  
  return { lat, lng };
}

/**
 * 네이버 API 응답을 Restaurant 타입으로 변환
 */
export function convertNaverItemsToRestaurants(
  items: NaverLocalItem[],
  userLat?: number,
  userLng?: number
): Restaurant[] {
  return items.map((item, index) => {
    const coords = convertNaverCoords(item.mapx, item.mapy);
    
    // 거리 계산
    let distance = "거리 정보 없음";
    if (userLat && userLng) {
      const distanceInMeters = calculateDistance(userLat, userLng, coords.lat, coords.lng);
      distance = formatDistance(distanceInMeters);
    }

    return {
      id: `naver-${index}-${item.mapx}-${item.mapy}`,
      name: stripHtmlTags(item.title),
      category: mapNaverCategoryToAppCategory(item.category),
      address: item.roadAddress || item.address,
      distance,
      tel: item.telephone,
      // 평점은 랜덤으로 생성 (네이버 API는 평점 미제공)
      rating: Math.round((Math.random() * 1.5 + 3.5) * 10) / 10,
    };
  });
}

/**
 * 주소를 간소화하여 검색하기 좋은 형태로 변환
 */
function simplifyAddress(address: string): string {
  // "서울 서초구 강남대로27길 9" -> "서울 서초구"
  // "서울특별시 강남구 테헤란로 123" -> "서울 강남구"
  
  // 상세 주소 제거 (번지, 건물명, 상세주소 등)
  let simplified = address
    .replace(/\d+(-\d+)?번지?/g, '') // 번지 제거
    .replace(/\d+길/g, '') // ~길 제거
    .replace(/\d+로/g, '로') // ~로의 번호 제거
    .trim();
  
  // "시/도 + 구/군" 까지만 추출
  const parts = simplified.split(' ').filter(p => p.length > 0);
  
  if (parts.length >= 2) {
    // 첫 2개 또는 3개 부분만 사용 (서울특별시, 서울 등 고려)
    if (parts[0].includes('특별시') || parts[0].includes('광역시')) {
      return `${parts[0].replace('특별시', '').replace('광역시', '')} ${parts[1]}`;
    }
    return `${parts[0]} ${parts[1]}`;
  }
  
  return parts[0] || address;
}

/**
 * 주소 기반으로 식당 검색
 */
export async function searchRestaurantsByAddress(
  address: string,
  category?: string
): Promise<Restaurant[]> {
  try {
    // 주소를 간소화
    const simplifiedAddress = simplifyAddress(address);
    
    // 검색 쿼리 구성
    let query = `${simplifiedAddress} 음식점`;
    if (category && category !== "전체") {
      query = `${simplifiedAddress} ${category}`;
    }

    console.log(`🔍 검색 쿼리: "${query}" (원본 주소: "${address}")`);

    const response = await searchLocalRestaurants(query, 15); // 5개 x 3페이지 = 15개
    
    console.log(`✅ API 응답: ${response.items.length}개 결과`);

    // 검색 결과가 없는 경우
    if (response.items.length === 0) {
      return [];
    }

    // 음식점만 필터링 (조건 완화)
    const restaurantItems = response.items.filter((item) => {
      const cat = item.category.toLowerCase();
      
      // 제외할 카테고리 (명확히 음식점이 아닌 것들)
      const excludeCategories = ['병원', '약국', '은행', '편의점', '마트', '학교', '부동산'];
      const shouldExclude = excludeCategories.some(exc => cat.includes(exc));
      
      if (shouldExclude) {
        return false;
      }
      
      // 음식 관련 키워드가 있으면 포함
      return (
        cat.includes("음식점") ||
        cat.includes("식당") ||
        cat.includes("한식") ||
        cat.includes("중식") ||
        cat.includes("일식") ||
        cat.includes("양식") ||
        cat.includes("분식") ||
        cat.includes("카페") ||
        cat.includes("패스트푸드") ||
        cat.includes("치킨") ||
        cat.includes("피자") ||
        cat.includes("버거") ||
        cat.includes("레스토랑") ||
        cat.includes("restaurant") ||
        cat.includes("cafe")
      );
    });

    console.log(`🍽️ 필터링 후: ${restaurantItems.length}개 식당`);

    return convertNaverItemsToRestaurants(restaurantItems);
  } catch (error) {
    console.error("식당 검색 중 오류:", error);
    throw error;
  }
}

