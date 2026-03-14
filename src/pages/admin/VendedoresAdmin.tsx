import { useState } from 'react';
import { useRifaAdmin } from '@/hooks/useRifaAdmin';
import { useGame } from '@/contexts/GameContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Loader2, CheckCircle2, XCircle, Users, Copy, ShieldBan, ShieldCheck, Edit, Wallet, HandCoins, AlertTriangle, Eye, ExternalLink, Grid3X3, SmartphoneNfc, Ticket, TrendingUp, BadgeDollarSign, HeartHandshake, PenTool } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AcertoVendedor } from '@/types/rifa';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const VendedoresAdmin = () => {
  const queryClient = useQueryClient();
  const { gameSettings } = useGame();
  const {
    solicitacoesVendedor,
    vendedoresComStats,
    acertosPendentes,
    todasFolhasBingo,
    todasCompras,
    isLoadingSolicitacoes,
    atualizarVendedor,
    salvarEdicaoCompletaVendedor,
    resolverAcerto,
    pagarComissaoManual,
    forcarRepasseAcerto,
    estornarRepasseAcerto
  } = useRifaAdmin();

  const [editandoVendedor, setEditandoVendedor] = useState<any | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [formEdicao, setFormEdicao] = useState({ nome_completo: '', telefone: '', cpf: '', rg: '', endereco: '', comissao: 0, desconto: 0 });
  
  const [acaoAcerto, setAcaoAcerto] = useState<{tipo: 'aprovado' | 'rejeitado', acerto: AcertoVendedor} | null>(null);
  const [isProcessandoAcerto, setIsProcessandoAcerto] = useState(false);
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);

  const [acertoForcarRepasse, setAcertoForcarRepasse] = useState<AcertoVendedor | null>(null);
  const [isForcandoRepasse, setIsForcandoRepasse] = useState(false);

  const [pagarComissaoOpen, setPagarComissaoOpen] = useState(false);
  const [acertoComissao, setAcertoComissao] = useState<AcertoVendedor | null>(null);
  const [valorComissao, setValorComissao] = useState<number>(0);
  const [descontarDoAdmin, setDescontarDoAdmin] = useState(true);
  const [isPagandoComissao, setIsPagandoComissao] = useState(false);

  const pendentes = solicitacoesVendedor.filter(s => s.status === 'pendente');
  const acertosParaAnalisar = acertosPendentes.filter(a => a.status === 'pendente' || a.status === 'em_analise');
  const resolvedAcertos = acertosPendentes.filter(a => a.status === 'aprovado' || a.status === 'rejeitado' || a.status === 'aprovar' || a.status === 'rejeitar');

  // Cálculos do Dashboard Financeiro de Vendedores
  const totalRecebido = resolvedAcertos.filter(a => a.status === 'aprovado' || a.status === 'aprovar').reduce((acc, a) => acc + Number(a.valor), 0);
  const totalComissoesPagas = resolvedAcertos.filter(a => a.status === 'aprovado' || a.status === 'aprovar').reduce((acc, a) => acc + Number(a.comissao_paga || 0), 0);
  
  const fiadosBingo = todasFolhasBingo.filter(f => f.status === 'pendente').reduce((acc, f) => acc + Number(f.valor_pago), 0);
  const fiadosRifa = todasCompras.filter(c => c.status === 'pendente' && c.tipo_pagamento === 'vendedor').reduce((acc, c) => acc + Number(c.valor_total), 0);
  const totalFiadoNaRua = fiadosBingo + fiadosRifa;

  // Vendas de Clientes (PIX Direto)
  const pagamentosClientesBingo = todasFolhasBingo.filter(f => f.status === 'em_analise').map(f => ({
    id: f.id,
    created_at: f.created_at,
    isBingo: true,
    displayNome: f.nome_comprador,
    displayTelefone: f.telefone_comprador,
    displayEndereco: f.endereco_comprador,
    displayJogo: f.partidas?.name,
    displayCodigo: f.codigo_validacao,
    displayVendedor: f.vendedores_rifa?.nome,
    displayValor: f.valor_pago,
    displayDesconto: f.desconto_aplicado,
    comprovante_url: f.comprovante_url
  }));

  const pagamentosClientesRifa = todasCompras.filter(c => c.status === 'em_analise').map(c => {
    const cartela = c.cartelas_rifa?.[0];
    const vendedorDaRifa = c.vendedor_id 
      ? vendedoresComStats.find((v: any) => v.id === c.vendedor_id)
      : vendedoresComStats.find((v: any) => v.id === c.ref_vendedor_id);
      
    return {
      id: c.id,
      created_at: c.created_at,
      isBingo: false,
      displayNome: cartela?.numeros_rifa?.nome_comprador || 'Comprador',
      displayTelefone: cartela?.numeros_rifa?.telefone_comprador,
      displayEndereco: cartela?.numeros_rifa?.endereco_comprador,
      displayJogo: c.rifas?.nome,
      displayCodigo: cartela?.codigo_validacao,
      displayVendedor: vendedorDaRifa?.nome || 'Desconhecido',
      displayValor: c.valor_total,
      displayDesconto: c.desconto_aplicado,
      comprovante_url: c.comprovante_url
    };
  });

  const pagamentosClientes = [...pagamentosClientesBingo, ...pagamentosClientesRifa].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  const [isProcessandoPagCliente, setIsProcessandoPagCliente] = useState(false);

  const handleResolverPagamentoCliente = async (vendaId: string, aprovar: boolean, isBingo: boolean) => {
    setIsProcessandoPagCliente(true);
    let fnName = '';
    if (isBingo) {
      fnName = aprovar ? 'aprovar_pagamento_cliente_bingo' : 'rejeitar_pagamento_cliente_bingo';
    } else {
      fnName = aprovar ? 'aprovar_pagamento_cliente_rifa' : 'rejeitar_pagamento_cliente_rifa';
    }
    
    const { data, error } = await supabase.rpc(fnName, { p_venda_id: vendaId });
    setIsProcessandoPagCliente(false);

    if (error || !data?.success) {
      toast.error(`Erro ao processar o pagamento direto do cliente: ${data?.error || error?.message}`);
      return;
    }
    
    toast.success(aprovar ? 'Comprovante do cliente aprovado! Comissão do vendedor gerada.' : 'Comprovante rejeitado.');
    queryClient.invalidateQueries({ queryKey: ['todasFolhasBingoAdmin'] });
    queryClient.invalidateQueries({ queryKey: ['todasComprasRifa'] });
    queryClient.invalidateQueries({ queryKey: ['vendedoresComStats'] });
  };

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
      nome_completo: vendedor.cadastro?.nome_completo || vendedor.nome || vendedor.perfis?.full_name || '',
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
    const payloadRifa = { 
      nome: formEdicao.nome_completo, 
      telefone: formEdicao.telefone, 
      documento: formEdicao.cpf, 
      comissao_percentual: Number(formEdicao.comissao), 
      percentual_desconto: Number(formEdicao.desconto) 
    };
    const payloadCadastro = { 
      nome_completo: formEdicao.nome_completo, 
      telefone: formEdicao.telefone, 
      cpf: formEdicao.cpf, 
      rg: formEdicao.rg, 
      endereco: formEdicao.endereco 
    };
    const ok = await salvarEdicaoCompletaVendedor(editandoVendedor.id, editandoVendedor.user_id, payloadRifa, payloadCadastro);
    setIsSavingEdit(false);
    if (ok) setEditandoVendedor(null);
  };

  const handleViewComprovante = async (path: string | null, isPublic: boolean = false) => {
    if (!path) {
        toast.error('Nenhum comprovante de imagem foi anexado a esta transação.');
        return;
    }
    if (isPublic) {
        setComprovanteUrl(path);
        return;
    }
    try {
      const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600);
      if (error) throw error;
      setComprovanteUrl(data.signedUrl);
    } catch (e) { toast.error('Erro ao carregar comprovante.'); }
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

  const openPagarComissao = (acerto: AcertoVendedor) => {
    const vendedor = vendedoresComStats.find((v: any) => v.id === acerto.vendedor_id);
    const comissaoPerc = vendedor?.comissao_percentual > 0 ? vendedor.comissao_percentual : (gameSettings?.comissao_vendedor_global || 0);
    const sugestao = Number(acerto.valor) * (comissaoPerc / 100);

    setAcertoComissao(acerto);
    setValorComissao(sugestao);
    setDescontarDoAdmin(true);
    setPagarComissaoOpen(true);
  };

  const handlePagarComissao = async () => {
    if (!acertoComissao) return;
    setIsPagandoComissao(true);
    const ok = await pagarComissaoManual(acertoComissao.id, valorComissao, descontarDoAdmin);
    setIsPagandoComissao(false);
    if (ok) setPagarComissaoOpen(false);
  };

  if (isLoadingSolicitacoes) {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5" /> Gestão de Vendedores</h2>
        <div className="flex gap-2">
          {pagamentosClientes.length > 0 && <Badge className="bg-blue-50 animate-pulse">{pagamentosClientes.length} PIX Cliente</Badge>}
        </div>
      </div>

      <Tabs defaultValue="acertos">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1">
          <TabsTrigger value="vendedores" className="py-3">Vendedores</TabsTrigger>
          <TabsTrigger value="solicitacoes" className="relative py-3">Inscrições {pendentes.length > 0 && <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">{pendentes.length}</span>}</TabsTrigger>
          <TabsTrigger value="acertos" className="relative py-3">Acertos (Lote) {acertosParaAnalisar.length > 0 && <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white">{acertosParaAnalisar.length}</span>}</TabsTrigger>
          <TabsTrigger value="clientes" className="relative py-3">PIX Direto {pagamentosClientes.length > 0 && <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">{pagamentosClientes.length}</span>}</TabsTrigger>
        </TabsList>

        <TabsContent value="vendedores" className="space-y-3 mt-4">
          {vendedoresComStats.map((v: any) => {
             const displayNome = v.cadastro?.nome_completo || v.nome || v.perfis?.full_name || 'Vendedor Sem Nome';
             return (
               <div key={v.id} className={`card-container space-y-3 ${!v.ativo ? 'opacity-80 border-destructive/30' : ''}`}>
                 <div className="flex items-start justify-between gap-2">
                   <div className="min-w-0 flex-1">
                     <div className="flex items-center gap-2">
                       <p className="font-bold text-sm truncate text-foreground">{displayNome}</p>
                       <Badge variant={v.ativo ? 'default' : 'destructive'} className={`text-[10px] shrink-0 ${v.ativo ? 'bg-green-500/15 text-green-700 border-green-500/30' : ''}`}>
                         {v.ativo ? 'Ativo' : 'Bloqueado'}
                       </Badge>
                     </div>
                     <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                       {v.telefone && <span>{v.telefone}</span>}
                       <span>Desconto: {v.percentual_desconto}%</span>
                       <span>Comissão: {v.comissao_percentual}%</span>
                     </div>
                   </div>
                   <div className="flex flex-col gap-1.5 shrink-0">
                     <Button size="sm" variant={v.ativo ? 'outline' : 'default'} className={`text-xs h-8 ${v.ativo ? 'text-destructive border-destructive/30' : 'bg-green-600 hover:bg-green-700'}`} onClick={() => handleToggleAtivo(v.id, v.ativo)}>
                       {v.ativo ? <ShieldBan className="w-3.5 h-3.5 mr-1.5" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />} 
                       {v.ativo ? 'Bloquear' : 'Desbloquear'}
                     </Button>
                   </div>
                 </div>
                 <div className="flex items-center justify-between border-t border-border pt-3">
                   <div className="flex items-center gap-1.5 bg-muted rounded px-2 py-1"><span className="text-[10px] text-muted-foreground">Ref:</span><span className="text-xs font-mono font-bold">{v.codigo_ref}</span><Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCopyRef(v.codigo_ref)}><Copy className="w-3 h-3" /></Button></div>
                   <Button size="sm" variant="secondary" className="h-8 text-xs font-semibold" onClick={() => openEditModal(v)}><Edit className="w-3.5 h-3.5 mr-1.5" /> Ver / Editar</Button>
                 </div>
               </div>
             );
          })}
        </TabsContent>

        <TabsContent value="clientes" className="mt-4 space-y-4">
          <div className="space-y-3">
             <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><SmartphoneNfc className="w-4 h-4 text-blue-600" /> Pagamentos Individuais de Clientes ({pagamentosClientes.length})</h3>
             <p className="text-xs text-muted-foreground mb-4">Estes clientes escanearam o PIX direto da cartela e enviaram o comprovante pela página de Validação Pública.</p>
             
             {pagamentosClientes.length === 0 ? (
                <div className="card-container text-center py-10 text-muted-foreground text-sm border-dashed">Nenhum pagamento direto pendente.</div>
             ) : (
               pagamentosClientes.map((venda: any) => {
                 const valorCheio = Number(venda.displayValor) / (1 - (Number(venda.displayDesconto || 0) / 100));
                 return (
                   <div key={venda.id} className="card-container p-4 border-l-4 border-l-blue-500 flex flex-col gap-3">
                     <div className="flex items-start justify-between">
                       <div>
                         <p className="font-bold text-sm text-foreground flex items-center gap-2">
                           {venda.displayNome}
                           {venda.isBingo ? (
                             <Badge variant="outline" className="text-[9px] text-purple-600 border-purple-300 bg-purple-50"><Grid3X3 className="w-3 h-3 mr-1"/> Bingo</Badge>
                           ) : (
                             <Badge variant="outline" className="text-[9px] text-blue-600 border-blue-300 bg-blue-50"><Ticket className="w-3 h-3 mr-1"/> Rifa</Badge>
                           )}
                         </p>
                         <p className="text-xs text-muted-foreground">
                           {venda.displayTelefone || 'Sem telefone'} 
                           {venda.displayEndereco ? ` • ${venda.displayEndereco}` : ''}
                         </p>
                       </div>
                       <div className="text-right shrink-0">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor Cobrado (Pix)</p>
                          <p className="text-xl font-black text-blue-600">R$ {valorCheio.toFixed(2)}</p>
                       </div>
                     </div>
                     
                     <div className="bg-muted/50 p-2.5 rounded-lg border border-border/50 text-xs">
                        <p className="font-bold flex items-center gap-1.5 mb-1 text-muted-foreground">
                          {venda.isBingo ? <Grid3X3 className="w-3.5 h-3.5" /> : <Ticket className="w-3.5 h-3.5" />} 
                          {venda.displayJogo}
                        </p>
                        <div className="flex justify-between">
                           <span className="font-mono text-primary font-bold">Cód: {venda.displayCodigo}</span>
                           <span className="text-muted-foreground">Vendedor: {venda.displayVendedor}</span>
                        </div>
                     </div>

                     <div className="flex items-center gap-3 pt-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewComprovante(venda.comprovante_url, true)}>
                          <Eye className="w-4 h-4 mr-2" /> Comprovante
                        </Button>
                        <div className="flex gap-2">
                          <Button size="icon" variant="destructive" className="h-9 w-9" onClick={() => handleResolverPagamentoCliente(venda.id, false, venda.isBingo)} disabled={isProcessandoPagCliente}><XCircle className="w-4 h-4" /></Button>
                          <Button size="icon" className="h-9 w-9 bg-green-600 hover:bg-green-700" onClick={() => handleResolverPagamentoCliente(venda.id, true, venda.isBingo)} disabled={isProcessandoPagCliente}><CheckCircle2 className="w-4 h-4" /></Button>
                        </div>
                     </div>
                   </div>
                 );
               })
             )}
          </div>
        </TabsContent>

        <TabsContent value="acertos" className="mt-4 space-y-6">
          {/* DASHBOARD FINANCEIRO DOS VENDEDORES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div className="card-container p-4 bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
               <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <p className="text-[10px] font-bold uppercase tracking-wider">Total Recebido (Caixa)</p>
               </div>
               <p className="text-2xl font-black font-heading text-green-800 dark:text-green-300">R$ {totalRecebido.toFixed(2).replace('.', ',')}</p>
            </div>
            <div className="card-container p-4 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
               <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-1">
                  <HeartHandshake className="w-4 h-4" />
                  <p className="text-[10px] font-bold uppercase tracking-wider">Comissões Pagas</p>
               </div>
               <p className="text-2xl font-black font-heading text-amber-800 dark:text-amber-300">R$ {totalComissoesPagas.toFixed(2).replace('.', ',')}</p>
               <p className="text-[9px] text-amber-700/70 leading-tight mt-1">Créditos depositados na conta dos vendedores.</p>
            </div>
            <div className="card-container p-4 bg-destructive/5 border-destructive/20">
               <div className="flex items-center gap-2 text-destructive mb-1">
                  <BadgeDollarSign className="w-4 h-4" />
                  <p className="text-[10px] font-bold uppercase tracking-wider">Fiado na Rua (A Receber)</p>
               </div>
               <p className="text-2xl font-black font-heading text-destructive">R$ {totalFiadoNaRua.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>

          <div className="space-y-3">
             <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Wallet className="w-4 h-4 text-green-600" /> Acertos em Lote para Aprovar ({acertosParaAnalisar.length})</h3>
             {acertosParaAnalisar.length === 0 ? (
                <div className="card-container text-center py-10 text-muted-foreground text-sm border-dashed">Nenhum acerto em lote pendente.</div>
             ) : (
               acertosParaAnalisar.map(a => (
                 <div key={a.id} className="card-container p-4 border-l-4 border-l-green-500 flex flex-col">
                   <div className="flex items-start justify-between">
                     <div>
                       <p className="font-bold text-sm text-foreground">{a.vendedores_rifa?.nome || 'Vendedor'}</p>
                       <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor do PIX (Bruto)</p>
                        <p className="text-xl font-black text-green-600">R$ {Number(a.valor).toFixed(2)}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-3 pt-3 mt-3 border-t">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewComprovante(a.comprovante_url, false)}><Eye className="w-4 h-4 mr-2" /> Comprovante PIX</Button>
                      <div className="flex gap-2">
                        <Button size="icon" variant="destructive" className="h-9 w-9" onClick={() => setAcaoAcerto({ tipo: 'rejeitado', acerto: a })}><XCircle className="w-4 h-4" /></Button>
                        <Button size="icon" className="h-9 w-9 bg-green-600 hover:bg-green-700" onClick={() => setAcaoAcerto({ tipo: 'aprovado', acerto: a })}><CheckCircle2 className="w-4 h-4" /></Button>
                      </div>
                   </div>
                 </div>
               ))
             )}
          </div>

          <div className="space-y-3 pt-6 border-t">
             <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Wallet className="w-4 h-4 text-muted-foreground" /> Histórico de Acertos (Resolvidos)</h3>
             {resolvedAcertos.length === 0 ? (
                <div className="card-container text-center py-10 text-muted-foreground text-sm border-dashed">Nenhum acerto em lote resolvido.</div>
             ) : (
               resolvedAcertos.map(a => {
                  const finalStatus = a.status === 'aprovar' ? 'aprovado' : a.status === 'rejeitar' ? 'rejeitado' : a.status;
                  const valorBruto = Number(a.valor);
                  const comissao = Number(a.comissao_paga || 0);
                  const liquido = valorBruto - comissao;
                  
                 return (
                 <div key={a.id} className="card-container p-4 flex flex-col bg-muted/20">
                   <div className="flex items-start justify-between">
                     <div>
                       <p className="font-bold text-sm text-foreground">{a.vendedores_rifa?.nome || 'Vendedor'}</p>
                       <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor Bruto</p>
                        <p className="text-xl font-black text-foreground">R$ {valorBruto.toFixed(2)}</p>
                     </div>
                   </div>
                   
                   {finalStatus === 'aprovado' && (
                       <div className="flex flex-col gap-2 my-3 p-2.5 bg-background rounded-lg border border-border/50">
                           <div className="flex items-center justify-between">
                               <div className="text-center">
                                   <p className="text-[9px] uppercase font-bold text-amber-600">Comissão Paga</p>
                                   <p className="font-mono font-bold text-sm text-amber-700">R$ {comissao.toFixed(2)}</p>
                               </div>
                               <div className="text-center border-l pl-4">
                                   <p className="text-[9px] uppercase font-bold text-success">Líquido no Caixa</p>
                                   <p className="font-mono font-bold text-sm text-success">R$ {liquido.toFixed(2)}</p>
                               </div>
                           </div>
                           
                           {/* BOTÃO PARA CORREÇÃO MANUAL DE COMISSÃO ZERADA */}
                           {comissao === 0 && (
                               <div className="border-t pt-2 mt-1">
                                   <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="w-full text-amber-600 border-amber-300 hover:bg-amber-50 h-8 text-[10px] font-bold"
                                      onClick={() => openPagarComissao(a)}
                                   >
                                      <PenTool className="w-3 h-3 mr-1.5" /> Corrigir: Pagar Comissão Faltante
                                   </Button>
                               </div>
                           )}
                       </div>
                   )}

                   <div className="flex items-center justify-between pt-3 mt-1 border-t">
                      <div className="flex items-center gap-2">
                         <Badge className={finalStatus === 'aprovado' ? 'bg-success text-white' : 'bg-destructive text-white'}>
                             {finalStatus.toUpperCase()}
                         </Badge>
                         {finalStatus === 'aprovado' && (
                             a.repasse_concluido ? (
                               <Badge variant="outline" className="text-[9px] bg-green-500/10 text-green-700 border-green-500/30 font-bold">
                                 <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Dinheiro Dividido
                               </Badge>
                             ) : (
                               <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-700 border-red-500/30 font-bold animate-pulse">
                                 <AlertTriangle className="w-2.5 h-2.5 mr-1" /> Erro no Repasse
                               </Badge>
                             )
                         )}
                      </div>
                      <div className="flex items-center gap-2">
                         {finalStatus === 'aprovado' && !a.repasse_concluido && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600 hover:bg-amber-100" title="Saldo não entrou no Caixa? Forçar Repasse" onClick={() => setAcertoForcarRepasse(a)}>
                              <AlertTriangle className="w-4 h-4" />
                            </Button>
                         )}
                         {finalStatus === 'aprovado' && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Estornar Acerto e Repasses" onClick={() => estornarRepasseAcerto(a.id)}>
                              <Undo2 className="w-4 h-4" />
                            </Button>
                         )}
                         <Button variant="ghost" size="sm" onClick={() => handleViewComprovante(a.comprovante_url, false)}><Eye className="w-4 h-4 mr-2" /> Comprovante</Button>
                      </div>
                   </div>
                 </div>
               )})
             )}
          </div>

        </TabsContent>
      </Tabs>

      {/* MODAL DE EDIÇÃO DE VENDEDOR */}
      <Dialog open={!!editandoVendedor} onOpenChange={(open) => !open && setEditandoVendedor(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5 text-primary" /> Editar Vendedor</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Nome Completo</Label><Input value={formEdicao.nome_completo} onChange={e => setFormEdicao(p => ({...p, nome_completo: e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>CPF</Label><Input value={formEdicao.cpf} onChange={e => setFormEdicao(p => ({...p, cpf: e.target.value}))} /></div><div className="space-y-2"><Label>RG</Label><Input value={formEdicao.rg} onChange={e => setFormEdicao(p => ({...p, rg: e.target.value}))} /></div></div>
            <div className="border-t pt-4 grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Desconto Físico (%)</Label><Input type="number" step="0.1" value={formEdicao.desconto} onChange={e => setFormEdicao(p => ({...p, desconto: Number(e.target.value)}))} /></div><div className="space-y-2"><Label>Comissão Online (%)</Label><Input type="number" step="0.1" value={formEdicao.comissao} onChange={e => setFormEdicao(p => ({...p, comissao: Number(e.target.value)}))} /></div></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setEditandoVendedor(null)}>Cancelar</Button><Button onClick={handleSaveEdit} disabled={isSavingEdit}>{isSavingEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}Salvar Alterações</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!comprovanteUrl} onOpenChange={(open) => !open && setComprovanteUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Visualizador de Comprovante</DialogTitle></DialogHeader>
          <div className="flex items-center justify-center p-2 bg-muted/30 rounded-lg min-h-[50vh]">
            {comprovanteUrl && (comprovanteUrl.toLowerCase().includes('.pdf') ? <iframe src={comprovanteUrl} className="w-full h-[65vh] rounded-md border shadow-sm bg-white" /> : <img src={comprovanteUrl} alt="Comprovante" className="max-w-full max-h-[65vh] object-contain rounded-md shadow-sm" />)}
          </div>
          <DialogFooter>
            {comprovanteUrl && <Button asChild variant="outline" className="gap-2"><a href={comprovanteUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /> Abrir Original / Baixar</a></Button>}
            <Button variant="default" onClick={() => setComprovanteUrl(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL CORRIGIR COMISSÃO MANUAL (PARA ACERTOS ANTIGOS) */}
      <Dialog open={pagarComissaoOpen} onOpenChange={setPagarComissaoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <PenTool className="w-5 h-5" /> Corrigir Comissão Pendente
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
             <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
               Neste acerto antigo, o valor de <strong>R$ {Number(acertoComissao?.valor || 0).toFixed(2)}</strong> foi todo para o seu caixa, e a comissão não foi repassada para o vendedor.
             </div>
             
             <div className="space-y-2">
                 <Label>Valor da Comissão para o Vendedor (R$)</Label>
                 <Input 
                    type="number" 
                    step="0.01" 
                    value={valorComissao} 
                    onChange={e => setValorComissao(Number(e.target.value))} 
                    className="font-bold text-lg h-12 text-amber-700" 
                 />
                 <p className="text-[10px] text-muted-foreground">
                    Ao confirmar, este valor será creditado no saldo do vendedor.
                 </p>
             </div>

             <div className="flex items-center justify-between p-3 border rounded-lg bg-background mt-4">
                <div>
                  <Label className="text-sm font-bold">Descontar do Caixa do Admin?</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Se ativo, o valor da comissão será subtraído do lucro da plataforma (recomendado).
                  </p>
                </div>
                <Switch checked={descontarDoAdmin} onCheckedChange={setDescontarDoAdmin} />
             </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPagarComissaoOpen(false)}>Cancelar</Button>
            <Button onClick={handlePagarComissao} disabled={isPagandoComissao || valorComissao <= 0} className="bg-amber-600 hover:bg-amber-700 text-white">
              {isPagandoComissao ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <HandCoins className="w-4 h-4 mr-2" />}
              Transferir para Vendedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!acaoAcerto} onOpenChange={open => !open && setAcaoAcerto(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2">{acaoAcerto?.tipo === 'aprovado' ? <HandCoins className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}{acaoAcerto?.tipo === 'aprovado' ? 'Confirmar Recebimento' : 'Rejeitar Comprovante'}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-3">
            {acaoAcerto?.tipo === 'aprovado' ? (
              <p className="text-sm text-muted-foreground">Você conferiu o PIX e o valor de <strong>R$ {Number(acaoAcerto.acerto.valor).toFixed(2)}</strong> realmente caiu na conta?</p>
            ) : (
              <p className="text-sm text-muted-foreground">O comprovante é inválido ou o dinheiro não caiu?</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAcaoAcerto(null)}>Cancelar</Button>
            <Button className={acaoAcerto?.tipo === 'aprovado' ? 'bg-green-600 hover:bg-green-700 text-white' : ''} variant={acaoAcerto?.tipo === 'rejeitado' ? 'destructive' : 'default'} onClick={handleResolverAcerto} disabled={isProcessandoAcerto}>{isProcessandoAcerto && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{acaoAcerto?.tipo === 'aprovado' ? 'Sim, o dinheiro caiu!' : 'Rejeitar Acerto'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!acertoForcarRepasse} onOpenChange={open => !open && setAcertoForcarRepasse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-6 h-6" /> Forçar Repasse pro Caixa Admin
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
             <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
               <strong>Atenção:</strong> Utilize esta opção apenas se o sistema não tiver creditado o valor de <strong>R$ {Number(acertoForcarRepasse?.valor || 0).toFixed(2)}</strong> no Caixa do Admin ao aprovar.
             </div>
             <p className="text-sm text-muted-foreground">
               Ao confirmar, o sistema adicionará esse valor diretamente ao seu Caixa. Como o vendedor já reteve a comissão em dinheiro na venda física, não há repasse de créditos para ele.
             </p>
             <p className="text-xs font-bold text-destructive">
               Importante: Se você clicar aqui e o saldo já tiver sido pago antes, o valor será duplicado indevidamente no Caixa.
             </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAcertoForcarRepasse(null)}>Cancelar</Button>
            <Button onClick={handleForcarRepasse} disabled={isForcandoRepasse} className="bg-amber-600 hover:bg-amber-700 text-white">
              {isForcandoRepasse && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar e Enviar p/ Caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendedoresAdmin;