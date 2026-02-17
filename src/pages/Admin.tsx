import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GameType } from '@/types/bingo';
import { PrizeType, Match, MatchStatus } from '@/types/match';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { 
  Plus, LogOut, Play, DoorOpen, Trash2, Trophy, Users, 
  Clock, Coins, Hash, ArrowLeft, StopCircle, Settings, Save, Bot, Shuffle, Ticket, ArrowRight, Webhook, Key, Send, Loader2, CreditCard
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Footer } from '@/components/Footer';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';

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
  const { session, profile, signOut } = useAuth();
  const { 
    matches, players, createMatch, matchCards,
    openMatch, startMatch, finishMatch, deleteMatch, callNumber,
    toggleAutoCall, gameSettings, updateGameSettings, allCreditRequests
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
  const [currentSettings, setCurrentSettings] = useState({
    custo_nova_cartela: 10,
    custo_recarga_cartela: 5,
    usos_por_recarga: 1,
    intervalo_sorteio_auto_seg: 120,
    valor_por_credito: 1.00,
    n8n_test_url: '',
    n8n_prod_url: '',
    n8n_env: 'test',
    pix_key: '',
    credit_request_text: '',
  });
  const [callerInput, setCallerInput] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [isTestingN8n, setIsTestingN8n] = useState(false);
  const processingRef = useRef(new Set());

  useEffect(() => {
    if (!session || (profile && profile.role !== 'admin')) {
      navigate('/');
    }
  }, [session, profile, navigate]);

  useEffect(() => {
    if (gameSettings) {
      setCurrentSettings({
        custo_nova_cartela: gameSettings.custo_nova_cartela,
        custo_recarga_cartela: gameSettings.custo_recarga_cartela,
        usos_por_recarga: gameSettings.usos_por_recarga,
        intervalo_sorteio_auto_seg: gameSettings.intervalo_sorteio_auto_seg,
        valor_por_credito: gameSettings.valor_por_credito || 1.00,
        n8n_test_url: gameSettings.n8n_test_url || '',
        n8n_prod_url: gameSettings.n8n_prod_url || '',
        n8n_env: gameSettings.n8n_env || 'test',
        pix_key: gameSettings.pix_key || '',
        credit_request_text: gameSettings.credit_request_text || '',
      });
    }
  }, [gameSettings]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    matches.forEach(match => {
      if (match.is_auto_calling && match.status === 'in_progress' && match.next_auto_call_timestamp && now >= new Date(match.next_auto_call_timestamp).getTime()) {
        if (processingRef.current.has(match.id)) return;

        processingRef.current.add(match.id);

        const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
          .filter(num => !match.called_numbers.includes(num));

        if (availableNumbers.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableNumbers.length);
          callNumber(match.id, availableNumbers[randomIndex]);
        } else {
          toggleAutoCall(match.id);
        }

        setTimeout(() => processingRef.current.delete(match.id), 500);
      }
    });
  }, [now, matches, callNumber, toggleAutoCall]);

  if (!profile || profile.role !== 'admin') {
    return null;
  }

  const handleCreateMatch = () => {
    if (!matchForm.name.trim() || !matchForm.startTime) return;

    const prizePayload: any = {
      type: matchForm.prizeType,
      value: matchForm.prizeValue,
    };
    if (matchForm.prizeType === 'product') {
      prizePayload.productName = matchForm.prizeName;
    }

    createMatch({
      name: matchForm.name,
      game_type: matchForm.gameType,
      max_cards_per_player: matchForm.maxCardsPerPlayer,
      card_price: matchForm.cardPrice,
      prize: prizePayload,
      start_time: new Date(matchForm.startTime).toISOString(),
    });
    setShowCreate(false);
  };

  const handleCallNumber = (matchId: string) => {
    const num = parseInt(callerInput[matchId] || '', 10);
    if (num >= 1 && num <= 75) {
      callNumber(matchId, num);
      setCallerInput(prev => ({ ...prev, [matchId]: '' }));
    }
  };

  const handleRandomCall = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(num => !match.called_numbers.includes(num));
    if (availableNumbers.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      callNumber(match.id, availableNumbers[randomIndex]);
    } else {
      toast({ title: 'Todos os números já foram sorteados!', variant: 'destructive' });
    }
  };

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSettings = () => {
    updateGameSettings({
      ...currentSettings,
      custo_nova_cartela: parseInt(currentSettings.custo_nova_cartela as any, 10),
      custo_recarga_cartela: parseInt(currentSettings.custo_recarga_cartela as any, 10),
      usos_por_recarga: parseInt(currentSettings.usos_por_recarga as any, 10),
      intervalo_sorteio_auto_seg: parseInt(currentSettings.intervalo_sorteio_auto_seg as any, 10),
      valor_por_credito: parseFloat(currentSettings.valor_por_credito as any),
    });
  };

  const handleTestN8n = async () => {
    setIsTestingN8n(true);
    const { data, error } = await supabase.functions.invoke('test-n8n');

    if (error) {
      let detailedError = error.message;
      if ('context' in error && typeof (error as any).context.json === 'function') {
        try {
          const errorJson = await (error as any).context.json();
          if (errorJson.error) { detailedError = errorJson.error; }
        } catch (e) { console.error("Failed to parse edge function error response:", e); }
      }
      toast({ title: 'Falha no Teste', description: detailedError, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso!', description: data.message || 'Notificação de teste enviada.' });
    }
    setIsTestingN8n(false);
  };

  const pendingRequestsCount = allCreditRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="gradient-hero py-6 px-4">
        <div className="container max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-primary-foreground">Painel Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary-foreground/70 text-sm hidden sm:block">{players.length} jogadores</span>
            <Button variant="ghost" size="sm" className="text-primary-foreground" onClick={signOut}><LogOut className="w-4 h-4 mr-1" />Sair</Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto py-8 px-4 flex-grow">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="card-container">
            <h2 className="font-heading text-xl font-bold text-foreground mb-4 flex items-center gap-2"><Settings className="w-5 h-5" /> Configurações Gerais</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="custo_nova_cartela">Custo Nova Cartela</Label>
                <Input id="custo_nova_cartela" name="custo_nova_cartela" type="number" value={currentSettings.custo_nova_cartela} onChange={handleSettingsChange} />
              </div>
              <div>
                <Label htmlFor="custo_recarga_cartela">Custo Recarga</Label>
                <Input id="custo_recarga_cartela" name="custo_recarga_cartela" type="number" value={currentSettings.custo_recarga_cartela} onChange={handleSettingsChange} />
              </div>
              <div>
                <Label htmlFor="usos_por_recarga">Usos por Recarga</Label>
                <Input id="usos_por_recarga" name="usos_por_recarga" type="number" value={currentSettings.usos_por_recarga} onChange={handleSettingsChange} />
              </div>
              <div>
                <Label htmlFor="intervalo_sorteio_auto_seg">Intervalo Sorteio (s)</Label>
                <Input id="intervalo_sorteio_auto_seg" name="intervalo_sorteio_auto_seg" type="number" value={currentSettings.intervalo_sorteio_auto_seg} onChange={handleSettingsChange} />
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t">
              <h3 className="font-heading text-lg font-bold text-foreground mb-4 flex items-center gap-2"><Key className="w-5 h-5" /> Solicitação de Créditos (PIX)</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="valor_por_credito">Valor por Crédito (R$)</Label>
                  <Input id="valor_por_credito" name="valor_por_credito" type="number" step="0.01" value={currentSettings.valor_por_credito} onChange={handleSettingsChange} />
                </div>
                <div>
                  <Label htmlFor="pix_key">Chave PIX</Label>
                  <Input id="pix_key" name="pix_key" type="text" placeholder="Sua chave PIX (e.g., CPF, email, telefone)" value={currentSettings.pix_key} onChange={handleSettingsChange} />
                </div>
                <div>
                  <Label htmlFor="credit_request_text">Texto de Instrução</Label>
                  <Textarea id="credit_request_text" name="credit_request_text" placeholder="Instruções para o jogador sobre como fazer o PIX e enviar o comprovante." value={currentSettings.credit_request_text} onChange={handleSettingsChange} />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t">
              <h3 className="font-heading text-lg font-bold text-foreground mb-4 flex items-center gap-2"><Webhook className="w-5 h-5" /> Notificações (n8n)</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="n8n_test_url">URL de Teste</Label>
                  <Input id="n8n_test_url" name="n8n_test_url" type="text" placeholder="https://.../webhook-test/..." value={currentSettings.n8n_test_url} onChange={handleSettingsChange} />
                </div>
                <div>
                  <Label htmlFor="n8n_prod_url">URL de Produção</Label>
                  <Input id="n8n_prod_url" name="n8n_prod_url" type="text" placeholder="https://.../webhook/..." value={currentSettings.n8n_prod_url} onChange={handleSettingsChange} />
                </div>
                <div>
                  <Label>Ambiente Ativo</Label>
                  <RadioGroup
                    value={currentSettings.n8n_env}
                    onValueChange={(value) => setCurrentSettings(prev => ({ ...prev, n8n_env: value }))}
                    className="flex items-center gap-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="test" id="r1" />
                      <Label htmlFor="r1">Teste</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="production" id="r2" />
                      <Label htmlFor="r2">Produção</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestN8n}
                    disabled={isTestingN8n}
                  >
                    {isTestingN8n ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Testar Ambiente Ativo
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSaveSettings}><Save className="w-4 h-4 mr-2" /> Salvar Todas as Configurações</Button>
            </div>
          </div>

          <div className="space-y-8">
            <div className="card-container">
              <h2 className="font-heading text-xl font-bold text-foreground mb-4 flex items-center gap-2"><Users className="w-5 h-5" /> Gerenciamento de Jogadores</h2>
              <p className="text-muted-foreground mb-4">Acesse a página de gerenciamento para ver detalhes, cartelas e gerenciar os créditos de cada jogador.</p>
              <Button className="w-full" onClick={() => navigate('/admin/players')}>
                Gerenciar Jogadores <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
            <div className="card-container">
              <h2 className="font-heading text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Solicitações de Crédito
                {pendingRequestsCount > 0 && <Badge variant="destructive">{pendingRequestsCount}</Badge>}
              </h2>
              <p className="text-muted-foreground mb-4">Aprove ou rejeite as solicitações de crédito enviadas pelos jogadores.</p>
              <Button className="w-full" onClick={() => navigate('/admin/credit-requests')}>
                Ver Solicitações <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-xl font-bold text-foreground">Partidas ({matches.length})</h2>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nova Partida</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle className="font-heading">Criar Partida</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="matchName">Nome da partida</Label>
                    <Input id="matchName" placeholder="Ex: Bingo de Sexta" value={matchForm.name} onChange={e => setMatchForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="startTime">Data e Hora de Início</Label>
                    <Input id="startTime" type="datetime-local" value={matchForm.startTime} onChange={e => setMatchForm(p => ({ ...p, startTime: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Tipo de Jogo</Label>
                    <Select value={matchForm.gameType} onValueChange={(v: GameType) => setMatchForm(p => ({ ...p, gameType: v }))}>
                      <SelectTrigger><SelectValue placeholder="Tipo de Jogo" /></SelectTrigger>
                      <SelectContent>{Object.entries(gameTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cardPrice">Preço/Cartela</Label>
                      <Input id="cardPrice" type="number" placeholder="10" value={matchForm.cardPrice} onChange={e => setMatchForm(p => ({ ...p, cardPrice: +e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="maxCards">Máx. Cartelas</Label>
                      <Input id="maxCards" type="number" placeholder="3" value={matchForm.maxCardsPerPlayer} onChange={e => setMatchForm(p => ({ ...p, maxCardsPerPlayer: +e.target.value }))} />
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">Prêmio</h4>
                    <div>
                      <Label>Tipo de Prêmio</Label>
                      <Select value={matchForm.prizeType} onValueChange={(v: PrizeType) => setMatchForm(p => ({ ...p, prizeType: v }))}>
                        <SelectTrigger><SelectValue placeholder="Tipo de Prêmio" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Porcentagem do Pote</SelectItem>
                          <SelectItem value="fixed">Valor Fixo</SelectItem>
                          <SelectItem value="product">Produto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {matchForm.prizeType === 'product' ? (
                      <div>
                        <Label htmlFor="prizeName">Nome do Produto</Label>
                        <Input id="prizeName" placeholder="Ex: Cesta de Café" value={matchForm.prizeName} onChange={e => setMatchForm(p => ({ ...p, prizeName: e.target.value }))} />
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="prizeValue">{matchForm.prizeType === 'percentage' ? 'Porcentagem (%)' : 'Créditos'}</Label>
                        <Input id="prizeValue" type="number" placeholder={matchForm.prizeType === 'percentage' ? '70' : '500'} value={matchForm.prizeValue} onChange={e => setMatchForm(p => ({ ...p, prizeValue: +e.target.value }))} />
                      </div>
                    )}
                  </div>

                  <Button className="w-full !mt-6" onClick={handleCreateMatch}>Criar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {matches.map(match => {
              const matchCardsCount = matchCards.filter(mc => mc.match_id === match.id).length;
              const playersInMatchCount = new Set(matchCards.filter(mc => mc.match_id === match.id).map(mc => mc.player_id)).size;
              const countdown = match.next_auto_call_timestamp ? Math.round((new Date(match.next_auto_call_timestamp).getTime() - now) / 1000) : 0;

              return (
                <div key={match.id} className="card-container">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-heading font-bold text-lg text-foreground">{match.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[match.status]}`}>{statusLabels[match.status]}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />{gameTypeLabels[match.game_type]}</span>
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{playersInMatchCount} jogadores</span>
                        <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" />{matchCardsCount} cartelas</span>
                        <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5" />Pote: {match.pot}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {match.status === 'waiting' && <Button size="sm" onClick={() => openMatch(match.id)}><DoorOpen className="w-4 h-4 mr-1" />Abrir</Button>}
                      {match.status === 'open' && <Button size="sm" onClick={() => startMatch(match.id)}><Play className="w-4 h-4 mr-1" />Iniciar</Button>}
                      {match.status === 'in_progress' && <Button size="sm" variant="outline" onClick={() => finishMatch(match.id)}><StopCircle className="w-4 h-4 mr-1" />Finalizar</Button>}
                      {(match.status === 'waiting' || match.status === 'finished') && <Button size="sm" variant="destructive" onClick={() => deleteMatch(match.id)}><Trash2 className="w-4 h-4" /></Button>}
                    </div>
                  </div>
                  {match.status === 'in_progress' && (
                    <div className="border-t border-border pt-4 mt-2">
                      <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex gap-2">
                          <Input type="number" placeholder="Número" value={callerInput[match.id] || ''} onChange={e => setCallerInput(p => ({ ...p, [match.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleCallNumber(match.id)} className="w-24" />
                          <Button onClick={() => handleCallNumber(match.id)}>Marcar</Button>
                          <Button variant="outline" size="icon" onClick={() => handleRandomCall(match.id)}><Shuffle className="w-4 h-4" /></Button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch id={`auto-call-${match.id}`} checked={!!match.is_auto_calling} onCheckedChange={() => toggleAutoCall(match.id)} />
                          <Label htmlFor={`auto-call-${match.id}`} className="flex items-center gap-1">
                            <Bot className="w-4 h-4" /> Sorteio Automático {match.is_auto_calling && countdown > 0 && `(${countdown}s)`}
                          </Label>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {match.called_numbers.map(num => <span key={num} className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">{num}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;