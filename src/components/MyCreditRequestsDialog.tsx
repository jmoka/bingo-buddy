import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from './ui/scroll-area';
import { Coins, Calendar, Info } from 'lucide-react';

interface MyCreditRequestsDialogProps {
  children: React.ReactNode;
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-600' },
  approved: { label: 'Aprovada', color: 'bg-success/10 text-success' },
  rejected: { label: 'Rejeitada', color: 'bg-destructive/10 text-destructive' },
};

export const MyCreditRequestsDialog = ({ children }: MyCreditRequestsDialogProps) => {
  const { creditRequests } = useGame();

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Histórico de Créditos</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-4">
            {creditRequests.length === 0 ? (
              <div className="text-center py-12">
                <Info className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                <p className="text-muted-foreground">Você ainda não fez nenhuma solicitação.</p>
              </div>
            ) : (
              creditRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {format(new Date(req.requested_at), "dd 'de' MMMM", { locale: ptBR })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(req.requested_at), "HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-primary" />
                      <p className="font-bold text-lg">
                        {req.credits_requested || req.credits_granted || 0} créditos
                      </p>
                    </div>

                    {req.amount_paid && (
                      <p className="text-xs text-muted-foreground">
                        Valor pago: R$ {req.amount_paid.toFixed(2).replace('.', ',')}
                      </p>
                    )}

                    {req.status === 'approved' && req.credits_granted && req.credits_granted !== req.credits_requested && (
                      <p className="text-xs text-success font-medium">
                        Liberado: {req.credits_granted} créditos
                      </p>
                    )}
                    
                    {req.notes && req.status === 'rejected' && (
                      <p className="text-xs text-destructive italic mt-1">
                        Motivo: {req.notes}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={statusConfig[req.status].color}>
                      {statusConfig[req.status].label}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost" className="w-full sm:w-auto">Fechar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};