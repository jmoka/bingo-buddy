import { useState, useMemo } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { GameSettings } from '@/types/match';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { toast } from 'sonner';
import { Copy, Upload, Loader2, Minus, Plus, Zap } from 'lucide-react';
import { QrCodePix } from 'qrcode-pix';
import { useAuth } from '@/contexts/AuthContext';

interface CreditRequestDialogProps {
  gameSettings: GameSettings | undefined;
  children: React.ReactNode;
}

export const CreditRequestDialog = ({ gameSettings, children }: CreditRequestDialogProps) => {
  const { requestCredits } = useGame();
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [credits, setCredits] = useState<number>(10);

  const amount = credits * (gameSettings?.valor_por_credito || 1);

  const pixPayload = useMemo(() => {
    if (!gameSettings?.pix_key || !profile) return '';

    try {
      const cleanKey = gameSettings.pix_key.replace(/\s/g, '');
      const cleanName = (gameSettings.pix_name || 'BINGOSHOW').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '').toUpperCase();
      const cleanCity = (gameSettings.pix_city || 'SAOPAULO').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '').toUpperCase();

      return QrCodePix({
        version: '01',
        key: cleanKey,
        name: cleanName,
        city: cleanCity,
        value: parseFloat(amount.toFixed(2)),
      }).payload();
    } catch (e) {
      console.error("Erro ao gerar PIX:", e);
      return '';
    }
  }, [gameSettings, profile, amount]);

  const handleCopyToClipboard = () => {
    if (pixPayload) {
      navigator.clipboard.writeText(pixPayload);
      toast.success('PIX Copia e Cola copiado!');
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Por favor, anexe o comprovante de pagamento.');
      return;
    }
    setIsLoading(true);
    try {
      const success = await requestCredits(file, credits, amount);
      if (success) {
        toast.success('Solicitação enviada!', {
          description: 'O administrador foi notificado. Aguarde a liberação dos seus créditos.',
        });
        setFile(null);
        setIsOpen(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Solicitar Créditos</DialogTitle>
          <DialogDescription>
            {gameSettings?.credit_request_text || 'Escolha a quantidade de créditos, faça o PIX e anexe o comprovante.'}
          </DialogDescription>
        </DialogHeader>
        {gameSettings?.pix_key ? (
          <div className="space-y-4 pt-4 text-center">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <Label htmlFor="credits-input">Quantidade de Créditos</Label>
              <div className="flex items-center justify-center gap-2">
                <Button size="icon" variant="outline" onClick={() => setCredits(c => Math.max(0.01, Number((c - 1).toFixed(2))))}>
                  <Minus className="w-4 h-4" />
                </Button>
                <Input
                  id="credits-input"
                  type="number"
                  step="0.01"
                  className="w-24 text-center text-lg font-bold"
                  value={credits}
                  onChange={(e) => setCredits(Number(e.target.value) || 0)}
                />
                <Button size="icon" variant="outline" onClick={() => setCredits(c => Number((c + 1).toFixed(2)))}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="font-heading text-2xl font-bold text-primary">
                Total: R$ {amount.toFixed(2).replace('.', ',')}
              </div>
            </div>

            {pixPayload && (
              <div className="p-4 bg-white rounded-lg inline-block">
                <QRCode value={pixPayload} size={160} />
              </div>
            )}
            
            <div className="relative">
              <Input value={pixPayload ? "Clique para copiar o PIX" : "Erro ao gerar PIX"} readOnly className="pr-10 text-center cursor-pointer" onClick={handleCopyToClipboard} />
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={handleCopyToClipboard}
                disabled={!pixPayload}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            <div className="border-t pt-4 space-y-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Escolha como prosseguir</p>
              
              <Button 
                className="w-full h-12 bg-primary/20 text-primary/70 shadow-none font-bold" 
                disabled={true}
                title="Integração bancária em desenvolvimento"
              >
                <Zap className="w-5 h-5 mr-2 opacity-50" />
                PAGAMENTO AUTOMÁTICO (EM BREVE)
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Ou manual com comprovante</span></div>
              </div>

              <div className="space-y-2 text-left">
                <Label htmlFor="receipt" className="text-xs">Anexar Comprovante</Label>
                <Input
                  id="receipt"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
                <Button 
                  variant="outline" 
                  className="w-full h-10" 
                  onClick={handleSubmit} 
                  disabled={!file || isLoading}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Enviar para Revisão Admin
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="text-muted-foreground">O sistema de solicitação de créditos não está configurado no momento.</p>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Fechar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};