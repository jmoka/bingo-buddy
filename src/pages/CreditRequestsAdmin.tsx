"use client";

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRifaAdmin } from '@/hooks/useRifaAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Eye, ExternalLink, MessageSquare, Trash2, Coins, RefreshCw, Undo2, User, ShieldCheck, Loader2, CreditCard, Store, HandCoins, AlertTriangle } from 'lucide-react';
import PlayerAvatar from '@/components/PlayerAvatar';
import { CreditRequest, CreditRequestMessage } from '@/types/match';
import { AcertoVendedor } from '@/types/rifa';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';

const statusConfig: Record<string, { label: string, color: string }> = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-600' },
  approved: { label: 'Aprovada', color: 'bg-success/10 text-success' },
  aprovado: { label: 'Aprovada', color: 'bg-success/10 text-success' },
  rejected: { label: 'Rejeitada', color: 'bg-destructive/10 text-destructive' },
  rejeitado: { label: 'Rejeitada', color: 'bg-destructive/10 text-destructive' },
};

const CreditRequestsAdmin = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { allCreditRequests, resolveCreditRequest, deleteCreditRequest, unblockCreditRequest, fetchRequestMessages, isLoading: isGameLoading } = useGame();
  const { acertosPendentes, resolverAcerto, forcarRepasseAcerto, isLoading: isRifaLoading } = useRifaAdmin();
  
  // States - Credit Requests
  const [selectedRequest, setSelectedRequest] = useState<CreditRequest | null>(null);
  const [conversationRequest, setConversationRequest] = useState<CreditRequest | null>(null);
  const [messages, setMessages] = useState<CreditRequestMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [creditsToGrant, setCreditsToGrant] = useState(0);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'delete' | null>(null);
  
  // States - Acertos
  const [acaoAcerto, setAcaoAcerto] = useState<{tipo: 'aprovado' | 'rejeitado', acerto: AcertoVendedor} | null>(null);
  const [isProcessandoAcerto, setIsProcessandoAcerto] = useState(false);

  // States - Forçar Repasse
  const [acertoForcarRepasse, setAcertoForcarRepasse] = useState<AcertoVendedor | null>(null);
  const [isForcandoRepasse, setIsForcandoRepasse] = useState(false);

  // Generics
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);

  const isLoading = isGameLoading || isRifaLoading;

  useEffect(() => {
    if (!profile || profile.role !== 'admin') {
      navigate('/');
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (conversationRequest) {
      loadMessages(conversationRequest.id);
    } else {
      setMessages([]);
    }
  }, [conversationRequest]);

  const loadMessages = async (requestId: string) => {
    setIsLoadingMessages(true);
    const data = await fetchRequestMessages(requestId);
    setMessages(data);
    setIsLoadingMessages(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['rawCreditRequests'] });
    await queryClient.invalidateQueries({ queryKey: ['acertosAdmin'] });
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleOpenDialog = (request: CreditRequest, type: 'approve' | 'reject' | 'delete') => {
    setSelectedRequest(request);
    setActionType(type);
    setCreditsToGrant(request.credits_requested || 0);
    setRejectionNotes(request.notes || '');
    setIsResolveDialogOpen(true);
  };

  const handleResolve = async () => {
    if (!selectedRequest || !actionType) return;
    if (actionType === 'delete') {
      await deleteCreditRequest(selectedRequest.id);
    } else if (actionType === 'approve') {
      await resolveCreditRequest(selectedRequest.id, 'approved', creditsToGrant, rejectionNotes);
    } else {
      await resolveCreditRequest(selectedRequest.id, 'rejected', undefined, rejectionNotes);
    }
    setIsResolveDialogOpen(false);
  };

  const handleResolverAcerto = async () => {
    if (!acaoAcerto) return;
    setIsProcessandoAcerto(true);
    const ok = await resolverAcerto(acaoAcerto.acerto.id, acaoAcerto.tipo);
    setIsProcessandoAcerto(false);
    if (ok) setAcaoAcerto(null);
  };

  const handleForcarRepasse = async () => {
    if (!acertoForcarRepasse) return;
    setIsForcandoRepasse(true);
    await forcarRepasseAcerto(acertoForcarRepasse.id);
    setIsForcandoRepasse(false);
    setAcertoForcarRepasse(null);
  };

  const handleViewReceipt = async (path: string) => {
    if (!path) {
      toast.error('Nenhum comprovante anexado.');
      return;
    }
    if (path === 'AUTOMATIC_PAYMENT' || path.startsWith('STRIPE_')) {
        toast.info('Pagamento processado automaticamente via Cartão (Stripe). Não existe arquivo de imagem.', { duration: 5000 });
        return;
    }
    try {
      const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600);
      if (error) throw error;
      setComprovanteUrl(data.signedUrl);
    } catch (e) {
      toast.error('Erro ao carregar o arquivo do comprovante.');
    }
  };

  const pendingRequests = allCreditRequests.filter(r => r.status === 'pending');
  const resolvedRequests = allCreditRequests.filter(r => r.status !== 'pending');

  const pendingAcertos = acertosPendentes.filter(a => a.status === 'pendente' || a.status === 'em_analise');
  const resolvedAcertos = acertosPendentes.filter(a => a.status === 'aprovado' || a.status === 'rejeitado' || a.status === 'aprovar' || a.status === 'rejeitar');

  const totalPendentes = pendingRequests.length + pendingAcertos.length;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Entradas do Caixa</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing || isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            Pendentes 
            {totalPendentes > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {totalPendentes}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved" className="flex items-center gap-2">
            Resolvidas (Histórico)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <div className="card-container overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem / Jogador</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor PIX</TableHead>
                  <TableHead className="text-center">Comprovante</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 1. MAP DE ACERTOS DE VENDEDORES (Dinheiro direto pro caixa) */}
                {pendingAcertos.map(acerto => (
                  <TableRow key={acerto.id} className="bg-amber-50/50 dark:bg-amber-900/10">
                    <TableCell className="min-w-[250px]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
                          <Store className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-amber-900 dark:text-amber-400">{acerto.vendedores_rifa?.nome || 'Vendedor'}</span>
                          <Badge variant="outline" className="w-fit text-[9px] mt-1 bg-amber-100 text-amber-800 border-amber-300">Acerto de Vendas (Vendedor)</Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm min-w-[150px]">
                      <div className="font-medium">{format(new Date(acerto.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
                      <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(acerto.created_at), { addSuffix: true, locale: ptBR })}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-success text-lg">R$ {Number(acerto.valor).toFixed(2).replace('.', ',')}</div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Direto p/ Caixa Admin</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="outline" size="sm" onClick={() => handleViewReceipt(acerto.comprovante_url)}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> Ver PIX
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="icon" variant="ghost" className="text-destructive h-9 w-9 bg-destructive/10 hover:bg-destructive/20" onClick={() => setAcaoAcerto({ tipo: 'rejeitado', acerto })}><X className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-success h-9 w-9 bg-success/10 hover:bg-success/20" onClick={() => setAcaoAcerto({ tipo: 'aprovado', acerto })}><Check className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {/* 2. MAP DE COMPRA DE CRÉDITOS (Jogadores Comuns) */}
                {pendingRequests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell className="min-w-[250px]">
                      <div className="flex items-center gap-3">
                        <PlayerAvatar url={req.perfis?.avatar_url || null} />
                        <div className="flex flex-col">
                          <span className="font-medium">{req.perfis?.full_name || 'Usuário Desconhecido'}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">ID: ...{req.player_id.slice(-6)}</span>
                          <button 
                              onClick={() => setConversationRequest(req)}
                              className="mt-2 flex items-start gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20 text-left hover:bg-primary/20 transition-colors w-full max-w-[280px] shadow-sm group"
                            >
                              <MessageSquare className="w-4 h-4 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Abrir Conversa</span>
                                <span className="text-xs text-foreground font-medium leading-normal line-clamp-2">
                                  {req.resubmission_notes || "Ver histórico de mensagens..."}
                                </span>
                              </div>
                            </button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm min-w-[150px]">
                      <div className="font-medium">{format(new Date(req.requested_at), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
                      <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(req.requested_at), { addSuffix: true, locale: ptBR })}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-primary text-lg">R$ {Number(req.amount_paid || 0).toFixed(2).replace('.', ',')}</div>
                      <div className="text-xs font-medium text-muted-foreground">Pediu: {(req.credits_requested || 0)} cr.</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="outline" size="sm" onClick={() => handleViewReceipt(req.receipt_url)}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> Ver PIX
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="icon" variant="ghost" className="text-destructive h-9 w-9 bg-destructive/10 hover:bg-destructive/20" onClick={() => handleOpenDialog(req, 'reject')}><X className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-success h-9 w-9 bg-success/10 hover:bg-success/20" onClick={() => handleOpenDialog(req, 'approve')}><Check className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-muted-foreground h-9 w-9 hover:bg-muted" onClick={() => handleOpenDialog(req, 'delete')}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {totalPendentes === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhuma entrada pendente no momento.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="resolved">
          <div className="card-container overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Origem / Jogador</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status / Forma</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 1. MAP DE ACERTOS DE VENDEDORES (RESOLVIDOS) */}
                {resolvedAcertos.map(acerto => {
                  const finalStatus = acerto.status === 'aprovar' ? 'aprovado' : acerto.status === 'rejeitar' ? 'rejeitado' : acerto.status;
                  const config = statusConfig[finalStatus] || { label: finalStatus, color: 'bg-muted text-muted-foreground' };
                  
                  return (
                  <TableRow key={acerto.id} className="opacity-90 bg-amber-50/20 dark:bg-amber-900/5">
                    <TableCell className="text-sm min-w-[120px]">
                      <div className="font-medium">{format(new Date(acerto.resolved_at || acerto.created_at), "dd/MM/yy", { locale: ptBR })}</div>
                      <div className="text-[10px] text-muted-foreground">{format(new Date(acerto.resolved_at || acerto.created_at), "HH:mm", { locale: ptBR })}</div>
                    </TableCell>
                    <TableCell className="min-w-[200px]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <Store className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{acerto.vendedores_rifa?.nome || 'Vendedor'}</span>
                          <span className="text-[10px] text-amber-600 font-medium">Acerto Financeiro</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-success">R$ {Number(acerto.valor).toFixed(2).replace('.', ',')}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1.5">
                        <Badge className={`${config.color} border-none`}>{config.label}</Badge>
                        <Badge variant="outline" className="text-[9px] bg-amber-500/5 text-amber-600 border-amber-500/20">Acerto (PIX)</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {finalStatus === 'aprovado' && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600 hover:bg-amber-100" title="Comissão não repassada? Forçar Repasse" onClick={() => setAcertoForcarRepasse(acerto)}>
                            <AlertTriangle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" title="Ver Comprovante PIX" onClick={() => handleViewReceipt(acerto.comprovante_url)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )})}

                {/* 2. MAP DE COMPRA DE CRÉDITOS (RESOLVIDOS) */}
                {resolvedRequests.map(req => {
                  const isStripe = req.receipt_url?.startsWith('STRIPE_') || req.receipt_url === 'AUTOMATIC_PAYMENT';
                  const config = statusConfig[req.status] || { label: req.status, color: 'bg-muted text-muted-foreground' };

                  return (
                  <TableRow key={req.id} className="opacity-90">
                    <TableCell className="text-sm min-w-[120px]">
                      <div className="font-medium">{format(new Date(req.resolved_at || req.requested_at), "dd/MM/yy", { locale: ptBR })}</div>
                      <div className="text-[10px] text-muted-foreground">{format(new Date(req.resolved_at || req.requested_at), "HH:mm", { locale: ptBR })}</div>
                    </TableCell>
                    <TableCell className="min-w-[200px]">
                      <div className="flex items-center gap-3">
                        <PlayerAvatar url={req.perfis?.avatar_url || null} />
                        <div className="flex flex-col">
                          <span className="font-medium">{req.perfis?.full_name || 'Removido'}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">ID: ...{req.player_id.slice(-6)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-primary">R$ {Number(req.amount_paid || 0).toFixed(2).replace('.', ',')}</div>
                      <div className="text-xs text-muted-foreground">{(req.credits_granted || 0)} cr. liberados</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1.5">
                         <Badge className={`${config.color} border-none`}>{config.label}</Badge>
                         {isStripe ? (
                           <Badge variant="outline" className="text-[9px] bg-primary/5 text-primary border-primary/20"><CreditCard className="w-3 h-3 mr-1"/> Cartão (Stripe)</Badge>
                         ) : (
                           <Badge variant="outline" className="text-[9px] bg-blue-500/5 text-blue-600 border-blue-500/20">Recarga PIX</Badge>
                         )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {isStripe ? (
                           <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground opacity-40 cursor-not-allowed" title="Pagamento Automático (Não possui imagem anexada)">
                             <CreditCard className="w-4 h-4" />
                           </Button>
                        ) : (
                           <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" title="Ver Comprovante PIX" onClick={() => handleViewReceipt(req.receipt_url)}>
                             <Eye className="w-4 h-4" />
                           </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" title="Ver Mensagens / Avisos" onClick={() => setConversationRequest(req)}>
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                        {req.status === 'rejected' && <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" title="Reabrir Solicitação" onClick={() => unblockCreditRequest(req.id)}><Undo2 className="w-4 h-4" /></Button>}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive opacity-70 hover:opacity-100" title="Apagar Registro" onClick={() => handleOpenDialog(req, 'delete')}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOG DE VISUALIZAR COMPROVANTE */}
      <Dialog open={!!comprovanteUrl} onOpenChange={(open) => !open && setComprovanteUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Visualizador de Comprovante</DialogTitle>
            <DialogDescription className="sr-only">Visualize a imagem ou o PDF enviado.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-2 bg-muted/30 rounded-lg min-h-[50vh]">
            {comprovanteUrl && (
              comprovanteUrl.toLowerCase().includes('.pdf') || comprovanteUrl.toLowerCase().includes('.pdf?') ? (
                <iframe src={comprovanteUrl} className="w-full h-[65vh] rounded-md border shadow-sm bg-white" title="Visualizador de PDF" />
              ) : (
                <img src={comprovanteUrl} alt="Comprovante" className="max-w-full max-h-[65vh] object-contain rounded-md shadow-sm" />
              )
            )}
          </div>
          <DialogFooter>
            {comprovanteUrl && (
              <Button asChild variant="outline" className="gap-2">
                <a href={comprovanteUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" /> Abrir Original / Baixar
                </a>
              </Button>
            )}
            <Button variant="default" onClick={() => setComprovanteUrl(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE RESOLVER ACERTOS DE VENDEDOR */}
      <Dialog open={!!acaoAcerto} onOpenChange={open => !open && setAcaoAcerto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {acaoAcerto?.tipo === 'aprovado' ? <HandCoins className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}
              {acaoAcerto?.tipo === 'aprovado' ? 'Confirmar Acerto de Vendas' : 'Rejeitar Acerto'}
            </DialogTitle>
            <DialogDescription className="sr-only">Aprove ou rejeite o PIX do vendedor.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {acaoAcerto?.tipo === 'aprovado' ? (
              <p className="text-sm text-muted-foreground">Você conferiu o PIX e o valor de <strong className="text-success text-lg">R$ {Number(acaoAcerto.acerto.valor).toFixed(2)}</strong> realmente caiu na sua conta?</p>
            ) : (
              <p className="text-sm text-muted-foreground">O comprovante é inválido ou o dinheiro não caiu?</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAcaoAcerto(null)}>Cancelar</Button>
            <Button className={acaoAcerto?.tipo === 'aprovado' ? 'bg-green-600 hover:bg-green-700 text-white' : ''} variant={acaoAcerto?.tipo === 'rejeitado' ? 'destructive' : 'default'} onClick={handleResolverAcerto} disabled={isProcessandoAcerto}>
              {isProcessandoAcerto && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {acaoAcerto?.tipo === 'aprovado' ? 'Sim, o dinheiro caiu!' : 'Rejeitar Acerto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE FORÇAR REPASSE DE ACERTO */}
      <Dialog open={!!acertoForcarRepasse} onOpenChange={open => !open && setAcertoForcarRepasse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-6 h-6" /> Forçar Repasse de Saldos
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
             <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
               <strong>Atenção:</strong> Utilize esta opção apenas se ocorreu uma falha técnica anterior e os saldos (Comissão do Vendedor e Lucro do Caixa) não foram distribuídos ao aprovar este acerto no passado.
             </div>
             <p className="text-sm text-muted-foreground">
               Ao confirmar, o sistema calculará matematicamente a comissão que este vendedor deveria ter recebido na época e repassará a diferença para a sua caixa (Admin).
             </p>
             <p className="text-xs font-bold text-destructive">
               Importante: Se você clicar aqui e os saldos já tiverem sido pagos na primeira vez, os valores serão duplicados indevidamente.
             </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAcertoForcarRepasse(null)}>Cancelar</Button>
            <Button onClick={handleForcarRepasse} disabled={isForcandoRepasse} className="bg-amber-600 hover:bg-amber-700 text-white">
              {isForcandoRepasse && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar e Repassar Saldos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE CHAT COM O JOGADOR (SOLICITACOES DE CREDITO) */}
      <Dialog open={!!conversationRequest} onOpenChange={(open) => !open && setConversationRequest(null)}>
        <DialogContent className="max-w-md h-[70vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 font-heading">
              <MessageSquare className="w-5 h-5 text-primary" /> Histórico da Conversa
            </DialogTitle>
            <DialogDescription>Solicitação de {conversationRequest?.perfis?.full_name}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-grow p-4">
            {isLoadingMessages ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
                <div className="space-y-4">
                    {messages.length === 0 && conversationRequest?.notes && (
                        <div className="flex flex-col items-start space-y-1">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-primary ml-2">
                                <ShieldCheck className="w-3 h-3" /> 
                                Sistema • {format(new Date(conversationRequest.resolved_at || conversationRequest.requested_at), "HH:mm", { locale: ptBR })}
                            </div>
                            <div className="p-3 rounded-2xl shadow-sm max-w-[85%] text-sm leading-relaxed border bg-primary/10 border-primary/20 rounded-tl-none text-foreground font-medium">
                                {conversationRequest.notes}
                            </div>
                        </div>
                    )}

                    {messages.length === 0 && !conversationRequest?.notes && (
                        <div className="text-center py-10 text-muted-foreground">Nenhuma mensagem no histórico.</div>
                    )}

                    {messages.map(msg => {
                        const isMe = msg.sender_id === profile?.id;
                        return (
                            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}>
                                <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest ${isMe ? 'text-muted-foreground mr-2' : 'text-primary ml-2'}`}>
                                    {isMe ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                    {isMe ? 'Admin (Você)' : 'Jogador'} • {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                                </div>
                                <div className={`p-3 rounded-2xl shadow-sm max-w-[85%] text-sm leading-relaxed border ${
                                    isMe 
                                    ? 'bg-muted border-border rounded-tr-none' 
                                    : 'bg-primary/10 border-primary/20 rounded-tl-none text-foreground'
                                }`}>
                                    {msg.message}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-4 border-t bg-muted/20">
            <DialogClose asChild><Button variant="outline" className="w-full">Fechar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE APROVAR/REJEITAR SOLICITACAO DE CREDITO JOGADOR */}
      <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'delete' && <Trash2 className="w-5 h-5 text-destructive" />}
              {actionType === 'approve' && <Check className="w-5 h-5 text-success" />}
              {actionType === 'reject' && <X className="w-5 h-5 text-destructive" />}
              {actionType === 'delete' ? 'Excluir Solicitação' : 'Resolver Solicitação'}
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && actionType !== 'delete' && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                <div><p className="text-[10px] uppercase font-bold text-muted-foreground">O Jogador Pagou (PIX)</p><p className="text-xl font-black text-primary">R$ {Number(selectedRequest.amount_paid || 0).toFixed(2).replace('.', ',')}</p></div>
                <div className="text-right"><p className="text-[10px] uppercase font-bold text-muted-foreground">Créditos Solicitados</p><p className="text-xl font-bold">{selectedRequest.credits_requested} cr.</p></div>
              </div>
              {actionType === 'approve' && (
                <div className="space-y-2"><Label>Créditos a Liberar no Saldo dele</Label><Input type="number" value={creditsToGrant} onChange={e => setCreditsToGrant(+e.target.value || 0)} className="text-lg font-bold" /></div>
              )}
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Mensagem para o Jogador</Label>
                <Textarea placeholder="Explique o motivo do bloqueio ou confirme a liberação..." value={rejectionNotes} onChange={e => setRejectionNotes(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button variant={actionType === 'approve' ? 'default' : 'destructive'} onClick={handleResolve}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreditRequestsAdmin;