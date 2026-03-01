import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRifaAdmin } from '@/hooks/useRifaAdmin';
import { useRifas } from '@/hooks/useRifas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trophy, Users, DollarSign, Hash, Loader2, CheckCircle, XCircle, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NumeroRifa, CompraRifa, Rifa } from '@/types/rifa';

type FiltroNumeros = 'todos' | 'disponivel' | 'vendido' | 'reservado';

const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  ativa: { label: 'Ativa', badgeClass: 'bg-green-500/10 text-green-600 border-green-500/20' },
  finalizada: { label: 'Finalizada', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  cancelada: { label: 'Cancelada', badgeClass: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const numeroBadgeClass: Record<string, string> = {
  disponivel: 'bg-muted text-muted-foreground border border-border hover:bg-muted/70',
  vendido: 'bg-green-500/15 text-green-700 border border-green-500/30',
  reservado: 'bg-amber-500/15 text-amber-700 border border-amber-500/30',
};

const RifaDetalheAdmin = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { todasRifas, todasCompras, getNumerosRifaAdmin, finalizarRifa, cancelarRifa, atualizarRifa, deletarRifa } = useRifaAdmin();
  useRifas();

  const rifa = todasRifas.find(r => r.id === id);

  const [numeros, setNumeros] = useState<NumeroRifa[]>([]);
  const [loadingNumeros, setLoadingNumeros] = useState(false);
  const [filtroNumeros, setFiltroNumeros] = useState<FiltroNumeros>('todos');

  const [numeroGanhador, setNumeroGanhador] = useState('');
  const [confirmFinalizarOpen, setConfirmFinalizarOpen] = useState(false);
  const [confirmCancelarOpen, setConfirmCancelarOpen] = useState(false);
  const [confirmDeletarOpen, setConfirmDeletarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [deletando, setDeletando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [editForm, setEditForm] = useState<Partial<Rifa>>({});

  useEffect(() => {
    if (rifa) {
      setEditForm({
        nome: rifa.nome,
        descricao: rifa.descricao ?? '',
        regulamento: rifa.regulamento ?? '',
        premio_descricao: rifa.premio_descricao ?? '',
        premio_foto: rifa.premio_foto ?? '',
        foto_capa: rifa.foto_capa ?? '',
        custo_por_numero: rifa.custo_por_numero,
        data_encerramento: rifa.data_encerramento
          ? rifa.data_encerramento.slice(0, 16)
          : '',
      });
    }
  }, [rifa?.id]);

  useEffect(() => {
    if (!id) return;
    setLoadingNumeros(true);
    getNumerosRifaAdmin(id).then(data => {
      setNumeros(data);
      setLoadingNumeros(false);
    });
  }, [id]);

  if (!rifa) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const comprasRifa = todasCompras.filter(c => c.rifa_id === id);
  const vendidos = numeros.filter(n => n.status === 'vendido').length;
  const reservados = numeros.filter(n => n.status === 'reservado').length;
  const disponiveis = numeros.filter(n => n.status === 'disponivel').length;
  const total = rifa.quantidade_numeros;
  const receitaTotal = vendidos * rifa.custo_por_numero;
  const percentualVendido = total > 0 ? Math.round((vendidos / total) * 100) : 0;

  const numerosFiltrados =
    filtroNumeros === 'todos' ? numeros : numeros.filter(n => n.status === filtroNumeros);

  const cfg = statusConfig[rifa.status] ?? statusConfig.cancelada;

  const handleFinalizar = async () => {
    if (!id) return;
    const num = parseInt(numeroGanhador, 10);
    if (isNaN(num)) return;
    setFinalizando(true);
    await finalizarRifa(id, num);
    setFinalizando(false);
    setConfirmFinalizarOpen(false);
  };

  const handleCancelar = async () => {
    if (!id) return;
    setCancelando(true);
    await cancelarRifa(id);
    setCancelando(false);
    setConfirmCancelarOpen(false);
  };

  const handleDeletar = async () => {
    if (!id) return;
    setDeletando(true);
    const ok = await deletarRifa(id);
    setDeletando(false);
    if (ok) navigate('/admin/rifas');
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSalvando(true);
    const payload: Partial<Rifa> = {
      nome: editForm.nome,
      descricao: editForm.descricao || null,
      regulamento: editForm.regulamento || null,
      premio_descricao: editForm.premio_descricao || null,
      premio_foto: editForm.premio_foto || null,
      foto_capa: editForm.foto_capa || null,
      custo_por_numero: Number(editForm.custo_por_numero),
      data_encerramento: editForm.data_encerramento || null,
    };
    const ok = await atualizarRifa(id, payload);
    setSalvando(false);
    if (ok) setEditarOpen(false);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/rifas')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col min-w-0">
            <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground truncate">
              {rifa.nome}
            </h1>
          </div>
          <Badge variant="outline" className={cfg.badgeClass}>
            {cfg.label}
          </Badge>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setEditarOpen(true)}>
            <Pencil className="w-4 h-4 mr-1.5" /> Editar
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setConfirmDeletarOpen(true)}>
            <Trash2 className="w-4 h-4 mr-1.5" /> Deletar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card-container p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
            <Hash className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Total</span>
          </div>
          <p className="text-2xl font-bold font-heading">{total}</p>
        </div>
        <div className="card-container p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-xs font-semibold uppercase tracking-wide">Vendidos</span>
          </div>
          <p className="text-2xl font-bold font-heading text-green-600">{vendidos}</p>
        </div>
        <div className="card-container p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Disponíveis</span>
          </div>
          <p className="text-2xl font-bold font-heading">{disponiveis}</p>
        </div>
        <div className="card-container p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide">Receita</span>
          </div>
          <p className="text-2xl font-bold font-heading text-primary">
            R${receitaTotal.toFixed(2).replace('.', ',')}
          </p>
        </div>
      </div>

      <div className="card-container p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-muted-foreground">Progresso de Vendas</span>
          <span className="text-sm font-bold">{percentualVendido}%</span>
        </div>
        <Progress value={percentualVendido} className="h-3" />
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{vendidos} vendidos</span>
          <span>{reservados} reservados</span>
          <span>{disponiveis} disponíveis</span>
        </div>
      </div>

      <Tabs defaultValue="numeros" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 h-12">
          <TabsTrigger value="numeros">Números</TabsTrigger>
          <TabsTrigger value="compras">
            Compras
            {comprasRifa.length > 0 && (
              <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {comprasRifa.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="finalizar">Finalizar</TabsTrigger>
        </TabsList>

        <TabsContent value="numeros">
          <div className="card-container p-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {(['todos', 'disponivel', 'vendido', 'reservado'] as FiltroNumeros[]).map(f => (
                <Button
                  key={f}
                  size="sm"
                  variant={filtroNumeros === f ? 'default' : 'outline'}
                  onClick={() => setFiltroNumeros(f)}
                  className="capitalize"
                >
                  {f === 'todos'
                    ? 'Todos'
                    : f === 'disponivel'
                    ? 'Disponíveis'
                    : f === 'vendido'
                    ? 'Vendidos'
                    : 'Reservados'}
                </Button>
              ))}
            </div>

            {loadingNumeros ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5 mb-4">
                  {numerosFiltrados.map(n => (
                    <span
                      key={n.id}
                      className={`flex items-center justify-center rounded-md text-xs font-bold py-1.5 px-1 select-none ${numeroBadgeClass[n.status] ?? numeroBadgeClass.disponivel}`}
                    >
                      {n.numero}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {numerosFiltrados.length} número(s) exibido(s)
                </p>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="compras">
          <div className="space-y-3">
            {comprasRifa.length === 0 ? (
              <div className="card-container p-10 text-center">
                <XCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma compra registrada.</p>
              </div>
            ) : (
              comprasRifa.map(compra => (
                <CompraCard key={compra.id} compra={compra} custo={rifa.custo_por_numero} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="finalizar">
          {rifa.status === 'ativa' && (
            <div className="space-y-4">
              <div className="card-container p-5 border-amber-500/30 bg-amber-500/5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-700">Atenção</p>
                    <p className="text-sm text-amber-600/80 mt-0.5">
                      Esta ação é irreversível. Ao finalizar a rifa, o número ganhador será
                      registrado e a rifa será encerrada permanentemente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="card-container p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="numero_ganhador">Número Ganhador</Label>
                  <Input
                    id="numero_ganhador"
                    type="number"
                    placeholder="Digite o número sorteado"
                    value={numeroGanhador}
                    onChange={e => setNumeroGanhador(e.target.value)}
                    min={rifa.numero_inicial}
                    max={rifa.numero_inicial + rifa.quantidade_numeros - 1}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!numeroGanhador || finalizando}
                  onClick={() => setConfirmFinalizarOpen(true)}
                >
                  {finalizando ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trophy className="w-4 h-4 mr-2" />
                  )}
                  Finalizar Rifa
                </Button>
              </div>

              <div className="card-container p-5">
                <p className="text-sm font-semibold text-destructive mb-3">Zona de Perigo</p>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={cancelando}
                  onClick={() => setConfirmCancelarOpen(true)}
                >
                  {cancelando ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Cancelar Rifa
                </Button>
              </div>
            </div>
          )}

          {rifa.status === 'finalizada' && (
            <div className="card-container p-8 text-center bg-green-500/5 border-green-500/20">
              <Trophy className="w-14 h-14 text-green-500 mx-auto mb-4" />
              <h2 className="font-heading text-xl font-bold text-green-700 mb-2">
                Rifa Finalizada!
              </h2>
              {rifa.numero_ganhador !== null && (
                <div className="inline-flex flex-col items-center gap-1 mt-2 bg-green-500/10 rounded-xl px-6 py-3 border border-green-500/20">
                  <span className="text-xs uppercase tracking-wide font-semibold text-green-600/70">
                    Número Ganhador
                  </span>
                  <span className="text-4xl font-bold font-heading text-green-700">
                    {rifa.numero_ganhador}
                  </span>
                </div>
              )}
              {rifa.ganhador_id && (
                <p className="text-sm text-muted-foreground mt-4">
                  ID do ganhador:{' '}
                  <span className="font-mono text-xs">{rifa.ganhador_id}</span>
                </p>
              )}
            </div>
          )}

          {rifa.status === 'cancelada' && (
            <div className="card-container p-8 text-center bg-muted/30">
              <XCircle className="w-14 h-14 text-muted-foreground/40 mx-auto mb-4" />
              <h2 className="font-heading text-xl font-bold text-muted-foreground mb-2">
                Rifa Cancelada
              </h2>
              <p className="text-sm text-muted-foreground">
                Esta rifa foi cancelada e não pode ser reativada.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={confirmFinalizarOpen} onOpenChange={setConfirmFinalizarOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Confirmar Finalização
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Você está prestes a finalizar a rifa{' '}
              <strong className="text-foreground">{rifa.nome}</strong> com o número ganhador:
            </p>
            <div className="flex items-center justify-center bg-primary/10 rounded-xl py-4 border border-primary/20">
              <span className="text-4xl font-bold font-heading text-primary">{numeroGanhador}</span>
            </div>
            <p className="text-xs text-destructive font-semibold text-center">
              Esta ação é irreversível.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmFinalizarOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleFinalizar} disabled={finalizando}>
              {finalizando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCancelarOpen} onOpenChange={setConfirmCancelarOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              Cancelar Rifa
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja cancelar a rifa{' '}
              <strong className="text-foreground">{rifa.nome}</strong>? Esta ação é irreversível.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmCancelarOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleCancelar} disabled={cancelando}>
              {cancelando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cancelar Rifa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeletarOpen} onOpenChange={setConfirmDeletarOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Deletar Rifa
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja <strong className="text-destructive">deletar permanentemente</strong> a rifa{' '}
              <strong className="text-foreground">{rifa.nome}</strong>? Todos os números e compras serão removidos.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDeletarOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleDeletar} disabled={deletando}>
              {deletando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Deletar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editarOpen} onOpenChange={setEditarOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Editar Rifa
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSalvarEdicao} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-nome">Nome *</Label>
              <Input
                id="edit-nome"
                required
                value={editForm.nome ?? ''}
                onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-descricao">Descrição</Label>
              <Textarea
                id="edit-descricao"
                rows={2}
                value={editForm.descricao ?? ''}
                onChange={e => setEditForm(p => ({ ...p, descricao: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-regulamento">Regulamento</Label>
              <Textarea
                id="edit-regulamento"
                rows={3}
                value={editForm.regulamento ?? ''}
                onChange={e => setEditForm(p => ({ ...p, regulamento: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-premio-desc">Descrição do Prêmio</Label>
              <Textarea
                id="edit-premio-desc"
                rows={2}
                value={editForm.premio_descricao ?? ''}
                onChange={e => setEditForm(p => ({ ...p, premio_descricao: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-premio-foto">URL da Foto do Prêmio</Label>
              <Input
                id="edit-premio-foto"
                value={editForm.premio_foto ?? ''}
                onChange={e => setEditForm(p => ({ ...p, premio_foto: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-foto-capa">URL da Foto de Capa</Label>
              <Input
                id="edit-foto-capa"
                value={editForm.foto_capa ?? ''}
                onChange={e => setEditForm(p => ({ ...p, foto_capa: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-custo">Custo por Número (R$)</Label>
              <Input
                id="edit-custo"
                type="number"
                step="0.01"
                min={0}
                value={editForm.custo_por_numero ?? ''}
                onChange={e => setEditForm(p => ({ ...p, custo_por_numero: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-encerramento">Data de Encerramento</Label>
              <Input
                id="edit-encerramento"
                type="datetime-local"
                value={editForm.data_encerramento ?? ''}
                onChange={e => setEditForm(p => ({ ...p, data_encerramento: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditarOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 gradient-primary" disabled={salvando}>
                {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

const CompraCard = ({ compra, custo }: { compra: CompraRifa; custo: number }) => {
  return (
    <div className="card-container p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-1 mb-2">
          {compra.numeros.map(n => (
            <span
              key={n}
              className="inline-flex items-center justify-center rounded-md bg-green-500/15 text-green-700 border border-green-500/30 text-xs font-bold px-1.5 py-0.5"
            >
              {n}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {format(new Date(compra.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="font-bold text-primary text-sm">
          R${Number(compra.valor_total).toFixed(2).replace('.', ',')}
        </span>
        <Badge variant="outline" className="text-[10px] capitalize">
          {compra.tipo_pagamento}
        </Badge>
      </div>
    </div>
  );
};

export default RifaDetalheAdmin;
