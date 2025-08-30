/**
 * Utilitário para Virtual Scrolling otimizado
 */

export interface VirtualScrollConfig {
    itemHeight: number
    containerHeight: number
    itemCount: number
    overscan?: number
  }
  
  export interface VirtualScrollResult {
    startIndex: number
    endIndex: number
    totalHeight: number
    offsetY: number
  }
  
  export function calculateVisibleRange(
    scrollTop: number,
    config: VirtualScrollConfig
  ): VirtualScrollResult {
    const { itemHeight, containerHeight, itemCount, overscan = 5 } = config
    
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      itemCount,
      Math.ceil((scrollTop + containerHeight) / itemHeight)
    )
    
    const visibleStartIndex = Math.max(0, startIndex - overscan)
    const visibleEndIndex = Math.min(itemCount, endIndex + overscan)
    
    return {
      startIndex: visibleStartIndex,
      endIndex: visibleEndIndex,
      totalHeight: itemCount * itemHeight,
      offsetY: visibleStartIndex * itemHeight
    }
  }
  
  export function useVirtualScroll(config: VirtualScrollConfig, scrollTop: number) {
    return calculateVisibleRange(scrollTop, config)
  }