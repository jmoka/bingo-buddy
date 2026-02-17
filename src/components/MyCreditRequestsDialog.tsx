import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from './ui/scroll-area';
import { Coins, Calendar, Info, CheckCircle2, AlertCircle } from 'lucide-react';

interface MyCreditRequestsDialogProps {
  children: React.ReactNode;
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-600', icon: Info },
  approved: { label: 'Aprovada', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejected: { label: 'Rejeitada', color: 'bg-destructive/10 text-destructive', icon: AlertCircle },
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
              creditRequests.map(req => {
                const config = statusConfig[req.status];
                const StatusIcon = config.icon;

                return (
                  <div key={req.id} className="p-4 rounded-xl bg-muted/50 border border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{format(new Date(req.requested_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
                      </div>
                      <Badge className={config.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Pedido</p>
                        <div className="flex items-center gap-1.5">
                          <Coins className="w-4 h-4 text-muted-foreground" />
                          <span className="font-bold">{req.credits_requested} cr.</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          R$ {req.amount_paid?.toFixed(2).replace('.', ',')}
                        </p>
                      </div>

                      {req.status === 'approved' && (
                        <div className="space-y-1 border-l pl-4 border-success/20">
                          <p className="text-[10px] uppercase font-bold text-success tracking-wider">Aprovado</p>
                          <div className="flex items-center gap-1.5">
                            <Coins className="w-4 h-4 text-success" />
                            <span className="font-bold text-success">{req.credits_granted} cr.</span>
                          </div>
                          <p className="text-xs text-success/70">Créditos liberados</p>
                        </div>
                      )}
                    </div>
                    
                    {req.notes && req.status === 'rejected' && (
                      <div className="mt-2 p-2 rounded bg-destructive/5 text-xs text-destructive flex gap-2">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span><strong>Motivo:</strong> {req.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })
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