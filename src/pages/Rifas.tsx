import { useNavigate } from 'react-router-dom';
import { useRifas } from '@/hooks/useRifas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Ticket, Calendar, DollarSign, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Rifa } from '@/types/rifa';

const statusBadge = (status: Rifa['status']) => {
  if (status === 'ativa') return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">Ativa</Badge>;
  if (status === 'cancelada') return <Badge variant="secondary">Cancelada</Badge>;
  return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">Finalizada</Badge>;
};

const Rifas = () => {
  const navigate = useNavigate();
  const { rifas, isLoadingRifas } = useRifas();

  const activeRifas = rifas.filter(r => r.status === 'ativa');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Ticket className="w-6 h-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold">Rifas</h1>
        </div>
      </div>

      {isLoadingRifas && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      )}

      {!isLoadingRifas && activeRifas.length === 0 && (
        <div className="card-container flex flex-col items-center justify-center py-16 gap-4 text-center">
          <Ticket className="w-12 h-12 text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium">Nenhuma rifa ativa no momento</p>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Lobby
          </Button>
        </div>
      )}

      {!isLoadingRifas && activeRifas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeRifas.map(rifa => (
            <div
              key={rifa.id}
              className="card-container p-0 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/rifas/${rifa.id}`)}
            >
              {rifa.foto_capa ? (
                <img
                  src={rifa.foto_capa}
                  alt={rifa.nome}
                  className="w-full h-40 object-cover rounded-t-lg"
                />
              ) : (
                <div className="w-full h-40 rounded-t-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                  <Ticket className="w-14 h-14 text-primary/50" />
                </div>
              )}

              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold text-lg leading-tight">{rifa.nome}</h2>
                  {statusBadge(rifa.status)}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    {rifa.custo_por_numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / número
                  </span>
                  <span className="flex items-center gap-1">
                    <Ticket className="w-3.5 h-3.5" />
                    {rifa.quantidade_numeros} números
                  </span>
                  {rifa.data_encerramento && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Encerra: {format(new Date(rifa.data_encerramento), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                  )}
                </div>

                {rifa.descricao && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{rifa.descricao}</p>
                )}

                <Button size="sm" className="w-full mt-2 gradient-primary font-bold" onClick={e => { e.stopPropagation(); navigate(`/rifas/${rifa.id}`); }}>
                  Ver Números
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Rifas;
