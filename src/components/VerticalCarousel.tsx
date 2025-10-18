import { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VerticalCarouselProps {
  children: React.ReactNode[];
  itemHeight?: number;
  visibleItems?: number;
  className?: string;
}

const VerticalCarousel = ({ 
  children, 
  itemHeight = 200, 
  visibleItems = 3,
  className = "" 
}: VerticalCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  const totalItems = children.length;
  const maxIndex = Math.max(0, totalItems - visibleItems);

  const scrollToIndex = (index: number) => {
    if (containerRef.current) {
      const scrollTop = index * itemHeight;
      containerRef.current.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
      setCurrentIndex(index);
    }
  };

  const handleScroll = () => {
    if (!containerRef.current || isScrolling) return;

    setIsScrolling(true);
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (containerRef.current) {
        const scrollTop = containerRef.current.scrollTop;
        const newIndex = Math.round(scrollTop / itemHeight);
        setCurrentIndex(Math.min(Math.max(0, newIndex), maxIndex));
      }
      setIsScrolling(false);
    }, 150);
  };

  const scrollUp = () => {
    const newIndex = Math.max(0, currentIndex - 1);
    scrollToIndex(newIndex);
  };

  const scrollDown = () => {
    const newIndex = Math.min(maxIndex, currentIndex + 1);
    scrollToIndex(newIndex);
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const getItemScale = (index: number) => {
    const centerIndex = currentIndex + Math.floor(visibleItems / 2);
    const distance = Math.abs(index - centerIndex);
    
    if (distance === 0) return 1.15; // Center item - pops out more
    if (distance === 1) return 1.0; // Adjacent items - normal size
    return 0.95; // Other items - slightly smaller
  };

  const getItemOpacity = (index: number) => {
    const centerIndex = currentIndex + Math.floor(visibleItems / 2);
    const distance = Math.abs(index - centerIndex);
    
    if (distance === 0) return 1; // Center item - full opacity
    if (distance === 1) return 0.8; // Adjacent items
    if (distance === 2) return 0.6; // Further items
    return 0.4; // Distant items
  };

  return (
    <div className={`relative ${className}`}>
      {/* Scroll Up Button */}
      {currentIndex > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={scrollUp}
          className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-background"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      )}

      {/* Carousel Container */}
      <div
        ref={containerRef}
        className="overflow-y-auto scrollbar-hide"
        style={{ 
          height: `${visibleItems * itemHeight}px`,
          scrollSnapType: 'y mandatory'
        }}
        onScroll={handleScroll}
      >
        <div className="space-y-12">
          {children.map((child, index) => (
            <div
              key={index}
              className="transition-all duration-500 ease-out origin-center"
              style={{
                height: `${itemHeight}px`,
                transform: `scale(${getItemScale(index)})`,
                opacity: getItemOpacity(index),
                scrollSnapAlign: 'start',
                zIndex: getItemScale(index) === 1.15 ? 10 : 1
              }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Scroll Down Button */}
      {currentIndex < maxIndex && (
        <Button
          variant="ghost"
          size="sm"
          onClick={scrollDown}
          className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 z-10 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-background"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}

      {/* Progress Indicators */}
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex flex-col gap-1">
        {Array.from({ length: Math.min(totalItems, visibleItems + 2) }).map((_, index) => (
          <div
            key={index}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              index >= currentIndex && index < currentIndex + visibleItems
                ? 'bg-primary'
                : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default VerticalCarousel;