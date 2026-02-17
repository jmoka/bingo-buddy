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
  Hash, ArrowLeft, StopCircle, Settings, Save, Bot, Shuffle, ArrowRight, Webhook, Key, Send, Loader2, CreditCard, Banknote, Check
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
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
    matches, createMatch, matchCards,
    openMatch, startMatch, finishMatch, deleteMatch, callNumber,
    toggleAutoCall, gameSettings, updateGameSettings, allCreditRequests,
    allRedeemRequests
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
    prizeImageFile: null as File | null,
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
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
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

  const handleCreateMatch = async () => {
    if (!matchForm.name.trim() || !matchForm.startTime) return;

    let prizeImageUrl: string | undefined = undefined;

    if (matchForm.prizeType === 'product' && matchForm.prizeImageFile) {
        const file = matchForm.prizeImageFile;
        const filePath = `public/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        
        const { error: uploadError } = await supabase.storage
            .from('prizes')
            .upload(filePath, file);

        if (uploadError) {
            toast({ title: 'Erro no Upload', description: uploadError.message, variant: 'destructive' });
            return;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('prizes')
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
    });
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

  const handleSaveSettings = async () => {
    setIsSaving(true);
    await updateGameSettings({
      ...currentSettings,
      custo_nova_cartela: parseInt(currentSettings.custo_nova_cartela as any, 10),
      custo_recarga_cartela: parseInt(currentSettings.custo_recarga_cartela as any, 10),
      usos_por_recarga: parseInt(currentSettings.usos_por_recarga as any, 10),
      intervalo_sorteio_auto_seg: parseInt(currentSettings.intervalo_sorteio_auto_seg as any, 10),
      valor_por_credito: parseFloat(currentSettings.valor_por_credito as any),
    });
    setIsSaving(false);
    setJustSaved(true);
    setTimeout(() => {
      setJustSaved(false);
    }, 2000);
  };

  const handleTestN8n = async () => {
    setIsTestingN8n(true);
    const { data, error } = await supabase.functions.invoke('test-n8n');
    if (error) { toast({ title: 'Falha no Teste', description: error.message, variant: 'destructive' }); } 
    else { toast({ title: 'Sucesso!', description: data.message || 'Notificação de teste enviada.' }); }
    setIsTestingN8n(false);
  };

  const pendingRequestsCount = (allCreditRequests || []).filter(r => r.status === 'pending').length;
  const pendingRedeemsCount = (allRedeemRequests || []).filter(r => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="gradient-hero py-6 px-4">
        <div className="container max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => navigate('/')}><ArrowLeft className="w-5 h-5" /></Button>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-primary-foreground">Painel Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-primary-foreground" onClick={signOut}><LogOut className="w-4 h-4 mr-1" />Sair</Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto py-8 px-4 flex-grow">
        <Tabs defaultValue="matches" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto mb-8">
            <TabsTrigger value="matches" className="py-3">Partidas</TabsTrigger>
            <TabsTrigger value="credits" className="py-3 relative">
              Entradas
              {pendingRequestsCount > 0 && <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white border border-background">{pendingRequestsCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="redeems" className="py-3 relative">
              Saídas
              {pendingRedeemsCount > 0 && <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white border border-background">{pendingRedeemsCount}</span>}
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
                  <DialogHeader><DialogTitle className="font-heading">Criar Partida</DialogTitle><DialogDescription>Preencha os detalhes da nova partida.</DialogDescription></DialogHeader>
                  <div className="space-y-4 pt-4">
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
                    <Button className="w-full !mt-6" onClick={handleCreateMatch}>Criar Partida</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {matches.map(match => (
              <div key={match.id} className="card-container">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-heading font-bold text-lg text-foreground">{match.name}</h3>
                      <Badge className={statusColors[match.status]}>{statusLabels[match.status]}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex gap-3"><span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />{gameTypeLabels[match.game_type]}</span></div>
                  </div>
                  <div className="flex gap-2">
                    {match.status === 'waiting' && <Button size="sm" onClick={() => openMatch(match.id)}>Abrir</Button>}
                    {match.status === 'open' && <Button size="sm" onClick={() => startMatch(match.id)}>Iniciar</Button>}
                    {match.status === 'in_progress' && <Button size="sm" variant="outline" onClick={() => finishMatch(match.id)}>Finalizar</Button>}
                    {(match.status === 'waiting' || match.status === 'finished') && <Button size="sm" variant="destructive" onClick={() => deleteMatch(match.id)}><Trash2 className="w-4 h-4" /></Button>}
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="credits">
            <div className="card-container">
              <h2 className="font-heading text-xl font-bold text-foreground mb-4">Solicitações de Entrada</h2>
              <p className="text-muted-foreground mb-6">Aprovação de comprovantes e liberação de créditos.</p>
              <Button className="w-full py-6 text-lg gradient-primary" onClick={() => navigate('/admin/credit-requests')}>Gerenciar Entradas <ArrowRight className="w-5 h-5 ml-2" /></Button>
            </div>
          </TabsContent>

          <TabsContent value="redeems">
            <div className="card-container">
              <h2 className="font-heading text-xl font-bold text-foreground mb-4">Solicitações de Resgate (Saída)</h2>
              <p className="text-muted-foreground mb-6">Pagamento de prêmios e créditos aos jogadores via PIX.</p>
              <Button className="w-full py-6 text-lg gradient-primary" onClick={() => navigate('/admin/redeem-requests')}>Gerenciar Resgates <ArrowRight className="w-5 h-5 ml-2" /></Button>
            </div>
          </TabsContent>

          <TabsContent value="players">
            <div className="card-container">
              <h2 className="font-heading text-xl font-bold text-foreground mb-4">Base de Jogadores</h2>
              <p className="text-muted-foreground mb-6">Visualize detalhes de perfis e ajuste saldos manualmente.</p>
              <Button className="w-full py-6 text-lg" variant="outline" onClick={() => navigate('/admin/players')}>Gerenciar Jogadores <ArrowRight className="w-5 h-5 ml-2" /></Button>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="card-container">
              <h2 className="font-heading text-xl font-bold text-foreground mb-6 flex items-center gap-2"><Settings className="w-5 h-5" /> Ajustes do Sistema</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-heading font-bold text-primary">Economia</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Nova Cartela</Label><Input name="custo_nova_cartela" type="number" value={currentSettings.custo_nova_cartela} onChange={handleSettingsChange} /></div>
                    <div><Label>Recarga</Label><Input name="custo_recarga_cartela" type="number" value={currentSettings.custo_recarga_cartela} onChange={handleSettingsChange} /></div>
                    <div><Label>R$ por Crédito</Label><Input name="valor_por_credito" type="number" step="0.01" value={currentSettings.valor_por_credito} onChange={handleSettingsChange} /></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-heading font-bold text-primary">PIX</h3>
                  <div><Label>Chave PIX (Admin)</Label><Input name="pix_key" value={currentSettings.pix_key} onChange={handleSettingsChange} /></div>
                  <div><Label>Texto de Instrução</Label><Textarea name="credit_request_text" value={currentSettings.credit_request_text} onChange={handleSettingsChange} rows={3} /></div>
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <Button onClick={handleSaveSettings} className="gradient-primary" disabled={isSaving || justSaved}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : justSaved ? (
                    <span className="flex items-center animate-saved">
                      <Check className="w-4 h-4 mr-2" />
                      Salvo!
                    </span>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar
                    </>
                  )}
                </Button>
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