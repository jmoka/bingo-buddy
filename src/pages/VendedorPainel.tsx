import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVendedor } from '@/hooks/useVendedor';
import { useVendedorBingo } from '@/hooks/useVendedorBingo';
import { useRifas } from '@/hooks/useRifas';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Loader2, Copy, Link2, CheckSquare, ShoppingBag, UserCheck, Ticket,
  Printer, Plus, Undo2, Grid3X3, DollarSign, Wallet, Upload, Clock, CheckCircle2, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NumeroRifa } from '@/types/rifa';

const VendedorPainel = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const { meuVendedor, minhasReservas, minhasVendas, meusAcertos, isLoading, reservarNumeros, cancelarReserva, validarVenda, gerarLink, enviarAcerto } = useVendedor();
  const { rifas, getNumerosRifa } = useRifas();
  
  const { matches, gameSettings } = useGame();
  const { folhasEmitidas, comprarFolhasBingo } = useVendedorBingo();

  const [activeTab, setActiveTab] = useState<'rifas' | 'bingo' | 'acertos'>('rifas');

  const [validarOpen, setValidarOpen] = useState(false);
  const [validarNumero, setValidarNumero] = useState<(NumeroRifa & { rifas: any }) | null>(null);
  const [validarForm, setValidarForm] = useState({ nome: '', telefone: '', endereco: '' });
  const [isValidando, setIsValidando] = useState(false);

  const [reservarOpen, setReservarOpen] = useState(false);
  const [reservarRifaId, setReservarRifaId] = useState('');
  const [reservarSelecionados, setReservarSelecionados] = useState<number[]>([]);
  const [reservarFiado, setReservarFiado] = useState(false);
  const [isReservando, setIsReservando] = useState(false);

  const [cancelarNumero, setCancelarNumero] = useState<(NumeroRifa & { rifas: any }) | null>(null);
  const [isCancelando, setIsCancelando] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'ativa' | 'finalizada'>('todas');

  const [comprarBingoOpen, setComprarBingoOpen] = useState(false);
  const [selectedBingoMatch, setSelectedBingoMatch] = useState('');
  const [qtdFolhasBingo, setQtdFolhasBingo] = useState(1);
  const [bingoFiado, setBingoFiado] = useState(false);
  const [isGerandoFolhas, setIsGerandoFolhas] = useState(false);

  // Modal Acertos
  const [pagarAcertoOpen, setPagarAcertoOpen] = useState(false);
  const [acertoFile, setAcertoFile] = useState<File | null>(null);
  const [isEnviandoAcerto, setIsEnviandoAcerto] = useState(false);
  const acertoFileRef = useRef<HTMLInputElement>(null);

  const manualMatches = useMemo(() => matches.filter(m => m.status === 'open' && !m.is_auto_calling), [matches]);
  const numerosDisponiveis = useMemo(() => getNumerosRifa(reservarRifaId), [reservarRifaId, getNumerosRifa]);
  const rifasAtivas = useMemo(() => rifas.filter(r => r.status === 'ativa'), [rifas]);

  // Lógica de Pendências (Dívida) com Cálculo de Bruto e Desconto
  const faturasPendentes = useMemo(() => {
    const folhas = folhasEmitidas.filter(f => f.status === 'pendente');
    const rifasCompradas = minhasVendas.filter(v => v.status === 'pendente');
    
    let totalLiquido = 0;
    let totalBruto = 0;

    folhas.forEach(f => {
      const liq = Number(f.valor_pago);
      const descPerc = Number(f.desconto_aplicado || 0);
      const bruto = descPerc < 100 ? liq / (1 - descPerc / 100) : liq;
      totalLiquido += liq;
      totalBruto += bruto;
    });

    rifasCompradas.forEach(r => {
      const liq = Number(r.valor_total);
      const descPerc = Number(r.desconto_aplicado || 0);
      const bruto = descPerc < 100 ? liq / (1 - descPerc / 100) : liq;
      totalLiquido += liq;
      totalBruto += bruto;
    });
    
    return {
      folhas,
      rifasCompradas,
      totalLiquido,
      totalBruto,
      totalDesconto: totalBruto - totalLiquido
    };
  }, [folhasEmitidas, minhasVendas]);

  const toggleReservar = (numero: number) => {
    setReservarSelecionados(prev => prev.includes(numero) ? prev.filter(n => n !== numero) : [...prev, numero]);
  };

  const handleReservar = async () => {
    if (!reservarRifaId || reservarSelecionados.length === 0) return;
    setIsReservando(true);
    const ok = await reservarNumeros(reservarRifaId, reservarSelecionados, reservarFiado);
    setIsReservando(false);
    if (ok) {
      setReservarOpen(false);
      setReservarRifaId('');
      setReservarSelecionados([]);
      setReservarFiado(false);
    }
  };

  const reservasPorRifa = useMemo(() => {
    const map: Record<string, (NumeroRifa & { rifas: any })[]> = {};
    const filtradas = filtroStatus === 'todas' ? minhasReservas : minhasReservas.filter(r => r.rifas?.status === filtroStatus);
    for (const r of filtradas) {
      if (!map[r.rifa_id]) map[r.rifa_id] = [];
      map[r.rifa_id].push(r);
    }
    return map;
  }, [minhasReservas, filtroStatus]);

  const handleValidar = async () => {
    if (!validarNumero || !validarForm.nome.trim()) return;
    setIsValidando(true);
    const ok = await validarVenda(validarNumero.id, validarForm.nome, validarForm.telefone, validarForm.endereco);
    setIsValidando(false);
    if (ok) setValidarOpen(false);
  };

  const handleGerarFolhasBingo = async () => {
    if (!selectedBingoMatch || qtdFolhasBingo < 1) return;
    setIsGerandoFolhas(true);
    const gridsPorFolha = gameSettings?.cartelas_por_folha_bingo || 4;
    const ok = await comprarFolhasBingo(selectedBingoMatch, qtdFolhasBingo, gridsPorFolha, bingoFiado);
    setIsGerandoFolhas(false);
    if (ok) {
      setComprarBingoOpen(false);
      setSelectedBingoMatch('');
      setQtdFolhasBingo(1);
      setBingoFiado(false);
    }
  };

  const handleEnviarAcerto = async () => {
    if (!acertoFile || faturasPendentes.totalLiquido <= 0) return;
    setIsEnviandoAcerto(true);
    const bingoIds = faturasPendentes.folhas.map(f => f.id);
    const rifaIds = faturasPendentes.rifasCompradas.map(r => r.id);
    const ok = await enviarAcerto(bingoIds, rifaIds, faturasPendentes.totalLiquido, acertoFile);
    setIsEnviandoAcerto(false);
    if (ok) {
      setPagarAcertoOpen(false);
      setAcertoFile(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  if (!meuVendedor) {
    return (
      <div className="card-container text-center py-16 space-y-4 max-w-md mx-auto">
        <UserCheck className="w-12 h-12 text-muted-foreground/40 mx-auto" />
        <p className="text-muted-foreground">Você não está cadastrado como vendedor ativo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-xl font-bold">Painel do Vendedor</h1>
            <p className="text-sm text-muted-foreground">{meuVendedor.nome}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
           <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">Ativo</Badge>
           <span className="text-[10px] text-muted-foreground mt-1 font-semibold">{meuVendedor.percentual_desconto}% Desconto | {meuVendedor.comissao_percentual}% Comissão</span>
        </div>
      </div>

      {faturasPendentes.totalLiquido > 0 && (
        <div className="card-container bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
            <DollarSign className="w-8 h-8 shrink-0" />
            <div>
              <h3 className="font-bold text-lg leading-tight">Você possui Acertos Pendentes</h3>
              <p className="text-xs font-medium">Você deve repassar R$ {faturasPendentes.totalLiquido.toFixed(2).replace('.', ',')} ao sistema. As cartelas geradas no fiado só terão validade após o pagamento.</p>
            </div>
          </div>
          <Button variant="destructive" className="shrink-0 w-full sm:w-auto font-bold" onClick={() => setActiveTab('acertos')}>
            Resolver Pendências
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
        <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/50 p-1 mb-4">
          <TabsTrigger value="rifas" className="flex items-center gap-2"><Ticket className="w-4 h-4" /> Rifas</TabsTrigger>
          <TabsTrigger value="bingo" className="flex items-center gap-2"><Grid3X3 className="w-4 h-4" /> Bingo Físico</TabsTrigger>
          <TabsTrigger value="acertos" className="flex items-center gap-2 relative">
            <Wallet className="w-4 h-4" /> Acertos
            {faturasPendentes.totalLiquido > 0 && <span className="absolute top-1 right-1 flex h-2.5 w-2.5 rounded-full bg-destructive" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rifas" className="space-y-6 mt-0">
          <div className="grid grid-cols-3 gap-3">
             <div className="card-container p-3 text-center border-2 border-primary/20"><p className="text-[10px] text-muted-foreground">Reservados</p><p className="text-xl font-bold font-heading text-primary">{minhasReservas.length}</p></div>
             <div className="card-container p-3 text-center border-2 border-green-500/20"><p className="text-[10px] text-muted-foreground">Validados</p><p className="text-xl font-bold font-heading text-green-600">{minhasReservas.filter(n => n.status === 'vendido').length}</p></div>
             <div className="card-container p-3 text-center border-2 border-amber-500/20"><p className="text-[10px] text-muted-foreground">Pendentes</p><p className="text-xl font-bold font-heading text-amber-600">{minhasReservas.filter(n => n.status === 'reservado').length}</p></div>
          </div>

          <div className="card-container space-y-3">
            <h3 className="font-heading font-bold text-sm flex items-center gap-2"><Link2 className="w-4 h-4 text-primary" /> Links de Indicação (Ganha Comissão)</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 p-2 bg-muted rounded-lg">
                <span className="text-xs text-muted-foreground truncate flex-1">{gerarLink()} (Geral)</span>
                <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={() => { navigator.clipboard.writeText(gerarLink()); toast.success('Copiado!'); }}><Copy className="w-3 h-3 mr-1" /> Copiar</Button>
              </div>
            </div>
          </div>

          <div className="card-container p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-lg">Suas Reservas e Vendas Físicas</h3>
                <Button className="gradient-primary" onClick={() => setReservarOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Vender / Reservar
                </Button>
              </div>

              {Object.keys(reservasPorRifa).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" /> Nenhuma reserva ativa.
                </div>
              ) : (
                Object.entries(reservasPorRifa).filter(([, nums]) => nums[0]?.rifas?.status === 'ativa').map(([rifaId, numeros]) => (
                    <div key={rifaId} className="space-y-3 bg-muted/30 p-3 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-heading font-bold text-sm">{numeros[0]?.rifas?.nome ?? 'Rifa'}</h4>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/vendedor/imprimir/${rifaId}`)}>
                          <Printer className="w-3 h-3 mr-1" /> Imprimir
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {numeros.map(n => (
                          <div key={n.id} className="relative group">
                            <button
                              onClick={() => n.status === 'reservado' && openValidar(n)}
                              className={`w-full rounded-lg p-2 flex flex-col items-center justify-center gap-0.5 transition-colors min-h-[64px] ${n.status === 'vendido' ? 'bg-green-100 text-green-700 cursor-default' : 'bg-amber-100 text-amber-700 hover:bg-amber-200 cursor-pointer'}`}
                            >
                              <span className="text-base font-bold font-heading">{n.numero}</span>
                              {n.status === 'vendido' ? <CheckSquare className="w-3 h-3 mt-0.5" /> : <span className="text-[9px] opacity-60">pendente</span>}
                            </button>
                            {n.status === 'reservado' && (
                              <button onClick={e => { e.stopPropagation(); setCancelarNumero(n); }} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-100 text-red-600 rounded p-0.5">
                                <Undo2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                ))
              )}
          </div>
        </TabsContent>

        <TabsContent value="bingo" className="space-y-4 mt-0">
          <div className="grid grid-cols-3 gap-3">
             <div className="card-container p-3 text-center border-2 border-purple-500/20"><p className="text-[10px] text-muted-foreground">Folhas Emitidas</p><p className="text-xl font-bold font-heading text-purple-600">{folhasEmitidas.length}</p></div>
             <div className="card-container p-3 text-center border-2 border-primary/20"><p className="text-[10px] text-muted-foreground">Cartelas (Grids)</p><p className="text-xl font-bold font-heading text-primary">{folhasEmitidas.reduce((a,f) => a + (f.grids?.length || 0), 0)}</p></div>
             <div className="card-container p-3 text-center border-2 border-green-500/20"><p className="text-[10px] text-muted-foreground">Pago</p><p className="text-lg font-bold font-heading text-green-600">R$ {folhasEmitidas.filter(f=>f.status==='pago').reduce((a,f)=>a+Number(f.valor_pago),0).toFixed(2)}</p></div>
          </div>

          <div className="card-container p-0 overflow-hidden">
            <div className="p-4 border-b bg-purple-50/50 dark:bg-purple-900/10 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-purple-900 dark:text-purple-300">Venda de Bingo Físico</h3>
                <p className="text-xs text-muted-foreground">Emita cartelas de papel e venda presencialmente.</p>
              </div>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold" onClick={() => setComprarBingoOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Gerar Folhas
              </Button>
            </div>
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {folhasEmitidas.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma folha gerada.</div>
              ) : (
                folhasEmitidas.map(folha => (
                  <div key={folha.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-bold text-sm">{folha.partidas?.name || 'Partida'}</p>
                      <div className="flex gap-2 text-[10px] text-muted-foreground mt-1 items-center">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded border">Cod: {folha.codigo_validacao}</span>
                        <span>{format(new Date(folha.created_at), "dd/MM/yy HH:mm")}</span>
                        <Badge variant="outline" className={`h-4 ${folha.status === 'pendente' ? 'text-destructive border-destructive' : folha.status === 'em_analise' ? 'text-amber-500 border-amber-500' : 'text-success border-success'}`}>
                          {folha.status}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/vendedor/imprimir-bingo/${folha.id}`)}>
                      <Printer className="w-4 h-4 mr-1.5" /> Imprimir
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="acertos" className="space-y-4 mt-0">
          <div className="card-container">
            <h2 className="font-heading text-lg font-bold flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-primary" /> Acertos Financeiros
            </h2>
            
            {faturasPendentes.totalLiquido > 0 ? (
              <div className="p-5 border-2 border-amber-500/30 bg-amber-50 dark:bg-amber-900/10 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-amber-500/20 pb-4 gap-4">
                  <div>
                    <p className="text-xs uppercase font-bold text-amber-700/70">Total a repassar (Líquido)</p>
                    <p className="text-3xl font-black font-heading text-amber-700 dark:text-amber-500 mt-1">
                      R$ {faturasPendentes.totalLiquido.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <Button className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm font-bold w-full sm:w-auto" onClick={() => setPagarAcertoOpen(true)}>
                    Informar Pagamento
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pb-2">
                   <div>
                       <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor Bruto (Vendas)</p>
                       <p className="text-sm font-bold text-foreground">R$ {faturasPendentes.totalBruto.toFixed(2).replace('.', ',')}</p>
                   </div>
                   <div>
                       <p className="text-[10px] uppercase font-bold text-muted-foreground">Seu Ganho (Desconto)</p>
                       <p className="text-sm font-bold text-green-600">R$ {faturasPendentes.totalDesconto.toFixed(2).replace('.', ',')}</p>
                   </div>
                </div>

                <div className="space-y-2 border-t border-amber-500/20 pt-4">
                  <p className="text-xs font-bold text-amber-800">Itens que serão validados ao pagar:</p>
                  <ul className="text-xs space-y-2 text-amber-700/80">
                    {faturasPendentes.folhas.map(f => {
                       const liq = Number(f.valor_pago);
                       const descPerc = Number(f.desconto_aplicado || 0);
                       const bruto = descPerc < 100 ? liq / (1 - descPerc / 100) : liq;
                       return (
                         <li key={f.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-amber-500/10 pb-1.5 gap-1">
                           <span>• Folha de Bingo: {f.partidas?.name}</span>
                           <div className="flex items-center sm:justify-end gap-2">
                             <span className="line-through text-[10px] opacity-60" title="Valor Bruto">R$ {bruto.toFixed(2).replace('.', ',')}</span>
                             <Badge variant="outline" className="h-4 text-[9px] bg-white/50 border-amber-500/30 text-amber-700 px-1">-{descPerc}%</Badge>
                             <span className="font-bold">R$ {liq.toFixed(2).replace('.', ',')}</span>
                           </div>
                         </li>
                       );
                    })}
                    {faturasPendentes.rifasCompradas.map(r => {
                       const liq = Number(r.valor_total);
                       const descPerc = Number(r.desconto_aplicado || 0);
                       const bruto = descPerc < 100 ? liq / (1 - descPerc / 100) : liq;
                       return (
                         <li key={r.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-amber-500/10 pb-1.5 gap-1">
                           <span>• Rifa ({r.numeros.length} nºs)</span>
                           <div className="flex items-center sm:justify-end gap-2">
                             <span className="line-through text-[10px] opacity-60" title="Valor Bruto">R$ {bruto.toFixed(2).replace('.', ',')}</span>
                             <Badge variant="outline" className="h-4 text-[9px] bg-white/50 border-amber-500/30 text-amber-700 px-1">-{descPerc}%</Badge>
                             <span className="font-bold">R$ {liq.toFixed(2).replace('.', ',')}</span>
                           </div>
                         </li>
                       );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center border-2 border-dashed border-success/30 rounded-xl bg-success/5">
                <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2" />
                <p className="font-bold text-success">Tudo em dia!</p>
                <p className="text-sm text-muted-foreground mt-1">Você não possui cartelas pendentes de repasse.</p>
              </div>
            )}

            <div className="mt-8">
              <h3 className="font-heading font-bold text-sm mb-3">Histórico de Acertos</h3>
              <div className="space-y-3">
                {meusAcertos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum acerto enviado ainda.</p>
                ) : (
                  meusAcertos.map((acerto: any) => (
                    <div key={acerto.id} className="p-3 border rounded-lg flex items-center justify-between text-sm">
                      <div>
                        <p className="font-bold">R$ {Number(acerto.valor).toFixed(2).replace('.', ',')}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(acerto.created_at), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                      <Badge variant={acerto.status === 'aprovado' ? 'default' : acerto.status === 'rejeitado' ? 'destructive' : 'secondary'} className={acerto.status === 'aprovado' ? 'bg-success' : ''}>
                        {acerto.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL DE COMPRA DE BINGO */}
      <Dialog open={comprarBingoOpen} onOpenChange={setComprarBingoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Grid3X3 className="w-5 h-5 text-purple-600" />
              Emitir Folhas de Bingo
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label>Selecione a Partida Manual</Label>
              {manualMatches.length === 0 ? (
                <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-lg">Não há partidas manuais abertas.</div>
              ) : (
                <Select value={selectedBingoMatch} onValueChange={setSelectedBingoMatch}>
                  <SelectTrigger><SelectValue placeholder="Escolha uma partida..." /></SelectTrigger>
                  <SelectContent>
                    {manualMatches.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name} — R$ {Number(m.card_price).toFixed(2)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedBingoMatch && (
              <div className="space-y-2">
                <Label>Quantidade de Folhas Físicas</Label>
                <Input type="number" min="1" value={qtdFolhasBingo} onChange={e => setQtdFolhasBingo(parseInt(e.target.value) || 1)} />
                <p className="text-[10px] text-muted-foreground">Cada folha terá <strong>{gameSettings?.cartelas_por_folha_bingo || 4} grids</strong>.</p>
              </div>
            )}

            {selectedBingoMatch && qtdFolhasBingo > 0 && (() => {
              const match = manualMatches.find(m => m.id === selectedBingoMatch);
              const desconto = meuVendedor?.percentual_desconto || 0;
              const precoBase = (match?.card_price || 0) * qtdFolhasBingo;
              const totalComDesconto = precoBase * (1 - desconto / 100);

              return (
                <>
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor Bruto:</span>
                      <span>R$ {precoBase.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">Seu Desconto ({desconto}%):</span>
                      <span className="text-green-600">- R$ {(precoBase - totalComDesconto).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-purple-200 mt-1">
                      <span>Valor a Pagar:</span>
                      <span className="text-purple-700">R$ {totalComDesconto.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="text-sm font-bold">Gerar no Fiado</Label>
                      <p className="text-[10px] text-muted-foreground">Imprimir agora e repassar valor ao Admin depois.</p>
                    </div>
                    <Switch checked={bingoFiado} onCheckedChange={setBingoFiado} />
                  </div>
                </>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setComprarBingoOpen(false)}>Cancelar</Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" disabled={isGerandoFolhas || !selectedBingoMatch || qtdFolhasBingo < 1} onClick={handleGerarFolhasBingo}>
              {isGerandoFolhas ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
              {bingoFiado ? 'Gerar Fiado' : 'Comprar e Gerar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE RESERVA RIFA */}
      <Dialog open={reservarOpen} onOpenChange={setReservarOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Reserva de Números</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Selecione a Rifa</Label>
              <Select value={reservarRifaId} onValueChange={(val) => { setReservarRifaId(val); setReservarSelecionados([]); }}>
                <SelectTrigger><SelectValue placeholder="Escolha uma rifa ativa" /></SelectTrigger>
                <SelectContent>
                  {rifasAtivas.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {reservarRifaId && (
              <div className="space-y-2">
                <Label>Números Disponíveis</Label>
                <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto p-2 border rounded-md">
                  {numerosDisponiveis.map(n => (
                    <button
                      key={n.id} disabled={n.status !== 'disponivel'}
                      onClick={() => n.status === 'disponivel' && toggleReservar(n.numero)}
                      className={`rounded p-1 text-xs font-semibold transition-colors ${reservarSelecionados.includes(n.numero) ? 'bg-primary text-primary-foreground' : n.status === 'disponivel' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'}`}
                    >
                      {n.numero}
                    </button>
                  ))}
                </div>
                
                {reservarSelecionados.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-1">
                      {(() => { 
                        const rifa = rifasAtivas.find(r => r.id === reservarRifaId); 
                        const desconto = meuVendedor.percentual_desconto || 0;
                        const bruto = rifa ? reservarSelecionados.length * rifa.custo_por_numero : 0;
                        const liquido = bruto * (1 - desconto/100);
                        return (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Valor Bruto ({reservarSelecionados.length} nºs):</span>
                              <span>R$ {bruto.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-green-600">Seu Desconto ({desconto}%):</span>
                              <span className="text-green-600">- R$ {(bruto - liquido).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg text-primary pt-2 border-t border-primary/20 mt-1">
                              <span>Valor a Pagar:</span>
                              <span>R$ {liquido.toFixed(2)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label className="text-sm font-bold">Reservar Fiado</Label>
                        <p className="text-[10px] text-muted-foreground">Pagar valor ao Admin depois.</p>
                      </div>
                      <Switch checked={reservarFiado} onCheckedChange={setReservarFiado} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReservarOpen(false)}>Cancelar</Button>
            <Button className="gradient-primary" onClick={handleReservar} disabled={isReservando || !reservarRifaId || reservarSelecionados.length === 0}>
              {isReservando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL PAGAR ACERTOS */}
      <Dialog open={pagarAcertoOpen} onOpenChange={setPagarAcertoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repassar Valor ao Sistema</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-4 bg-muted rounded-xl text-center space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Valor exato da transferência (Líquido):</p>
              <p className="text-4xl font-black font-heading text-primary">R$ {faturasPendentes.totalLiquido.toFixed(2).replace('.', ',')}</p>
              <p className="text-xs text-muted-foreground">Sua comissão (R$ {faturasPendentes.totalDesconto.toFixed(2).replace('.', ',')}) já foi subtraída.</p>
            </div>
            {gameSettings?.pix_key && (
              <div className="space-y-1">
                <Label>Chave PIX do Admin</Label>
                <div className="flex gap-2">
                  <Input value={gameSettings.pix_key} readOnly className="font-mono bg-muted font-bold" />
                  <Button variant="outline" onClick={() => { navigator.clipboard.writeText(gameSettings.pix_key || ''); toast.success('Copiado'); }}><Copy className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Anexar Comprovante</Label>
              <input ref={acertoFileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setAcertoFile(e.target.files?.[0] || null)} />
              <Button type="button" variant="outline" className="w-full h-12 border-dashed border-2" onClick={() => acertoFileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" /> {acertoFile ? acertoFile.name : 'Clique para selecionar arquivo'}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPagarAcertoOpen(false)}>Cancelar</Button>
            <Button className="gradient-primary" onClick={handleEnviarAcerto} disabled={isEnviandoAcerto || !acertoFile}>
              {isEnviandoAcerto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckSquare className="w-4 h-4 mr-2" />} Enviar para Análise
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outros Modais (Validar, Cancelar) */}
      <Dialog open={validarOpen} onOpenChange={setValidarOpen}>
        <DialogContent><DialogHeader><DialogTitle>Validar Venda - Número {validarNumero?.numero}</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-sm text-muted-foreground">Para liberar a cartela, preencha os dados do comprador.</p><div className="space-y-2"><Label>Nome (Obrigatório)</Label><Input value={validarForm.nome} onChange={e => setValidarForm(p => ({ ...p, nome: e.target.value }))} /></div><div className="space-y-2"><Label>WhatsApp</Label><Input value={validarForm.telefone} onChange={e => setValidarForm(p => ({ ...p, telefone: e.target.value }))} /></div><Button className="w-full gradient-primary" onClick={handleValidar} disabled={isValidando || !validarForm.nome.trim()}>{isValidando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckSquare className="h-4 w-4 mr-2" />} Confirmar Venda</Button></div></DialogContent>
      </Dialog>

      <Dialog open={!!cancelarNumero} onOpenChange={open => { if (!open) setCancelarNumero(null); }}>
        <DialogContent><DialogHeader><DialogTitle className="text-destructive flex items-center gap-2"><Undo2 className="w-5 h-5" /> Cancelar Reserva</DialogTitle></DialogHeader><div className="space-y-3 py-3"><p>Você tem certeza que deseja cancelar a reserva do número <strong>{cancelarNumero?.numero}</strong>?</p><p className="text-sm text-muted-foreground">O número voltará a ficar disponível e o valor pago por ele será estornado para o seu saldo.</p></div><DialogFooter><Button variant="ghost" onClick={() => setCancelarNumero(null)} disabled={isCancelando}>Voltar</Button><Button variant="destructive" onClick={async () => { if (!cancelarNumero) return; setIsCancelando(true); const ok = await cancelarReserva(cancelarNumero.id); setIsCancelando(false); if (ok) setCancelarNumero(null); }} disabled={isCancelando}>{isCancelando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Confirmar Cancelamento</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
};

export default VendedorPainel;