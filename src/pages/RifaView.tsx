import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRifas } from '@/hooks/useRifas';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Ticket,
  ArrowLeft,
  Calendar,
  DollarSign,
  Trophy,
  XCircle,
  ChevronDown,
  ChevronUp,
  Coins,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Rifa } from '@/types/rifa';
import { cn } from '@/lib/utils';

type NumberFilter = 'todos' | 'disponivel' | 'vendido';

const statusBadge = (status: Rifa['status']) => {
  if (status === 'ativa') return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">Ativa</Badge>;
  if (status === 'cancelada') return <Badge variant="secondary">Cancelada</Badge>;
  return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">Finalizada</Badge>;
};

const RifaView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { rifas, isLoadingRifas, getRifa, getNumerosRifa, comprarNumeros } = useRifas();

  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [filter, setFilter] = useState<NumberFilter>('todos');
  const [showRegulamento, setShowRegulamento] = useState(false);
  const [isBuying, setIsBuying] = useState(false);

  const rifa = id ? getRifa(id) : undefined;
  const numeros = id ? getNumerosRifa(id) : [];

  const stats = useMemo(() => {
    const total = rifa?.quantidade_numeros ?? 0;
    const sold = numeros.filter(n => n.status === 'vendido').length;
    const available = numeros.filter(n => n.status === 'disponivel').length;
    const percentage = total > 0 ? Math.round((sold / total) * 100) : 0;
    return { total, sold, available, percentage };
  }, [numeros, rifa]);

  const allNumbers = useMemo(() => {
    if (!rifa) return [];
    const start = rifa.numero_inicial;
    const end = start + rifa.quantidade_numeros - 1;
    const arr = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [rifa]);

  const filteredNumbers = useMemo(() => {
    if (filter === 'todos') return allNumbers;
    return allNumbers.filter(n => {
      const found = numeros.find(nr => nr.numero === n);
      const status = found?.status ?? 'disponivel';
      if (filter === 'disponivel') return status === 'disponivel';
      if (filter === 'vendido') return status === 'vendido' || status === 'reservado';
      return true;
    });
  }, [allNumbers, numeros, filter]);

  const toggleNumber = (num: number) => {
    const found = numeros.find(n => n.numero === num);
    if (found && found.status !== 'disponivel') return;
    setSelectedNumbers(prev =>
      prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
    );
  };

  const handleComprar = async () => {
    if (!id || selectedNumbers.length === 0) return;
    setIsBuying(true);
    const success = await comprarNumeros(id, selectedNumbers);
    if (success) setSelectedNumbers([]);
    setIsBuying(false);
  };

  const totalPrice = rifa ? selectedNumbers.length * rifa.custo_por_numero : 0;

  if (isLoadingRifas && !rifa) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!rifa) {
    return (
      <div className="card-container text-center py-20 space-y-4">
        <Ticket className="w-12 h-12 text-muted-foreground/40 mx-auto" />
        <p className="text-muted-foreground text-lg">Rifa não encontrada.</p>
        <Button variant="outline" onClick={() => navigate('/rifas')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar às Rifas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/rifas')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-xl font-bold truncate">{rifa.nome}</h1>
        </div>
        {statusBadge(rifa.status)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          {rifa.foto_capa ? (
            <img
              src={rifa.foto_capa}
              alt={rifa.nome}
              className="w-full max-h-64 object-cover rounded-lg"
            />
          ) : (
            <div className="w-full h-48 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
              <Ticket className="w-16 h-16 text-primary/50" />
            </div>
          )}

          <div className="card-container space-y-3">
            {rifa.descricao && (
              <p className="text-sm text-muted-foreground">{rifa.descricao}</p>
            )}

            {(rifa.premio_descricao || rifa.premio_foto) && (
              <div className="border rounded-lg p-3 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700/30 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" /> Prêmio
                </p>
                {rifa.premio_foto && (
                  <img
                    src={rifa.premio_foto}
                    alt="Foto do prêmio"
                    className="w-full max-h-40 object-cover rounded"
                  />
                )}
                {rifa.premio_descricao && (
                  <p className="text-sm text-amber-800 dark:text-amber-300">{rifa.premio_descricao}</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                {rifa.custo_por_numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / número
              </span>
              {rifa.data_encerramento && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  Encerra: {format(new Date(rifa.data_encerramento), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              )}
            </div>

            {rifa.regulamento && (
              <div>
                <button
                  className="flex items-center gap-1.5 text-sm font-medium text-primary"
                  onClick={() => setShowRegulamento(v => !v)}
                >
                  {showRegulamento ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Ver regulamento
                </button>
                {showRegulamento && (
                  <p className="mt-2 text-xs text-muted-foreground whitespace-pre-line border-t pt-2">
                    {rifa.regulamento}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{stats.sold} de {stats.total} números vendidos</span>
                <span>{stats.percentage}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${stats.percentage}%` }}
                />
              </div>
            </div>
          </div>

          {rifa.status === 'finalizada' && (
            <div className="card-container space-y-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold">
                <Trophy className="w-5 h-5" />
                Esta rifa foi encerrada
              </div>
              {rifa.numero_ganhador != null && (
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Número ganhador: <span className="font-bold text-lg">{rifa.numero_ganhador}</span>
                </p>
              )}
              {rifa.ganhador_id && (
                <p className="text-xs text-muted-foreground">ID do ganhador: {rifa.ganhador_id}</p>
              )}
            </div>
          )}

          {rifa.status === 'cancelada' && (
            <div className="card-container space-y-1 border-destructive/30 bg-destructive/5">
              <div className="flex items-center gap-2 text-destructive font-bold">
                <XCircle className="w-5 h-5" />
                Rifa cancelada
              </div>
              <p className="text-xs text-muted-foreground">Esta rifa foi cancelada e não aceita mais participações.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="card-container space-y-4">
            <h2 className="font-heading font-bold text-base">Selecione seus números</h2>

            <div className="flex gap-2">
              {(['todos', 'disponivel', 'vendido'] as NumberFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                    filter === f
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-transparent hover:border-primary/30'
                  )}
                >
                  {f === 'todos' ? 'Todos' : f === 'disponivel' ? 'Disponíveis' : 'Vendidos'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-8 sm:grid-cols-10 gap-1">
              {filteredNumbers.map(num => {
                const found = numeros.find(n => n.numero === num);
                const status = found?.status ?? 'disponivel';
                const isSelected = selectedNumbers.includes(num);

                if (status === 'vendido') {
                  return (
                    <button
                      key={num}
                      disabled
                      className="aspect-square rounded text-[10px] font-bold bg-red-100 text-red-500 dark:bg-red-900/20 cursor-not-allowed opacity-60"
                    >
                      {num}
                    </button>
                  );
                }

                if (status === 'reservado') {
                  return (
                    <button
                      key={num}
                      disabled
                      className="aspect-square rounded text-[10px] font-bold bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 cursor-not-allowed opacity-60"
                    >
                      {num}
                    </button>
                  );
                }

                return (
                  <button
                    key={num}
                    onClick={() => rifa.status === 'ativa' && toggleNumber(num)}
                    disabled={rifa.status !== 'ativa'}
                    className={cn(
                      'aspect-square rounded text-[10px] font-bold transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-primary/20',
                      rifa.status !== 'ativa' && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>

          {rifa.status === 'ativa' && (
            <div className="card-container space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedNumbers.length} número(s) selecionado(s)
                </span>
                <span className="text-sm font-bold">
                  Total: {totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({totalPrice} créditos)
                </span>
              </div>

              <Button
                className="w-full gradient-primary font-bold"
                disabled={selectedNumbers.length === 0 || isBuying}
                onClick={handleComprar}
              >
                {isBuying ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Ticket className="w-4 h-4 mr-2" />
                )}
                Comprar {selectedNumbers.length > 0 ? `${selectedNumbers.length} ` : ''}número{selectedNumbers.length !== 1 ? 's' : ''}
              </Button>

              {profile != null && (
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Coins className="w-3.5 h-3.5" />
                  Seus créditos: <span className="font-semibold text-foreground">{profile.credits}</span>
                </p>
              )}
            </div>
          )}

          {rifa.status !== 'ativa' && (
            <div className="card-container text-center py-6 text-muted-foreground text-sm">
              {rifa.status === 'finalizada'
                ? 'Esta rifa foi encerrada. Não é possível comprar números.'
                : 'Esta rifa foi cancelada. Não é possível comprar números.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RifaView;
