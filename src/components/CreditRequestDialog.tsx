import { useState, useMemo } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { GameSettings } from '@/types/match';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { toast } from 'sonner';
import { Copy, Upload, Loader2, Minus, Plus, CreditCard } from 'lucide-react';
import { QrCodePix } from 'qrcode-pix';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface CreditRequestDialogProps {
  gameSettings: GameSettings | undefined;
  children: React.ReactNode;
}

export const CreditRequestDialog = ({ gameSettings, children }: CreditRequestDialogProps) => {
  const { requestCredits } = useGame();
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [credits, setCredits] = useState<number>(10);

  const amount = credits * (gameSettings?.valor_por_credito || 1);

  // Calcula o valor final e o detalhamento da taxa se a cobrança estiver ativa
  const stripeFeeDetails = useMemo(() => {
    if (!gameSettings?.stripe_pass_fees_to_customer) return null;
    const perc = gameSettings.stripe_fee_percentage || 0;
    const fix = gameSettings.stripe_fee_fixed || 0;
    const final = (amount + fix) / (1 - (perc / 100));
    const finalRounded = Math.ceil(final * 100) / 100;
    const fee = finalRounded - amount;
    return { final: finalRounded, fee };
  }, [amount, gameSettings]);

  const finalStripeAmount = stripeFeeDetails ? stripeFeeDetails.final : amount;

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

  const handleStripePayment = async () => {
    setIsStripeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-session', {
        body: { 
          amount, 
          type: 'credits',
          metadata: { credits_requested: credits }
        }
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      toast.error("Erro ao iniciar pagamento: " + e.message);
    } finally {
      setIsStripeLoading(false);
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
            {gameSettings?.credit_request_text || 'Escolha a quantidade de créditos e a forma de pagamento.'}
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
            </div>

            {gameSettings.stripe_enabled && (
              <div className="space-y-2">
                <Button 
                  className="w-full h-14 bg-primary text-white shadow-button font-bold text-lg" 
                  onClick={handleStripePayment}
                  disabled={isStripeLoading}
                >
                  {isStripeLoading ? <Loader2 className="w-6 h-6 mr-2 animate-spin" /> : <CreditCard className="w-6 h-6 mr-2" />}
                  PAGAR R$ {finalStripeAmount.toFixed(2).replace('.', ',')} NO CARTÃO
                </Button>
                {stripeFeeDetails && (
                  <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded border border-border/50 flex justify-between items-center px-4">
                    <span>Créditos: <strong>R$ {amount.toFixed(2).replace('.', ',')}</strong></span>
                    <span>+ Taxa Cartão: <strong>R$ {stripeFeeDetails.fee.toFixed(2).replace('.', ',')}</strong></span>
                  </div>
                )}
              </div>
            )}

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Ou PIX Manual (Sem taxas extras)</span></div>
            </div>

            <div className="space-y-4">
                <p className="text-xl font-heading font-black text-primary">Total: R$ {amount.toFixed(2).replace('.', ',')}</p>
                
                {pixPayload && (
                <div className="p-4 bg-white rounded-lg inline-block border">
                    <QRCode value={pixPayload} size={140} />
                </div>
                )}
                
                <div className="relative">
                <Input value={pixPayload ? "Clique para copiar chave PIX" : "Erro ao gerar PIX"} readOnly className="pr-10 text-center cursor-pointer text-xs" onClick={handleCopyToClipboard} />
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

                <div className="space-y-2 text-left pt-2">
                    <Label htmlFor="receipt" className="text-xs font-bold">Já pagou o PIX manual? Anexe aqui:</Label>
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
                    Enviar Comprovante p/ Admin
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