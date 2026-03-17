'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '../../lib/supabase';
import { useScrollToProduct } from '../hooks/useScrollToProduct';

interface ProductImage {
  id: string;
  image_url: string;
  display_order: number;
}

interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  category: string;
  description?: string;
  created_at: string;
  image_url?: string;
  additional_images?: string[];
  product_images?: ProductImage[];
}

interface ProductGridOptimizedProps {
  category: string;
  searchTerm?: string;
}

function ProductCard({ product }: { product: Product }) {
  // 이미지 우선순위: product_images > image_url
  const mainImage = product.product_images?.[0]?.image_url || product.image_url;

  // 현재 페이지 URL을 from 파라미터로 전달
  const currentUrl = typeof window !== 'undefined'
    ? encodeURIComponent(window.location.pathname + window.location.search)
    : encodeURIComponent('/');

  return (
    <Link
      href={`/product?id=${product.id}&from=${currentUrl}`}
      className="group cursor-pointer block h-full"
      scroll={false}
      data-product-id={product.id}
    >
      <div className="bg-white rounded-lg overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
        <div className="aspect-square bg-gray-100 relative overflow-hidden">
          {mainImage ? (
            <img
              src={mainImage}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <span className="text-xs md:text-sm text-gray-400 font-bold">이미지 준비중</span>
            </div>
          )}
        </div>
        <div className="p-2 md:p-3 space-y-1 flex-grow">
          <h3 className="text-sm md:text-base font-black group-hover:text-mega-red transition-colors line-clamp-2">
            {product.name}
          </h3>
          <p className="text-sm md:text-base font-black">₩{product.price.toLocaleString()}</p>
        </div>
      </div>
    </Link>
  );
}

