import { useState, useMemo } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { GameSettings } from '@/contexts/GameContext';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { toast } from 'sonner';
import { Copy, Upload, Loader2, Minus, Plus } from 'lucide-react';
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
  const [credits, setCredits] = useState(10);

  // Memoize a transação para evitar que o QR Code mude a cada renderização
  // Ele só vai mudar se a quantidade de créditos ou o ID do perfil mudar
  const amount = credits * (gameSettings?.valor_por_credito || 1);

  const pixPayload = useMemo(() => {
    if (!gameSettings?.pix_key || !profile) return '';

    // Criamos um ID de transação estável que muda apenas quando o diálogo é aberto
    const stableId = `BINGO${profile.id.substring(0, 8)}`.slice(0, 25);

    try {
      return QrCodePix({
        version: '01',
        key: gameSettings.pix_key,
        name: 'Bingo App',
        city: 'WEB',
        transactionId: stableId,
        message: `Créditos para o Bingo`,
        value: parseFloat(amount.toFixed(2)),
      }).payload();
    } catch (e) {
      console.error("Erro ao gerar PIX:", e);
      return '';
    }
  }, [gameSettings?.pix_key, profile, amount]);

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Solicitar Créditos</DialogTitle>
        </DialogHeader>
        {gameSettings?.pix_key ? (
          <div className="space-y-4 pt-4 text-center">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {gameSettings.credit_request_text || 'Escolha a quantidade de créditos, faça o PIX e anexe o comprovante.'}
            </p>
            
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <Label htmlFor="credits-input">Quantidade de Créditos</Label>
              <div className="flex items-center justify-center gap-2">
                <Button size="icon" variant="outline" onClick={() => setCredits(c => Math.max(1, c - 10))}>
                  <Minus className="w-4 h-4" />
                </Button>
                <Input
                  id="credits-input"
                  type="number"
                  className="w-24 text-center text-lg font-bold"
                  value={credits}
                  onChange={(e) => setCredits(parseInt(e.target.value, 10) || 1)}
                />
                <Button size="icon" variant="outline" onClick={() => setCredits(c => c + 10)}>
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
            <div>
              <Label htmlFor="receipt" className="sr-only">Comprovante</Label>
              <Input
                id="receipt"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="text-muted-foreground">O sistema de solicitação de créditos não está configurado no momento.</p>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Fechar</Button></DialogClose>
          {gameSettings?.pix_key && (
            <Button onClick={handleSubmit} disabled={!file || isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Enviar Comprovante
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};