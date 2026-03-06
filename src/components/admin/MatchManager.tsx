import { useState, useEffect, useRef } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GameType } from '@/types/bingo';
import { PrizeType, MatchStatus, Match } from '@/types/match';
import { gameTypeLabels, calculateNumbersToWin } from '@/utils/bingoUtils';
import { Plus, Trash2, Trophy, Edit, Shuffle, Clock, Coins, Users, TrendingUp, Ticket, User, Flame, Target, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

const statusLabels: Record<MatchStatus, string> = {
  waiting: 'Aguardando',
  open: 'Aberta',
  in_progress: 'Em andamento',
  finished: 'Finalizada',
};

const statusColors: Record<MatchStatus, string> = {
  waiting: 'bg-muted text-muted-foreground',
  open: 'bg-primary/10 text-primary',
  in_progress: 'bg-accent/10 text-accent',
  finished: 'bg-success/10 text-success',
};

const MatchManager = () => {
  const { toast } = useToast();
  const { 
    matches, createMatch, updateMatch, matchCards,
    openMatch, startMatch, finishMatch, deleteMatch, callNumber,
    toggleAutoCall
  } = useGame();

  const [showCreate, setShowCreate] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [matchForm, setMatchForm] = useState({
    name: '',
    gameType: 'full' as GameType,
    maxCardsPerPlayer: 3,
    cardPrice: 10,
    prizeType: 'percentage' as PrizeType,
    prizeValue: 70,
    prizeName: '',
    startTime: '',
    prizeImageFile: null as File | null,
    min_players: 1,
    is_auto_calling: false,
  });
  
  const [callerInput, setCallerInput] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [isCallingRandom, setIsCallingRandom] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (matchForm.prizeType === 'fixed' || matchForm.prizeType === 'product') {
      if (matchForm.cardPrice > 0 && matchForm.prizeValue > 0) {
        const min = Math.ceil(matchForm.prizeValue / matchForm.cardPrice);
        setMatchForm(p => ({ ...p, min_players: min }));
      }
    } else {
      setMatchForm(p => ({ ...p, min_players: 1 }));
    }
  }, [matchForm.prizeType, matchForm.prizeValue, matchForm.cardPrice]);

  const handleCreateMatch = async () => {
    if (!matchForm.name.trim() || !matchForm.startTime) return;

    let prizeImageUrl: string | undefined = undefined;

    if (matchForm.prizeType === 'product' && matchForm.prizeImageFile) {
        const file = matchForm.prizeImageFile;
        const filePath = `public/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file);

        if (uploadError) {
            toast({ title: 'Erro no Upload', description: uploadError.message, variant: 'destructive' });
            return;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
        
        prizeImageUrl = publicUrl;
    }

    const prizePayload: any = { type: matchForm.prizeType, value: matchForm.prizeValue };
    if (matchForm.prizeType === 'product') prizePayload.productName = matchForm.prizeName;
    
    const matchData = {
        name: matchForm.name,
        game_type: matchForm.gameType,
        max_cards_per_player: matchForm.maxCardsPerPlayer,
        card_price: matchForm.cardPrice,
        prize: prizePayload,
        start_time: new Date(matchForm.startTime).toISOString(),
        prize_image_url: prizeImageUrl,
        min_players: matchForm.min_players,
        is_auto_calling: matchForm.is_auto_calling,
    };

    await createMatch(matchData);
    setShowCreate(false);
    setMatchForm({
        name: '',
        gameType: 'full' as GameType,
        maxCardsPerPlayer: 3,
        cardPrice: 10,
        prizeType: 'percentage' as PrizeType,
        prizeValue: 70,
        prizeName: '',
        startTime: '',
        prizeImageFile: null,
        min_players: 1,
        is_auto_calling: false,
    });
  };

  const handleOpenEditDialog = (match: Match) => {
    setEditingMatch(match);
    setMatchForm({
      name: match.name,
      gameType: match.game_type,
      maxCardsPerPlayer: match.max_cards_per_player,
      cardPrice: match.card_price,
      prizeType: match.prize.type,
      prizeValue: match.prize.value || 0,
      prizeName: match.prize.productName || '',
      startTime: format(new Date(match.start_time), "yyyy-MM-dd'T'HH:mm"),
      prizeImageFile: null,
      min_players: match.min_players,
      is_auto_calling: match.is_auto_calling || false,
    });
  };

  const handleUpdateMatch = async () => {
    if (!editingMatch) return;

    let prizeImageUrl = editingMatch.prize_image_url;

    if (matchForm.prizeType === 'product' && matchForm.prizeImageFile) {
      const file = matchForm.prizeImageFile;
      const filePath = `public/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
      
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) {
          toast({ title: 'Erro no Upload', description: uploadError.message, variant: 'destructive' });
          return;
      }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      prizeImageUrl = publicUrl;
    }

    const prizePayload: any = { type: matchForm.prizeType, value: matchForm.prizeValue };
    if (matchForm.prizeType === 'product') prizePayload.productName = matchForm.prizeName;
    
    const matchData = {
        name: matchForm.name,
        game_type: matchForm.game_type,
        max_cards_per_player: matchForm.maxCardsPerPlayer,
        card_price: matchForm.cardPrice,
        prize: prizePayload,
        start_time: new Date(matchForm.startTime).toISOString(),
        prize_image_url: prizeImageUrl,
        min_players: matchForm.min_players,
        is_auto_calling: matchForm.is_auto_calling,
    };

    await updateMatch(editingMatch.id, matchData);
    setEditingMatch(null);
  };

  const handleCallNumber = (matchId: string) => {
    const num = parseInt(callerInput[matchId] || '', 10);
    if (num >= 1 && num <= 75) {
      callNumber(matchId, num);
      setCallerInput(prev => ({ ...prev, [matchId]: '' }));
    }
  };

  const handleRandomCall = async (matchId: string) => {
    setIsCallingRandom(matchId);
    const match = matches.find(m => m.id === matchId);
    if (!match) {
      setIsCallingRandom(null);
      return;
    }
    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(num => !(match.called_numbers || []).includes(num));
    if (availableNumbers.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      await callNumber(match.id, availableNumbers[randomIndex]);
    } else {
      toast({ title: 'Todos os números já foram sorteados!', variant: 'destructive' });
    }
    setIsCallingRandom(null);
  };

  const matchDialogContent = (
    <div className="space-y-4 py-4">
      <div><Label>Nome</Label><Input value={matchForm.name} onChange={e => setMatchForm(p => ({ ...p, name: e.target.value }))} /></div>
      <div><Label>Data/Hora Início</Label><Input type="datetime-local" value={matchForm.startTime} onChange={e => setMatchForm(p => ({ ...p, startTime: e.target.value }))} /></div>
      <div><Label>Tipo de Jogo</Label><Select value={matchForm.gameType} onValueChange={(v: GameType) => setMatchForm(p => ({ ...p, gameType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(gameTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid grid-cols-2 gap-4">
          <div><Label>Preço</Label><Input type="number" value={matchForm.cardPrice} onChange={e => setMatchForm(p => ({ ...p, cardPrice: +e.target.value }))} /></div>
          <div><Label>Máx. Cartelas</Label><Input type="number" value={matchForm.maxCardsPerPlayer} onChange={e => setMatchForm(p => ({ ...p, maxCardsPerPlayer: +e.target.value }))} /></div>
      </div>
      <div>
        <Label>Tipo de Prêmio</Label>
        <RadioGroup
            value={matchForm.prizeType}
            onValueChange={(v: PrizeType) => setMatchForm(p => ({ ...p, prizeType: v }))}
            className="grid grid-cols-3 gap-2 mt-2"
        >
            <div>
            <RadioGroupItem value="percentage" id="percentage" className="peer sr-only" />
            <Label htmlFor="percentage" className="flex text-xs items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                % do Pote
            </Label>
            </div>
            <div>
            <RadioGroupItem value="fixed" id="fixed" className="peer sr-only" />
            <Label htmlFor="fixed" className="flex text-xs items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                Valor Fixo
            </Label>
            </div>
            <div>
            <RadioGroupItem value="product" id="product" className="peer sr-only" />
            <Label htmlFor="product" className="flex text-xs items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                Produto
            </Label>
            </div>
        </RadioGroup>
      </div>

      {matchForm.prizeType === 'percentage' && (
      <div>
          <Label>Porcentagem do Pote (%)</Label>
          <Input type="number" value={matchForm.prizeValue} onChange={e => setMatchForm(p => ({ ...p, prizeValue: +e.target.value }))} />
      </div>
      )}
      {matchForm.prizeType === 'fixed' && (
      <div>
          <Label>Valor Fixo (créditos)</Label>
          <Input type="number" value={matchForm.prizeValue} onChange={e => setMatchForm(p => ({ ...p, prizeValue: +e.target.value }))} />
      </div>
      )}
      {matchForm.prizeType === 'product' && (
      <div className="space-y-4">
          <div>
              <Label>Nome do Produto</Label>
              <Input value={matchForm.prizeName} onChange={e => setMatchForm(p => ({ ...p, prizeName: e.target.value }))} />
          </div>
          <div>
              <Label>Valor do Produto (em créditos)</Label>
              <Input type="number" value={matchForm.prizeValue} onChange={e => setMatchForm(p => ({ ...p, prizeValue: +e.target.value }))} />
          </div>
          <div>
              <Label>Imagem do Produto</Label>
              <Input 
                  type="file" 
                  accept="image/*" 
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  onChange={e => setMatchForm(p => ({ ...p, prizeImageFile: e.target.files ? e.target.files[0] : null }))} 
              />
          </div>
      </div>
      )}
        {(matchForm.prizeType === 'fixed' || matchForm.prizeType === 'product') && (
        <div>
          <Label>Mínimo de Jogadores</Label>
          <Input type="number" value={matchForm.min_players} onChange={e => setMatchForm(p => ({ ...p, min_players: +e.target.value }))} />
          <p className="text-[10px] text-muted-foreground mt-1">Calculado: {Math.ceil(matchForm.prizeValue / matchForm.cardPrice) || 1} jogadores para cobrir o prêmio.</p>
        </div>
      )}
      <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm mt-4">
        <div className="space-y-0.5">
            <Label>Início e Sorteio Automáticos</Label>
            <p className="text-xs text-muted-foreground">
                A partida iniciará e sorteará os números sozinha.
            </p>
        </div>
        <Switch
            checked={matchForm.is_auto_calling}
            onCheckedChange={(checked) => setMatchForm(p => ({ ...p, is_auto_calling: checked }))}
        />
      </div>
    </div>
  );

  const getCountdown = (startTime: string) => {
    const diff = new Date(startTime).getTime() - now;
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h > 0 ? `${h.toString().padStart(2, '0')}:` : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getAutoCallCountdown = (nextCallTimestamp: string | null | undefined) => {
    if (!nextCallTimestamp) return null;
    const diff = new Date(nextCallTimestamp).getTime() - now;
    if (diff <= 0) return '00:00';
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderMatchList = (matchesToRender: Match[]) => {
    if (matchesToRender.length === 0) {
      return (
        <div className="card-container text-center py-12">
          <p className="text-sm text-muted-foreground">Nenhuma partida nesta categoria.</p>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        {matchesToRender.map(match => {
          const cardsInMatch = matchCards.filter(mc => mc.match_id === match.id);
          const playersInMatchCount = new Set(cardsInMatch.map(mc => mc.player_id)).size;
          const totalCardsCount = cardsInMatch.length;
          
          const prizeValue = match.prize.type === 'percentage' 
            ? Math.floor((match.pot * (match.prize.value || 0)) / 100) 
            : (match.prize.value || 0);
          
          const profit = match.pot - prizeValue;
          const canStart = playersInMatchCount >= match.min_players;
          const countdown = (match.status === 'waiting' || match.status === 'open') ? getCountdown(match.start_time) : null;
          const autoCallCountdown = match.is_auto_calling && match.status === 'in_progress' ? getAutoCallCountdown(match.next_auto_call_timestamp) : null;

          const stats = { missing5: 0, missing3: 0, missing1: 0 };
          if (match.status === 'in_progress') {
              for (const card of cardsInMatch) {
                  const needed = calculateNumbersToWin(card, match.game_type);
                  if (needed <= 1) stats.missing1++;
                  else if (needed <= 3) stats.missing3++;
                  else if (needed <= 5) stats.missing5++;
              }
          }

          return (
            <div key={match.id} className="card-container">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-heading font-bold text-lg text-foreground">{match.name}</h3>
                    <Badge className={statusColors[match.status]}>{statusLabels[match.status]}</Badge>
                    {match.prize.returnedReason === 'NO_PLAYERS' && match.status === 'waiting' && (
                      <Badge variant="destructive" className="text-[10px] h-5">Retornada</Badge>
                    )}
                    {countdown && (
                      <Badge variant="outline" className="font-mono text-xs">
                          <Clock className="w-3 h-3 mr-1.5" />
                          {countdown}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex gap-3"><span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />{gameTypeLabels[match.game_type]}</span></div>
                </div>
                <div className="flex gap-2">
                  {match.status === 'waiting' && <Button size="sm" variant="outline" onClick={() => handleOpenEditDialog(match)}><Edit className="w-4 h-4 mr-2" />Editar</Button>}
                  {match.status === 'waiting' && <Button size="sm" onClick={() => openMatch(match.id)}>Abrir</Button>}
                  
                  {match.status === 'open' && (
                    !canStart ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" title={`Requer ${match.min_players} jogadores. Atualmente: ${playersInMatchCount}.`}>Iniciar</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Forçar início da partida?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta partida não atingiu o número mínimo de {match.min_players} jogadores (atualmente com {playersInMatchCount}). 
                              Iniciar a partida mesmo assim pode fazer com que o prêmio não seja coberto pelo valor arrecadado.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => startMatch(match.id, true)}>Forçar Início</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <Button size="sm" onClick={() => startMatch(match.id)}>Iniciar</Button>
                    )
                  )}

                  {match.status === 'in_progress' && <Button size="sm" variant="outline" onClick={() => finishMatch(match.id)}>Finalizar</Button>}
                  {(match.status === 'waiting' || match.status === 'finished') && <Button size="sm" variant="destructive" onClick={() => deleteMatch(match.id)}><Trash2 className="w-4 h-4" /></Button>}
                </div>
              </div>

              {/* Dashboard Financeiro Admin */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                    <Ticket className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Cartelas</span>
                  </div>
                  <p className="font-heading text-lg font-bold">{totalCardsCount}</p>
                  <p className="text-[10px] text-muted-foreground">{playersInMatchCount} jogadores</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="flex items-center gap-2 mb-1 text-primary">
                    <Coins className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Aposta Total</span>
                  </div>
                  <p className="font-heading text-lg font-bold text-primary">{match.pot} cr.</p>
                  <p className="text-[10px] text-muted-foreground">Pote acumulado</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <div className="flex items-center gap-2 mb-1 text-amber-600">
                    <Trophy className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Valor Prêmio</span>
                  </div>
                  <p className="font-heading text-lg font-bold text-amber-600">{prizeValue} cr.</p>
                  <p className="text-[10px] text-muted-foreground">{match.prize.type === 'percentage' ? `${match.prize.value}% do pote` : 'Valor fixo'}</p>
                </div>
                <div className={cn(
                  "p-3 rounded-lg border",
                  profit >= 0 ? "bg-success/5 border-success/10" : "bg-destructive/5 border-destructive/10"
                )}>
                  <div className={cn("flex items-center gap-2 mb-1", profit >= 0 ? "text-success" : "text-destructive")}>
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Ganho Bingo</span>
                  </div>
                  <p className={cn("font-heading text-lg font-bold", profit >= 0 ? "text-success" : "text-destructive")}>
                    {profit} cr.
                  </p>
                  <p className="text-[10px] text-muted-foreground">{profit >= 0 ? 'Lucro esperado' : 'Prejuízo atual'}</p>
                </div>
              </div>

              {match.status === 'in_progress' && (
                <div className="mb-6 p-4 rounded-xl bg-muted/20 border border-border">
                  <h4 className="text-center font-heading font-bold mb-3 text-sm text-foreground">Status da Partida: Quase lá!</h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/50 border border-border/50">
                      <Target className="w-4 h-4 text-muted-foreground mb-1" />
                      <span className="font-bold text-lg font-heading">{stats.missing5}</span>
                      <span className="text-[9px] uppercase font-bold text-muted-foreground">Faltam 5</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-accent/10 border border-accent/20">
                      <Target className="w-4 h-4 text-accent mb-1" />
                      <span className="font-bold text-lg font-heading text-accent">{stats.missing3}</span>
                      <span className="text-[9px] uppercase font-bold text-accent/80">Faltam 3</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                      <Flame className="w-4 h-4 text-destructive mb-1" />
                      <span className="font-bold text-lg font-heading text-destructive">{stats.missing1}</span>
                      <span className="text-[9px] uppercase font-bold text-destructive/80">Por 1!</span>
                    </div>
                  </div>
                </div>
              )}

              {match.status === 'finished' && match.winners.length > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-success/5 border-2 border-dashed border-success/20 animate-slide-up">
                  <h4 className="font-heading font-bold text-success flex items-center gap-2 mb-3">
                    <Trophy className="w-5 h-5" /> Vencedor(es) da Partida
                  </h4>
                  <div className="space-y-3">
                    {match.winners.map((winner, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-success/10">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-success font-bold text-xs">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-sm font-bold flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                              {winner.playerName}
                            </p>
                            <p className="text-[10px] text-muted-foreground">com a cartela: <strong>{winner.cardName}</strong></p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-success border-success/20 bg-success/5">BINGO!</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {match.status === 'in_progress' && (
                <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                        <h4 className="font-heading font-semibold">Sorteio em Tempo Real</h4>
                        <div className="flex items-center gap-2">
                            {autoCallCountdown && (
                              <Badge variant="outline" className="font-mono text-xs">
                                <Clock className="w-3 h-3 mr-1.5" />
                                {autoCallCountdown}
                              </Badge>
                            )}
                            <Label htmlFor={`auto-call-${match.id}`} className="text-xs">Sorteio Automático</Label>
                            <Switch
                                id={`auto-call-${match.id}`}
                                checked={!!match.is_auto_calling}
                                onCheckedChange={() => toggleAutoCall(match.id)}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                        <Input
                            placeholder="Nº"
                            type="number"
                            className="w-20"
                            value={callerInput[match.id] || ''}
                            onChange={e => setCallerInput(p => ({ ...p, [match.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleCallNumber(match.id)}
                        />
                        <Button variant="outline" onClick={() => handleCallNumber(match.id)}>Sortear</Button>
                        <Button 
                          variant="secondary" 
                          onClick={() => handleRandomCall(match.id)}
                          disabled={isCallingRandom === match.id}
                        >
                          {isCallingRandom === match.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
                        </Button>
                    </div>
                    <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-2">Números chamados ({(match.called_numbers || []).length})</p>
                        <div className="flex flex-wrap gap-1.5">
                            {(match.called_numbers || []).map(num => (
                                <span key={num} className="w-7 h-7 rounded-full bg-secondary text-secondary-foreground text-xs font-bold flex items-center justify-center">{num}</span>
                            ))}
                        </div>
                    </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const inProgressMatches = matches.filter(m => m.status === 'in_progress');
  const openMatches = matches.filter(m => m.status === 'open');
  const waitingMatches = matches.filter(m => m.status === 'waiting');
  const finishedMatches = matches.filter(m => m.status === 'finished');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl font-bold text-foreground">Gestão de Partidas</h2>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nova Partida</Button></DialogTrigger>
          <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="font-heading">Criar Partida</DialogTitle>
              <DialogDescription>Preencha os detalhes da nova partida.</DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto -mx-6 px-6">
              {matchDialogContent}
            </div>
            <DialogFooter className="flex-shrink-0 pt-4">
              <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
              <Button onClick={handleCreateMatch}>Criar Partida</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <Tabs defaultValue="in_progress" className="w-full">
        <TabsList className="grid w-full h-auto p-1 grid-cols-2 sm:grid-cols-4 mb-6">
          <TabsTrigger value="in_progress" className="flex items-center gap-2">
            Em Andamento
            {inProgressMatches.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {inProgressMatches.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="open" className="flex items-center gap-2">
            Abertas
            {openMatches.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                {openMatches.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="waiting" className="flex items-center gap-2">
            Aguardando
            {waitingMatches.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {waitingMatches.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="finished" className="flex items-center gap-2">
            Finalizadas
            {finishedMatches.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">
                {finishedMatches.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="in_progress" className="mt-2">{renderMatchList(inProgressMatches)}</TabsContent>
        <TabsContent value="open" className="mt-2">{renderMatchList(openMatches)}</TabsContent>
        <TabsContent value="waiting" className="mt-2">{renderMatchList(waitingMatches)}</TabsContent>
        <TabsContent value="finished" className="mt-2">{renderMatchList(finishedMatches)}</TabsContent>
      </Tabs>

      <Dialog open={!!editingMatch} onOpenChange={(isOpen) => !isOpen && setEditingMatch(null)}>
        <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="font-heading">Editar Partida</DialogTitle>
            <DialogDescription>Ajuste os detalhes da partida.</DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto -mx-6 px-6">
            {matchDialogContent}
          </div>
          <DialogFooter className="flex-shrink-0 pt-4">
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button onClick={handleUpdateMatch}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MatchManager;