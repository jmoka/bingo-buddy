import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from './ui/scroll-area';
import { Coins, Calendar, Info, CheckCircle2, AlertCircle, Clock, Banknote, Download } from 'lucide-react';
import { RedeemRequest } from '@/types/match';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MyRedeemRequestsDialogProps {
  children: React.ReactNode;
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-600', icon: Clock },
  approved: { label: 'Concluído', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejected: { label: 'Problema', color: 'bg-destructive/10 text-destructive', icon: AlertCircle },
};

export const MyRedeemRequestsDialog = ({ children }: MyRedeemRequestsDialogProps) => {
  const { redeemRequests = [] } = useGame(); // Fallback para array vazio

  const safeRequests = Array.isArray(redeemRequests) ? redeemRequests : [];
  const pending = safeRequests.filter(r => r.status === 'pending');
  const approved = safeRequests.filter(r => r.status === 'approved');
  const rejected = safeRequests.filter(r => r.status === 'rejected');

  const handleDownloadReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from('receipts').download(path);
    if (error) { toast.error('Erro ao baixar comprovante.'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprovante-resgate.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const renderList = (requests: RedeemRequest[]) => {
    if (requests.length === 0) {
      return (
        <div className="text-center py-12">
          <Info className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
          <p className="text-muted-foreground">Nenhum resgate encontrado.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 py-2">
        {requests.map(req => {
          const config = statusConfig[req.status] || statusConfig.pending;
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
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Resgatado</p>
                      <p className="text-lg font-bold font-heading">{req.credits_requested} créditos</p>
                  </div>
                  <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-primary tracking-wider">A Receber</p>
                      <p className="text-lg font-bold text-primary font-heading">R$ {Number(req.amount_to_receive).toFixed(2).replace('.', ',')}</p>
                  </div>
              </div>
              
              {req.receipt_url && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => handleDownloadReceipt(req.receipt_url!)}>
                    <Download className="w-4 h-4 mr-2" /> Baixar Comprovante de Transferência
                </Button>
              )}

              {req.notes && (
                <div className={`p-3 rounded-lg text-xs flex gap-2 border ${req.status === 'rejected' ? 'bg-destructive/5 text-destructive border-destructive/10' : 'bg-success/5 text-success border-success/10'}`}>
                  <Info className="w-4 h-4 shrink-0" />
                  <span><strong>Nota do Admin:</strong> {req.notes}</span>
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
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            <Banknote className="w-6 h-6 text-primary" />
            Meus Resgates
          </DialogTitle>
          <DialogDescription>Acompanhe o pagamento dos seus créditos resgatados.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pending" className="flex-grow flex flex-col overflow-hidden">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                Em Análise
                {pending.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                    {pending.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="flex items-center gap-2">
                Pagos
                {approved.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">
                    {approved.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="rejected" className="flex items-center gap-2">
                Problemas
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
                {renderList(pending)}
              </TabsContent>
              <TabsContent value="approved" className="mt-0 focus-visible:ring-0">
                {renderList(approved)}
              </TabsContent>
              <TabsContent value="rejected" className="mt-0 focus-visible:ring-0">
                {renderList(rejected)}
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>

        <DialogFooter className="p-4 border-t bg-card">
          <DialogClose asChild><Button variant="outline" className="w-full sm:w-auto">Fechar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};