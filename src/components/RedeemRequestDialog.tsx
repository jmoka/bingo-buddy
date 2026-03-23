import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Minus, Plus, Banknote, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface RedeemRequestDialogProps {
  children: React.ReactNode;
}

export const RedeemRequestDialog = ({ children }: RedeemRequestDialogProps) => {
  const { requestRedeem, gameSettings } = useGame();
  const { profile } = useAuth();
  const [credits, setCredits] = useState<number>(10);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const currentBalance = profile?.credits || 0;
  const amount = credits * (gameSettings?.valor_por_credito || 1);
  const remainingCredits = currentBalance - credits;

  const handleSubmit = async () => {
    if (credits <= 0) {
      toast.error('Informe uma quantidade válida de créditos.');
      return;
    }
    if (remainingCredits < 0) {
        toast.error('Saldo insuficiente para este resgate!');
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
          {/* Card de Saldo Atual */}
          <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none">Saldo Disponível</p>
                <p className="text-lg font-black font-heading text-foreground">{currentBalance.toFixed(2)} cr.</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-background text-[10px] font-bold">CARTEIRA</Badge>
          </div>

          <div className="p-4 bg-muted/50 rounded-xl space-y-4 text-center border border-border/50">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Quantidade para Resgate</Label>
            <div className="flex items-center justify-center gap-3">
              <Button size="icon" variant="outline" className="h-10 w-10 rounded-full" onClick={() => setCredits(c => Math.max(0.01, Number((c - 10).toFixed(2))))}>
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                step="0.01"
                className="w-32 text-center text-2xl font-black bg-background h-12 border-2 focus-visible:ring-primary"
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value) || 0)}
              />
              <Button size="icon" variant="outline" className="h-10 w-10 rounded-full" onClick={() => setCredits(c => Number((c + 10).toFixed(2)))}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="flex flex-col p-3 bg-success/5 rounded-lg border border-success/20">
                    <span className="text-[9px] uppercase font-bold text-success/70 mb-1">Você Recebe</span>
                    <span className="text-lg font-black text-success font-heading">R$ {amount.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className={cn(
                  "flex flex-col p-3 rounded-lg border transition-colors",
                  remainingCredits < 0 ? "bg-destructive/5 border-destructive/20" : "bg-muted rounded-lg border-border"
                )}>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground mb-1">Saldo Restante</span>
                    <span className={cn(
                      "text-lg font-black font-heading",
                      remainingCredits < 0 ? 'text-destructive' : 'text-foreground'
                    )}>
                        {remainingCredits.toFixed(2)} cr.
                    </span>
                </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="redeem-msg" className="text-xs font-bold">Mensagem / Chave PIX (Opcional)</Label>
            <Textarea
              id="redeem-msg"
              placeholder="Ex: Minha chave PIX é o meu CPF..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-[10px] text-muted-foreground italic text-center">
                * Seus créditos serão subtraídos do saldo imediatamente ao solicitar.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild><Button variant="ghost" className="font-bold">Cancelar</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={isLoading || remainingCredits < 0 || credits <= 0} className="gradient-primary font-bold h-12 px-8 shadow-button">
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Banknote className="w-4 h-4 mr-2" />}
            Solicitar Resgate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};