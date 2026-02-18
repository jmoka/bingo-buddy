import { useState, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, Settings, Check, Loader2 } from 'lucide-react';

const SettingsManager = () => {
  const { gameSettings, updateGameSettings } = useGame();
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

  return (
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
  );
};

export default SettingsManager;