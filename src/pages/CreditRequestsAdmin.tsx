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
import { ArrowLeft, Check, X, Download, MessageSquare } from 'lucide-react';
import { Footer } from '@/components/Footer';
import PlayerAvatar from '@/components/PlayerAvatar';
import { CreditRequest } from '@/types/match';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-600' },
  approved: { label: 'Aprovada', color: 'bg-success/10 text-success' },
  rejected: { label: 'Rejeitada', color: 'bg-destructive/10 text-destructive' },
};

const CreditRequestsAdmin = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { allCreditRequests, resolveCreditRequest } = useGame();
  const [selectedRequest, setSelectedRequest] = useState<CreditRequest | null>(null);
  const [creditsToGrant, setCreditsToGrant] = useState(0);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    if (!profile || profile.role !== 'admin') {
      navigate('/');
    }
  }, [profile, navigate]);

  const handleOpenDialog = (request: CreditRequest, type: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(type);
    setCreditsToGrant(0);
    setRejectionNotes('');
    setIsResolveDialogOpen(true);
  };

  const handleResolve = async () => {
    if (!selectedRequest || !actionType) return;
    
    if (actionType === 'approve') {
      await resolveCreditRequest(selectedRequest.id, 'approved', creditsToGrant);
    } else {
      await resolveCreditRequest(selectedRequest.id, 'rejected', undefined, rejectionNotes);
    }
    setIsResolveDialogOpen(false);
  };

  const handleDownloadReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from('receipts').download(path);
    if (error) {
      console.error('Error downloading receipt:', error);
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() || 'comprovante';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-primary-foreground">Solicitações de Crédito</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto py-8 px-4 flex-grow">
        <Tabs defaultValue="pending">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">Pendentes ({pendingRequests.length})</TabsTrigger>
            <TabsTrigger value="resolved">Resolvidas ({resolvedRequests.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">
            <div className="card-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jogador</TableHead>
                    <TableHead>Data</TableHead>
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
                          <span className="font-medium">{req.perfis?.full_name || 'Não definido'}</span>
                        </div>
                      </TableCell>
                      <TableCell title={format(new Date(req.requested_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}>
                        {formatDistanceToNow(new Date(req.requested_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="outline" size="sm" onClick={() => handleDownloadReceipt(req.receipt_url)}>
                          <Download className="w-3 h-3 mr-2" /> Baixar
                        </Button>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="destructive" onClick={() => handleOpenDialog(req, 'reject')}>
                          <X className="w-4 h-4 mr-1" /> Rejeitar
                        </Button>
                        <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => handleOpenDialog(req, 'approve')}>
                          <Check className="w-4 h-4 mr-1" /> Aprovar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pendingRequests.length === 0 && <p className="text-center text-muted-foreground py-10">Nenhuma solicitação pendente.</p>}
            </div>
          </TabsContent>
          <TabsContent value="resolved" className="mt-4">
            <div className="card-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jogador</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Créditos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resolvedRequests.map(req => (
                    <TableRow key={req.id} className="opacity-80">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <PlayerAvatar url={req.perfis?.avatar_url || null} />
                          <span className="font-medium">{req.perfis?.full_name || 'Não definido'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(req.requested_at), "dd/MM/yy", { locale: ptBR })}</TableCell>
                      <TableCell>
                        <Badge className={statusConfig[req.status].color}>{statusConfig[req.status].label}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono">{req.credits_granted || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {resolvedRequests.length === 0 && <p className="text-center text-muted-foreground py-10">Nenhuma solicitação resolvida.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver Solicitação</DialogTitle>
            <DialogDescription>
              {actionType === 'approve' ? 'Defina quantos créditos serão adicionados ao jogador.' : 'Adicione uma nota para a rejeição (opcional).'}
            </DialogDescription>
          </DialogHeader>
          {actionType === 'approve' ? (
            <div className="pt-4">
              <label htmlFor="credits" className="text-sm font-medium">Créditos a Conceder</label>
              <Input id="credits" type="number" value={creditsToGrant} onChange={e => setCreditsToGrant(parseInt(e.target.value, 10) || 0)} />
            </div>
          ) : (
            <div className="pt-4">
              <label htmlFor="notes" className="text-sm font-medium">Motivo da Rejeição</label>
              <Textarea id="notes" placeholder="Ex: Comprovante inválido." value={rejectionNotes} onChange={e => setRejectionNotes(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button onClick={handleResolve}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default CreditRequestsAdmin;