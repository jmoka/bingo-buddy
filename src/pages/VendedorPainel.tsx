import { useState, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Loader2,
  Copy,
  Link2,
  CheckSquare,
  ShoppingBag,
  UserCheck,
  Ticket,
  TrendingUp,
  Printer,
  Plus,
  Undo2,
  Trophy,
  Calendar,
  Grid3X3
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NumeroRifa } from '@/types/rifa';

interface ValidarForm {
  nome: string;
  telefone: string;
  endereco: string;
}

const VendedorPainel = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  // Hooks de Rifa
  const { meuVendedor, minhasReservas, minhasVendas, isLoading, reservarNumeros, cancelarReserva, validarVenda, gerarLink } = useVendedor();
  const { rifas, getNumerosRifa } = useRifas();
  
  // Hooks de Bingo
  const { matches, gameSettings } = useGame();
  const { folhasEmitidas, comprarFolhasBingo } = useVendedorBingo();

  const [validarOpen, setValidarOpen] = useState(false);
  const [validarNumero, setValidarNumero] = useState<(NumeroRifa & { rifas: any }) | null>(null);
  const [validarForm, setValidarForm] = useState<ValidarForm>({ nome: '', telefone: '', endereco: '' });
  const [isValidando, setIsValidando] = useState(false);

  const [reservarOpen, setReservarOpen] = useState(false);
  const [reservarRifaId, setReservarRifaId] = useState('');
  const [reservarSelecionados, setReservarSelecionados] = useState<number[]>([]);
  const [isReservando, setIsReservando] = useState(false);

  const [cancelarNumero, setCancelarNumero] = useState<(NumeroRifa & { rifas: any }) | null>(null);
  const [isCancelando, setIsCancelando] = useState(false);

  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'ativa' | 'finalizada'>('todas');

  // Estado Modal de Compra de Bingo Físico
  const [comprarBingoOpen, setComprarBingoOpen] = useState(false);
  const [selectedBingoMatch, setSelectedBingoMatch] = useState('');
  const [qtdFolhasBingo, setQtdFolhasBingo] = useState(1);
  const [isGerandoFolhas, setIsGerandoFolhas] = useState(false);

  // Filtra apenas as partidas manuais abertas para o vendedor vender
  const manualMatches = useMemo(() => {
    return matches.filter(m => m.status === 'open' && !m.is_auto_calling);
  }, [matches]);

  const numerosDisponiveis = useMemo(() => {
    if (!reservarRifaId) return [];
    return getNumerosRifa(reservarRifaId);
  }, [reservarRifaId, getNumerosRifa]);

  const rifasAtivas = useMemo(() => rifas.filter(r => r.status === 'ativa'), [rifas]);

  const toggleReservar = (numero: number) => {
    setReservarSelecionados(prev =>
      prev.includes(numero) ? prev.filter(n => n !== numero) : [...prev, numero]
    );
  };

  const handleReservar = async () => {
    if (!reservarRifaId || reservarSelecionados.length === 0) return;
    setIsReservando(true);
    const ok = await reservarNumeros(reservarRifaId, reservarSelecionados);
    setIsReservando(false);
    if (ok) {
      setReservarOpen(false);
      setReservarRifaId('');
      setReservarSelecionados([]);
    }
  };

  const reservasPorRifa = useMemo(() => {
    const map: Record<string, (NumeroRifa & { rifas: any })[]> = {};
    const filtradas = filtroStatus === 'todas'
      ? minhasReservas
      : minhasReservas.filter(r => r.rifas?.status === filtroStatus);
    for (const r of filtradas) {
      const key = r.rifa_id;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [minhasReservas, filtroStatus]);

  const handleCopyLink = (rifaId?: string) => {
    const link = gerarLink(rifaId);
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const openValidar = (numero: NumeroRifa & { rifas: any }) => {
    setValidarNumero(numero);
    setValidarForm({ nome: numero.nome_comprador || '', telefone: numero.telefone_comprador || '', endereco: numero.endereco_comprador || '' });
    setValidarOpen(true);
  };

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
    const ok = await comprarFolhasBingo(selectedBingoMatch, qtdFolhasBingo, gridsPorFolha);
    setIsGerandoFolhas(false);
    if (ok) {
      setComprarBingoOpen(false);
      setSelectedBingoMatch('');
      setQtdFolhasBingo(1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!meuVendedor) {
    return (
      <div className="card-container text-center py-16 space-y-4 max-w-md mx-auto">
        <UserCheck className="w-12 h-12 text-muted-foreground/40 mx-auto" />
        <p className="text-muted-foreground">Você não está cadastrado como vendedor ativo.</p>
        <Button variant="outline" onClick={() => navigate('/solicitar-vendedor')}>
          Solicitar status de Vendedor
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-xl font-bold">Painel do Vendedor</h1>
          <p className="text-sm text-muted-foreground">{meuVendedor.nome}</p>
        </div>
        <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">Ativo</Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {([
          { key: 'todas', label: 'Total Rifas', value: minhasReservas.length, color: 'text-primary', bg: 'bg-primary/10 border-primary/30' },
          { key: 'ativa', label: 'Rifas Ativas', value: minhasReservas.filter(n => n.rifas?.status === 'ativa').length, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-700/30' },
          { key: 'bingo', label: 'Folhas Bingo', value: folhasEmitidas.length, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200 dark:bg-purple-900/10 dark:border-purple-700/30' },
        ] as const).map(({ key, label, value, color, bg }) => (
          <div
            key={key}
            className={`card-container p-3 text-center border-2 ${bg}`}
          >
            <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
            <p className={`text-xl font-bold font-heading ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="rifas">
        <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/50 p-1 mb-4">
          <TabsTrigger value="rifas" className="flex items-center gap-2">
            <Ticket className="w-4 h-4" /> Sistema de Rifas
          </TabsTrigger>
          <TabsTrigger value="bingo" className="flex items-center gap-2">
            <Grid3X3 className="w-4 h-4" /> Venda de Bingo Físico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rifas" className="space-y-6 mt-0">
          <div className="card-container space-y-3">
            <h3 className="font-heading font-bold text-sm flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" />
              Links de Indicação
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 p-2 bg-muted rounded-lg">
                <span className="text-xs text-muted-foreground truncate flex-1">{gerarLink()}</span>
                <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={() => handleCopyLink()}>
                  <Copy className="w-3 h-3 mr-1" /> Copiar
                </Button>
              </div>
              {rifas.filter(r => r.status === 'ativa').map(rifa => (
                <div key={rifa.id} className="flex items-center justify-between gap-2 p-2 bg-muted rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{rifa.nome}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{gerarLink(rifa.id)}</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={() => handleCopyLink(rifa.id)}>
                    <Copy className="w-3 h-3 mr-1" /> Copiar
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Tabs defaultValue="reservas" className="border rounded-xl bg-card shadow-sm p-4">
            <TabsList className="grid w-full grid-cols-3 h-10 bg-muted/50 p-1 mb-4">
              <TabsTrigger value="reservas" className="text-xs">Reservas</TabsTrigger>
              <TabsTrigger value="vendas" className="text-xs">Vendas</TabsTrigger>
              <TabsTrigger value="encerradas" className="text-xs">Encerradas</TabsTrigger>
            </TabsList>
            
            <TabsContent value="reservas" className="space-y-4">
              <Button className="w-full gradient-primary" onClick={() => setReservarOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Nova Reserva de Números
              </Button>
              {/* Restante do código de reservas de rifas já existente */}
              {Object.keys(reservasPorRifa).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhuma reserva ativa.
                </div>
              ) : (
                Object.entries(reservasPorRifa).filter(([, nums]) => nums[0]?.rifas?.status === 'ativa').map(([rifaId, numeros]) => {
                  const rifa = numeros[0]?.rifas;
                  return (
                    <div key={rifaId} className="space-y-3 bg-muted/30 p-3 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-heading font-bold text-sm">{rifa?.nome ?? 'Rifa'}</h4>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/vendedor/imprimir/${rifaId}`)}>
                          <Printer className="w-3 h-3 mr-1" /> Imprimir
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {numeros.map(n => (
                          <div key={n.id} className="relative group">
                            <button
                              onClick={() => n.status === 'reservado' && openValidar(n)}
                              className={`w-full rounded-lg p-2 flex flex-col items-center justify-center gap-0.5 transition-colors min-h-[64px] ${
                                n.status === 'vendido'
                                  ? 'bg-green-100 text-green-700 cursor-default'
                                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200 cursor-pointer'
                              }`}
                            >
                              <span className="text-base font-bold font-heading">{n.numero}</span>
                              {n.status === 'vendido' ? <CheckSquare className="w-3 h-3 mt-0.5" /> : <span className="text-[9px] opacity-60">pendente</span>}
                            </button>
                            {n.status === 'reservado' && (
                              <button
                                onClick={e => { e.stopPropagation(); setCancelarNumero(n); }}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-100 text-red-600 rounded p-0.5"
                              >
                                <Undo2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>
            
            <TabsContent value="vendas">
               <p className="text-sm text-muted-foreground text-center py-6">Consulte a listagem de vendas validadas aqui.</p>
            </TabsContent>
            <TabsContent value="encerradas">
               <p className="text-sm text-muted-foreground text-center py-6">Consulte o histórico de sorteios encerrados.</p>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="bingo" className="space-y-4 mt-0">
          <div className="card-container bg-gradient-to-br from-purple-500/10 to-primary/10 border-purple-500/20">
            <h2 className="font-heading text-lg font-bold text-purple-900 dark:text-purple-300 flex items-center gap-2 mb-2">
              <Grid3X3 className="w-5 h-5" /> Venda de Bingo Físico
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Gere folhas impressas com múltiplas cartelas ({gameSettings?.cartelas_por_folha_bingo || 4} grids por folha) 
              para partidas manuais. Seu desconto de vendedor será aplicado!
            </p>
            
            <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold" onClick={() => setComprarBingoOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Gerar Folhas para Venda
            </Button>
          </div>

          <div className="card-container p-0 overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
              <h3 className="font-heading font-bold">Folhas Emitidas Recentes</h3>
            </div>
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {folhasEmitidas.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  <Printer className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhuma folha de bingo gerada ainda.
                </div>
              ) : (
                folhasEmitidas.map(folha => (
                  <div key={folha.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-bold text-sm">{folha.partidas?.name || 'Partida'}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded border">Cod: {folha.codigo_validacao}</span>
                        <span>{format(new Date(folha.created_at), "dd/MM/yy HH:mm")}</span>
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
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
              <span className="text-xs text-muted-foreground uppercase font-bold">Seu Saldo</span>
              <span className="text-lg font-bold font-heading">{Number(profile?.credits || 0).toFixed(2)} cr.</span>
            </div>

            <div className="space-y-2">
              <Label>Selecione a Partida Manual</Label>
              {manualMatches.length === 0 ? (
                <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-lg">
                  Não há partidas manuais abertas no momento.
                </div>
              ) : (
                <Select value={selectedBingoMatch} onValueChange={setSelectedBingoMatch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma partida..." />
                  </SelectTrigger>
                  <SelectContent>
                    {manualMatches.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} — Ingresso: R$ {Number(m.card_price).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedBingoMatch && (
              <div className="space-y-2">
                <Label>Quantidade de Folhas Físicas (Ingressos)</Label>
                <Input 
                  type="number" 
                  min="1" 
                  value={qtdFolhasBingo} 
                  onChange={e => setQtdFolhasBingo(parseInt(e.target.value) || 1)} 
                />
                <p className="text-[10px] text-muted-foreground">
                  Cada folha gerada conterá <strong>{gameSettings?.cartelas_por_folha_bingo || 4} grids 5x5</strong>.
                </p>
              </div>
            )}

            {selectedBingoMatch && qtdFolhasBingo > 0 && (() => {
              const match = manualMatches.find(m => m.id === selectedBingoMatch);
              const desconto = meuVendedor?.percentual_desconto || 0;
              const precoBase = (match?.card_price || 0) * qtdFolhasBingo;
              const totalComDesconto = precoBase * (1 - desconto / 100);

              return (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor Bruto:</span>
                    <span>R$ {precoBase.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Seu Desconto ({desconto}%):</span>
                    <span className="text-green-600">- R$ {(precoBase - totalComDesconto).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-purple-200/50 mt-1">
                    <span>Você Paga:</span>
                    <span className="text-purple-700 dark:text-purple-400">R$ {totalComDesconto.toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setComprarBingoOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={isGerandoFolhas || !selectedBingoMatch || qtdFolhasBingo < 1}
              onClick={handleGerarFolhasBingo}
            >
              {isGerandoFolhas ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
              Gerar {qtdFolhasBingo} Folha(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OUTROS MODAIS EXISTENTES (Validar e Cancelar Reserva) */}
      <Dialog open={validarOpen} onOpenChange={setValidarOpen}>
        {/* ... (mantido igual) ... */}
      </Dialog>

      <Dialog open={!!cancelarNumero} onOpenChange={open => { if (!open) setCancelarNumero(null); }}>
        {/* ... (mantido igual) ... */}
      </Dialog>

    </div>
  );
};

export default VendedorPainel;