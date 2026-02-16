import { useState } from 'react';
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
  Clock, Coins, Hash, ArrowLeft, StopCircle 
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
  const { 
    isAdmin, adminLogout, matches, players, createMatch, 
    openMatch, startMatch, finishMatch, deleteMatch, callNumber,
    getMatchCards,
  } = useGame();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    gameType: 'full' as GameType,
    maxCardsPerPlayer: 3,
    cardPrice: 10,
    prizeType: 'percentage' as PrizeType,
    prizeValue: 70,
    prizeName: '',
    startTime: '',
  });
  const [callerInput, setCallerInput] = useState<Record<string, string>>({});

  if (!isAdmin) {
    navigate('/admin/login');
    return null;
  }

  const handleCreate = () => {
    if (!form.name.trim() || !form.startTime) return;
    createMatch({
      name: form.name,
      gameType: form.gameType,
      maxCardsPerPlayer: form.maxCardsPerPlayer,
      cardPrice: form.cardPrice,
      prize: {
        type: form.prizeType,
        value: form.prizeValue,
        productName: form.prizeType === 'product' ? form.prizeName : undefined,
      },
      startTime: new Date(form.startTime).toISOString(),
    });
    setShowCreate(false);
    setForm({ name: '', gameType: 'full', maxCardsPerPlayer: 3, cardPrice: 10, prizeType: 'percentage', prizeValue: 70, prizeName: '', startTime: '' });
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-xl font-bold text-foreground">
            Partidas ({matches.length})
          </h2>

          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="gradient-primary shadow-button">
                <Plus className="w-4 h-4 mr-2" />
                Nova Partida
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading">Criar Partida</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Nome da partida" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="bg-secondary border-0" />
                
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Tipo de Jogo</label>
                  <Select value={form.gameType} onValueChange={(v: GameType) => setForm(prev => ({ ...prev, gameType: v }))}>
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
                    <Input type="number" min={1} max={10} value={form.maxCardsPerPlayer} onChange={e => setForm(prev => ({ ...prev, maxCardsPerPlayer: +e.target.value }))} className="bg-secondary border-0" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Preço/Cartela</label>
                    <Input type="number" min={1} value={form.cardPrice} onChange={e => setForm(prev => ({ ...prev, cardPrice: +e.target.value }))} className="bg-secondary border-0" />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Tipo de Prêmio</label>
                  <Select value={form.prizeType} onValueChange={(v: PrizeType) => setForm(prev => ({ ...prev, prizeType: v }))}>
                    <SelectTrigger className="bg-secondary border-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">% do Pote</SelectItem>
                      <SelectItem value="fixed">Valor Fixo</SelectItem>
                      <SelectItem value="product">Produto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.prizeType === 'product' && (
                  <Input placeholder="Nome do produto" value={form.prizeName} onChange={e => setForm(prev => ({ ...prev, prizeName: e.target.value }))} className="bg-secondary border-0" />
                )}

                {form.prizeType !== 'product' && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">
                      {form.prizeType === 'percentage' ? 'Porcentagem (%)' : 'Valor (créditos)'}
                    </label>
                    <Input type="number" min={1} value={form.prizeValue} onChange={e => setForm(prev => ({ ...prev, prizeValue: +e.target.value }))} className="bg-secondary border-0" />
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Horário de Início</label>
                  <Input type="datetime-local" value={form.startTime} onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))} className="bg-secondary border-0" />
                </div>

                <Button className="w-full gradient-primary shadow-button" onClick={handleCreate} disabled={!form.name.trim() || !form.startTime}>
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

                  {/* Number caller for in_progress matches */}
                  {match.status === 'in_progress' && (
                    <div className="border-t border-border pt-4 mt-2">
                      <div className="flex gap-2 mb-3">
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
                      <div className="flex flex-wrap gap-1.5">
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
