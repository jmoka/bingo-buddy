import { useState, useEffect, useMemo } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, Settings, Check, Loader2, Bot, Link as LinkIcon, DollarSign, Banknote, Play, CalendarDays, Clock, Ticket, CreditCard } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfDay } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog";
import { GameType, PrizeType } from '@/types/match';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

const SettingsManager = () => {
  const { gameSettings, updateGameSettings, withdrawAdminProfit } = useGame();
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
    pix_name: '',
    pix_city: '',
    credit_request_text: '',
    auto_engine_enabled: false,
    auto_engine_interval_mins: 60,
    auto_engine_matches_per_day: 24,
    auto_engine_game_type: 'full' as any,
    auto_engine_card_price: 10,
    auto_engine_prize_type: 'percentage' as any,
    auto_engine_prize_value: 80,
    auto_engine_start_hour: 0,
    desconto_vendedor_global: 0,
    comissao_vendedor_global: 0,
    cartelas_por_folha_bingo: 4,
    stripe_secret_key: '',
    stripe_webhook_secret: '',
    stripe_enabled: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [isTestingEngine, setIsTestingEngine] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

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
        pix_name: gameSettings.pix_name || 'BINGO SHOW',
        pix_city: gameSettings.pix_city || 'SAO PAULO',
        credit_request_text: gameSettings.credit_request_text || '',
        auto_engine_enabled: gameSettings.auto_engine_enabled || false,
        auto_engine_interval_mins: gameSettings.auto_engine_interval_mins || 60,
        auto_engine_matches_per_day: gameSettings.auto_engine_matches_per_day || 24,
        auto_engine_game_type: gameSettings.auto_engine_game_type || 'full',
        auto_engine_card_price: gameSettings.auto_engine_card_price || 10,
        auto_engine_prize_type: gameSettings.auto_engine_prize_type || 'percentage',
        auto_engine_prize_value: gameSettings.auto_engine_prize_value || 80,
        auto_engine_start_hour: gameSettings.auto_engine_start_hour || 0,
        desconto_vendedor_global: gameSettings.desconto_vendedor_global || 0,
        comissao_vendedor_global: gameSettings.comissao_vendedor_global || 0,
        cartelas_por_folha_bingo: gameSettings.cartelas_por_folha_bingo || 4,
        stripe_secret_key: gameSettings.stripe_secret_key || '',
        stripe_webhook_secret: gameSettings.stripe_webhook_secret || '',
        stripe_enabled: gameSettings.stripe_enabled || false,
      });
    }
  }, [gameSettings]);

  const schedulePreview = useMemo(() => {
    const times = [];
    const intervalMins = Math.max(1, Number(currentSettings.auto_engine_interval_mins));
    let checkTime = startOfDay(new Date()).getTime() + (Number(currentSettings.auto_engine_start_hour) * 3600000);
    const limit = checkTime + (24 * 3600000);
    const interval = intervalMins * 60000;

    while (checkTime < limit && times.length < Number(currentSettings.auto_engine_matches_per_day)) {
      times.push(new Date(checkTime));
      checkTime += interval;
    }
    return times;
  }, [currentSettings.auto_engine_start_hour, currentSettings.auto_engine_interval_mins, currentSettings.auto_engine_matches_per_day]);

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleChange = async (name: string, checked: boolean) => {
    setCurrentSettings(prev => ({ ...prev, [name]: checked }));
    
    setIsSaving(true);
    const success = await updateGameSettings({ 
        ...currentSettings, 
        [name]: checked,
        auto_engine_interval_mins: Math.max(1, Number(currentSettings.auto_engine_interval_mins)),
        auto_engine_matches_per_day: Number(currentSettings.auto_engine_matches_per_day),
        auto_engine_card_price: Number(currentSettings.auto_engine_card_price),
        auto_engine_prize_value: Number(currentSettings.auto_engine_prize_value),
        auto_engine_start_hour: Number(currentSettings.auto_engine_start_hour),
        cartelas_por_folha_bingo: Number(currentSettings.cartelas_por_folha_bingo),
    });
    setIsSaving(false);

    if (success && name === 'auto_engine_enabled' && checked) {
        toast.info("Motor ativado! Tentando criar a primeira partida...");
        try {
            await supabase.functions.invoke('auto-match-engine', { body: { force: true } });
        } catch (e) {}
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setCurrentSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSettings = async () => {
    if (Number(currentSettings.auto_engine_interval_mins) < 1) {
        toast.error("O intervalo do motor deve ser de pelo menos 1 minuto.");
        return;
    }

    setIsSaving(true);
    const success = await updateGameSettings({
      ...currentSettings,
      custo_nova_cartela: Number(currentSettings.custo_nova_cartela),
      custo_recarga_cartela: Number(currentSettings.custo_recarga_cartela),
      usos_por_recarga: parseInt(currentSettings.usos_por_recarga as any, 10),
      intervalo_sorteio_auto_seg: parseInt(currentSettings.intervalo_sorteio_auto_seg as any, 10),
      valor_por_credito: Number(currentSettings.valor_por_credito),
      auto_engine_interval_mins: parseInt(currentSettings.auto_engine_interval_mins as any, 10),
      auto_engine_matches_per_day: parseInt(currentSettings.auto_engine_matches_per_day as any, 10),
      auto_engine_card_price: Number(currentSettings.auto_engine_card_price),
      auto_engine_prize_value: Number(currentSettings.auto_engine_prize_value),
      auto_engine_start_hour: parseInt(currentSettings.auto_engine_start_hour as any, 10),
      desconto_vendedor_global: Number(currentSettings.desconto_vendedor_global),
      comissao_vendedor_global: Number(currentSettings.comissao_vendedor_global),
      cartelas_por_folha_bingo: parseInt(currentSettings.cartelas_por_folha_bingo as any, 10),
    });
    
    setIsSaving(false);
    if (success) {
        setJustSaved(true);
        toast.success("Configurações salvas com sucesso!");
        setTimeout(() => setJustSaved(false), 2000);
    }
  };

  const handleTestEngine = async () => {
    setIsTestingEngine(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-match-engine', { body: { force: true } });
      if (error) throw error;
      if (data.success) {
        toast.success('Motor executado!', { description: `Nova partida criada: ${data.match.name}` });
      } else {
        toast.info('Motor executado, mas nenhuma partida foi criada.', { description: data.message });
      }
    } catch (e: any) {
      toast.error('Erro ao testar motor', { description: e.message });
    } finally {
      setIsTestingEngine(false);
    }
  };

  const handleWithdraw = async () => {
    setIsWithdrawing(true);
    const success = await withdrawAdminProfit(withdrawAmount);
    if (success) {
      setIsWithdrawDialogOpen(false);
      setWithdrawAmount(0);
    }
    setIsWithdrawing(false);
  };

  return (
    <div className="card-container">
      <h2 className="font-heading text-xl font-bold text-foreground mb-6 flex items-center gap-2"><Settings className="w-5 h-5" /> Ajustes do Sistema</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-10">
        <div className="space-y-6">
          <h3 className="font-heading font-bold text-primary border-b pb-2">Economia</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Nova Cartela (cr)</Label><Input name="custo_nova_cartela" type="number" step="0.01" value={currentSettings.custo_nova_cartela} onChange={handleSettingsChange} /></div>
            <div><Label>Recarga (cr)</Label><Input name="custo_recarga_cartela" type="number" step="0.01" value={currentSettings.custo_recarga_cartela} onChange={handleSettingsChange} /></div>
            <div><Label>Usos por Recarga</Label><Input name="usos_por_recarga" type="number" value={currentSettings.usos_por_recarga} onChange={handleSettingsChange} /></div>
            <div><Label>R$ por Crédito</Label><Input name="valor_por_credito" type="number" step="0.01" value={currentSettings.valor_por_credito} onChange={handleSettingsChange} /></div>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="font-heading font-bold text-primary border-b pb-2 flex items-center gap-2"><Clock className="w-4 h-4" /> Regras de Partida</h3>
          <div>
            <Label>Intervalo entre Números (segundos)</Label>
            <Input 
              name="intervalo_sorteio_auto_seg" 
              type="number" 
              value={currentSettings.intervalo_sorteio_auto_seg} 
              onChange={handleSettingsChange} 
            />
            <p className="text-[10px] text-muted-foreground mt-1">Tempo de espera entre cada bola sorteada no modo automático.</p>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="font-heading font-bold text-primary border-b pb-2 flex items-center gap-2"><Ticket className="w-4 h-4" /> Sistema de Vendedores</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Desconto Global (%)</Label>
              <Input name="desconto_vendedor_global" type="number" step="0.1" min="0" max="100" value={currentSettings.desconto_vendedor_global} onChange={handleSettingsChange} />
            </div>
            <div>
              <Label>Comissão Global (%)</Label>
              <Input name="comissao_vendedor_global" type="number" step="0.1" min="0" max="100" value={currentSettings.comissao_vendedor_global} onChange={handleSettingsChange} />
            </div>
            <div className="col-span-2">
              <Label>Grids por Folha de Bingo Impressa</Label>
              <Input name="cartelas_por_folha_bingo" type="number" min="1" max="10" value={currentSettings.cartelas_por_folha_bingo} onChange={handleSettingsChange} />
              <p className="text-[10px] text-muted-foreground mt-1">Quando o vendedor emite 1 bilhete físico para o bingo, quantas cartelas (chances) o jogador terá na folha.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="font-heading font-bold text-primary border-b pb-2">PIX e Créditos</h3>
          <div className="space-y-4">
            <div><Label>Chave PIX (Admin)</Label><Input name="pix_key" value={currentSettings.pix_key} onChange={handleSettingsChange} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome Recebedor (Sem acentos)</Label><Input name="pix_name" value={currentSettings.pix_name} onChange={handleSettingsChange} placeholder="Ex: BINGO SHOW" /></div>
              <div><Label>Cidade (Sem acentos)</Label><Input name="pix_city" value={currentSettings.pix_city} onChange={handleSettingsChange} placeholder="Ex: SAO PAULO" /></div>
            </div>
            <div><Label>Texto de Instrução</Label><Textarea name="credit_request_text" value={currentSettings.credit_request_text} onChange={handleSettingsChange} rows={3} /></div>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="font-heading font-bold text-primary border-b pb-2 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Pagamentos Automáticos (Stripe)</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-base font-bold">Ativar Stripe</Label>
                <p className="text-xs text-muted-foreground">Habilita pagamentos automáticos via Cartão/PIX.</p>
              </div>
              <Switch 
                checked={currentSettings.stripe_enabled} 
                onCheckedChange={(checked) => handleToggleChange('stripe_enabled', checked)}
              />
            </div>
            <div>
              <Label>Stripe Secret Key (sk_...)</Label>
              <Input name="stripe_secret_key" type="password" value={currentSettings.stripe_secret_key} onChange={handleSettingsChange} placeholder="Cole sua chave secreta aqui" />
            </div>
            <div>
              <Label>Stripe Webhook Secret (whsec_...)</Label>
              <Input name="stripe_webhook_secret" type="password" value={currentSettings.stripe_webhook_secret} onChange={handleSettingsChange} placeholder="Cole o segredo do webhook aqui" />
            </div>
            <p className="text-[10px] text-muted-foreground bg-muted p-2 rounded border border-dashed">
              <strong>Dica:</strong> Configure o Webhook no Stripe para enviar eventos para:<br/>
              <code className="font-bold text-primary">https://vqvnodwojefubbbnbyar.supabase.co/functions/v1/stripe-webhook</code>
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="font-heading font-bold text-primary border-b pb-2 flex items-center gap-2"><Bot className="w-4 h-4" /> Automação (Motor)</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-base font-bold">Status do Motor</Label>
                <p className="text-xs text-muted-foreground">Ligue para criar partidas automaticamente.</p>
              </div>
              <Switch 
                checked={currentSettings.auto_engine_enabled} 
                onCheckedChange={(checked) => handleToggleChange('auto_engine_enabled', checked)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hora de Início (0-23h)</Label>
                <Input name="auto_engine_start_hour" type="number" min="0" max="23" value={currentSettings.auto_engine_start_hour} onChange={handleSettingsChange} />
              </div>
              <div>
                <Label>Intervalo (min)</Label>
                <Input name="auto_engine_interval_mins" type="number" min="1" value={currentSettings.auto_engine_interval_mins} onChange={handleSettingsChange} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Partidas por Dia (Máx)</Label>
                <Input name="auto_engine_matches_per_day" type="number" value={currentSettings.auto_engine_matches_per_day} onChange={handleSettingsChange} />
              </div>
              <div>
                <Label>Preço da Cartela (cr)</Label>
                <Input name="auto_engine_card_price" type="number" step="0.01" value={currentSettings.auto_engine_card_price} onChange={handleSettingsChange} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Jogo Padrão</Label>
              <Select value={currentSettings.auto_engine_game_type} onValueChange={(v: GameType) => handleSelectChange('auto_engine_game_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(gameTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prêmio Padrão</Label>
              <div className="flex gap-2">
                <RadioGroup
                  value={currentSettings.auto_engine_prize_type}
                  onValueChange={(v: PrizeType) => handleSelectChange('auto_engine_prize_type', v)}
                  className="grid grid-cols-2 gap-2 flex-grow"
                >
                  <div>
                    <RadioGroupItem value="percentage" id="auto_percentage" className="peer sr-only" />
                    <Label htmlFor="auto_percentage" className="flex text-xs items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                      % do Pote
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="fixed" id="auto_fixed" className="peer sr-only" />
                    <Label htmlFor="auto_fixed" className="flex text-xs items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                      Valor Fixo
                    </Label>
                  </div>
                </RadioGroup>
                <Input 
                  name="auto_engine_prize_value" 
                  type="number" 
                  step="0.01"
                  value={currentSettings.auto_engine_prize_value} 
                  onChange={handleSettingsChange} 
                  className="w-24"
                />
              </div>
            </div>

            <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                <Label className="flex items-center gap-2 mb-3"><CalendarDays className="w-4 h-4" /> Agenda Programada (Slots)</Label>
                <div className="grid grid-cols-4 gap-2">
                    {schedulePreview.map((time, i) => (
                        <div key={i} className="text-[10px] font-bold font-mono bg-background border rounded p-1 text-center">
                            {format(time, 'HH:mm')}
                        </div>
                    ))}
                </div>
            </div>

            {currentSettings.auto_engine_enabled && (
              <Button 
                variant="outline" 
                className="w-full border-primary/30 text-primary hover:bg-primary/5"
                onClick={handleTestEngine}
                disabled={isTestingEngine}
              >
                {isTestingEngine ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                Testar Motor Agora
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="font-heading font-bold text-primary border-b pb-2 flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Integrações (n8n)</h3>
          <div><Label>URL de Teste</Label><Input name="n8n_test_url" value={currentSettings.n8n_test_url} onChange={handleSettingsChange} /></div>
          <div><Label>URL de Produção</Label><Input name="n8n_prod_url" value={currentSettings.n8n_prod_url} onChange={handleSettingsChange} /></div>
          <div>
            <Label>Ambiente Ativo</Label>
            <Select value={currentSettings.n8n_env} onValueChange={(v) => handleSelectChange('n8n_env', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Teste</SelectItem>
                <SelectItem value="production">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-6 md:col-span-2">
          <h3 className="font-heading font-bold text-primary border-b pb-2 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Caixa do Admin</h3>
          <div className="p-4 bg-muted rounded-lg flex items-center justify-between">
            <div>
              <Label>Lucro Total Acumulado</Label>
              <p className="text-2xl font-bold font-heading text-success">
                {Number(gameSettings?.admin_profit || 0).toFixed(2)} créditos
              </p>
            </div>
            <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Banknote className="w-4 h-4 mr-2" />
                  Retirar Lucro
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Retirar Lucro do Caixa</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div>
                    <Label htmlFor="withdraw-amount">Créditos a Retirar</Label>
                    <Input
                      id="withdraw-amount"
                      type="number"
                      step="0.01"
                      value={withdrawAmount || ''}
                      onChange={(e) => setWithdrawAmount(Number(e.target.value) || 0)}
                      max={gameSettings?.admin_profit || 0}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                  <Button onClick={handleWithdraw} disabled={isWithdrawing || !withdrawAmount || withdrawAmount <= 0}>
                    {isWithdrawing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Confirmar Retirada
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="mt-10 flex justify-end">
        <Button onClick={handleSaveSettings} className="gradient-primary" disabled={isSaving || justSaved}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : justSaved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {isSaving ? 'Salvando...' : justSaved ? 'Salvo!' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
};

export default SettingsManager;