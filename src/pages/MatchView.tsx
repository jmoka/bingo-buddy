import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { BingoCell } from '@/components/BingoCell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { ArrowLeft, Coins, Users, Bot, Loader2, Star, Trophy, AlertTriangle, CheckCircle2, Hand } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { playNotificationSound } from '@/utils/soundUtils';
import { WinnerDisplay } from '@/components/WinnerDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { MatchStats } from '@/components/MatchStats';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

const MatchView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { matches, getPlayerMatchCards, matchCards, isLoading, markNumberManually } = useGame();
  const queryClient = useQueryClient();
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  
  const [confirmManualCard, setConfirmManualCard] = useState<{cardId: string, num?: number} | null>(null);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`match-view-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'partidas', filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cartelas_partida', filter: `match_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['matchCards'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  const match = matches.find(m => m.id === id);
  
  const prevCalledNumbersRef = useRef<number[]>([]);
  const prevWinnersCountRef = useRef<number>(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!match) return;

    const currentNumbers = match.called_numbers || [];
    if (currentNumbers.length > prevCalledNumbersRef.current.length) {
      const newNumber = currentNumbers[currentNumbers.length - 1];
      setLastCalledNumber(newNumber);
      if (match.status !== 'finished') {
        toast.info(`Número sorteado: ${newNumber}!`, { duration: 2000 });
        playNotificationSound();
      }
    }
    prevCalledNumbersRef.current = currentNumbers;

    const winners = match.winners || [];
    if (winners.length > prevWinnersCountRef.current) {
      const latestWinner = winners[winners.length - 1];
      const isFunWinner = (latestWinner as any).creditType === 'fake';

      if (isFunWinner && match.status !== 'finished') {
        toast.success(`BINGO DE BRINCAR!`, {
          description: `${latestWinner.playerName} bateu com a cartela "${latestWinner.cardName}". O jogo continua para o prêmio real!`,
          duration: 6000,
        });
        playNotificationSound();
      } else if (match.status === 'finished') {
        toast.success('BINGO! Partida finalizada!', {
          description: `Parabéns aos vencedores!`,
          duration: 10000,
        });
        playNotificationSound();
      }
    }
    prevWinnersCountRef.current = winners.length;

  }, [match]);

  const handleCellClick = async (cardId: string, num: number, currentMode: 'auto' | 'manual', isMarked: boolean) => {
    if (!match || match.status !== 'in_progress' || isMarked || num === 0) return;
    
    if (!match.called_numbers?.includes(num)) {
        toast.error("Este número ainda não foi sorteado!");
        return;
    }

    if (currentMode === 'auto') {
        setConfirmManualCard({ cardId, num });
    } else {
        await markNumberManually(cardId, num);
    }
  };

  const handleConfirmManual = async () => {
    if (confirmManualCard) {
      // Se a troca foi via clique em número, marcamos o número. 
      // Se foi via switch, passamos null para apenas trocar o modo.
      await markNumberManually(confirmManualCard.cardId, confirmManualCard.num || null);
      setConfirmManualCard(null);
    }
  };

  if (isLoading && !match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-heading">Carregando partida...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="card-container text-center py-20">
        <p className="text-muted-foreground text-lg">Partida não encontrada.</p>
        <Button className="mt-6 gradient-primary" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Lobby
        </Button>
      </div>
    );
  }

  const myCards = profile && id ? getPlayerMatchCards(id, profile.id) : [];
  const allCardsForThisMatch = matchCards.filter(c => c.match_id === id);
  const playersInMatchCount = new Set(allCardsForThisMatch.map(mc => mc.player_id)).size;
  const lastCalled = match.called_numbers?.length > 0 ? match.called_numbers[match.called_numbers.length - 1] : null;
  const countdown = match.next_auto_call_timestamp ? Math.max(0, Math.round((new Date(match.next_auto_call_timestamp).getTime() - now) / 1000)) : null;
  const funWinnersInProgress = (match.winners || []).filter(w => (w as any).creditType === 'fake');

  return (
    <>
      <div className="gradient-hero py-4 px-4 -mt-6 sm:-mt-8 -mx-4 mb-6 rounded-b-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-heading text-lg sm:text-xl font-bold text-primary-foreground">{match.name}</h1>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-primary-foreground/70 text-xs">
                <span>{gameTypeLabels[match.game_type]}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{playersInMatchCount}</span>
                <span className="flex items-center gap-1"><Coins className="w-3 h-3" />Pote: {Number(match.pot || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
          {lastCalled && (
            <div className="bingo-ball animate-bounce-in text-xl w-12 h-12 sm:w-14 sm:h-14" key={lastCalled}>
              {lastCalled}
            </div>
          )}
        </div>
      </div>

      {match.status === 'in_progress' && funWinnersInProgress.length > 0 && (
        <Alert className="mb-6 border-amber-500 bg-amber-500/10 text-amber-700 animate-pulse">
          <Star className="h-4 w-4 text-amber-600" />
          <AlertTitle className="font-heading font-bold">Bingo de Brincar!</AlertTitle>
          <AlertDescription className="text-xs">
            {funWinnersInProgress.map(w => w.playerName).join(', ')} já bateu Bingo de brincar. 
            <strong> O jogo continua valendo o prêmio real!</strong>
          </AlertDescription>
        </Alert>
      )}

      <WinnerDisplay match={match} allMatchCards={allCardsForThisMatch} />

      {match.status !== 'finished' && (
        <MatchStats match={match} allMatchCards={allCardsForThisMatch} />
      )}

      {match.status !== 'finished' && match.is_auto_calling && (
        <div className="card-container mb-6 bg-accent/10 text-accent text-center p-4">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <p className="font-medium text-sm flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Sorteio automático ativado!
            </p>
            {countdown !== null && (
              <div className="flex items-center gap-2">
                <span className="text-sm">Próximo número em:</span>
                <span className="font-bold font-mono text-lg bg-accent text-accent-foreground rounded-md px-2 py-1">
                  {countdown}s
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card-container mb-6">
        <p className="text-sm text-muted-foreground mb-2">Números sorteados ({(match.called_numbers || []).length})</p>
        <div className="flex flex-wrap gap-1.5">
          {(match.called_numbers || []).map(num => (
            <span key={num} className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
              {num}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-bold text-foreground">
            Minhas Cartelas ({myCards.length})
        </h2>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full border border-border/50">
            <Hand className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Clique no número para marcar manual</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {myCards.map((card) => {
          const mode = card.marking_mode || 'auto';
          return (
            <div key={card.id} className={cn(
                "card-container max-w-sm mx-auto w-full border-2 transition-all relative",
                mode === 'manual' ? "border-amber-500/30 shadow-amber-500/5" : "border-transparent"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="min-w-0">
                    <h3 className="font-heading font-semibold text-foreground flex items-center gap-2 truncate">
                        {card.name}
                        {card.credit_type === 'fake' && <Badge variant="outline" className="text-[9px] h-4 border-amber-400 text-amber-600">Brincar</Badge>}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                            mode === 'auto' ? "bg-primary/10 text-primary" : "bg-amber-500 text-white animate-pulse"
                        )}>
                            {mode === 'auto' ? 'Automático' : 'MODO MANUAL'}
                        </span>
                    </div>
                </div>
                
                {/* Interruptor de Modo */}
                <div className="flex flex-col items-end gap-1">
                    <Label htmlFor={`mode-${card.id}`} className="text-[8px] uppercase font-bold text-muted-foreground">Trocar p/ Manual</Label>
                    <Switch 
                        id={`mode-${card.id}`}
                        checked={mode === 'manual'}
                        disabled={mode === 'manual' || match.status === 'finished'}
                        onCheckedChange={() => mode === 'auto' && setConfirmManualCard({ cardId: card.id })}
                    />
                </div>
              </div>
              
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {['B', 'I', 'N', 'G', 'O'].map(letter => (
                  <div key={letter} className="w-full aspect-square rounded-lg flex items-center justify-center text-sm sm:text-lg font-heading font-bold gradient-primary text-primary-foreground shadow-sm">
                    {letter}
                  </div>
                ))}
                {card.numbers.flat().map((num, i) => {
                    const isMarked = card.marked_numbers instanceof Set 
                        ? card.marked_numbers.has(num) 
                        : Array.isArray(card.marked_numbers) && card.marked_numbers.includes(num);
                        
                    return (
                        <BingoCell
                            key={`${card.id}-${i}`}
                            number={num}
                            isMarked={isMarked}
                            isFreeSpace={i === 12}
                            isNewlyMarked={num === lastCalledNumber}
                            onClick={() => handleCellClick(card.id, num, mode, isMarked)}
                        />
                    )
                })}
              </div>
              
              {mode === 'manual' && match.status === 'in_progress' && (
                <div className="mt-4 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-bottom-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-800 font-medium leading-tight">
                        Você assumiu a marcação. Fique atento aos números sorteados para não passar batido!
                    </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!confirmManualCard} onOpenChange={(open) => !open && setConfirmManualCard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
                Mudar para Marcação Manual?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-bold text-foreground">
                Uma vez que você marcar manualmente, esta cartela deixará de ser marcada automaticamente pelo sistema!
              </p>
              <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-destructive font-semibold text-sm">
                "Você terá que marcar os números manualmente caso deixe de marcar você passará batido."
              </div>
              <p>Deseja continuar e assumir o controle desta cartela agora?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmManual} className="bg-amber-600 hover:bg-amber-700">
                Sim, quero marcar manual
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MatchView;