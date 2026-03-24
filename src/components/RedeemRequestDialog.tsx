import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
      <DialogContent className="max-w-md w-full h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto !rounded-none sm:!rounded-2xl border-0 sm:border bg-background">
        <DialogHeader className="pt-6 px-6">
          <DialogTitle className="font-heading flex items-center justify-center sm:justify-start gap-2 text-3xl">
            <Banknote className="w-8 h-8 text-primary" />
            Resgatar Créditos
          </DialogTitle>
          <DialogDescription className="text-center sm:text-left text-base mt-2 font-medium">
            Converta seus créditos em dinheiro. O valor será enviado para sua conta.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 px-6 pt-4 pb-8">
          {/* Card de Saldo Atual */}
          <div className="flex items-center justify-between p-5 bg-primary/5 border-2 border-primary/20 rounded-2xl shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs uppercase font-black text-muted-foreground leading-none mb-1">Saldo Disponível</p>
                <p className="text-2xl font-black font-heading text-foreground">{currentBalance.toFixed(2)} cr.</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-background text-[10px] font-black border-2">CARTEIRA</Badge>
          </div>

          <div className="p-6 bg-muted/30 rounded-2xl space-y-6 text-center border-2 border-border shadow-sm">
            <Label className="text-sm font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">Quantidade para Resgate</Label>
            <div className="flex items-center justify-center gap-4">
              <Button size="icon" variant="outline" className="h-14 w-14 rounded-full border-2 shadow-sm" onClick={() => setCredits(c => Math.max(0.01, Number((c - 10).toFixed(2))))}>
                <Minus className="w-6 h-6" />
              </Button>
              <Input
                type="number"
                step="0.01"
                className="w-32 text-center text-3xl font-black bg-white dark:bg-card h-14 border-2 focus-visible:ring-primary shadow-inner"
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value) || 0)}
              />
              <Button size="icon" variant="outline" className="h-14 w-14 rounded-full border-2 shadow-sm" onClick={() => setCredits(c => Number((c + 10).toFixed(2)))}>
                <Plus className="w-6 h-6" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex flex-col p-4 bg-success/10 rounded-xl border-2 border-success/30 shadow-sm">
                    <span className="text-[10px] uppercase font-black tracking-widest text-success/80 mb-2">Você Recebe</span>
                    <span className="text-2xl font-black text-success font-heading">R$ {amount.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className={cn(
                  "flex flex-col p-4 rounded-xl border-2 shadow-sm transition-colors",
                  remainingCredits < 0 ? "bg-destructive/10 border-destructive/30" : "bg-white dark:bg-card border-border"
                )}>
                    <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-2">Saldo Restante</span>
                    <span className={cn(
                      "text-xl font-black font-heading mt-1",
                      remainingCredits < 0 ? 'text-destructive' : 'text-foreground'
                    )}>
                        {remainingCredits.toFixed(2)} cr.
                    </span>
                </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Label htmlFor="redeem-msg" className="text-sm font-black uppercase text-gray-800 dark:text-gray-200">Chave PIX / Mensagem (Obrigatório)</Label>
            <Textarea
              id="redeem-msg"
              placeholder="Digite sua CHAVE PIX aqui para receber o pagamento..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="resize-none text-base p-4 border-2 shadow-inner h-24"
            />
            <p className="text-xs text-muted-foreground font-medium text-center bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                Seus créditos serão subtraídos do saldo imediatamente ao solicitar.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 pt-2 pb-8 sm:pb-6 gap-3 sm:gap-0 mt-auto bg-background">
          <DialogClose asChild><Button variant="outline" className="w-full sm:w-auto h-14 text-lg font-bold border-2">Cancelar</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={isLoading || remainingCredits < 0 || credits <= 0 || !message.trim()} className="w-full gradient-primary font-black h-14 text-lg shadow-button">
            {isLoading ? <Loader2 className="w-6 h-6 mr-2 animate-spin" /> : <Banknote className="w-6 h-6 mr-2" />}
            Solicitar Resgate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};