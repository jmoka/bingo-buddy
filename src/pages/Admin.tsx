import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GameType } from '@/types/bingo';
import { PrizeType, Match, MatchStatus } from '@/types/match';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { 
  Plus, LogOut, Play, DoorOpen, Trash2, Trophy, Users, 
  Clock, Coins, Hash, ArrowLeft, StopCircle, Settings, Save, Bot
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    isAdmin, adminLogout, matches, players, createMatch, 
    openMatch, startMatch, finishMatch, deleteMatch, callNumber,
    toggleAutoCall, getMatchCards, gameSettings, updateGameSettings,
  } = useGame();

  const [showCreate, setShowCreate] = useState(false);
  const [matchForm, setMatchForm] = useState({
    name: '',
    gameType: 'full' as GameType,
    maxCardsPerPlayer: 3,
    cardPrice: 10,
    prizeType: 'percentage' as PrizeType,
    prizeValue: 70,
    prizeName: '',
    startTime: '',
  });
  const [settingsForm, setSettingsForm] = useState(gameSettings);
  const [callerInput, setCallerInput] = useState<Record<string, string>>({});
  const [countdown, setCountdown] = useState<Record<string, number>>({});

  useEffect(() => {
    setSettingsForm(gameSettings);
  }, [gameSettings]);

  // Auto-call and countdown logic
  useEffect(() => {
    const intervals = new Map<string, NodeJS.Timeout>();
    const countdownIntervals = new Map<string, NodeJS.Timeout>();

    matches.forEach(match => {
      if (match.isAutoCalling && match.status === 'in_progress') {
        // Main auto-call interval
        const intervalId = setInterval(() => {
          const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
            .filter(num => !match.calledNumbers.includes(num));

          if (availableNumbers.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableNumbers.length);
            const newNumber = availableNumbers[randomIndex];
            callNumber(match.id, newNumber);
          } else {
            toggleAutoCall(match.id);
          }
        }, gameSettings.autoCallIntervalSeconds * 1000);
        intervals.set(match.id, intervalId);

        // Countdown interval
        if (!countdown[match.id]) {
          setCountdown(prev => ({ ...prev, [match.id]: gameSettings.autoCallIntervalSeconds }));
        }
        const countdownId = setInterval(() => {
          setCountdown(prev => {
            const current = prev[match.id] || 0;
            if (current <= 1) {
              return { ...prev, [match.id]: gameSettings.autoCallIntervalSeconds };
            }
            return { ...prev, [match.id]: current - 1 };
          });
        }, 1000);
        countdownIntervals.set(match.id, countdownId);
      }
    });

    return () => {
      intervals.forEach(id => clearInterval(id));
      countdownIntervals.forEach(id => clearInterval(id));
    };
  }, [matches, gameSettings.autoCallIntervalSeconds, callNumber, toggleAutoCall, countdown]);

  if (!isAdmin) {
    navigate('/admin/login');
    return null;
  }

  const handleCreateMatch = () => {
    if (!matchForm.name.trim() || !matchForm.startTime) return;
    createMatch({
      name: matchForm.name,
      gameType: matchForm.gameType,
      maxCardsPerPlayer: matchForm.maxCardsPerPlayer,
      cardPrice: matchForm.cardPrice,
      prize: {
        type: matchForm.prizeType,
        value: matchForm.prizeValue,
        productName: matchForm.prizeType === 'product' ? matchForm.prizeName : undefined,
      },
      startTime: new Date(matchForm.startTime).toISOString(),
    });
    setShowCreate(false);
    setMatchForm({ name: '', gameType: 'full', maxCardsPerPlayer: 3, cardPrice: 10, prizeType: 'percentage', prizeValue: 70, prizeName: '', startTime: '' });
  };

  const handleSaveSettings = () => {
    updateGameSettings(settingsForm);
    toast({ title: 'Configurações salvas!', description: 'Os novos valores já estão em vigor.' });
  };

  const handleCallNumber = (matchId: string) => {
    const num = parseInt(callerInput[matchId] || '', 10);
    if (num >= 1 && num <= 75) {
      callNumber(matchId, num);
      setCallerInput(prev => ({ ...prev, [matchId]: '' }));
    }
  };

  const getPrizeDisplay = (match: Match) => {
    if (match.prize.type === 'product') return `🎁 ${match.prize.productName}`;
    if (match.prize.type === 'fixed') return `💰 ${match.prize.value} créditos`;
    return `📊 ${match.prize.value}% do pote (${Math.floor(match.pot * match.prize.value / 100)} créditos)`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-hero py-6 px-4">
        <div className="container max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-primary-foreground">
              Painel Admin
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary-foreground/70 text-sm hidden sm:block">
              {players.length} jogadores
            </span>
            <Button variant="ghost" size="sm" className="text-primary-foreground" onClick={() => { adminLogout(); navigate('/'); }}>
              <LogOut className="w-4 h-4 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto py-8 px-4">
        {/* General Settings */}
        <div className="card-container mb-8">
          <h2 className="font-heading text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" /> Configurações Gerais
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Custo/Nova Cartela</label>
              <Input type="number" min={0} value={settingsForm.newCardCost} onChange={e => setSettingsForm(prev => ({ ...prev, newCardCost: +e.target.value }))} className="bg-secondary border-0" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Custo/Recarga de Uso</label>
              <Input type="number" min={0} value={settingsForm.cardRechargeCost} onChange={e => setSettingsForm(prev => ({ ...prev, cardRechargeCost: +e.target.value }))} className="bg-secondary border-0" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Usos por Recarga</label>
              <Input type="number" min={1} value={settingsForm.usesPerRecharge} onChange={e => setSettingsForm(prev => ({ ...prev, usesPerRecharge: +e.target.value }))} className="bg-secondary border-0" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Intervalo Sorteio (s)</label>
              <Input type="number" min={5} value={settingsForm.autoCallIntervalSeconds} onChange={e => setSettingsForm(prev => ({ ...prev, autoCallIntervalSeconds: +e.target.value }))} className="bg-secondary border-0" />
            </div>
          </div>
          <Button className="mt-4 gradient-primary shadow-button" onClick={handleSaveSettings}>
            <Save className="w-4 h-4 mr-2" /> Salvar Configurações
          </Button>
        </div>

        {/* Matches */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-xl font-bold text-foreground">
            Partidas ({matches.length})
          </h2>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Partida
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading">Criar Partida</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Nome da partida" value={matchForm.name} onChange={e => setMatchForm(prev => ({ ...prev, name: e.target.value }))} className="bg-secondary border-0" />
                
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Tipo de Jogo</label>
                  <Select value={matchForm.gameType} onValueChange={(v: GameType) => setMatchForm(prev => ({ ...prev, gameType: v }))}>
                    <SelectTrigger className="bg-secondary border-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['full', 'horizontal', 'vertical', 'diagonal'] as GameType[]).map(t => (
                        <SelectItem key={t} value={t}>{gameTypeLabels[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Máx. Cartelas/Jogador</label>
                    <Input type="number" min={1} max={10} value={matchForm.maxCardsPerPlayer} onChange={e => setMatchForm(prev => ({ ...prev, maxCardsPerPlayer: +e.target.value }))} className="bg-secondary border-0" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Preço/Cartela</label>
                    <Input type="number" min={1} value={matchForm.cardPrice} onChange={e => setMatchForm(prev => ({ ...prev, cardPrice: +e.target.value }))} className="bg-secondary border-0" />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Tipo de Prêmio</label>
                  <Select value={matchForm.prizeType} onValueChange={(v: PrizeType) => setMatchForm(prev => ({ ...prev, prizeType: v }))}>
                    <SelectTrigger className="bg-secondary border-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">% do Pote</SelectItem>
                      <SelectItem value="fixed">Valor Fixo</SelectItem>
                      <SelectItem value="product">Produto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {matchForm.prizeType === 'product' && (
                  <Input placeholder="Nome do produto" value={matchForm.prizeName} onChange={e => setMatchForm(prev => ({ ...prev, prizeName: e.target.value }))} className="bg-secondary border-0" />
                )}

                {matchForm.prizeType !== 'product' && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">
                      {matchForm.prizeType === 'percentage' ? 'Porcentagem (%)' : 'Valor (créditos)'}
                    </label>
                    <Input type="number" min={1} value={matchForm.prizeValue} onChange={e => setMatchForm(prev => ({ ...prev, prizeValue: +e.target.value }))} className="bg-secondary border-0" />
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Horário de Início</label>
                  <Input type="datetime-local" value={matchForm.startTime} onChange={e => setMatchForm(prev => ({ ...prev, startTime: e.target.value }))} className="bg-secondary border-0" />
                </div>

                <Button className="w-full gradient-primary shadow-button" onClick={handleCreateMatch} disabled={!matchForm.name.trim() || !matchForm.startTime}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Partida
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {matches.length === 0 ? (
          <div className="card-container text-center py-12">
            <p className="text-muted-foreground">Nenhuma partida criada.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map(match => {
              const matchCards = getMatchCards(match.id);
              return (
                <div key={match.id} className="card-container">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-heading font-bold text-lg text-foreground">{match.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[match.status]}`}>
                          {statusLabels[match.status]}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />{gameTypeLabels[match.gameType]}</span>
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{match.playerIds.length} jogadores</span>
                        <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" />{matchCards.length} cartelas</span>
                        <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5" />Pote: {match.pot}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{new Date(match.startTime).toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="text-sm text-foreground mt-1">{getPrizeDisplay(match)}</p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {match.status === 'waiting' && (
                        <Button size="sm" className="gradient-primary" onClick={() => openMatch(match.id)}>
                          <DoorOpen className="w-4 h-4 mr-1" />Abrir
                        </Button>
                      )}
                      {match.status === 'open' && (
                        <Button size="sm" className="gradient-accent" onClick={() => startMatch(match.id)}>
                          <Play className="w-4 h-4 mr-1" />Iniciar
                        </Button>
                      )}
                      {match.status === 'in_progress' && (
                        <Button size="sm" variant="outline" onClick={() => finishMatch(match.id)}>
                          <StopCircle className="w-4 h-4 mr-1" />Finalizar
                        </Button>
                      )}
                      {(match.status === 'waiting' || match.status === 'finished') && (
                        <Button size="sm" variant="destructive" onClick={() => deleteMatch(match.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {match.status === 'in_progress' && (
                    <div className="border-t border-border pt-4 mt-2">
                      <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={75}
                            placeholder="Número (1-75)"
                            value={callerInput[match.id] || ''}
                            onChange={e => setCallerInput(prev => ({ ...prev, [match.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleCallNumber(match.id)}
                            className="bg-secondary border-0 text-center font-semibold w-40"
                          />
                          <Button onClick={() => handleCallNumber(match.id)} className="gradient-accent">
                            Sortear
                          </Button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`auto-call-${match.id}`}
                            checked={!!match.isAutoCalling}
                            onCheckedChange={() => toggleAutoCall(match.id)}
                          />
                          <Label htmlFor={`auto-call-${match.id}`} className="flex items-center gap-1">
                            <Bot className="w-4 h-4" /> Sorteio Automático
                            {match.isAutoCalling && countdown[match.id] && (
                              <span className="ml-2 text-xs font-mono text-muted-foreground">(Próximo em {countdown[match.id]}s)</span>
                            )}
                          </Label>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {match.calledNumbers.map(num => (
                          <span key={num} className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
                            {num}
                          </span>
                        ))}
                        {match.calledNumbers.length === 0 && (
                          <span className="text-sm text-muted-foreground italic">Nenhum número sorteado</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;