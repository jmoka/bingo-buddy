import { useState, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from './ui/scroll-area';
import { Coins, Calendar, Info, CheckCircle2, AlertCircle, Clock, Banknote, RefreshCw, ExternalLink, MessageSquare, ShieldCheck, User, Loader2 } from 'lucide-react';
import { RedeemRequest, RedeemRequestMessage } from '@/types/match';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RedeemResubmissionDialog } from './RedeemResubmissionDialog';

interface MyRedeemRequestsDialogProps {
  children: React.ReactNode;
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-600', icon: Clock },
  approved: { label: 'Concluído', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejected: { label: 'Problema', color: 'bg-destructive/10 text-destructive', icon: AlertCircle },
};

export const MyRedeemRequestsDialog = ({ children }: MyRedeemRequestsDialogProps) => {
  const { profile } = useAuth();
  const { redeemRequests = [], fetchRedeemMessages } = useGame();

  const [conversationRequest, setConversationRequest] = useState<RedeemRequest | null>(null);
  const [messages, setMessages] = useState<RedeemRequestMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const safeRequests = Array.isArray(redeemRequests) ? redeemRequests : [];
  const pending = safeRequests.filter(r => r.status === 'pending');
  const approved = safeRequests.filter(r => r.status === 'approved');
  const rejected = safeRequests.filter(r => r.status === 'rejected');

  useEffect(() => {
    if (conversationRequest) {
      loadMessages(conversationRequest.id);
    } else {
      setMessages([]);
    }
  }, [conversationRequest]);

  const loadMessages = async (requestId: string) => {
    setIsLoadingMessages(true);
    const data = await fetchRedeemMessages(requestId);
    setMessages(data);
    setIsLoadingMessages(false);
  };

  const handleDownloadReceipt = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (e) {
      toast.error('Erro ao abrir o comprovante.');
    }
  };

  const renderList = (requests: RedeemRequest[]) => {
    if (!requests || requests.length === 0) {
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
                    <ExternalLink className="w-4 h-4 mr-2" /> Ver Comprovante de Transferência
                </Button>
              )}

              <button 
                onClick={() => setConversationRequest(req)}
                className="mt-2 flex items-start gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20 text-left hover:bg-primary/20 transition-colors w-full shadow-sm group"
              >
                <MessageSquare className="w-4 h-4 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Acessar Chat da Solicitação</span>
                  <span className="text-xs text-foreground font-medium leading-normal line-clamp-2">
                    Clique para ver a chave PIX enviada ou os avisos do Admin.
                  </span>
                </div>
              </button>

              {req.status === 'rejected' && (
                <div className="mt-3 border-t pt-3">
                  <RedeemResubmissionDialog request={req}>
                    <Button variant="outline" size="sm" className="w-full">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Responder Admin / Pedir Revisão
                    </Button>
                  </RedeemResubmissionDialog>
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

        {/* DIALOG NESTED PARA O CHAT */}
        <Dialog open={!!conversationRequest} onOpenChange={(open) => !open && setConversationRequest(null)}>
          <DialogContent className="max-w-md h-[70vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2 border-b">
              <DialogTitle className="flex items-center gap-2 font-heading">
                <MessageSquare className="w-5 h-5 text-primary" /> Chat de Pagamento
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="flex-grow p-4">
              {isLoadingMessages ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                  <div className="space-y-4">
                      {messages.map(msg => {
                          const isMe = msg.sender_id === profile?.id;
                          return (
                              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}>
                                  <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest ${isMe ? 'text-primary ml-2' : 'text-muted-foreground mr-2'}`}>
                                      {isMe ? <User className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3 text-success" />}
                                      {isMe ? 'Você' : 'Admin'} • {format(new Date(msg.created_at), "HH:mm")}
                                  </div>
                                  <div className={`p-3 rounded-2xl shadow-sm max-w-[85%] text-sm border ${
                                      isMe ? 'bg-primary/10 border-primary/20 rounded-tr-none' : 'bg-muted border-border rounded-tl-none'
                                  }`}>
                                      {msg.message}
                                  </div>
                              </div>
                          );
                      })}
                      {messages.length === 0 && (
                          <p className="text-center text-muted-foreground text-sm py-10">Nenhuma mensagem neste histórico.</p>
                      )}
                  </div>
              )}
            </ScrollArea>

            <DialogFooter className="p-4 border-t bg-muted/20">
              <Button variant="outline" className="w-full" onClick={() => setConversationRequest(null)}>Voltar para Solicitações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DialogFooter className="p-4 border-t bg-card">
          <DialogClose asChild><Button variant="outline" className="w-full sm:w-auto">Fechar Histórico</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};