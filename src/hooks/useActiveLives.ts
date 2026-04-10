import { useState, useEffect } from 'react';

interface LiveStatus {
  isLive: boolean;
  viewerCount: number;
  broadcaster?: string;
}

export const useActiveLives = () => {
  const [activeLives, setActiveLives] = useState<Record<string, LiveStatus>>({});

  const checkActiveLives = async () => {
    try {
      const response = await fetch('http://localhost:8085/api/live-status');
      const lives = await response.json();
      setActiveLives(lives);
    } catch (error) {
      console.error('Erro ao verificar lives ativas:', error);
    }
  };

  useEffect(() => {
    // Verificar status inicial
    checkActiveLives();

    // Verificar a cada 5 segundos
    const interval = setInterval(checkActiveLives, 5000);

    return () => clearInterval(interval);
  }, []);

  return activeLives;
};