import React from 'react';
import { Crown } from 'lucide-react';
import { PlayerStatus } from '../../shared/types';

export interface LobbyPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isYou: boolean;
  status: PlayerStatus;
}

interface LobbyPlayerListProps {
  players: LobbyPlayer[];
  maxPlayers?: number;
}

export const LobbyPlayerList: React.FC<LobbyPlayerListProps> = ({
  players,
  maxPlayers = 8,
}) => {
  return (
    <div className="mb-6">
      <p className="text-sm font-bold text-gray-700 mb-2">
        Players ({players.length}/{maxPlayers} max)
      </p>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {players.map((player) => (
          <div
            key={player.id}
            className={`flex items-center justify-between p-3 rounded-xl ${
              player.isYou ? 'bg-indigo-100 border-2 border-indigo-300' : 'bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-2">
              {player.isHost && <Crown size={16} className="text-yellow-500" />}
              <span className="font-semibold">{player.name}</span>
              {player.isYou && <span className="text-xs text-indigo-500">(You)</span>}
            </div>
            <div
              className={`w-2 h-2 rounded-full ${
                player.status === PlayerStatus.CONNECTED ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default LobbyPlayerList;
