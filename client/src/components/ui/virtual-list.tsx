import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((index: number) => number);
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
  containerClassName?: string;
  onScroll?: (scrollTop: number) => void;
  estimatedItemHeight?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

interface VisibleRange {
  start: number;
  end: number;
}

function VirtualListComponent<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 3,
  className,
  containerClassName,
  onScroll,
  estimatedItemHeight = 50,
  getItemKey,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({ start: 0, end: 10 });
  const [containerHeight, setContainerHeight] = useState(0);
  const itemHeightCache = useRef<Map<number, number>>(new Map());

  // Calculate item height
  const getItemHeight = useCallback(
    (index: number): number => {
      if (typeof itemHeight === 'function') {
        if (!itemHeightCache.current.has(index)) {
          itemHeightCache.current.set(index, itemHeight(index));
        }
        return itemHeightCache.current.get(index) || estimatedItemHeight;
      }
      return itemHeight;
    },
    [itemHeight, estimatedItemHeight]
  );

  // Calculate total height
  const getTotalHeight = useCallback((): number => {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
      total += getItemHeight(i);
    }
    return total;
  }, [items.length, getItemHeight]);

  // Calculate item offset
  const getItemOffset = useCallback(
    (index: number): number => {
      let offset = 0;
      for (let i = 0; i < index; i++) {
        offset += getItemHeight(i);
      }
      return offset;
    },
    [getItemHeight]
  );

  // Find start index for a given scroll position
  const findStartIndex = useCallback(
    (scrollTop: number): number => {
      let accumulatedHeight = 0;
      for (let i = 0; i < items.length; i++) {
        accumulatedHeight += getItemHeight(i);
        if (accumulatedHeight > scrollTop) {
          return Math.max(0, i - overscan);
        }
      }
      return Math.max(0, items.length - 1);
    },
    [items.length, getItemHeight, overscan]
  );

  // Find end index for a given scroll position
  const findEndIndex = useCallback(
    (scrollTop: number, containerHeight: number): number => {
      const viewportEnd = scrollTop + containerHeight;
      let accumulatedHeight = 0;
      for (let i = 0; i < items.length; i++) {
        accumulatedHeight += getItemHeight(i);
        if (accumulatedHeight >= viewportEnd) {
          return Math.min(items.length - 1, i + overscan);
        }
      }
      return items.length - 1;
    },
    [items.length, getItemHeight, overscan]
  );

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const scrollTop = containerRef.current.scrollTop;
    const startIndex = findStartIndex(scrollTop);
    const endIndex = findEndIndex(scrollTop, containerHeight);

    setVisibleRange({ start: startIndex, end: endIndex });
    onScroll?.(scrollTop);
  }, [containerHeight, findStartIndex, findEndIndex, onScroll]);

  // Handle resize
  useEffect(() => {
    const updateContainerHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        setContainerHeight(height);
        handleScroll();
      }
    };

    updateContainerHeight();

    const resizeObserver = new ResizeObserver(updateContainerHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleScroll]);

  // Update visible range when items change
  useEffect(() => {
    handleScroll();
  }, [items, handleScroll]);

  const totalHeight = getTotalHeight();
  const offsetY = getItemOffset(visibleRange.start);

  // Render visible items
  const visibleItems = [];
  for (let i = visibleRange.start; i <= visibleRange.end && i < items.length; i++) {
    const item = items[i];
    const key = getItemKey ? getItemKey(item, i) : i;
    const height = getItemHeight(i);
    const top = getItemOffset(i) - offsetY;

    visibleItems.push(
      <div
        key={key}
        style={{
          position: 'absolute',
          top: `${top}px`,
          left: 0,
          right: 0,
          height: `${height}px`,
        }}
      >
        {renderItem(item, i)}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-auto', containerClassName)}
      onScroll={handleScroll}
    >
      <div
        className={cn('relative', className)}
        style={{
          height: `${totalHeight}px`,
        }}
      >
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems}
        </div>
      </div>
    </div>
  );
}

// Memoized version for better performance
export const VirtualList = memo(VirtualListComponent) as typeof VirtualListComponent;

// Hook for virtual scrolling logic
export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3,
}: {
  items: T[];
  itemHeight: number | ((index: number) => number);
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const getItemHeight = useCallback(
    (index: number): number => {
      if (typeof itemHeight === 'function') {
        return itemHeight(index);
      }
      return itemHeight;
    },
    [itemHeight]
  );

  const visibleRange = React.useMemo(() => {
    let accumulatedHeight = 0;
    let start = 0;
    let end = items.length - 1;

    // Find start index
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i);
      if (accumulatedHeight + height > scrollTop) {
        start = Math.max(0, i - overscan);
        break;
      }
      accumulatedHeight += height;
    }

    // Find end index
    accumulatedHeight = 0;
    for (let i = start; i < items.length; i++) {
      if (accumulatedHeight > containerHeight) {
        end = Math.min(items.length - 1, i + overscan);
        break;
      }
      accumulatedHeight += getItemHeight(i);
    }

    return { start, end };
  }, [items.length, scrollTop, containerHeight, overscan, getItemHeight]);

  const totalHeight = React.useMemo(() => {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
      total += getItemHeight(i);
    }
    return total;
  }, [items.length, getItemHeight]);

  const offsetY = React.useMemo(() => {
    let offset = 0;
    for (let i = 0; i < visibleRange.start; i++) {
      offset += getItemHeight(i);
    }
    return offset;
  }, [visibleRange.start, getItemHeight]);

  return {
    visibleRange,
    totalHeight,
    offsetY,
    scrollTop,
    setScrollTop,
  };
}

export default VirtualList;
