"use client";

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Download, MessageSquare, Trash2, Coins, AlertTriangle } from 'lucide-react';
import { Footer } from '@/components/Footer';
import PlayerAvatar from '@/components/PlayerAvatar';
import { CreditRequest } from '@/types/match';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-600' },
  approved: { label: 'Aprovada', color: 'bg-success/10 text-success' },
  rejected: { label: 'Rejeitada/Bloqueada', color: 'bg-destructive/10 text-destructive' },
};

const CreditRequestsAdmin = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { allCreditRequests, resolveCreditRequest, deleteCreditRequest } = useGame();
  
  const [selectedRequest, setSelectedRequest] = useState<CreditRequest | null>(null);
  const [creditsToGrant, setCreditsToGrant] = useState(0);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'delete' | null>(null);

  useEffect(() => {
    if (!profile || profile.role !== 'admin') {
      navigate('/');
    }
  }, [profile, navigate]);

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
    if (error) {
      toast.error('Erro ao baixar comprovante.');
      return;
    }
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
        </div>
      </header>

      <main className="container max-w-6xl mx-auto py-8 px-4 flex-grow">
        <Tabs defaultValue="pending">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
            <TabsTrigger value="pending">Pendentes ({pendingRequests.length})</TabsTrigger>
            <TabsTrigger value="resolved">Resolvidas ({resolvedRequests.length})</TabsTrigger>
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
                            <span className="font-medium">{req.perfis?.full_name || 'Não definido'}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">ID: ...{req.player_id.slice(-6)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{format(new Date(req.requested_at), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
                        <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(req.requested_at), { addSuffix: true, locale: ptBR })}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-primary">{req.credits_requested} cr.</div>
                        <div className="text-xs text-muted-foreground">R$ {Number(req.amount_paid).toFixed(2).replace('.', ',')}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="outline" size="sm" onClick={() => handleDownloadReceipt(req.receipt_url)}>
                          <Download className="w-3.5 h-3.5 mr-1" /> Ver
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" title="Bloquear/Rejeitar" onClick={() => handleOpenDialog(req, 'reject')}>
                            <X className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-success h-8 w-8" title="Aprovar" onClick={() => handleOpenDialog(req, 'approve')}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-muted-foreground h-8 w-8" title="Excluir" onClick={() => handleOpenDialog(req, 'delete')}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pendingRequests.length === 0 && <div className="text-center py-12 text-muted-foreground">Tudo em dia! Nenhuma solicitação pendente.</div>}
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
                    <TableHead>Mensagem/Nota</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resolvedRequests.map(req => (
                    <TableRow key={req.id} className="opacity-80">
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <PlayerAvatar url={req.perfis?.avatar_url || null} />
                          <span>{req.perfis?.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusConfig[req.status].color} border-none`}>{statusConfig[req.status].label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-bold">{req.credits_granted || 0} de {req.credits_requested}</div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs italic text-muted-foreground">
                        {req.notes || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => handleOpenDialog(req, 'delete')}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'delete' && <Trash2 className="w-5 h-5 text-destructive" />}
              {actionType === 'approve' && <Check className="w-5 h-5 text-success" />}
              {actionType === 'reject' && <X className="w-5 h-5 text-destructive" />}
              {actionType === 'delete' ? 'Excluir Solicitação' : 'Resolver Solicitação'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'delete' ? 'Deseja remover esta solicitação permanentemente do histórico?' : 'Preencha as informações para processar o pedido.'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && actionType !== 'delete' && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Solicitado</p>
                  <p className="text-lg font-bold">{selectedRequest.credits_requested} créditos</p>
                </div>
                <Coins className="w-8 h-8 text-primary/20" />
              </div>

              {actionType === 'approve' && (
                <div className="space-y-2">
                  <Label>Créditos a Liberar</Label>
                  <Input type="number" value={creditsToGrant} onChange={e => setCreditsToGrant(parseInt(e.target.value, 10) || 0)} className="text-lg font-bold" />
                </div>
              )}

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Mensagem para o Jogador (Opcional)
                </Label>
                <Textarea 
                  placeholder="Explique o motivo do bloqueio ou confirme a liberação..." 
                  value={rejectionNotes} 
                  onChange={e => setRejectionNotes(e.target.value)} 
                />
              </div>
            </div>
          )}

          {actionType === 'delete' && (
            <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/10 text-destructive text-sm flex gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>Esta ação é irreversível. A solicitação do jogador <strong>{selectedRequest?.perfis?.full_name}</strong> será apagada.</p>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button 
              variant={actionType === 'approve' ? 'default' : 'destructive'} 
              onClick={handleResolve}
            >
              {actionType === 'approve' ? 'Confirmar Aprovação' : actionType === 'delete' ? 'Excluir Agora' : 'Bloquear/Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default CreditRequestsAdmin;