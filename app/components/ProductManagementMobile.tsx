'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Filter, Plus, Trash2, MoreVertical,
  CheckSquare, Square, ChevronDown, X, Edit,
  Camera, FileText, FileSpreadsheet
} from 'lucide-react';
import ProductAddModal from './ProductAddModal';
import ProductEditModal from './ProductEditModal';

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
  product_images?: Array<{
    id: string;
    image_url: string;
    display_order: number;
  }>;
}

const categories = [
  '전체', '남성 상의', '남성 하의', '여성 의류',
  '모자', '벨트', '신발', '숄/머플러', '가방',
  '지갑', '안경/선글라스', '시계/넥타이', '악세서리', '향수', '기타'
];

export default function ProductManagementMobile() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [isLoading, setIsLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsPerPage = 20;

  // 상품 목록 불러오기 - Supabase 직접 호출
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const { supabase } = await import('../../lib/supabase');
      
      // 상품 데이터 가져오기 (soft delete된 상품 제외)
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1000);
      
      if (error) throw error;
      
      if (products) {
        // 상품 이미지 가져오기
        const productsWithImages = await Promise.all(
          products.map(async (product) => {
            const { data: images } = await supabase
              .from('product_images')
              .select('*')
              .eq('product_id', product.id)
              .order('display_order');
            
            return {
              ...product,
              product_images: images || [],
              additional_images: images?.map(img => img.image_url) || []
            };
          })
        );
        
        setProducts(productsWithImages);
        setFilteredProducts(productsWithImages);
      } else {
        setProducts([]);
        setFilteredProducts([]);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // 필터링
  useEffect(() => {
    let filtered = [...products];

    if (selectedCategory && selectedCategory !== '전체') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.brand.toLowerCase().includes(term)
      );
    }

    setFilteredProducts(filtered);
    setPage(1);
  }, [products, selectedCategory, searchTerm]);

  // 페이지네이션
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, page]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // 상품 선택
  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedProducts.length === paginatedProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(paginatedProducts.map(p => p.id));
    }
  };

  // 단일 삭제 - soft delete (RPC 함수 사용)
  const handleSingleDelete = async (productId: string) => {
    if (!confirm('이 상품을 삭제하시겠습니까?')) return;

    setIsLoading(true);
    try {
      const { supabase } = await import('../../lib/supabase');

      const { data, error } = await supabase.rpc('soft_delete_products', {
        product_ids: [productId]
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || '삭제 실패');

      setProducts(prev => prev.filter(p => p.id !== productId));
      setSelectedProducts(prev => prev.filter(id => id !== productId));
    } catch (error: any) {
      console.error('상품 삭제 오류:', error);
      alert(`삭제 중 오류가 발생했습니다: ${error?.message || '알 수 없는 오류'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 일괄 삭제 - soft delete (RPC 함수 사용)
  const handleBulkDelete = async () => {
    if (selectedProducts.length > 20) {
      alert('한 번에 20개까지만 삭제할 수 있습니다. 선택을 줄여주세요.');
      return;
    }
    if (!confirm(`선택한 ${selectedProducts.length}개 상품을 삭제하시겠습니까?`)) return;

    setIsLoading(true);
    try {
      const { supabase } = await import('../../lib/supabase');

      const { data, error } = await supabase.rpc('soft_delete_products', {
        product_ids: selectedProducts
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || '삭제 실패');

      setProducts(prev => prev.filter(p => !selectedProducts.includes(p.id)));
      setSelectedProducts([]);
      setShowBulkActions(false);
    } catch (error: any) {
      console.error('일괄 삭제 오류:', error);
      alert(`삭제 중 오류가 발생했습니다: ${error?.message || '알 수 없는 오류'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 카테고리 일괄 변경 - Supabase 직접 호출
  const handleBulkCategoryUpdate = async (category: string) => {
    if (!confirm(`선택한 ${selectedProducts.length}개 상품을 "${category}" 카테고리로 이동하시겠습니까?`)) return;
    
    setIsLoading(true);
    try {
      const { supabase } = await import('../../lib/supabase');
      
      for (const id of selectedProducts) {
        const { error } = await supabase
          .from('products')
          .update({ category })
          .eq('id', id);
          
        if (error) {
          console.error('Failed to update product category:', error);
        }
      }
      
      setSelectedProducts([]);
      setShowBulkActions(false);
      fetchProducts();
      alert(`${selectedProducts.length}개 상품이 "${category}" 카테고리로 이동되었습니다.`);
    } catch (error) {
      alert('카테고리 변경 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 상단 헤더 */}
      <div className="sticky top-0 z-30 bg-white shadow-sm">
        {/* 검색바 */}
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="상품명, 브랜드 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-12 py-2 bg-gray-50 rounded-lg text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 min-w-[32px] min-h-[32px] flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* 필터 & 액션바 */}
        <div className="px-4 py-2 flex items-center justify-between">
          <button
            onClick={() => setShowFilterModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{selectedCategory === '전체' ? '카테고리' : selectedCategory}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-2">
            {selectedProducts.length > 0 && (
              <span className="text-sm font-bold text-mega-yellow">
                {selectedProducts.length}개 선택
              </span>
            )}
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 bg-black text-white rounded-lg text-sm font-medium"
            >
              {selectedProducts.length === paginatedProducts.length && selectedProducts.length > 0 
                ? '선택 해제' 
                : '전체 선택'}
            </button>
          </div>
        </div>
      </div>

      {/* 상품 목록 */}
      <div className="px-4 py-4">
        <div className="space-y-3">
          {paginatedProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg p-3 shadow-sm"
            >
              <div className="flex gap-3">
                {/* 체크박스 */}
                <button
                  onClick={() => toggleProductSelection(product.id)}
                  className="flex-shrink-0 mt-1"
                >
                  {selectedProducts.includes(product.id) ? (
                    <CheckSquare className="w-5 h-5 text-mega-yellow" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {/* 상품 이미지 */}
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {(() => {
                    // 이미지 우선순위: product_images > image_url > No Image
                    const imageUrl = product.product_images?.[0]?.image_url || product.image_url;
                    
                    if (imageUrl) {
                      return (
                        <img
                          src={imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-xs text-gray-400">Error</div>';
                            }
                          }}
                        />
                      );
                    } else {
                      return (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                          No Image
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* 상품 정보 */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{product.name}</h3>
                  <p className="text-xs text-gray-500">{product.brand}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-sm">₩{product.price.toLocaleString()}</span>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {product.category}
                    </span>
                  </div>
                </div>

                {/* 편집 버튼 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingProduct(product);
                    setShowEditModal(true);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <Edit className="w-4 h-4 text-gray-600" />
                </button>

              </div>
            </div>
          ))}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = i + Math.max(1, Math.min(page - 2, totalPages - 4));
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-10 h-10 rounded-lg font-medium ${
                    page === pageNum
                      ? 'bg-mega-yellow text-black'
                      : 'bg-white text-gray-700 border'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 플로팅 액션 버튼 (FAB) */}
      <div className="fixed bottom-6 right-6 z-40">
        {/* 메인 FAB 버튼 - 바로 상품 추가 모달 열기 */}
        <button
          onClick={() => {
            setShowProductModal(true);
          }}
          className="w-14 h-14 bg-mega-yellow rounded-full shadow-lg flex items-center justify-center"
        >
          <Plus className="w-6 h-6 text-black" />
        </button>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              alert(`${files.length}개의 이미지가 선택되었습니다.`);
              setShowProductModal(true);
            }
            e.target.value = '';
          }}
        />
      </div>
      

      {/* 선택된 항목이 있을 때 하단 액션바 */}
      {selectedProducts.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-30">
          <div className="flex gap-2">
            <button
              onClick={handleBulkDelete}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-medium"
            >
              삭제 ({selectedProducts.length})
            </button>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkCategoryUpdate(e.target.value);
                  e.target.value = '';
                }
              }}
              className="flex-1 py-2.5 px-3 border rounded-lg"
            >
              <option value="">카테고리 이동</option>
              {categories.filter(cat => cat !== '전체').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* 필터 모달 */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 z-50">
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h3 className="font-bold text-lg">카테고리 선택</h3>
              <button onClick={() => setShowFilterModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setShowFilterModal(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg mb-2 ${
                    selectedCategory === cat
                      ? 'bg-mega-yellow text-black font-medium'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  {cat} 
                  <span className="text-sm text-gray-500 ml-2">
                    ({products.filter(p => cat === '전체' || p.category === cat).length})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 상품 추가 모달 */}
      {showProductModal && (
        <ProductAddModal
          onClose={() => setShowProductModal(false)}
          onSave={() => {
            setShowProductModal(false);
            fetchProducts();
          }}
        />
      )}

      {/* 상품 수정 모달 */}
      {showEditModal && editingProduct && (
        <ProductEditModal
          product={editingProduct}
          onClose={() => {
            setShowEditModal(false);
            setEditingProduct(null);
          }}
          onSave={() => {
            setShowEditModal(false);
            setEditingProduct(null);
            fetchProducts();
          }}
        />
      )}

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mega-yellow"></div>
          </div>
        </div>
      )}
    </div>
  );
}