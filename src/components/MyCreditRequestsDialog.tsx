import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from './ui/scroll-area';

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
          <DialogTitle className="font-heading">Minhas Solicitações de Crédito</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-4">
            {creditRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Você ainda não fez nenhuma solicitação.</p>
            ) : (
              creditRequests.map(req => (
                <div key={req.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-semibold">
                      {req.credits_requested ? `${req.credits_requested} créditos` : `Solicitação`}
                    </p>
                    <p className="text-xs text-muted-foreground" title={format(new Date(req.requested_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}>
                      {formatDistanceToNow(new Date(req.requested_at), { addSuffix: true, locale: ptBR })}
                    </p>
                    {req.status === 'approved' && req.credits_granted && (
                      <p className="text-sm text-success font-medium mt-1">+{req.credits_granted} créditos recebidos</p>
                    )}
                     {req.status === 'rejected' && (
                      <p className="text-sm text-destructive mt-1">Rejeitada</p>
                    )}
                  </div>
                  <Badge className={statusConfig[req.status].color}>{statusConfig[req.status].label}</Badge>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Fechar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};