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
  label?: string; // Curved text on card circumference
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
      return card.symbols.map((symbol, index) => {
        if (index === 0) {
          // Center symbol
          return {
            symbol,
            x: 50,
            y: 50,
            scale: 1.4, // Slightly larger
            rotation: Math.random() * 360
          };
        }
        // Surrounding symbols
        const angle = ((index - 1) / (numSymbols - 1)) * 2 * Math.PI;
        const radius = 33; 
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        const scale = 0.9;
        const rotation = Math.random() * 360;

        return { symbol, x, y, scale, rotation };
      });

    } else {
      // CHAOTIC LAYOUT (Medium): Physics-Based Relaxation
      // This algorithm places items and then iteratively "pushes" them apart to resolve overlaps.
      // It is much more robust than random placement for packing irregular sizes in a circle.

      // 1. Initialize with random positions and scales
      const items = card.symbols.map((symbol) => {
        // Scale variance: 0.85 to 1.25 (slightly smaller max to ensure fit)
        const scale = 0.85 + Math.random() * 0.4; 
        
        // Initial random position: Start somewhat spread out (r=0-30) to avoid initial "singularity"
        const angle = Math.random() * 2 * Math.PI;
        const r = Math.random() * 30; 
        
        return {
          symbol,
          scale,
          x: 50 + r * Math.cos(angle),
          y: 50 + r * Math.sin(angle),
          // Estimated collision radius in % (25% is base size, so radius is ~12.5% * scale)
          // We add a small buffer for visual spacing
          radius: (12.5 * scale) * 0.9, 
          rotation: Math.random() * 360,
          vx: 0,
          vy: 0
        };
      });

      // 2. Physics Simulation / Relaxation Loop
      const iterations = 50;
      const center = { x: 50, y: 50 };
      const containerRadius = 50; 
      const padding = 2; // % padding between items

      for (let i = 0; i < iterations; i++) {
        // A. Repulsion (Resolve Overlaps)
        for (let a = 0; a < items.length; a++) {
          for (let b = a + 1; b < items.length; b++) {
            const itemA = items[a];
            const itemB = items[b];

            let dx = itemA.x - itemB.x;
            let dy = itemA.y - itemB.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            
            // Desired distance
            const minDist = itemA.radius + itemB.radius + padding;

            if (dist < minDist) {
              // Overlap detected!
              if (dist === 0) {
                // Handle exact overlap
                dx = Math.random() - 0.5;
                dy = Math.random() - 0.5;
                dist = Math.sqrt(dx*dx + dy*dy);
              }
              
              // Calculate push amount (half each way)
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

        // B. Boundary Constraint (Keep in Circle)
        items.forEach(item => {
          let dx = item.x - center.x;
          let dy = item.y - center.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          
          // Max allowable distance from center for this item
          // (Container Radius - Item Radius - Edge Padding)
          const maxDist = containerRadius - item.radius - 2; 

          if (dist > maxDist) {
            // Push back inside
            if (dist === 0) dist = 0.1;
            const ratio = maxDist / dist;
            item.x = center.x + dx * ratio;
            item.y = center.y + dy * ratio;
          }
        });
      }

      // Return final layout
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

      {/* The Actual Card Circle */}
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

      {/* Curved Label on card circumference */}
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
                fill: '#1e1b4b',
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