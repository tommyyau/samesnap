import React, { useMemo } from 'react';
import { CardData, SymbolItem, CardDifficulty } from '../types';

interface CardProps {
  card: CardData;
  size: number;
  onClickSymbol?: (symbol: SymbolItem) => void;
  disabled?: boolean;
  highlightError?: boolean;
  highlightSymbolId?: number | null; // ID of the symbol to flash
  layoutMode?: CardDifficulty;
  className?: string;
  interactive?: boolean;
  label?: string; // New prop for curved text
}

const Card: React.FC<CardProps> = ({ 
  card, 
  size, 
  onClickSymbol, 
  disabled = false, 
  highlightError = false,
  highlightSymbolId = null,
  layoutMode = CardDifficulty.EASY,
  className = '',
  interactive = true,
  label
}) => {
  // Precompute layout
  const symbolLayout = useMemo(() => {
    const numSymbols = card.symbols.length;
    
    if (layoutMode === CardDifficulty.EASY) {
      // ORDERLY LAYOUT: 1 in center, rest in a circle
      // Text is now on circumference, so symbols use full card space
      return card.symbols.map((symbol, index) => {
        if (index === 0) {
          // Center symbol - true center now that text is on edge
          return {
            symbol,
            x: 50,
            y: 50,
            scale: 1.4,
            rotation: Math.random() * 360
          };
        }
        // Surrounding symbols - larger radius for better spread
        const angle = ((index - 1) / (numSymbols - 1)) * 2 * Math.PI;
        const radius = 30; // Increased from 26 for better spread
        const x = 50 + radius * Math.cos(angle - Math.PI / 2); // Start from top
        const y = 50 + radius * Math.sin(angle - Math.PI / 2); // Centered at true middle
        const scale = 0.9;
        const rotation = Math.random() * 360;

        return { symbol, x, y, scale, rotation };
      });

    } else {
      // CHAOTIC LAYOUT (Medium and Hard)
      // Text is now on circumference, so symbols use full card space
      // Hard mode has more extreme size variation
      const isHard = layoutMode === CardDifficulty.HARD;
      const minScale = isHard ? 0.6 : 0.85;
      const scaleRange = isHard ? 0.9 : 0.4; // 0.6-1.5 for hard, 0.85-1.25 for medium

      // 1. Initialize with random positions
      const items = card.symbols.map((symbol) => {
        const scale = minScale + Math.random() * scaleRange;
        const angle = Math.random() * 2 * Math.PI;
        const r = Math.random() * 30; // Increased spread

        return {
          symbol,
          scale,
          x: 50 + r * Math.cos(angle),
          y: 50 + r * Math.sin(angle),
          radius: (12.5 * scale) * 0.9,
          rotation: Math.random() * 360,
          vx: 0,
          vy: 0
        };
      });

      // 2. Physics Simulation
      const iterations = 50;
      const center = { x: 50, y: 50 }; // True center - no offset needed
      const containerRadius = 42; // Use more of the card
      const padding = 2;

      for (let i = 0; i < iterations; i++) {
        // A. Repulsion between symbols
        for (let a = 0; a < items.length; a++) {
          for (let b = a + 1; b < items.length; b++) {
            const itemA = items[a];
            const itemB = items[b];

            let dx = itemA.x - itemB.x;
            let dy = itemA.y - itemB.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = itemA.radius + itemB.radius + padding;

            if (dist < minDist) {
              if (dist === 0) {
                dx = Math.random() - 0.5;
                dy = Math.random() - 0.5;
                dist = Math.sqrt(dx*dx + dy*dy);
              }
              const overlap = minDist - dist;
              const pushX = (dx / dist) * (overlap * 0.5);
              const pushY = (dy / dist) * (overlap * 0.5);
              itemA.x += pushX;
              itemA.y += pushY;
              itemB.x -= pushX;
              itemB.y -= pushY;
            }
          }
        }

        // B. Boundary Constraint - keep within circle
        items.forEach(item => {
          const dx = item.x - center.x;
          const dy = item.y - center.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = containerRadius - item.radius - 2;

          if (dist > maxDist) {
            const ratio = maxDist / Math.max(dist, 0.1);
            item.x = center.x + dx * ratio;
            item.y = center.y + dy * ratio;
          }
        });
      }

      return items.map(item => ({
        symbol: item.symbol,
        x: item.x,
        y: item.y,
        scale: item.scale,
        rotation: item.rotation
      }));
    }
  }, [card.id, card.symbols, layoutMode]);

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: size, height: size }}>
      
      {/* 1. The Actual Card Circle */}
      <div 
        className={`
          relative w-full h-full rounded-full bg-white shadow-xl border-4 transition-all duration-300 overflow-hidden z-10
          ${highlightError ? 'border-red-500 animate-pulse bg-red-50' : 'border-indigo-200'}
          ${disabled ? 'cursor-not-allowed' : ''}
          ${interactive && !disabled ? 'hover:border-indigo-400' : ''}
          ${className}
        `}
      >
        {symbolLayout.map((item, i) => {
          const isMatch = highlightSymbolId === item.symbol.id;
          const isDimmed = highlightSymbolId !== null && !isMatch;

          return (
            <div
              key={`${card.id}-${item.symbol.id}-${i}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled && onClickSymbol) onClickSymbol(item.symbol);
              }}
              className={`
                absolute flex items-center justify-center select-none
                transition-all duration-500
                ${interactive && !disabled ? 'cursor-pointer hover:scale-125 active:scale-95' : ''}
                ${isMatch ? 'z-50 scale-150 drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]' : ''}
                ${isDimmed ? 'opacity-20 blur-[1px]' : 'opacity-100'}
              `}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                width: `${25 * item.scale}%`,
                height: `${25 * item.scale}%`,
                transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${isMatch ? 1.5 : 1})`,
                fontSize: `${size * 0.15 * item.scale}px`,
              }}
            >
              {item.symbol.char}
            </div>
          );
        })}
      </div>

      {/* 2. Curved Label ABOVE the card - clear separation from border */}
      {label && (
        <div className="absolute z-20 pointer-events-none" style={{
          width: size * 1.2,
          height: size * 1.2,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)'
        }}>
          <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
            <defs>
              {/*
                Path: Arc ON the card border to cover the circumference line
                Card edge is at radius 50 from center (60,60)
                Text arc at radius 50 - sits right on the border
              */}
              <path id={`label-curve-${card.id}`} d="M 10,60 A 50,50 0 0 1 110,60" />
            </defs>
            {/* White stroke behind text for contrast */}
            <text
              style={{
                fontSize: size * 0.038,
                fill: 'none',
                stroke: 'white',
                strokeWidth: 4,
                fontFamily: 'Fredoka, sans-serif',
                fontWeight: 800,
                textAnchor: 'middle',
                dominantBaseline: 'middle',
                letterSpacing: '0.15em',
                pointerEvents: 'none',
                userSelect: 'none'
              }}
            >
              <textPath href={`#label-curve-${card.id}`} startOffset="50%">
                {label}
              </textPath>
            </text>
            {/* Main text */}
            <text
              style={{
                fontSize: size * 0.038,
                fill: '#1e1b4b', // indigo-950 - very dark for contrast
                fontFamily: 'Fredoka, sans-serif',
                fontWeight: 800,
                textAnchor: 'middle',
                dominantBaseline: 'middle',
                letterSpacing: '0.15em',
                pointerEvents: 'none',
                userSelect: 'none'
              }}
            >
              <textPath href={`#label-curve-${card.id}`} startOffset="50%">
                {label}
              </textPath>
            </text>
          </svg>
        </div>
      )}

    </div>
  );
};

export default Card;