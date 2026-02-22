import { useState, useEffect, useMemo } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, Settings, Check, Loader2, Bot, Link as LinkIcon, DollarSign, Banknote, Play, CalendarDays, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfDay } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";

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
    credit_request_text: '',
    auto_engine_enabled: false,
    auto_engine_interval_mins: 60,
    auto_engine_matches_per_day: 24,
    auto_engine_game_type: 'full' as any,
    auto_engine_card_price: 10,
    auto_engine_prize_type: 'percentage' as any,
    auto_engine_prize_value: 80,
    auto_engine_start_hour: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [isTestingEngine, setIsTestingEngine] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
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
        credit_request_text: gameSettings.credit_request_text || '',
        auto_engine_enabled: gameSettings.auto_engine_enabled || false,
        auto_engine_interval_mins: gameSettings.auto_engine_interval_mins || 60,
        auto_engine_matches_per_day: gameSettings.auto_engine_matches_per_day || 24,
        auto_engine_game_type: gameSettings.auto_engine_game_type || 'full',
        auto_engine_card_price: gameSettings.auto_engine_card_price || 10,
        auto_engine_prize_type: gameSettings.auto_engine_prize_type || 'percentage',
        auto_engine_prize_value: gameSettings.auto_engine_prize_value || 80,
        auto_engine_start_hour: gameSettings.auto_engine_start_hour || 0,
      });
    }
  }, [gameSettings]);

  const schedulePreview = useMemo(() => {
    const times = [];
    let checkTime = startOfDay(new Date()).getTime() + (Number(currentSettings.auto_engine_start_hour) * 3600000);
    const limit = checkTime + (24 * 3600000);
    const interval = Number(currentSettings.auto_engine_interval_mins) * 60000;

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
    
    // Salva imediatamente a alteração do switch para evitar confusão
    setIsSaving(true);
    const success = await updateGameSettings({ 
        ...currentSettings, 
        [name]: checked,
        // Garante que os números sejam números ao salvar via switch também
        auto_engine_interval_mins: Number(currentSettings.auto_engine_interval_mins),
        auto_engine_matches_per_day: Number(currentSettings.auto_engine_matches_per_day),
        auto_engine_card_price: Number(currentSettings.auto_engine_card_price),
        auto_engine_prize_value: Number(currentSettings.auto_engine_prize_value),
        auto_engine_start_hour: Number(currentSettings.auto_engine_start_hour),
    });
    setIsSaving(false);

    if (success && name === 'auto_engine_enabled' && checked) {
        toast.info("Motor ativado! Gerando a agenda de partidas do dia...");
        try {
            const { data } = await supabase.functions.invoke('auto-match-engine');
            if (data?.createdCount > 0) {
                toast.success(`${data.createdCount} partidas foram agendadas!`);
            } else {
                toast.info("A agenda de hoje já está completa.");
            }
        } catch (e) {}
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setCurrentSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const success = await updateGameSettings({
      ...currentSettings,
      custo_nova_cartela: parseInt(currentSettings.custo_nova_cartela as any, 10),
      custo_recarga_cartela: parseInt(currentSettings.custo_recarga_cartela as any, 10),
      usos_por_recarga: parseInt(currentSettings.usos_por_recarga as any, 10),
      intervalo_sorteio_auto_seg: parseInt(currentSettings.intervalo_sorteio_auto_seg as any, 10),
      valor_por_credito: parseFloat(currentSettings.valor_por_credito as any),
      auto_engine_interval_mins: parseInt(currentSettings.auto_engine_interval_mins as any, 10),
      auto_engine_matches_per_day: parseInt(currentSettings.auto_engine_matches_per_day as any, 10),
      auto_engine_card_price: parseInt(currentSettings.auto_engine_card_price as any, 10),
      auto_engine_prize_value: parseInt(currentSettings.auto_engine_prize_value as any, 10),
      auto_engine_start_hour: parseInt(currentSettings.auto_engine_start_hour as any, 10),
    });
    
    setIsSaving(false);
    if (success) {
        setJustSaved(true);
        toast.success("Configurações salvas com sucesso!");
        setTimeout(() => {
          setJustSaved(false);
        }, 2000);
    }
  };

  const handleTestEngine = async () => {
    setIsTestingEngine(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-match-engine');
      if (error) throw error;
      if (data.createdCount > 0) {
        toast.success('Motor executado!', { description: `${data.createdCount} partidas agendadas.` });
      } else {
        toast.info('Motor executado, mas nenhuma partida nova foi criada.', { description: 'A agenda já está completa para hoje.' });
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

  const adminProfitInReais = (gameSettings?.admin_profit || 0) * (gameSettings?.valor_por_credito || 1);

  return (
    <div className="card-container">
      <h2 className="font-heading text-xl font-bold text-foreground mb-6 flex items-center gap-2"><Settings className="w-5 h-5" /> Ajustes do Sistema</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-10">
        <div className="space-y-6">
          <h3 className="font-heading font-bold text-primary border-b pb-2">Economia</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Nova Cartela (cr)</Label><Input name="custo_nova_cartela" type="number" value={currentSettings.custo_nova_cartela} onChange={handleSettingsChange} /></div>
            <div><Label>Recarga (cr)</Label><Input name="custo_recarga_cartela" type="number" value={currentSettings.custo_recarga_cartela} onChange={handleSettingsChange} /></div>
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
              placeholder="Ex: 20"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Tempo de espera entre cada bola sorteada no modo automático.</p>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="font-heading font-bold text-primary border-b pb-2">PIX e Créditos</h3>
          <div><Label>Chave PIX (Admin)</Label><Input name="pix_key" value={currentSettings.pix_key} onChange={handleSettingsChange} /></div>
          <div><Label>Texto de Instrução</Label><Textarea name="credit_request_text" value={currentSettings.credit_request_text} onChange={handleSettingsChange} rows={3} /></div>
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
                <Input name="auto_engine_interval_mins" type="number" value={currentSettings.auto_engine_interval_mins} onChange={handleSettingsChange} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Partidas por Dia (Máx)</Label>
                <Input name="auto_engine_matches_per_day" type="number" value={currentSettings.auto_engine_matches_per_day} onChange={handleSettingsChange} />
              </div>
              <div>
                <Label>Preço da Cartela (cr)</Label>
                <Input name="auto_engine_card_price" type="number" value={currentSettings.auto_engine_card_price} onChange={handleSettingsChange} />
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
                <p className="text-[9px] text-muted-foreground mt-2 italic">* As partidas serão criadas nestes horários cravados.</p>
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
                {gameSettings?.admin_profit || 0} créditos
              </p>
              <p className="text-sm font-medium text-muted-foreground">
                (R$ {adminProfitInReais.toFixed(2).replace('.', ',')})
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
                  <DialogDescription>
                    Insira a quantidade de créditos que deseja retirar. Este valor será subtraído do lucro total acumulado.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Lucro disponível</p>
                    <p className="text-lg font-bold">{gameSettings?.admin_profit || 0} créditos</p>
                  </div>
                  <div>
                    <Label htmlFor="withdraw-amount">Créditos a Retirar</Label>
                    <Input
                      id="withdraw-amount"
                      type="number"
                      value={withdrawAmount || ''}
                      onChange={(e) => setWithdrawAmount(parseInt(e.target.value, 10) || 0)}
                      max={gameSettings?.admin_profit || 0}
                      placeholder="Ex: 100"
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
              Salvar Alterações
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default SettingsManager;