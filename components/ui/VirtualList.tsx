
import React, { useState, useEffect, useRef, useMemo } from 'react';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  containerHeight: number;
  className?: string;
  overscan?: number;
}

const VirtualList = <T,>({ items, renderItem, itemHeight, containerHeight, className = '', overscan = 3 }: VirtualListProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalHeight = items.length * itemHeight;
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = useMemo(() => {
      return items.slice(startIndex, endIndex).map((item, index) => ({
          item,
          index: startIndex + index,
          top: (startIndex + index) * itemHeight
      }));
  }, [items, startIndex, endIndex, itemHeight]);

  return (
    <div 
      ref={containerRef}
      className={`overflow-y-auto relative ${className}`} 
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, top }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: itemHeight,
              transform: `translateY(${top}px)`,
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VirtualList;
