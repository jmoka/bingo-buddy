import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVendedor } from '@/hooks/useVendedor';
import { useRifas } from '@/hooks/useRifas';
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
  const { meuVendedor, minhasReservas, minhasVendas, isLoading, reservarNumeros, cancelarReserva, validarVenda, gerarLink } = useVendedor();
  const { rifas, getNumerosRifa } = useRifas();

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

  const totalComissao = useMemo(() => {
    return minhasVendas.reduce((acc, v) => acc + Number(v.valor_total || 0), 0);
  }, [minhasVendas]);

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
          { key: 'todas', label: 'Total', value: minhasReservas.length, color: 'text-primary', bg: 'bg-primary/10 border-primary/30' },
          { key: 'ativa', label: 'Ativas', value: minhasReservas.filter(n => n.rifas?.status === 'ativa').length, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-700/30' },
          { key: 'finalizada', label: 'Finalizadas', value: minhasReservas.filter(n => n.rifas?.status === 'finalizada').length, color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200 dark:bg-gray-800/30 dark:border-gray-700/30' },
        ] as const).map(({ key, label, value, color, bg }) => (
          <button
            key={key}
            onClick={() => setFiltroStatus(key)}
            className={`card-container p-3 text-center transition-all border-2 ${filtroStatus === key ? `${bg} ring-2 ring-offset-1 ring-primary/40` : 'border-transparent'}`}
          >
            <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
            <p className={`text-2xl font-bold font-heading ${color}`}>{value}</p>
          </button>
        ))}
      </div>

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

      <Tabs defaultValue="reservas">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="reservas" className="flex items-center gap-1.5">
            <Ticket className="w-4 h-4" /> Reservas
            {minhasReservas.filter(r => r.status === 'reservado').length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {minhasReservas.filter(r => r.status === 'reservado').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="vendas" className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> Vendas
            {minhasReservas.filter(r => r.status === 'vendido').length > 0 && (
              <span className="ml-1 bg-green-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {minhasReservas.filter(r => r.status === 'vendido').length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reservas" className="space-y-4 mt-4">
          <Button className="w-full gradient-primary" onClick={() => setReservarOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova Reserva de Números
          </Button>
          {Object.keys(reservasPorRifa).length === 0 ? (
            <div className="card-container text-center py-10 text-muted-foreground text-sm">
              <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhuma reserva ainda.
            </div>
          ) : (() => {
            const ativas = Object.entries(reservasPorRifa).filter(([, nums]) => nums[0]?.rifas?.status === 'ativa');
            const finalizadas = Object.entries(reservasPorRifa).filter(([, nums]) => nums[0]?.rifas?.status !== 'ativa');
            const renderGrupo = (entries: typeof ativas) => entries.map(([rifaId, numeros]) => {
              const rifa = numeros[0]?.rifas;
              const finalizada = rifa?.status === 'finalizada';
              return (
                <div key={rifaId} className={`card-container space-y-3 ${finalizada ? 'border-gray-300 opacity-90' : ''}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading font-bold text-sm">{rifa?.nome ?? 'Rifa'}</h4>
                    <div className="flex items-center gap-2">
                      {!finalizada && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/vendedor/imprimir/${rifaId}`)}>
                          <Printer className="w-3 h-3 mr-1" /> Imprimir
                        </Button>
                      )}
                      <Badge variant={finalizada ? 'secondary' : 'default'} className="text-[10px]">
                        {finalizada ? 'finalizada' : 'ativa'}
                      </Badge>
                    </div>
                  </div>
                  {finalizada && numeros.some(n => n.status === 'reservado') && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <span className="text-xs font-bold text-red-600">Rifa encerrada — números reservados não foram pagos a tempo.</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {numeros.map(n => (
                      <div key={n.id} className="relative group">
                        <button
                          onClick={() => n.status === 'reservado' && !finalizada && openValidar(n)}
                          className={`w-full rounded-lg p-2 flex flex-col items-center justify-center gap-0.5 transition-colors min-h-[64px] ${
                            n.status === 'vendido'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/20 cursor-default'
                              : finalizada
                                ? 'bg-gray-100 text-gray-400 cursor-default'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 hover:bg-amber-200 dark:hover:bg-amber-900/40 cursor-pointer'
                          }`}
                          title={n.status === 'vendido' ? (n.nome_comprador || 'Vendido') : finalizada ? 'Rifa encerrada' : 'Clique para validar venda'}
                        >
                          <span className="text-base font-bold font-heading leading-none">{n.numero}</span>
                          {(n as any).cartelas_rifa?.[0]?.codigo_validacao && (
                            <span className="text-[8px] font-mono opacity-60 leading-none tracking-tight">
                              {(n as any).cartelas_rifa[0].codigo_validacao}
                            </span>
                          )}
                          {n.status === 'vendido' ? (
                            <>
                              <CheckSquare className="w-3 h-3 mt-0.5" />
                              {n.nome_comprador && (
                                <span className="text-[9px] leading-tight text-center line-clamp-2 max-w-full">{n.nome_comprador}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-[9px] leading-none opacity-60">{finalizada ? 'expirado' : 'pendente'}</span>
                          )}
                        </button>
                        {n.status === 'reservado' && !finalizada && (
                          <button
                            onClick={e => { e.stopPropagation(); setCancelarNumero(n); }}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-100 hover:bg-red-200 text-red-600 rounded p-0.5"
                            title="Cancelar reserva"
                          >
                            <Undo2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {numeros.filter(n => n.status === 'reservado').length} pendente(s) · {numeros.filter(n => n.status === 'vendido').length} validado(s)
                    {rifa?.custo_por_numero && ` · R$ ${Number(rifa.custo_por_numero).toFixed(2)} cada`}
                  </p>
                </div>
              );
            });
            return (
              <>
                {ativas.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Rifas Ativas</p>
                    {renderGrupo(ativas)}
                  </div>
                )}
                {finalizadas.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Rifas Finalizadas</p>
                    {renderGrupo(finalizadas)}
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>

        <TabsContent value="vendas" className="space-y-3 mt-4">
          {(() => {
            const vendidos = minhasReservas.filter(n => n.status === 'vendido' && (filtroStatus === 'todas' || n.rifas?.status === filtroStatus));
            const porRifa: Record<string, typeof vendidos> = {};
            for (const n of vendidos) {
              if (!porRifa[n.rifa_id]) porRifa[n.rifa_id] = [];
              porRifa[n.rifa_id].push(n);
            }
            const totalVendido = vendidos.reduce((acc, n) => acc + Number(n.rifas?.custo_por_numero || 0), 0);
            const ativas = Object.entries(porRifa).filter(([, nums]) => nums[0]?.rifas?.status === 'ativa');
            const finalizadas = Object.entries(porRifa).filter(([, nums]) => nums[0]?.rifas?.status !== 'ativa');

            const renderGrupoVendas = (entries: typeof ativas) => entries.map(([rifaId, nums]) => {
              const rifa = nums[0]?.rifas;
              const finalizada = rifa?.status === 'finalizada';
              return (
                <div key={rifaId} className={`card-container space-y-3 ${finalizada ? 'border-gray-300' : ''}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading font-bold text-sm">{rifa?.nome ?? 'Rifa'}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600 font-bold">
                        {nums.length} vendido(s) · R$ {(nums.length * Number(rifa?.custo_por_numero || 0)).toFixed(2)}
                      </span>
                      <Badge variant={finalizada ? 'secondary' : 'default'} className="text-[10px]">
                        {finalizada ? 'finalizada' : 'ativa'}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {nums.map(n => (
                      <div key={n.id} className="rounded-lg p-2 flex flex-col items-center justify-center gap-0.5 min-h-[64px] bg-green-100 text-green-700 dark:bg-green-900/20">
                        <span className="text-base font-bold font-heading leading-none">{n.numero}</span>
                        {(n as any).cartelas_rifa?.[0]?.codigo_validacao && (
                          <span className="text-[8px] font-mono opacity-60 leading-none tracking-tight">
                            {(n as any).cartelas_rifa[0].codigo_validacao}
                          </span>
                        )}
                        <CheckSquare className="w-3 h-3 mt-0.5" />
                        {n.nome_comprador && (
                          <span className="text-[9px] leading-tight text-center line-clamp-2 max-w-full">{n.nome_comprador}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            });

            return (
              <>
                <div className="card-container p-3 bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-700/30">
                  <p className="text-xs text-muted-foreground">Total em números vendidos</p>
                  <p className="text-xl font-bold font-heading text-green-700 dark:text-green-400">
                    {vendidos.length} número(s) · R$ {totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {vendidos.length === 0 ? (
                  <div className="card-container text-center py-10 text-muted-foreground text-sm">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Nenhuma venda registrada ainda.
                  </div>
                ) : (
                  <>
                    {ativas.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Rifas Ativas</p>
                        {renderGrupoVendas(ativas)}
                      </div>
                    )}
                    {finalizadas.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Rifas Finalizadas</p>
                        {renderGrupoVendas(finalizadas)}
                      </div>
                    )}
                  </>
                )}
              </>
            );
          })()}
        </TabsContent>
      </Tabs>

      <Dialog open={reservarOpen} onOpenChange={open => { setReservarOpen(open); if (!open) { setReservarRifaId(''); setReservarSelecionados([]); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reservar Números para Venda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-xs text-muted-foreground">Seus créditos</span>
              <span className="text-base font-bold font-heading">{Number(profile?.credits ?? 0).toFixed(2)} cr</span>
            </div>

            <div>
              <Label>Rifa</Label>
              <Select value={reservarRifaId} onValueChange={v => { setReservarRifaId(v); setReservarSelecionados([]); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione uma rifa ativa..." />
                </SelectTrigger>
                <SelectContent>
                  {rifasAtivas.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reservarRifaId && (
              <div>
                <Label className="mb-2 block">Números disponíveis — clique para selecionar</Label>
                <div className="grid grid-cols-8 gap-1 max-h-52 overflow-y-auto border rounded-lg p-2">
                  {numerosDisponiveis.map(n => (
                    <button
                      key={n.id}
                      disabled={n.status !== 'disponivel'}
                      onClick={() => n.status === 'disponivel' && toggleReservar(n.numero)}
                      className={`aspect-square rounded text-[11px] font-bold transition-colors ${
                        n.status !== 'disponivel'
                          ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-40'
                          : reservarSelecionados.includes(n.numero)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      {n.numero}
                    </button>
                  ))}
                </div>
                {(() => {
                  const rifa = rifas.find(r => r.id === reservarRifaId);
                  const desconto = meuVendedor?.percentual_desconto ?? 0;
                  const total = rifa ? reservarSelecionados.length * rifa.custo_por_numero * (1 - desconto / 100) : 0;
                  const saldoRestante = Number(profile?.credits ?? 0) - total;
                  return (
                    <div className="mt-2 space-y-1">
                      {reservarSelecionados.length > 0 && (
                        <div className="flex items-center justify-between p-2 bg-primary/5 border border-primary/20 rounded-lg">
                          <div className="text-xs space-y-0.5">
                            <p className="font-medium">
                              {reservarSelecionados.length} número(s){desconto > 0 ? ` · ${desconto}% desc.` : ''}
                            </p>
                            <p className={`text-[10px] ${saldoRestante < 0 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                              Saldo após: {saldoRestante.toFixed(2)} cr
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold font-heading text-primary">R$ {total.toFixed(2)}</p>
                            <button
                              onClick={() => setReservarSelecionados([])}
                              className="text-destructive hover:underline text-[10px] font-medium"
                            >
                              Limpar seleção
                            </button>
                          </div>
                        </div>
                      )}
                      {reservarSelecionados.length === 0 && (
                        <p className="text-xs text-muted-foreground">{numerosDisponiveis.filter(n => n.status === 'disponivel').length} disponível(is)</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReservarOpen(false)}>Cancelar</Button>
            <Button
              className="gradient-primary"
              onClick={handleReservar}
              disabled={isReservando || reservarSelecionados.length === 0}
            >
              {isReservando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ticket className="w-4 h-4 mr-2" />}
              Reservar {reservarSelecionados.length > 0 ? `(${reservarSelecionados.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={validarOpen} onOpenChange={setValidarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Validar Venda — Nº {validarNumero?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="val-nome">Nome do Comprador *</Label>
              <Input
                id="val-nome"
                value={validarForm.nome}
                onChange={e => setValidarForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label htmlFor="val-tel">Telefone</Label>
              <Input
                id="val-tel"
                value={validarForm.telefone}
                onChange={e => setValidarForm(f => ({ ...f, telefone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label htmlFor="val-end">Endereço</Label>
              <Input
                id="val-end"
                value={validarForm.endereco}
                onChange={e => setValidarForm(f => ({ ...f, endereco: e.target.value }))}
                placeholder="Endereço completo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setValidarOpen(false)}>Cancelar</Button>
            <Button
              className="gradient-primary"
              onClick={handleValidar}
              disabled={isValidando || !validarForm.nome.trim()}
            >
              {isValidando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelarNumero} onOpenChange={open => { if (!open) setCancelarNumero(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Reserva — Nº {cancelarNumero?.numero}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja cancelar a reserva do número <span className="font-bold text-foreground">{cancelarNumero?.numero}</span>?
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              O número voltará a ficar disponível e os créditos pagos serão estornados automaticamente.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelarNumero(null)}>Manter</Button>
            <Button
              variant="destructive"
              disabled={isCancelando}
              onClick={async () => {
                if (!cancelarNumero) return;
                setIsCancelando(true);
                await cancelarReserva(cancelarNumero.id);
                setIsCancelando(false);
                setCancelarNumero(null);
              }}
            >
              {isCancelando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cancelar Reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendedorPainel;
