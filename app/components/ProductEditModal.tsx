'use client';

import { useState, useEffect } from 'react';
import { X, Upload, Loader } from 'lucide-react';
import { storageAPI } from '../lib/supabase-rpc-api';

interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  category: string;
  description?: string;
  product_images?: Array<{
    id: string;
    image_url: string;
    display_order: number;
  }>;
}

interface ProductEditModalProps {
  product: Product;
  onClose: () => void;
  onSave: (updatedProduct?: any) => void;
}

const categories = [
  '남성 상의', '남성 하의', '여성 의류',
  '모자', '벨트', '신발', '숄/머플러', '가방',
  '지갑', '안경/선글라스', '시계/넥타이', '악세서리', '향수', '기타'
];

export default function ProductEditModal({ product, onClose, onSave }: ProductEditModalProps) {
  const [formData, setFormData] = useState({
    name: product.name,
    price: product.price,
    category: product.category,
    description: product.description || ''
  });
  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState(product.product_images || []);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // 이미지 선택 처리
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(prev => [...prev, ...files]);
    
    // 미리보기 URL 생성
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...urls]);
  };

  // 기존 이미지 삭제
  const handleDeleteExistingImage = (imageId: string) => {
    setExistingImages(prev => prev.filter(img => img.id !== imageId));
    setDeletedImageIds(prev => [...prev, imageId]);
  };

  // 새 이미지 제거
  const handleRemoveNewImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // 상품 수정 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || formData.price <= 0) {
      alert('필수 정보를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      // 새 이미지 업로드
      let uploadedImageUrls: string[] = [];
      if (images.length > 0) {
        const uploadResult = await storageAPI.uploadMultipleImages(images);
        uploadedImageUrls = uploadResult.uploaded;
        
        if (uploadResult.failed.length > 0) {
          console.error('Some images failed to upload:', uploadResult.failed);
        }
      }

      // Supabase 직접 호출로 상품 수정
      const { supabase } = await import('../../lib/supabase');
      
      // 1. products 테이블 업데이트
      const mainImageUrl = existingImages[0]?.image_url || uploadedImageUrls[0] || null;
      
      const { error: updateError } = await supabase
        .from('products')
        .update({
          name: formData.name,
          price: formData.price,
          category: formData.category,
          description: formData.description,
          image_url: mainImageUrl // 첫 번째 이미지를 메인 이미지로
        })
        .eq('id', product.id);

      if (updateError) {
        throw new Error('상품 수정에 실패했습니다: ' + updateError.message);
      }

      // 2. 기존 product_images 삭제
      if (deletedImageIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('product_images')
          .delete()
          .in('id', deletedImageIds);
          
        if (deleteError) {
          console.error('이미지 삭제 오류:', deleteError);
        }
      }

      // 3. 새로운 이미지 추가
      if (uploadedImageUrls.length > 0) {
        const currentMaxOrder = existingImages.length;
        const newImages = uploadedImageUrls.map((url, index) => ({
          product_id: product.id,
          image_url: url,
          display_order: currentMaxOrder + index + 1
        }));

        const { error: insertError } = await supabase
          .from('product_images')
          .insert(newImages);
          
        if (insertError) {
          console.error('이미지 추가 오류:', insertError);
        }
      }

      alert('상품이 성공적으로 수정되었습니다!');

      // 낙관적 업데이트를 위해 수정된 상품 데이터 전달
      const allImages = [
        ...existingImages,
        ...uploadedImageUrls.map((url, i) => ({
          id: `new-${i}`,
          image_url: url,
          display_order: existingImages.length + i + 1
        }))
      ];
      const updatedProduct = {
        ...product,
        name: formData.name,
        price: formData.price,
        category: formData.category,
        description: formData.description,
        image_url: mainImageUrl,
        product_images: allImages,
        additional_images: allImages.map(img => img.image_url)
      };
      onSave(updatedProduct);
    } catch (error) {
      console.error('Error updating product:', error);
      alert('상품 수정 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 언마운트 시 미리보기 URL 정리
  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">상품 수정</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 기본 정보 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품명 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-mega-yellow"
              required
              suppressHydrationWarning
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              가격 *
            </label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-mega-yellow"
              required
              min="0"
              suppressHydrationWarning
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              카테고리 *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-mega-yellow"
              required
            >
              <option value="">카테고리 선택</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-mega-yellow"
              rows={3}
            />
          </div>

          {/* 기존 이미지 */}
          {existingImages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                기존 이미지
              </label>
              <div className="grid grid-cols-3 gap-2">
                {existingImages.map((img) => (
                  <div key={img.id} className="relative">
                    <img
                      src={img.image_url}
                      alt="상품 이미지"
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingImage(img.id)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 새 이미지 추가 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              새 이미지 추가
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
                <Upload className="w-4 h-4" />
                <span>이미지 선택</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  suppressHydrationWarning
                />
              </label>
              {images.length > 0 && (
                <span className="text-sm text-gray-600">
                  {images.length}개 선택됨
                </span>
              )}
            </div>
            
            {/* 새 이미지 미리보기 */}
            {previewUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {previewUrls.map((url, index) => (
                  <div key={index} className="relative">
                    <img
                      src={url}
                      alt={`새 이미지 ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveNewImage(index)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 bg-mega-yellow text-black rounded-lg hover:bg-yellow-400 font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  수정 중...
                </>
              ) : (
                '상품 수정'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}