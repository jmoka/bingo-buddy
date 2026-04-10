import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface LiveStatus {
  isLive: boolean;
  viewerCount: number;
  broadcaster?: string;
}

export const useLiveStatus = (matchId: string) => {
  const [liveStatus, setLiveStatus] = useState<LiveStatus>({
    isLive: false,
    viewerCount: 0
  });
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-match', matchId);
    });

    newSocket.on('live-started', ({ matchId: liveMatchId, broadcaster }) => {
      if (liveMatchId === matchId) {
        setLiveStatus(prev => ({
          ...prev,
          isLive: true,
          broadcaster
        }));
      }
    });

    newSocket.on('live-stopped', ({ matchId: liveMatchId }) => {
      if (liveMatchId === matchId) {
        setLiveStatus({
          isLive: false,
          viewerCount: 0
        });
      }
    });

    // Verificar status inicial
    const checkStatus = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/live-status/${matchId}`);
        const status = await response.json();
        setLiveStatus(status);
      } catch (error) {
        console.error('Erro ao verificar status da live:', error);
      }
    };

    checkStatus();

    return () => {
      newSocket.disconnect();
    };
  }, [matchId]);

  const startLive = () => {
    socket?.emit('start-live', matchId);
  };

  const stopLive = () => {
    socket?.emit('stop-live', matchId);
  };

  return {
    ...liveStatus,
    startLive,
    stopLive,
    socket
  };
};