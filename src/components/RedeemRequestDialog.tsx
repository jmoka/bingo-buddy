import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Minus, Plus, Banknote } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface RedeemRequestDialogProps {
  children: React.ReactNode;
}

export const RedeemRequestDialog = ({ children }: RedeemRequestDialogProps) => {
  const { requestRedeem, gameSettings } = useGame();
  const { profile } = useAuth();
  const [credits, setCredits] = useState(50);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const amount = credits * (gameSettings?.valor_por_credito || 1);
  const remainingCredits = (profile?.credits || 0) - credits;

  const handleSubmit = async () => {
    if (credits <= 0) {
      toast.error('Informe uma quantidade válida de créditos.');
      return;
    }
    if (remainingCredits < 0) {
        toast.error('Saldo insuficiente!');
        return;
    }

    setIsLoading(true);
    try {
      const success = await requestRedeem(credits, amount, message);
      if (success) {
        toast.success('Solicitação de resgate enviada!', {
          description: `R$ ${amount.toFixed(2)} serão transferidos após a aprovação do administrador.`,
        });
        setMessage('');
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
          <DialogTitle className="font-heading flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            Resgatar Créditos
          </DialogTitle>
          <DialogDescription>
            Converta seus créditos em dinheiro. O valor será enviado para sua conta cadastrada.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          <div className="p-4 bg-muted rounded-xl space-y-4 text-center">
            <Label>Quantidade para Resgate</Label>
            <div className="flex items-center justify-center gap-3">
              <Button size="icon" variant="outline" onClick={() => setCredits(c => Math.max(10, c - 10))}>
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                className="w-28 text-center text-xl font-bold bg-background"
                value={credits}
                onChange={(e) => setCredits(parseInt(e.target.value, 10) || 0)}
              />
              <Button size="icon" variant="outline" onClick={() => setCredits(c => c + 10)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="flex flex-col p-2 bg-primary/5 rounded-lg border border-primary/10">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Você Recebe</span>
                    <span className="text-lg font-bold text-primary font-heading">R$ {amount.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex flex-col p-2 bg-muted rounded-lg border border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Saldo Restante</span>
                    <span className={`text-lg font-bold font-heading ${remainingCredits < 0 ? 'text-destructive' : 'text-foreground'}`}>
                        {remainingCredits} cr.
                    </span>
                </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="redeem-msg">Mensagem / Chave PIX (Opcional)</Label>
            <Textarea
              id="redeem-msg"
              placeholder="Ex: Minha chave PIX é o meu CPF..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
            <p className="text-[10px] text-muted-foreground italic">
                * Seus créditos serão subtraídos do saldo imediatamente ao solicitar.
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={isLoading || remainingCredits < 0 || credits <= 0} className="gradient-primary">
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Banknote className="w-4 h-4 mr-2" />}
            Solicitar Resgate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};