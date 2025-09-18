import React from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

interface ScrollAnimatedCardProps {
  children: React.ReactNode;
  index: number;
  className?: string;
}

const ScrollAnimatedCard: React.FC<ScrollAnimatedCardProps> = ({ 
  children, 
  index, 
  className = "" 
}) => {
  const { elementRef, isVisible } = useScrollAnimation(0.5);

  return (
    <div
      ref={elementRef}
      className={`
        flex-shrink-0 animate-fade-in transition-all duration-500 ease-out hover:scale-110 hover:z-20 relative
        ${isVisible ? 'scale-105 shadow-xl shadow-primary/20' : 'scale-100'}
        ${className}
      `}
      style={{ 
        animationDelay: `${index * 0.1}s`,
        transform: isVisible ? 'scale(1.05) translateY(-8px)' : 'scale(1) translateY(0px)',
        transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
};

export default ScrollAnimatedCard;