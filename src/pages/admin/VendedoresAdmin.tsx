import { useState } from 'react';
import { useRifaAdmin } from '@/hooks/useRifaAdmin';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Loader2, CheckCircle2, XCircle, Users, Copy, ShieldBan, ShieldCheck, Edit, Wallet, HandCoins, AlertTriangle, Eye, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { AcertoVendedor } from '@/types/rifa';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const VendedoresAdmin = () => {
  const {
    solicitacoesVendedor,
    vendedoresComStats,
    acertosPendentes,
    isLoadingSolicitacoes,
    atualizarVendedor,
    salvarEdicaoCompletaVendedor,
    resolverAcerto,
  } = useRifaAdmin();

  // Estados dos Modais
  const [editandoVendedor, setEditandoVendedor] = useState<any | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [formEdicao, setFormEdicao] = useState({ nome_completo: '', telefone: '', cpf: '', rg: '', endereco: '', comissao: 0, desconto: 0 });
  
  const [acaoAcerto, setAcaoAcerto] = useState<{tipo: 'aprovar' | 'rejeitar', acerto: AcertoVendedor} | null>(null);
  const [isProcessandoAcerto, setIsProcessandoAcerto] = useState(false);
  
  // Estado para visualizar comprovante
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);

  const pendentes = solicitacoesVendedor.filter(s => s.status === 'pendente');
  const acertosParaAnalisar = acertosPendentes.filter(a => a.status === 'pendente' || a.status === 'em_analise');
  const historicoAcertos = acertosPendentes.filter(a => a.status === 'aprovado' || a.status === 'rejeitado');

  const handleToggleAtivo = async (vendedorId: string, ativo: boolean) => {
    await atualizarVendedor(vendedorId, { ativo: !ativo });
  };

  const handleCopyRef = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    toast.success('Código copiado!');
  };

  const openEditModal = (vendedor: any) => {
    setEditandoVendedor(vendedor);
    setFormEdicao({
      nome_completo: vendedor.cadastro?.nome_completo || vendedor.nome || '',
      telefone: vendedor.cadastro?.telefone || vendedor.telefone || '',
      cpf: vendedor.cadastro?.cpf || vendedor.documento || '',
      rg: vendedor.cadastro?.rg || '',
      endereco: vendedor.cadastro?.endereco || '',
      comissao: vendedor.comissao_percentual || 0,
      desconto: vendedor.percentual_desconto || 0,
    });
  };

  const handleSaveEdit = async () => {
    if (!editandoVendedor) return;
    setIsSavingEdit(true);
    const payloadRifa = { nome: formEdicao.nome_completo, telefone: formEdicao.telefone, documento: formEdicao.cpf, comissao_percentual: Number(formEdicao.comissao), percentual_desconto: Number(formEdicao.desconto) };
    const payloadCadastro = { nome_completo: formEdicao.nome_completo, telefone: formEdicao.telefone, cpf: formEdicao.cpf, rg: formEdicao.rg, endereco: formEdicao.endereco };
    const ok = await salvarEdicaoCompletaVendedor(editandoVendedor.id, editandoVendedor.user_id, payloadRifa, payloadCadastro);
    setIsSavingEdit(false);
    if (ok) setEditandoVendedor(null);
  };

  const handleViewComprovante = async (path: string) => {
    try {
      // Gera uma URL assinada temporária que permite a visualização
      const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600); // 1 hora de validade
      if (error) throw error;
      setComprovanteUrl(data.signedUrl);
    } catch (e) {
      toast.error('Erro ao carregar o comprovante. Verifique as permissões de Storage.');
    }
  };

  const handleResolverAcerto = async () => {
    if (!acaoAcerto) return;
    setIsProcessandoAcerto(true);
    const ok = await resolverAcerto(acaoAcerto.acerto.id, acaoAcerto.tipo);
    setIsProcessandoAcerto(false);
    if (ok) setAcaoAcerto(null);
  };

  if (isLoadingSolicitacoes) {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5" /> Gestão de Vendedores</h2>
        <div className="flex gap-2">
          {pendentes.length > 0 && <Badge className="bg-amber-500">{pendentes.length} Solicitações</Badge>}
          {acertosParaAnalisar.length > 0 && <Badge className="bg-green-500">{acertosParaAnalisar.length} Pagamentos</Badge>}
        </div>
      </div>

      <Tabs defaultValue="acertos">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger value="vendedores" className="py-3">Vendedores</TabsTrigger>
          <TabsTrigger value="solicitacoes" className="relative py-3">
            Inscrições
            {pendentes.length > 0 && <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">{pendentes.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="acertos" className="relative py-3">
            Recebimentos (Fiado)
            {acertosParaAnalisar.length > 0 && <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white">{acertosParaAnalisar.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendedores" className="space-y-3 mt-4">
          {vendedoresComStats.map((v: any) => (
             <div key={v.id} className={`card-container space-y-3 ${!v.ativo ? 'opacity-80 border-destructive/30' : ''}`}>
               <div className="flex items-start justify-between gap-2">
                 <div className="min-w-0 flex-1">
                   <div className="flex items-center gap-2">
                     <p className="font-medium text-sm truncate">{v.nome}</p>
                     <Badge variant={v.ativo ? 'default' : 'destructive'} className={`text-[10px] shrink-0 ${v.ativo ? 'bg-green-500/15 text-green-700 border-green-500/30' : ''}`}>{v.ativo ? 'Ativo' : 'Bloqueado'}</Badge>
                   </div>
                   <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                     {v.telefone && <span>{v.telefone}</span>}
                     <span>Desconto: {v.percentual_desconto}%</span>
                     <span>Comissão: {v.comissao_percentual}%</span>
                   </div>
                 </div>
                 <div className="flex flex-col gap-1.5 shrink-0">
                   <Button size="sm" variant={v.ativo ? 'outline' : 'default'} className={`text-xs h-8 ${v.ativo ? 'text-destructive border-destructive/30' : 'bg-green-600 hover:bg-green-700'}`} onClick={() => handleToggleAtivo(v.id, v.ativo)}>
                     {v.ativo ? <ShieldBan className="w-3.5 h-3.5 mr-1.5" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />} {v.ativo ? 'Bloquear' : 'Desbloquear'}
                   </Button>
                 </div>
               </div>
               <div className="flex items-center justify-between border-t border-border pt-3">
                 <div className="flex items-center gap-1.5 bg-muted rounded px-2 py-1">
                   <span className="text-[10px] text-muted-foreground">Ref:</span><span className="text-xs font-mono font-bold">{v.codigo_ref}</span>
                   <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCopyRef(v.codigo_ref)}><Copy className="w-3 h-3" /></Button>
                 </div>
                 <Button size="sm" variant="secondary" className="h-8 text-xs font-semibold" onClick={() => openEditModal(v)}><Edit className="w-3.5 h-3.5 mr-1.5" /> Ver / Editar</Button>
               </div>
             </div>
          ))}
        </TabsContent>

        <TabsContent value="acertos" className="mt-4 space-y-6">
          <div className="space-y-3">
             <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Wallet className="w-4 h-4 text-green-600" /> Pagamentos em Análise ({acertosParaAnalisar.length})</h3>
             {acertosParaAnalisar.length === 0 ? (
                <div className="card-container text-center py-10 text-muted-foreground text-sm border-dashed">Nenhum acerto pendente de validação.</div>
             ) : (
               acertosParaAnalisar.map(a => (
                 <div key={a.id} className="card-container p-4 border-l-4 border-l-green-500 space-y-3">
                   <div className="flex items-start justify-between">
                     <div>
                       <p className="font-bold text-sm text-foreground">{a.vendedores_rifa?.nome || 'Vendedor'}</p>
                       <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor Declarado</p>
                        <p className="text-xl font-black text-green-600">R$ {Number(a.valor).toFixed(2)}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-3 pt-3 border-t">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewComprovante(a.comprovante_url)}>
                        <Eye className="w-4 h-4 mr-2" /> Visualizar Comprovante
                      </Button>
                      <div className="flex gap-2">
                        <Button size="icon" variant="destructive" className="h-9 w-9" onClick={() => setAcaoAcerto({ tipo: 'rejeitar', acerto: a })}><XCircle className="w-4 h-4" /></Button>
                        <Button size="icon" className="h-9 w-9 bg-green-600 hover:bg-green-700" onClick={() => setAcaoAcerto({ tipo: 'aprovar', acerto: a })}><CheckCircle2 className="w-4 h-4" /></Button>
                      </div>
                   </div>
                 </div>
               ))
             )}
          </div>
          
          <div className="space-y-3 pt-6 border-t">
            <h3 className="text-sm font-semibold text-muted-foreground">Histórico de Acertos Resolvidos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {historicoAcertos.map(a => (
                 <div key={a.id} className={`p-3 rounded-lg border flex items-center justify-between opacity-80 ${a.status === 'aprovado' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                   <div>
                     <p className="font-bold text-sm">{a.vendedores_rifa?.nome}</p>
                     <p className="text-xs text-muted-foreground">R$ {Number(a.valor).toFixed(2)} • {format(new Date(a.resolved_at || a.created_at), "dd/MM/yy HH:mm")}</p>
                   </div>
                   <Badge variant={a.status === 'aprovado' ? 'default' : 'destructive'} className={a.status === 'aprovado' ? 'bg-green-600' : ''}>
                     {a.status === 'aprovado' ? 'Recebido' : 'Recusado'}
                   </Badge>
                 </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="solicitacoes" className="mt-4 space-y-4">
           <p className="text-sm text-muted-foreground">Veja a listagem de solicitações e inscrições aqui.</p>
        </TabsContent>
      </Tabs>

      {/* Modal de Visualização de Comprovante */}
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

      {/* Modal de Resolução de Acerto (Mantido igual) */}
      <Dialog open={!!acaoAcerto} onOpenChange={open => !open && setAcaoAcerto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {acaoAcerto?.tipo === 'aprovar' ? <HandCoins className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}
              {acaoAcerto?.tipo === 'aprovar' ? 'Confirmar Recebimento' : 'Rejeitar Comprovante'}
            </DialogTitle>
            <DialogDescription className="sr-only">Validar acerto.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {acaoAcerto?.tipo === 'aprovar' ? (
              <>
                <p className="text-sm text-muted-foreground">Você conferiu o PIX e o valor de <strong>R$ {Number(acaoAcerto.acerto.valor).toFixed(2)}</strong> realmente caiu na conta?</p>
                <div className="p-3 bg-green-50 text-green-800 border border-green-200 text-xs rounded-lg font-medium">
                  Ao aprovar, todas as cartelas de Bingo e números de Rifa vinculados a este acerto se tornarão <strong className="uppercase">Válidas</strong> e participarão dos sorteios e prêmios. O pote das partidas também será atualizado.
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">O comprovante é inválido ou o dinheiro não caiu?</p>
                <div className="p-3 bg-red-50 text-red-800 border border-red-200 text-xs rounded-lg font-medium">
                  Ao rejeitar, as cartelas e números vinculados voltarão para o status <strong className="uppercase">Pendente</strong> e continuarão sem valer nada nos sorteios.
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAcaoAcerto(null)}>Cancelar</Button>
            <Button 
              className={acaoAcerto?.tipo === 'aprovar' ? 'bg-green-600 hover:bg-green-700 text-white' : ''} 
              variant={acaoAcerto?.tipo === 'rejeitar' ? 'destructive' : 'default'}
              onClick={handleResolverAcerto} 
              disabled={isProcessandoAcerto}
            >
              {isProcessandoAcerto && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {acaoAcerto?.tipo === 'aprovar' ? 'Sim, o dinheiro caiu!' : 'Rejeitar Acerto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendedoresAdmin;