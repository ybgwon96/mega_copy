
// 중앙화된 Supabase 클라이언트 사용 (중복 인스턴스 방지)
import { supabase } from '../../lib/supabase'


export const productsAPI = {
  async getAll(params?: {
    limit?: number
    offset?: number
    search?: string
    category?: string
  }) {
    const { data, error } = await supabase.rpc('get_products', {
      limit_count: params?.limit || 50,
      offset_count: params?.offset || 0,
      search_query: params?.search || '',
      category_filter: params?.category || ''
    })

    if (error) throw error
    
    if (data && typeof data === 'object' && 'data' in data) {
      return Array.isArray(data.data) ? data.data : []
    }
    
    return Array.isArray(data) ? data : []
  },

  async getById(id: string) {
    const { data, error } = await supabase.rpc('get_product_by_id', {
      product_id: id
    })

    if (error) throw error
    return data
  },

  /**
   * 상품 추가
   */
  async create(product: {
    name: string
    price: number
    description?: string
    category?: string
    image_url?: string
    stock?: number
    additional_images?: string[]
  }) {
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: product.name,
        price: product.price,
        description: product.description || '',
        category: product.category || '',
        image_url: product.image_url || '',
        stock: product.stock || 0,
        additional_images: product.additional_images || [],
        is_active: true
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase.rpc('update_product', {
      product_id: id,
      product_data: updates
    })

    if (error) throw error
    return data
  },

  async delete(id: string) {
    const { data, error } = await supabase.rpc('soft_delete_products', {
      product_ids: [id]
    })

    if (error) throw error
    if (!data?.success) throw new Error(data?.error || '삭제 실패')
    return data
  },

  async search(params: {
    term?: string
    category?: string
    minPrice?: number
    maxPrice?: number
    inStockOnly?: boolean
  }) {
    const { data, error } = await supabase.rpc('search_products', {
      search_term: params.term || '',
      search_category: params.category || null,
      min_price: params.minPrice || null,
      max_price: params.maxPrice || null,
      in_stock_only: params.inStockOnly || false
    })

    if (error) throw error
    return data
  },

  async getCategories() {
    const { data, error } = await supabase.rpc('get_categories')

    if (error) throw error
    return data
  }
}


export const adminAPI = {
  async login(username: string, password: string) {
    const { data, error } = await supabase.rpc('admin_login', {
      username_input: username,
      password_input: password
    })

    if (error) throw error
    
    // 로그인 성공 시 토큰 저장
    if (data?.success && data?.token) {
      localStorage.setItem('admin_token', data.token)
      localStorage.setItem('admin_data', JSON.stringify(data.admin))
    }
    
    return data
  },

  /**
   * 관리자 로그아웃
   */
  logout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_data')
    return { success: true }
  },

  /**
   * 현재 관리자 정보
   */
  getCurrentAdmin() {
    const adminData = localStorage.getItem('admin_data')
    return adminData ? JSON.parse(adminData) : null
  },

  /**
   * 관리자 토큰 확인
   */
  isAuthenticated() {
    return !!localStorage.getItem('admin_token')
  },

  /**
   * 관리자 통계
   */
  async getStats() {
    const { data, error } = await supabase.rpc('get_admin_stats')

    if (error) throw error
    return data
  }
}

// ========================================
// Orders API
// ========================================

export const ordersAPI = {
  /**
   * 주문 생성
   */
  async create(order: {
    customer_name: string
    customer_phone: string
    customer_address?: string
    product_id: string
    product_name: string
    quantity: number
    total_price: number
  }) {
    const { data, error } = await supabase.rpc('create_order', {
      order_data: order
    })

    if (error) throw error
    return data
  },

  /**
   * 주문 목록 조회
   */
  async getAll(params?: {
    limit?: number
    offset?: number
    status?: string
  }) {
    const { data, error } = await supabase.rpc('get_orders', {
      limit_count: params?.limit || 50,
      offset_count: params?.offset || 0,
      status_filter: params?.status || ''
    })

    if (error) throw error
    return data
  },

  /**
   * 주문 상태 업데이트
   */
  async updateStatus(orderId: string, status: string) {
    const { data, error } = await supabase.rpc('update_order_status', {
      order_id: orderId,
      new_status: status
    })

    if (error) throw error
    return data
  }
}

// ========================================
// Storage API (이미지 업로드)
// ========================================

export const storageAPI = {
  /**
   * 이미지 업로드 (Supabase Storage 직접 호출)
   */
  async uploadImage(file: File) {
    try {
      // 파일 검증
      if (!file) throw new Error('파일이 없습니다')
      if (file.size > 5 * 1024 * 1024) throw new Error('파일 크기는 5MB 이하여야 합니다')
      
      // 파일명 생성
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const fileExt = file.name.split('.').pop()
      const fileName = `${timestamp}-${randomString}.${fileExt}`
      const filePath = `products/${fileName}`
      
      // Supabase Storage에 직접 업로드
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        })
      
      if (error) {
        console.error('Storage upload error:', error)
        
        // Bucket이 없는 경우 생성 시도
        if (error.message?.includes('bucket') || error.message?.includes('not found')) {
          const { error: createError } = await supabase.storage.createBucket('product-images', {
            public: true,
            allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
          })
          
          if (!createError) {
            // 다시 업로드 시도
            const { data: retryData, error: retryError } = await supabase.storage
              .from('product-images')
              .upload(filePath, file, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false
              })
            
            if (retryError) throw retryError
          }
        } else {
          throw error
        }
      }
      
      // Public URL 생성
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath)
      
      return publicUrl
    } catch (error: any) {
      console.error('Image upload failed:', error)
      throw new Error(error.message || '이미지 업로드 실패')
    }
  },

  /**
   * 이미지 삭제
   */
  async deleteImage(url: string) {
    try {
      // URL에서 파일명 추출
      const fileName = url.split('/').pop()
      if (!fileName) throw new Error('잘못된 이미지 URL')
      
      const { error } = await supabase.storage
        .from('product-images')
        .remove([fileName])

      if (error) throw error
      return { success: true }
    } catch (error: any) {
      console.error('Image delete failed:', error)
      throw new Error(error.message || '이미지 삭제 실패')
    }
  },

  /**
   * 여러 이미지 업로드
   */
  async uploadMultipleImages(files: File[]) {
    const uploadPromises = files.map(file => this.uploadImage(file))
    const results = await Promise.allSettled(uploadPromises)
    
    const uploaded = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<string>).value)
    
    const failed = results
      .filter(r => r.status === 'rejected')
      .map(r => (r as PromiseRejectedResult).reason)
    
    return { uploaded, failed }
  }
}

// ========================================
// Realtime 구독 (선택사항)
// ========================================

export const realtimeAPI = {
  /**
   * Products 테이블 변경 구독
   */
  subscribeToProducts(callback: (payload: any) => void) {
    return supabase
      .channel('products-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'products' },
        callback
      )
      .subscribe()
  },

  /**
   * Orders 테이블 변경 구독
   */
  subscribeToOrders(callback: (payload: any) => void) {
    return supabase
      .channel('orders-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        callback
      )
      .subscribe()
  },

  /**
   * 구독 해제
   */
  unsubscribe(channel: any) {
    supabase.removeChannel(channel)
  }
}

// ========================================
// 유틸리티 함수
// ========================================

export const utils = {
  /**
   * 에러 처리
   */
  handleError(error: any) {
    console.error('Supabase Error:', error)
    
    if (error.code === '42501') {
      return '권한이 없습니다.'
    }
    if (error.code === '23505') {
      return '이미 존재하는 데이터입니다.'
    }
    if (error.code === '23503') {
      return '참조하는 데이터가 존재하지 않습니다.'
    }
    
    return error.message || '알 수 없는 오류가 발생했습니다.'
  },

  /**
   * 페이지네이션 계산
   */
  calculatePagination(currentPage: number, itemsPerPage: number) {
    return {
      offset: (currentPage - 1) * itemsPerPage,
      limit: itemsPerPage
    }
  }
}

// 기본 export
export default {
  products: productsAPI,
  admin: adminAPI,
  orders: ordersAPI,
  storage: storageAPI,
  realtime: realtimeAPI,
  utils
}