import { useNavigate } from 'react-router-dom';
import { useRifas } from '@/hooks/useRifas';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Ticket, Calendar, DollarSign, ArrowLeft, Trophy, Crown } from 'lucide-react';
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
  const { profile } = useAuth();
  const { rifas, isLoadingRifas } = useRifas();

  const activeRifas = rifas.filter(r => r.status === 'ativa');
  const finishedRifas = rifas.filter(r => r.status === 'finalizada');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Ticket className="w-6 h-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold">Rifas e Sorteios</h1>
        </div>
      </div>

      {isLoadingRifas ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="ativas" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-6">
            <TabsTrigger value="ativas" className="font-semibold tracking-wide">Abertas</TabsTrigger>
            <TabsTrigger value="finalizadas" className="font-semibold tracking-wide">Encerradas</TabsTrigger>
          </TabsList>

          <TabsContent value="ativas" className="mt-0">
            {activeRifas.length === 0 ? (
              <div className="card-container flex flex-col items-center justify-center py-16 gap-4 text-center">
                <Ticket className="w-12 h-12 text-muted-foreground/40" />
                <p className="text-muted-foreground font-medium">Nenhuma rifa ativa no momento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {activeRifas.map(rifa => (
                  <div
                    key={rifa.id}
                    className="card-container p-0 overflow-hidden cursor-pointer hover:-translate-y-1 transition-transform border-2 border-transparent hover:border-primary/30 shadow-md"
                    onClick={() => navigate(`/rifas/${rifa.id}`)}
                  >
                    {rifa.foto_capa ? (
                      <img
                        src={rifa.foto_capa}
                        alt={rifa.nome}
                        className="w-full h-44 object-cover"
                      />
                    ) : (
                      <div className="w-full h-44 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <Ticket className="w-14 h-14 text-primary/40" />
                      </div>
                    )}

                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-bold text-lg leading-tight line-clamp-2">{rifa.nome}</h2>
                        {statusBadge(rifa.status)}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <DollarSign className="w-3.5 h-3.5 text-green-600" />
                          R$ {Number(rifa.custo_por_numero).toFixed(2)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Ticket className="w-3.5 h-3.5" />
                          {rifa.quantidade_numeros} cotas
                        </span>
                        {rifa.data_encerramento && (
                          <span className="flex items-center gap-1 w-full mt-1">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            Sorteio: {format(new Date(rifa.data_encerramento), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        )}
                      </div>

                      {rifa.descricao && (
                        <p className="text-sm text-muted-foreground line-clamp-2 pt-1 border-t">{rifa.descricao}</p>
                      )}

                      <Button className="w-full mt-2 gradient-primary font-bold shadow-button" onClick={e => { e.stopPropagation(); navigate(`/rifas/${rifa.id}`); }}>
                        Garantir meus números
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="finalizadas" className="mt-0">
            {finishedRifas.length === 0 ? (
              <div className="card-container flex flex-col items-center justify-center py-16 gap-4 text-center">
                <Trophy className="w-12 h-12 text-muted-foreground/40" />
                <p className="text-muted-foreground font-medium">Nenhum sorteio foi finalizado ainda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {finishedRifas.map(rifa => {
                  const didIWin = profile && rifa.ganhador_id === profile.id;
                  
                  return (
                    <div
                      key={rifa.id}
                      className={`card-container p-0 overflow-hidden cursor-pointer transition-transform hover:-translate-y-1 shadow-md border-2 ${didIWin ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10' : 'border-border'}`}
                      onClick={() => navigate(`/rifas/${rifa.id}`)}
                    >
                      <div className="flex flex-col sm:flex-row h-full">
                        {/* Imagem */}
                        <div className="sm:w-2/5 h-40 sm:h-auto relative shrink-0">
                          {rifa.foto_capa ? (
                            <img src={rifa.foto_capa} alt={rifa.nome} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <Trophy className="w-10 h-10 text-muted-foreground/30" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent sm:hidden" />
                        </div>
                        
                        {/* Conteúdo */}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="font-bold text-base leading-tight mb-2">{rifa.nome}</h3>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                              <Calendar className="w-3 h-3" />
                              Encerrada em: {rifa.data_encerramento ? format(new Date(rifa.data_encerramento), 'dd/MM/yyyy') : '—'}
                            </p>
                          </div>
                          
                          <div className="mt-auto">
                            {didIWin ? (
                              <div className="bg-green-500 text-white rounded-xl p-3 flex items-center justify-between shadow-sm animate-pulse">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">VOCÊ GANHOU!</p>
                                  <p className="text-xl font-heading font-bold mt-0.5">Nº {rifa.numero_ganhador}</p>
                                </div>
                                <Crown className="w-8 h-8 opacity-80" />
                              </div>
                            ) : (
                              <div className="bg-muted rounded-xl p-3 flex items-center justify-between border">
                                <div>
                                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Sorteado</p>
                                  <p className="text-xl font-heading font-bold text-foreground mt-0.5">Nº {rifa.numero_ganhador ?? '—'}</p>
                                </div>
                                <Trophy className="w-6 h-6 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Rifas;