export default function ProductGridOptimized({ category, searchTerm = '' }: ProductGridOptimizedProps) {
  useScrollToProduct(); // 상품 기반 스크롤 복원 활성화
  const [products, setProducts] = useState<Product[]>([]);
  const [displayProducts, setDisplayProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [serverHasMore, setServerHasMore] = useState(true);
  const BATCH_SIZE = 100;

  // 검색어 디바운스 (한글 IME 매 키 입력 대응, 서버 API 호출은 디바운스 적용)
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 페이지 상태 복원 - sessionStorage에서 저장된 값 읽기
  const getStorageKey = () => `product-grid-page:${category}:${searchTerm}`;

  const getInitialPage = () => {
    if (typeof window === 'undefined') return 1;

    try {
      const stored = sessionStorage.getItem(getStorageKey());
      const parsed = stored ? parseInt(stored, 10) : 1;
      console.log('[ProductGrid] 저장된 페이지 복원:', parsed, 'for', getStorageKey());
      return isNaN(parsed) ? 1 : parsed;
    } catch {
      return 1;
    }
  };

  const [page, setPage] = useState(() => getInitialPage());
  const itemsPerPage = 18; // 6 rows * 3 columns
  const observerTarget = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);  // 초기 로드 추적
  const prevCategoryRef = useRef(category);
  const prevSearchTermRef = useRef(searchTerm);
  const isNavigatingBack = useRef(false);

  // 상품 데이터 가져오기 (직접 Supabase 쿼리 + 서버 사이드 필터링)
  const fetchProducts = useCallback(async (offset = 0, append = false) => {
    try {
      const searchParam = debouncedSearch.trim();
      const categoryParam = category !== '전체' ? category : '';
      console.log(`[ProductGrid] Fetching products (offset: ${offset}, limit: ${BATCH_SIZE}, category: ${categoryParam || '전체'}, search: ${searchParam || ''})...`);

      // 상품 조회
      let query = supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      if (categoryParam) {
        query = query.eq('category', categoryParam);
      }

      if (searchParam) {
        query = query.or(`name.ilike.%${searchParam}%,description.ilike.%${searchParam}%,brand.ilike.%${searchParam}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        // 이미지를 별도 쿼리로 일괄 조회 (PostgREST JOIN 실패 방지)
        const productIds = data.map((p: any) => p.id);
        const { data: allImages } = await supabase
          .from('product_images')
          .select('*')
          .in('product_id', productIds)
          .order('display_order');

        const imagesByProduct = (allImages || []).reduce((acc: Record<string, ProductImage[]>, img: any) => {
          if (!acc[img.product_id]) acc[img.product_id] = [];
          acc[img.product_id].push(img);
          return acc;
        }, {});

        const productsWithImages = data.map((p: any) => ({
          ...p,
          product_images: imagesByProduct[p.id] || [],
        }));

        if (append) {
          setProducts(prev => [...prev, ...productsWithImages]);
        } else {
          setProducts(productsWithImages);
        }

        setServerHasMore(data.length === BATCH_SIZE);
        console.log(`[ProductGrid] Loaded ${data.length} products (total offset: ${offset})`);
      } else {
        if (!append) setProducts([]);
        setServerHasMore(false);
      }
    } catch (error) {
      console.error('[ProductGrid] Failed to fetch products:', error);
      if (!append) setProducts([]);
      setServerHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [category, debouncedSearch]);

  // 초기 데이터 로드 + 카테고리/검색어 변경 시 리로드
  useEffect(() => {
    setProducts([]);
    setPage(1);
    setServerHasMore(true);
    setIsLoading(true);
    fetchProducts(0, false);
  }, [fetchProducts]);

  // 페이지네이션 (서버 사이드 필터링으로 전환됨 - 클라이언트 필터링 불필요)
  useEffect(() => {
    const endIndex = page * itemsPerPage;
    setDisplayProducts(products.slice(0, endIndex));
    setHasMore(products.length > endIndex || serverHasMore);

    if (isInitialLoad.current && page > 1 && products.length > 0) {
      console.log('[ProductGrid] 초기 로드 - 저장된 페이지 상태 복원 중:', page);
      isInitialLoad.current = false;
    }
  }, [products, page, serverHasMore]);

  // 더 많은 아이템 로드 (클라이언트 페이지 증가 + 필요 시 서버에서 추가 fetch)
  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);

      const nextPage = page + 1;
      const nextEndIndex = nextPage * itemsPerPage;

      // 현재 로드된 상품 수보다 더 많이 필요하고, 서버에 더 있으면 추가 fetch
      if (nextEndIndex >= products.length && serverHasMore) {
        fetchProducts(products.length, true).then(() => {
          setPage(nextPage);
          setIsLoadingMore(false);
        });
      } else {
        setPage(nextPage);
        setIsLoadingMore(false);
      }
    }
  }, [isLoadingMore, hasMore, page, products.length, serverHasMore, fetchProducts]);

  // Intersection Observer 설정
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loadMore]);

  // 페이지 상태가 변경될 때마다 sessionStorage에 저장
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(getStorageKey(), page.toString());
        console.log('[ProductGrid] 페이지 상태 저장:', page, 'for', getStorageKey());
      } catch (error) {
        console.error('[ProductGrid] 페이지 상태 저장 실패:', error);
      }
    }
  }, [page, category, searchTerm]);

  // popstate 이벤트 핸들러 - 브라우저 네비게이션 감지
  useEffect(() => {
    const handlePopState = () => {
      console.log('[ProductGrid] popstate 이벤트 감지');
      isNavigatingBack.current = true;

      // sessionStorage에서 현재 URL에 맞는 페이지 상태 복원
      const storedPage = getInitialPage();
      if (storedPage > 1) {
        console.log('[ProductGrid] 뒤로가기 - 페이지 상태 복원:', storedPage);
        setPage(storedPage);
        // 페이지가 2 이상이면 초기 로드로 처리하여 모든 상품 로드
        isInitialLoad.current = true;
      }

      setTimeout(() => {
        isNavigatingBack.current = false;
      }, 100);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [category, searchTerm]);

  // 카테고리 또는 검색어 변경 시 sessionStorage 초기화 (페이지 리셋은 fetchProducts 의존성으로 자동 처리)
  useEffect(() => {
    const categoryChanged = prevCategoryRef.current !== category;
    const searchTermChanged = prevSearchTermRef.current !== searchTerm;

    if ((categoryChanged || searchTermChanged) && !isNavigatingBack.current) {
      console.log('[ProductGrid] 카테고리/검색어 변경 감지 - 세션 스토리지 초기화');
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(getStorageKey());
        } catch {}
      }
    }

    prevCategoryRef.current = category;
    prevSearchTermRef.current = searchTerm;
  }, [category, searchTerm]);

  return (
    <div className="container mx-auto px-4 py-6">
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <LoadingSpinner />
        </div>
      ) : !displayProducts || displayProducts.length === 0 ? (
        <div className="text-center py-20 px-4">
          <p className="text-gray-500 font-bold">
            {searchTerm ? '검색 결과가 없습니다.' : '해당 카테고리에 상품이 없습니다.'}
          </p>
        </div>
      ) : (
        <>
          {/* 상품 그리드 - 3개씩 표시 */}
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            {displayProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {!hasMore && displayProducts.length > 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">모든 상품을 불러왔습니다.</p>
            </div>
          )}
        </>
      )}

      {/* 무한 스크롤 트리거 - 항상 DOM에 유지하여 Observer 재연결 보장 */}
      <div
        ref={observerTarget}
        className="flex justify-center items-center py-8"
        style={{ display: hasMore && !isLoading ? 'flex' : 'none' }}
      >
        {isLoadingMore ? (
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mega-yellow"></div>
            <span className="text-sm text-gray-500">상품 불러오는 중...</span>
          </div>
        ) : (
          <div className="h-10" />
        )}
      </div>
    </div>
  );
}
