"use client";

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Download, MessageSquare, Trash2, Coins, AlertTriangle, RefreshCw, Undo2, User, ShieldCheck, Loader2 } from 'lucide-react';
import { Footer } from '@/components/Footer';
import PlayerAvatar from '@/components/PlayerAvatar';
import { CreditRequest, CreditRequestMessage } from '@/types/match';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-600' },
  approved: { label: 'Aprovada', color: 'bg-success/10 text-success' },
  rejected: { label: 'Rejeitada/Bloqueada', color: 'bg-destructive/10 text-destructive' },
};

const CreditRequestsAdmin = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { allCreditRequests, resolveCreditRequest, deleteCreditRequest, unblockCreditRequest, fetchRequestMessages, isLoading } = useGame();
  
  const [selectedRequest, setSelectedRequest] = useState<CreditRequest | null>(null);
  const [conversationRequest, setConversationRequest] = useState<CreditRequest | null>(null);
  const [messages, setMessages] = useState<CreditRequestMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  
  const [creditsToGrant, setCreditsToGrant] = useState(0);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'delete' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const handleDownloadReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from('receipts').download(path);
    if (error) { toast.error('Erro ao baixar comprovante.'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprovante-${path.split('/').pop()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const pendingRequests = allCreditRequests.filter(r => r.status === 'pending');
  const resolvedRequests = allCreditRequests.filter(r => r.status !== 'pending');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="gradient-hero py-6 px-4">
        <div className="container max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-primary-foreground">Gerenciar Créditos</h1>
          </div>
          <Button variant="ghost" size="sm" className="text-primary-foreground" onClick={handleRefresh} disabled={isRefreshing || isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto py-8 px-4 flex-grow">
        <Tabs defaultValue="pending">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              Pendentes 
              {pendingRequests.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="resolved" className="flex items-center gap-2">
              Resolvidas
              {resolvedRequests.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">
                  {resolvedRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <div className="card-container overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jogador</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead className="text-center">Comprovante</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map(req => (
                    <TableRow key={req.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <PlayerAvatar url={req.perfis?.avatar_url || null} />
                          <div className="flex flex-col">
                            <span className="font-medium">{req.perfis?.full_name || 'Usuário Desconhecido'}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">ID: ...{req.player_id.slice(-6)}</span>
                            <button 
                                onClick={() => setConversationRequest(req)}
                                className="mt-2 flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-left hover:bg-primary/20 transition-colors w-full max-w-[280px] shadow-sm group"
                              >
                                <MessageSquare className="w-5 h-5 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                                <div className="flex flex-col overflow-hidden">
                                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5 text-center">Abrir Conversa Completa</span>
                                  <span className="text-xs text-foreground font-medium leading-normal line-clamp-2">
                                    {req.resubmission_notes || "Ver histórico de mensagens..."}
                                  </span>
                                </div>
                              </button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{format(new Date(req.requested_at), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
                        <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(req.requested_at), { addSuffix: true, locale: ptBR })}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-primary">{(req.credits_requested || 0)} cr.</div>
                        <div className="text-xs text-muted-foreground">R$ {Number(req.amount_paid || 0).toFixed(2).replace('.', ',')}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="outline" size="sm" onClick={() => handleDownloadReceipt(req.receipt_url)}>
                          <Download className="w-3.5 h-3.5 mr-1" /> Ver
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => handleOpenDialog(req, 'reject')}><X className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-success h-8 w-8" onClick={() => handleOpenDialog(req, 'approve')}><Check className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-muted-foreground h-8 w-8" onClick={() => handleOpenDialog(req, 'delete')}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="resolved">
            <div className="card-container overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jogador</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Créditos</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resolvedRequests.map(req => (
                    <TableRow key={req.id} className="opacity-80">
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <PlayerAvatar url={req.perfis?.avatar_url || null} />
                          <span>{req.perfis?.full_name || 'Removido'}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge className={`${statusConfig[req.status]?.color || 'bg-muted'} border-none`}>{statusConfig[req.status]?.label}</Badge></TableCell>
                      <TableCell><div className="text-sm font-bold">{req.credits_granted || 0} de {req.credits_requested}</div></TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        <button onClick={() => setConversationRequest(req)} className="text-[10px] text-primary/70 hover:text-primary transition-colors text-left font-bold flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Ver conversa...
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {req.status === 'rejected' && <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => unblockCreditRequest(req.id)}><Undo2 className="w-4 h-4" /></Button>}
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => handleOpenDialog(req, 'delete')}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </main>

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
            ) : messages.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">Nenhuma mensagem no histórico.</div>
            ) : (
                <div className="space-y-4">
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
                <div><p className="text-[10px] uppercase font-bold text-muted-foreground">Solicitado</p><p className="text-lg font-bold">{selectedRequest.credits_requested} créditos</p></div>
                <Coins className="w-8 h-8 text-primary/20" />
              </div>
              {actionType === 'approve' && (
                <div className="space-y-2"><Label>Créditos a Liberar</Label><Input type="number" value={creditsToGrant} onChange={e => setCreditsToGrant(+e.target.value || 0)} className="text-lg font-bold" /></div>
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

      <Footer />
    </div>
  );
};

export default CreditRequestsAdmin;