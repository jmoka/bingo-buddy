import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { GameSettings } from '@/contexts/GameContext';
import QRCode from 'qrcode.react';
import { toast } from 'sonner';
import { Copy, Upload, Loader2 } from 'lucide-react';

interface CreditRequestDialogProps {
  gameSettings: GameSettings | undefined;
  children: React.ReactNode;
}

export const CreditRequestDialog = ({ gameSettings, children }: CreditRequestDialogProps) => {
  const { requestCredits } = useGame();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleCopyToClipboard = () => {
    if (gameSettings?.pix_key) {
      navigator.clipboard.writeText(gameSettings.pix_key);
      toast.success('Chave PIX copiada!');
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Por favor, anexe o comprovante de pagamento.');
      return;
    }
    setIsLoading(true);
    try {
      const success = await requestCredits(file);
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
              {gameSettings.credit_request_text || 'Faça um PIX para a chave abaixo e anexe o comprovante para receber seus créditos.'}
            </p>
            <div className="p-4 bg-muted rounded-lg inline-block">
              <QRCode value={gameSettings.pix_key} size={160} />
            </div>
            <div className="relative">
              <Input value={gameSettings.pix_key} readOnly className="pr-10 text-center font-mono" />
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={handleCopyToClipboard}
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