import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from './ui/scroll-area';
import { Coins, Calendar, Info, CheckCircle2, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { CreditRequest } from '@/types/match';
import { ResubmissionDialog } from './ResubmissionDialog';

interface MyCreditRequestsDialogProps {
  children: React.ReactNode;
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-600', icon: Clock },
  approved: { label: 'Aprovada', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejected: { label: 'Rejeitada', color: 'bg-destructive/10 text-destructive', icon: AlertCircle },
};

export const MyCreditRequestsDialog = ({ children }: MyCreditRequestsDialogProps) => {
  const { creditRequests } = useGame();

  const pending = creditRequests.filter(r => r.status === 'pending');
  const approved = creditRequests.filter(r => r.status === 'approved');
  const rejected = creditRequests.filter(r => r.status === 'rejected');

  const formatCurrency = (value: any) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0,00';
    return num.toFixed(2).replace('.', ',');
  };

  const renderRequestList = (requests: CreditRequest[]) => {
    if (requests.length === 0) {
      return (
        <div className="text-center py-12">
          <Info className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
          <p className="text-muted-foreground">Nenhuma solicitação nesta categoria.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 py-2">
        {requests.map(req => {
          const config = statusConfig[req.status];
          const StatusIcon = config.icon;

          return (
            <div key={req.id} className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{format(new Date(req.requested_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
                </div>
                <Badge className={`${config.color} border-none`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {config.label}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Solicitado</p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-primary" />
                      <span className="text-lg font-bold font-heading">
                        {(Number(req.credits_requested) || 0)} cr.
                      </span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      Valor: R$ {formatCurrency(req.amount_paid)}
                    </span>
                  </div>
                </div>

                {req.status === 'approved' && (
                  <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                    <p className="text-[10px] uppercase font-bold text-success tracking-wider mb-2">Aprovado</p>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <span className="text-lg font-bold text-success font-heading">
                          {(Number(req.credits_granted) || 0)} cr.
                        </span>
                      </div>
                      <span className="text-xs font-medium text-success/70">
                        Liberado pelo Admin
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              {req.notes && req.status === 'rejected' && (
                <div className="mt-2 p-3 rounded-lg bg-destructive/5 text-xs text-destructive flex gap-2 border border-destructive/10">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span><strong>Motivo do Admin:</strong> {req.notes}</span>
                </div>
              )}

              {req.status === 'rejected' && (
                <div className="mt-3 border-t pt-3">
                  <ResubmissionDialog request={req}>
                    <Button variant="outline" size="sm" className="w-full">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Pedir Nova Revisão
                    </Button>
                  </ResubmissionDialog>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            <Coins className="w-6 h-6 text-primary" />
            Histórico de Créditos
          </DialogTitle>
          <DialogDescription>Acompanhe o status de todas as suas solicitações de crédito.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pending" className="flex-grow flex flex-col overflow-hidden">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                Pendentes
                {pending.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                    {pending.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="flex items-center gap-2">
                Aprovadas
                {approved.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">
                    {approved.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="rejected" className="flex items-center gap-2">
                Rejeitadas
                {rejected.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                    {rejected.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-grow overflow-hidden mt-4 bg-muted/30">
            <ScrollArea className="h-full px-6">
              <TabsContent value="pending" className="mt-0 focus-visible:ring-0">
                {renderRequestList(pending)}
              </TabsContent>
              <TabsContent value="approved" className="mt-0 focus-visible:ring-0">
                {renderRequestList(approved)}
              </TabsContent>
              <TabsContent value="rejected" className="mt-0 focus-visible:ring-0">
                {renderRequestList(rejected)}
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>

        <DialogFooter className="p-4 border-t bg-card">
          <DialogClose asChild>
            <Button variant="outline" className="w-full sm:w-auto">Fechar Histórico</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};