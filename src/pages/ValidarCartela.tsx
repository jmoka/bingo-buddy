import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Search, CheckCircle, XCircle, Ticket, Loader2, Hash, AlertTriangle, Grid3X3, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { checkWin } from '@/utils/bingoUtils';
import { BingoCard } from '@/types/bingo';

export default function ValidarCartela() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlCodigoRifa = searchParams.get('codigo');
  const urlCodigoBingo = searchParams.get('bingo');

  const [rifasAbertas, setRifasAbertas] = useState<{ id: string; nome: string }[]>([]);

  const [codigoCartela, setCodigoCartela] = useState(urlCodigoRifa || '');
  const [loadingCartela, setLoadingCartela] = useState(false);
  const [resultadoCartela, setResultadoCartela] = useState<any | null>(null);
  const [buscadoCartela, setBuscadoCartela] = useState(false);

  const [numeroRifa, setNumeroRifa] = useState('');
  const [rifaIdSelecionada, setRifaIdSelecionada] = useState('');
  const [loadingRifa, setLoadingRifa] = useState(false);
  const [resultadoRifa, setResultadoRifa] = useState<any | null>(null);
  const [buscadoRifa, setBuscadoRifa] = useState(false);

  const [codigoBingo, setCodigoBingo] = useState(urlCodigoBingo || '');
  const [loadingBingo, setLoadingBingo] = useState(false);
  const [resultadoBingo, setResultadoBingo] = useState<any | null>(null);
  const [buscadoBingo, setBuscadoBingo] = useState(false);

  useEffect(() => {
    supabase.from('rifas').select('id, nome').eq('status', 'ativa').order('nome').then(({ data }) => {
      if (data) setRifasAbertas(data);
    });
  }, []);

  useEffect(() => {
    if (urlCodigoRifa) buscarCartela(urlCodigoRifa);
    if (urlCodigoBingo) buscarBingo(urlCodigoBingo);
  }, [urlCodigoRifa, urlCodigoBingo]);

  const buscarCartela = async (codigoOverride?: string) => {
    const code = codigoOverride || codigoCartela;
    if (!code.trim()) { toast.error('Digite o código de validação.'); return; }
    
    setLoadingCartela(true);
    setBuscadoCartela(false);
    setResultadoCartela(null);
    
    const { data, error } = await supabase
      .from('cartelas_rifa')
      .select('*, compras_rifa(*, rifas(nome, status, numero_ganhador)), numeros_rifa(numero, status, nome_comprador, telefone_comprador)')
      .eq('codigo_validacao', code.toUpperCase().trim())
      .single();
      
    setLoadingCartela(false);
    setBuscadoCartela(true);
    setResultadoCartela(error || !data ? null : data);
  };

  const buscarNumeroRifa = async () => {
    if (!numeroRifa.trim()) { toast.error('Digite o número.'); return; }
    setLoadingRifa(true);
    setBuscadoRifa(false);
    setResultadoRifa(null);

    let query = supabase
      .from('numeros_rifa')
      .select('*, rifas(id, nome, status, numero_ganhador, custo_por_numero, data_encerramento)')
      .eq('numero', parseInt(numeroRifa))
      .in('status', ['reservado', 'vendido']);

    if (rifaIdSelecionada && rifaIdSelecionada !== 'todas') {
      query = query.eq('rifa_id', rifaIdSelecionada);
    }

    const { data, error } = await query.limit(10);
    setLoadingRifa(false);
    setBuscadoRifa(true);
    setResultadoRifa(error || !data || data.length === 0 ? null : data);
  };

  const buscarBingo = async (codigoOverride?: string) => {
    const code = codigoOverride || codigoBingo;
    if (!code.trim()) { toast.error('Digite o código de validação do bingo.'); return; }
    
    setLoadingBingo(true);
    setBuscadoBingo(false);
    setResultadoBingo(null);
    
    const { data, error } = await supabase
      .from('vendas_bingo_fisico')
      .select('*, partidas(*)')
      .eq('codigo_validacao', code.toUpperCase().trim())
      .single();
      
    setLoadingBingo(false);
    setBuscadoBingo(true);
    
    if (error || !data) {
      setResultadoBingo(null);
    } else {
      const match = data.partidas;
      const calledNumbersSet = new Set(match.called_numbers || []);
      
      const processedGrids = data.grids.map((gridMatrix: number[][], index: number) => {
        const tempCard: BingoCard = {
          id: `folha-${data.id}-grid-${index}`,
          name: `Cartela ${index + 1}`,
          numbers: gridMatrix,
          markedNumbers: calledNumbersSet
        };
        const winResult = checkWin(tempCard, match.game_type as any);
        return { gridMatrix, isWinner: !!winResult, winResult };
      });

      setResultadoBingo({ ...data, processedGrids, match });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Search className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Auditoria e Validação</h1>
        </div>

        <Tabs defaultValue={urlCodigoBingo ? "bingo" : (urlCodigoRifa ? "cartela" : "bingo")}>
          <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="bingo" className="py-2.5 flex items-center gap-1.5 text-xs sm:text-sm"><Grid3X3 className="w-4 h-4" /> BINGO Físico</TabsTrigger>
            <TabsTrigger value="rifa" className="py-2.5 flex items-center gap-1.5 text-xs sm:text-sm"><Hash className="w-4 h-4" /> Número Rifa</TabsTrigger>
            <TabsTrigger value="cartela" className="py-2.5 flex items-center gap-1.5 text-xs sm:text-sm"><Ticket className="w-4 h-4" /> Código Rifa</TabsTrigger>
          </TabsList>

          <TabsContent value="bingo" className="space-y-4 mt-4">
            <div className="card-container p-6 space-y-4 bg-purple-50/30 border-purple-500/20">
              <div className="space-y-2">
                <Label>Código da Folha de Bingo</Label>
                <div className="flex gap-2">
                  <Input value={codigoBingo} onChange={e => setCodigoBingo(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && buscarBingo()} placeholder="Ex: AB12CD" className="font-mono uppercase text-lg h-12" />
                  <Button className="h-12 w-12 bg-purple-600 hover:bg-purple-700" onClick={() => buscarBingo()} disabled={loadingBingo}>
                    {loadingBingo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            </div>

            {buscadoBingo && !resultadoBingo && (
              <div className="card-container p-6 border-red-300 bg-red-50 text-center"><XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" /><p className="font-bold text-lg text-red-700">Código não encontrado</p><p className="text-sm text-red-600/80">Esta folha não foi gerada pelo sistema.</p></div>
            )}

            {buscadoBingo && resultadoBingo && (
              <div className="space-y-6">
                {resultadoBingo.status !== 'pago' ? (
                  <div className="card-container p-6 border-red-400 bg-red-50/80 shadow-md">
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="h-10 w-10 text-red-600 shrink-0 mt-1" />
                      <div>
                        <h2 className="font-bold text-xl text-red-800">ATENÇÃO: CARTELA INVÁLIDA</h2>
                        <p className="text-red-700 mt-2 font-medium leading-relaxed">
                          O vendedor que lhe passou esta cartela ainda não realizou o repasse financeiro ao sistema (Cartela Fiada).
                        </p>
                        <p className="text-sm text-red-600/90 mt-2">
                          Esta folha <strong>NÃO PARTICIPA</strong> dos prêmios até ser regularizada. Procure imediatamente o vendedor.
                        </p>
                        <p className="text-xs font-mono font-bold bg-white/50 inline-block px-2 py-1 rounded mt-3 text-red-800 border border-red-200">
                          Código: {resultadoBingo.codigo_validacao}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="card-container p-5 border-purple-300">
                      <div className="flex items-center gap-3 mb-4 border-b pb-4">
                        <CheckCircle className="h-8 w-8 text-green-500 shrink-0" />
                        <div>
                          <p className="font-bold text-lg text-green-700 leading-tight">Folha Autêntica do Sistema</p>
                          <p className="text-sm text-muted-foreground">{resultadoBingo.partidas.name}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Código Folha</p>
                          <p className="font-mono font-bold text-lg">{resultadoBingo.codigo_validacao}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Números Sorteados</p>
                          <p className="font-bold">{resultadoBingo.partidas.called_numbers?.length || 0} bolas cantadas</p>
                        </div>
                      </div>
                    </div>

                    <h3 className="font-heading font-bold text-lg pt-2">Verificação das Cartelas da Folha</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {resultadoBingo.processedGrids.map((g: any, i: number) => (
                        <div key={i} className={`card-container p-4 border-2 transition-all ${g.isWinner ? 'border-success bg-success/5 shadow-lg shadow-success/10 scale-[1.02]' : 'border-border opacity-80'}`}>
                          <div className="flex justify-between items-center mb-3">
                            <span className="font-bold text-sm">Cartela {i + 1}</span>
                            {g.isWinner ? <Badge className="bg-success text-white animate-pulse"><Trophy className="w-3 h-3 mr-1" /> BATEU BINGO!</Badge> : <Badge variant="outline" className="text-muted-foreground">Não Bateu</Badge>}
                          </div>
                          
                          <div className="grid grid-cols-5 gap-1 text-center">
                            {['B', 'I', 'N', 'G', 'O'].map(letra => <div key={letra} className="text-xs font-black bg-muted rounded p-1">{letra}</div>)}
                            {g.gridMatrix.map((row: number[], rIdx: number) => (
                              row.map((num: number, cIdx: number) => {
                                const isMeio = rIdx === 2 && cIdx === 2;
                                const isCalled = isMeio || (resultadoBingo.match.called_numbers || []).includes(num);
                                const isWinningNum = g.isWinner && (isMeio || g.winResult.winningNumbers.includes(num));

                                return (
                                  <div key={cIdx} className={`aspect-square rounded flex items-center justify-center text-sm font-bold border ${isCalled ? (isWinningNum ? 'bg-success text-white border-success' : 'bg-primary/20 border-primary/30 text-primary') : 'border-border/50 text-muted-foreground/50'} ${isMeio ? 'bg-muted border-none text-muted-foreground' : ''}`}>
                                    {isMeio ? '★' : num}
                                  </div>
                                );
                              })
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rifa" className="space-y-4 mt-4">
             {/* Componente existente, sem alteração de regras (Rifa por número não costuma falhar o acerto pois não é fiado ao usuário) */}
          </TabsContent>

          <TabsContent value="cartela" className="space-y-4 mt-4">
            <div className="card-container p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código de validação (Rifa)</Label>
                <div className="flex gap-2">
                  <Input id="codigo" value={codigoCartela} onChange={e => setCodigoCartela(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && buscarCartela()} placeholder="Ex: AB12CD34EF" className="font-mono uppercase" />
                  <Button onClick={() => buscarCartela()} disabled={loadingCartela}>{loadingCartela ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
                </div>
              </div>
            </div>

            {buscadoCartela && !resultadoCartela && (
              <div className="card-container p-6 border-red-300 bg-red-50 text-center"><XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" /><p className="font-bold text-lg text-red-700">Código não encontrado</p></div>
            )}

            {buscadoCartela && resultadoCartela && (
              <div className="space-y-4">
                {resultadoCartela.compras_rifa?.status !== 'pago' ? (
                  <div className="card-container p-6 border-red-400 bg-red-50/80 shadow-md">
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="h-10 w-10 text-red-600 shrink-0 mt-1" />
                      <div>
                        <h2 className="font-bold text-xl text-red-800">ATENÇÃO: RIFA INVÁLIDA</h2>
                        <p className="text-red-700 mt-2 font-medium leading-relaxed">
                          O vendedor que lhe reservou este número ainda não realizou o repasse financeiro ao sistema.
                        </p>
                        <p className="text-sm text-red-600/90 mt-2">
                          Este número <strong>NÃO PARTICIPA</strong> do sorteio até ser regularizado.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card-container p-5 border-green-300 space-y-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-8 w-8 text-green-500 shrink-0" />
                      <div>
                        <p className="font-bold text-lg text-green-700">Cartela Válida e Paga</p>
                        <p className="text-sm text-muted-foreground">{resultadoCartela.compras_rifa?.rifas?.nome}</p>
                      </div>
                    </div>
                    {/* Exibe as infos normais da rifa (já existia no código anterior) */}
                    <div className="grid grid-cols-2 gap-4 text-sm mt-4 border-t pt-4">
                       <div><p className="text-[10px] uppercase text-muted-foreground">Número Comprado</p><p className="font-bold text-lg">{resultadoCartela.numeros_rifa?.numero}</p></div>
                       <div><p className="text-[10px] uppercase text-muted-foreground">Status da Rifa</p><p className="font-bold uppercase">{resultadoCartela.compras_rifa?.rifas?.status}</p></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}