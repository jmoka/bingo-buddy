import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ArrowLeft, Search, CheckCircle, XCircle, Ticket, Loader2, Hash, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function ValidarCartela() {
  const navigate = useNavigate();

  const [rifasAbertas, setRifasAbertas] = useState<{ id: string; nome: string }[]>([]);

  const [codigoCartela, setCodigoCartela] = useState('');
  const [loadingCartela, setLoadingCartela] = useState(false);
  const [resultadoCartela, setResultadoCartela] = useState<any | null>(null);
  const [buscadoCartela, setBuscadoCartela] = useState(false);

  const [numeroRifa, setNumeroRifa] = useState('');
  const [rifaIdSelecionada, setRifaIdSelecionada] = useState('');
  const [loadingRifa, setLoadingRifa] = useState(false);
  const [resultadoRifa, setResultadoRifa] = useState<any | null>(null);
  const [buscadoRifa, setBuscadoRifa] = useState(false);

  useEffect(() => {
    supabase
      .from('rifas')
      .select('id, nome')
      .eq('status', 'ativa')
      .order('nome')
      .then(({ data }) => {
        if (data) setRifasAbertas(data);
      });
  }, []);

  const buscarCartela = async () => {
    if (!codigoCartela.trim()) { toast.error('Digite o código de validação.'); return; }
    setLoadingCartela(true);
    setBuscadoCartela(false);
    setResultadoCartela(null);
    const { data, error } = await supabase
      .from('cartelas_rifa')
      .select('*, compras_rifa(*, rifas(nome, status, numero_ganhador)), numeros_rifa(numero, status, nome_comprador, telefone_comprador)')
      .eq('codigo_validacao', codigoCartela.toUpperCase().trim())
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
    console.log('buscarNumeroRifa:', { data, error, numeroRifa, rifaIdSelecionada });
    setLoadingRifa(false);
    setBuscadoRifa(true);
    setResultadoRifa(error || !data || data.length === 0 ? null : data);
  };

  const rifa = resultadoCartela?.compras_rifa?.rifas;
  const numeroCartela = resultadoCartela?.numeros_rifa?.numero;
  const statusNumero = resultadoCartela?.numeros_rifa?.status;
  const nomeComprador = resultadoCartela?.numeros_rifa?.nome_comprador;
  const telefoneComprador = resultadoCartela?.numeros_rifa?.telefone_comprador;
  const isVendido = statusNumero === 'vendido';
  const isReservado = statusNumero === 'reservado';
  const isGanhador =
    rifa?.status === 'finalizada' &&
    rifa?.numero_ganhador != null &&
    rifa.numero_ganhador === numeroCartela;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Search className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Validar</h1>
        </div>

        <Tabs defaultValue="rifa">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="rifa" className="flex items-center gap-1.5">
              <Hash className="w-4 h-4" /> Número da Rifa
            </TabsTrigger>
            <TabsTrigger value="cartela" className="flex items-center gap-1.5">
              <Ticket className="w-4 h-4" /> Código de Cartela
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rifa" className="space-y-4 mt-4">
            <div className="card-container p-6 space-y-4">
              <div className="space-y-2">
                <Label>Rifa</Label>
                <Select value={rifaIdSelecionada} onValueChange={setRifaIdSelecionada}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma rifa..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as rifas</SelectItem>
                    {rifasAbertas.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input
                  type="number"
                  value={numeroRifa}
                  onChange={e => setNumeroRifa(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscarNumeroRifa()}
                  placeholder="Ex: 42"
                  className="font-mono text-lg"
                />
              </div>
              <Button className="w-full gradient-primary" onClick={buscarNumeroRifa} disabled={loadingRifa}>
                {loadingRifa ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Buscar
              </Button>
            </div>

            {buscadoRifa && !resultadoRifa && (
              <div className="card-container p-6 border-blue-300 bg-blue-50/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Check className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-lg text-blue-700 leading-none">Número Disponível</p>
                      <Badge className="bg-blue-600 text-white hover:bg-blue-700 animate-pulse">LIBERADA</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Este número está livre! Volte até a Rifa e selecione-o para realizar a compra agora mesmo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {buscadoRifa && resultadoRifa && (
              <div className="space-y-3">
                {resultadoRifa.map((n: any) => {
                  const rifaData = n.rifas;
                  const isVendido = n.status === 'vendido';
                  const isGanhadorNum = rifaData?.status === 'finalizada' && rifaData?.numero_ganhador === n.numero;
                  return (
                    <div key={n.id} className={`card-container p-5 space-y-3 ${isVendido ? 'border-green-300' : 'border-amber-300'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isVendido
                            ? <CheckCircle className="h-7 w-7 text-green-500" />
                            : <Ticket className="h-7 w-7 text-amber-500" />
                          }
                          <div>
                            <p className="font-bold text-2xl font-mono">Nº {String(n.numero).padStart(3, '0')}</p>
                            <p className="text-xs text-muted-foreground">{rifaData?.nome}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={isVendido ? 'bg-green-500' : 'bg-amber-500'}>
                            {isVendido ? 'Vendido' : 'Reservado'}
                          </Badge>
                          {isGanhadorNum && (
                            <Badge className="bg-yellow-400 text-yellow-900 font-bold">GANHADOR!</Badge>
                          )}
                        </div>
                      </div>

                      {(n.nome_comprador || n.telefone_comprador || n.endereco_comprador) && (
                        <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                          {n.nome_comprador && (
                            <p><span className="text-muted-foreground text-xs">Comprador: </span><span className="font-semibold">{n.nome_comprador}</span></p>
                          )}
                          {n.telefone_comprador && (
                            <p><span className="text-muted-foreground text-xs">Telefone: </span>{n.telefone_comprador}</p>
                          )}
                          {n.endereco_comprador && (
                            <p><span className="text-muted-foreground text-xs">Endereço: </span>{n.endereco_comprador}</p>
                          )}
                        </div>
                      )}

                      {!isVendido && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-2">
                          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                          <p className="text-sm font-bold text-red-700">NÃO VÁLIDO PARA O SORTEIO — pagamento não confirmado</p>
                        </div>
                      )}
                      {isVendido && (
                        <div className="flex items-center gap-2 bg-green-50 border border-green-300 rounded-lg px-3 py-2">
                          <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                          <p className="text-sm font-bold text-green-700">VÁLIDO PARA O SORTEIO — pagamento confirmado</p>
                        </div>
                      )}
                      {rifaData && (
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div><span className="font-medium text-foreground">Valor: </span>R$ {Number(rifaData.custo_por_numero).toFixed(2)}</div>
                          {rifaData.data_encerramento && (
                            <div><span className="font-medium text-foreground">Sorteio: </span>{new Date(rifaData.data_encerramento).toLocaleDateString('pt-BR')}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cartela" className="space-y-4 mt-4">
            <div className="card-container p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código de validação</Label>
                <Input
                  id="codigo"
                  value={codigoCartela}
                  onChange={e => setCodigoCartela(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && buscarCartela()}
                  placeholder="Ex: AB12CD34EF"
                  className="font-mono uppercase"
                />
              </div>
              <Button className="w-full gradient-primary" onClick={buscarCartela} disabled={loadingCartela}>
                {loadingCartela ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Buscar
              </Button>
            </div>

            {buscadoCartela && resultadoCartela && (
              <div className={`card-container p-6 space-y-4 ${isVendido ? 'border-green-300' : 'border-amber-300'}`}>
                <div className="flex items-center gap-3">
                  <CheckCircle className={`h-8 w-8 ${isVendido ? 'text-green-500' : 'text-amber-500'}`} />
                  <div>
                    <p className={`font-bold text-lg ${isVendido ? 'text-green-700' : 'text-amber-700'}`}>
                      {isVendido ? 'Bilhete Vendido' : 'Bilhete Reservado (não vendido)'}
                    </p>
                    {rifa?.nome && <p className="text-sm text-muted-foreground">{rifa.nome}</p>}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {numeroCartela != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Número</span>
                      <span className="font-bold text-lg font-mono">{String(numeroCartela).padStart(3, '0')}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Código</span>
                    <span className="font-mono font-bold tracking-wider">{resultadoCartela.codigo_validacao}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className={isVendido ? 'bg-green-500' : 'bg-amber-500'}>
                      {isVendido ? 'Vendido' : 'Reservado'}
                    </Badge>
                  </div>
                </div>
                {isVendido && (nomeComprador || telefoneComprador) && (
                  <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Comprador</p>
                    {nomeComprador && <p className="font-semibold">{nomeComprador}</p>}
                    {telefoneComprador && <p className="text-muted-foreground">{telefoneComprador}</p>}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {isGanhador && (
                    <Badge className="bg-yellow-400 text-yellow-900 font-bold text-base px-4 py-1">GANHADOR!</Badge>
                  )}
                  {resultadoCartela.impresso && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Impresso
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {buscadoCartela && !resultadoCartela && (
              <div className="card-container p-6 border-red-300">
                <div className="flex items-center gap-3">
                  <XCircle className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="font-bold text-lg text-red-700">Cartela não encontrada</p>
                    <p className="text-sm text-muted-foreground">Verifique o código digitado.</p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}