import React from 'react';

interface VictoryCelebrationProps {
  winnerName: string;
  isPlayerWinner: boolean;
}

const CONFETTI_EMOJIS = ['🎉', '🎊', '🎈', '⭐', '✨', '🌟', '🏆'];

export const VictoryCelebration: React.FC<VictoryCelebrationProps> = ({
  winnerName,
  isPlayerWinner,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 overflow-hidden">
      {/* Winner text */}
      <div className="text-center z-10">
        <div className="text-5xl md:text-7xl font-black text-white drop-shadow-lg mb-4 animate-bounce">
          {isPlayerWinner ? 'YOU WIN!' : `${winnerName} WINS!`}
        </div>
      </div>

      {/* Floating confetti emojis */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-4xl md:text-5xl"
            style={{
              left: `${(i * 5) % 100}%`,
              bottom: '-10%',
              animation: `floatUp ${2 + (i % 3)}s ease-out forwards`,
              animationDelay: `${(i * 0.1) % 1}s`,
            }}
          >
            {CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length]}
          </div>
        ))}
      </div>

      {/* CSS for float animation */}
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-120vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default VictoryCelebration;
