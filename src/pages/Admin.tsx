import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GameType } from '@/types/bingo';
import { PrizeType, MatchStatus } from '@/types/match';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { 
  Plus, LogOut, Play, DoorOpen, Trash2, Trophy, Users, 
  Hash, ArrowLeft, StopCircle, Settings, Save, Bot, Shuffle, ArrowRight, Webhook, Key, Send, Loader2, CreditCard
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Footer } from '@/components/Footer';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';

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
    n8n_env: 'test' as 'test' | 'production',
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
        n8n_env: (gameSettings.n8n_env as 'test' | 'production') || 'test',
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
        const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(num => !match.called_numbers.includes(num));
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

  if (!profile || profile.role !== 'admin') return null;

  const handleCreateMatch = () => {
    if (!matchForm.name.trim() || !matchForm.startTime) return;
    const prizePayload: any = { type: matchForm.prizeType, value: matchForm.prizeValue };
    if (matchForm.prizeType === 'product') prizePayload.productName = matchForm.prizeName;
    createMatch({ ...matchForm, prize: prizePayload, start_time: new Date(matchForm.startTime).toISOString() });
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
      toast({ title: 'Falha no Teste', description: error.message, variant: 'destructive' });
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
            <Button variant="ghost" size="sm" className="text-primary-foreground" onClick={signOut}><LogOut className="w-4 h-4 mr-1" />Sair</Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto py-8 px-4 flex-grow">
        <Tabs defaultValue="matches" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto mb-8">
            <TabsTrigger value="matches" className="py-3">Partidas</TabsTrigger>
            <TabsTrigger value="credits" className="py-3 relative">
              Créditos
              {pendingRequestsCount > 0 && (
                <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white border-2 border-background">
                  {pendingRequestsCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="players" className="py-3">Jogadores</TabsTrigger>
            <TabsTrigger value="settings" className="py-3">Ajustes</TabsTrigger>
          </TabsList>

          <TabsContent value="matches" className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-bold text-foreground">Gerenciar Partidas</h2>
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
                        <Input id="cardPrice" type="number" value={matchForm.cardPrice} onChange={e => setMatchForm(p => ({ ...p, cardPrice: +e.target.value }))} />
                      </div>
                      <div>
                        <Label htmlFor="maxCards">Máx. Cartelas</Label>
                        <Input id="maxCards" type="number" value={matchForm.maxCardsPerPlayer} onChange={e => setMatchForm(p => ({ ...p, maxCardsPerPlayer: +e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2 pt-2">
                      <Label>Tipo de Prêmio</Label>
                      <Select value={matchForm.prizeType} onValueChange={(v: PrizeType) => setMatchForm(p => ({ ...p, prizeType: v }))}>
                        <SelectTrigger><SelectValue placeholder="Tipo de Prêmio" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Porcentagem do Pote</SelectItem>
                          <SelectItem value="fixed">Valor Fixo</SelectItem>
                          <SelectItem value="product">Produto</SelectItem>
                        </SelectContent>
                      </Select>
                      {matchForm.prizeType === 'product' ? (
                        <Input placeholder="Nome do Produto" value={matchForm.prizeName} onChange={e => setMatchForm(p => ({ ...p, prizeName: e.target.value }))} />
                      ) : (
                        <Input type="number" placeholder={matchForm.prizeType === 'percentage' ? '70 (%)' : '500 (Créditos)'} value={matchForm.prizeValue} onChange={e => setMatchForm(p => ({ ...p, prizeValue: +e.target.value }))} />
                      )}
                    </div>
                    <Button className="w-full !mt-6" onClick={handleCreateMatch}>Criar Partida</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
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
                        <Badge className={statusColors[match.status]}>{statusLabels[match.status]}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />{gameTypeLabels[match.game_type]}</span>
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{playersInMatchCount} jogadores</span>
                        <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" />{matchCardsCount} cartelas</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {match.status === 'waiting' && <Button size="sm" onClick={() => openMatch(match.id)}><DoorOpen className="w-4 h-4 mr-1" />Abrir</Button>}
                      {match.status === 'open' && <Button size="sm" onClick={() => startMatch(match.id)}><Play className="w-4 h-4 mr-1" />Iniciar</Button>}
                      {match.status === 'in_progress' && <Button size="sm" variant="outline" onClick={() => finishMatch(match.id)}><StopCircle className="w-4 h-4 mr-1" />Finalizar</Button>}
                      {(match.status === 'waiting' || match.status === 'finished') && <Button size="sm" variant="destructive" onClick={() => deleteMatch(match.id)}><Trash2 className="w-4 h-4" /></Button>}
                    </div>
                  </div>
                  {match.status === 'in_progress' && (
                    <div className="border-t pt-4">
                      <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex gap-2">
                          <Input type="number" placeholder="Núm." value={callerInput[match.id] || ''} onChange={e => setCallerInput(p => ({ ...p, [match.id]: e.target.value }))} className="w-20" />
                          <Button onClick={() => handleCallNumber(match.id)}>Marcar</Button>
                          <Button variant="outline" size="icon" onClick={() => handleRandomCall(match.id)}><Shuffle className="w-4 h-4" /></Button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch checked={!!match.is_auto_calling} onCheckedChange={() => toggleAutoCall(match.id)} />
                          <Label className="flex items-center gap-1"><Bot className="w-4 h-4" /> Auto {match.is_auto_calling && `(${countdown}s)`}</Label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="credits">
            <div className="card-container">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading text-xl font-bold text-foreground">Solicitações de Crédito</h2>
                <Badge variant="destructive">{pendingRequestsCount} Pendentes</Badge>
              </div>
              <p className="text-muted-foreground mb-6">Acesse a página de gerenciamento de solicitações para aprovar comprovantes e liberar créditos.</p>
              <Button className="w-full py-6 text-lg gradient-primary shadow-button" onClick={() => navigate('/admin/credit-requests')}>
                Gerenciar Solicitações <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="players">
            <div className="card-container">
              <h2 className="font-heading text-xl font-bold text-foreground mb-4">Base de Jogadores</h2>
              <p className="text-muted-foreground mb-6">Visualize detalhes de perfis, ajuste saldos manualmente e veja as cartelas de cada usuário.</p>
              <Button className="w-full py-6 text-lg" variant="outline" onClick={() => navigate('/admin/players')}>
                Gerenciar Jogadores <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="card-container">
              <h2 className="font-heading text-xl font-bold text-foreground mb-6 flex items-center gap-2"><Settings className="w-5 h-5" /> Configurações do Sistema</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-heading font-bold text-primary">Economia do Jogo</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Nova Cartela</Label><Input name="custo_nova_cartela" type="number" value={currentSettings.custo_nova_cartela} onChange={handleSettingsChange} /></div>
                    <div><Label>Recarga</Label><Input name="custo_recarga_cartela" type="number" value={currentSettings.custo_recarga_cartela} onChange={handleSettingsChange} /></div>
                    <div><Label>Usos/Recarga</Label><Input name="usos_por_recarga" type="number" value={currentSettings.usos_por_recarga} onChange={handleSettingsChange} /></div>
                    <div><Label>R$ por Crédito</Label><Input name="valor_por_credito" type="number" step="0.01" value={currentSettings.valor_por_credito} onChange={handleSettingsChange} /></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-heading font-bold text-primary">Pagamento PIX</h3>
                  <div><Label>Chave PIX</Label><Input name="pix_key" value={currentSettings.pix_key} onChange={handleSettingsChange} /></div>
                  <div><Label>Texto de Instrução</Label><Textarea name="credit_request_text" value={currentSettings.credit_request_text} onChange={handleSettingsChange} rows={3} /></div>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t space-y-4">
                <h3 className="font-heading font-bold text-primary flex items-center gap-2"><Webhook className="w-4 h-4" /> Integração n8n</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label>URL Teste</Label><Input name="n8n_test_url" value={currentSettings.n8n_test_url} onChange={handleSettingsChange} /></div>
                  <div><Label>URL Prod</Label><Input name="n8n_prod_url" value={currentSettings.n8n_prod_url} onChange={handleSettingsChange} /></div>
                </div>
                <div className="flex items-center justify-between">
                   <RadioGroup value={currentSettings.n8n_env} onValueChange={(v: 'test' | 'production') => setCurrentSettings(p => ({ ...p, n8n_env: v }))} className="flex gap-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="test" id="t1" /><Label htmlFor="t1">Teste</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="production" id="p1" /><Label htmlFor="p1">Produção</Label></div>
                  </RadioGroup>
                  <Button variant="outline" size="sm" onClick={handleTestN8n} disabled={isTestingN8n}>
                    {isTestingN8n ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} Testar Webhook
                  </Button>
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <Button onClick={handleSaveSettings} className="gradient-primary"><Save className="w-4 h-4 mr-2" /> Salvar Configurações</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;