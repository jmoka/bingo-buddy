import { useState, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, Settings, Check, Loader2, Bot, Link as LinkIcon, DollarSign, Banknote } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  });
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
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
      });
    }
  }, [gameSettings]);

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
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
          <h3 className="font-heading font-bold text-primary border-b pb-2">PIX e Créditos</h3>
          <div><Label>Chave PIX (Admin)</Label><Input name="pix_key" value={currentSettings.pix_key} onChange={handleSettingsChange} /></div>
          <div><Label>Texto de Instrução</Label><Textarea name="credit_request_text" value={currentSettings.credit_request_text} onChange={handleSettingsChange} rows={3} /></div>
        </div>

        <div className="space-y-6">
          <h3 className="font-heading font-bold text-primary border-b pb-2 flex items-center gap-2"><Bot className="w-4 h-4" /> Automação</h3>
          <div>
            <Label>Intervalo Sorteio Auto (segundos)</Label>
            <Input name="intervalo_sorteio_auto_seg" type="number" value={currentSettings.intervalo_sorteio_auto_seg} onChange={handleSettingsChange} />
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