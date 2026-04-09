import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useRealtimeNotifications = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'partidas' }, (payload: any) => {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
        const matchName = payload.new.name;
        toast.info(`🎮 Nova partida criada: ${matchName}`, { duration: 4000 });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'partidas' }, (payload: any) => {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
        const newStatus = payload.new.status;
        const matchName = payload.new.name;
        
        if (newStatus === 'in_progress') {
          toast.success(`🔴 ${matchName} está AO VIVO!`, { duration: 5000 });
        } else if (newStatus === 'open') {
          toast.info(`📢 ${matchName} aguardando jogadores...`, { duration: 4000 });
        } else if (newStatus === 'finished') {
          toast.success(`✅ ${matchName} finalizada!`, { duration: 4000 });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cartelas_partida' }, () => {
        queryClient.invalidateQueries({ queryKey: ['matchCards'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfis' }, () => {
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['players'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vitorias' }, () => {
        queryClient.invalidateQueries({ queryKey: ['wins'] });
        queryClient.invalidateQueries({ queryKey: ['allWins'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
