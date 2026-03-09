import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, CheckCircle, XCircle, Ticket, Loader2, Hash, AlertTriangle, Grid3X3, Trophy, ShieldCheck, UploadCloud, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { checkWin } from '@/utils/bingoUtils';
import { BingoCard } from '@/types/bingo';

export default function ValidarCartela() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlCodigoRifa = searchParams.get('codigo');
  const urlCodigoBingo = searchParams.get('bingo');

  const [rifasAbertas, setRifasAbertas] = useState<{ id: string; nome: string }[]>([]);

  // Bingo States
  const [codigoBingo, setCodigoBingo] = useState(urlCodigoBingo || '');
  const [loadingBingo, setLoadingBingo] = useState(false);
  const [resultadoBingo, setResultadoBingo] = useState<any | null>(null);
  const [buscadoBingo, setBuscadoBingo] = useState(false);

  // Envio de Comprovante pelo Cliente
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [clienteEndereco, setClienteEndereco] = useState('');
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [isEnviandoComprovante, setIsEnviandoComprovante] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Rifa States
  const [codigoCartela, setCodigoCartela] = useState(urlCodigoRifa || '');
  const [loadingCartela, setLoadingCartela] = useState(false);
  const [resultadoCartela, setResultadoCartela] = useState<any | null>(null);
  const [buscadoCartela, setBuscadoCartela] = useState(false);
  const [numeroRifa, setNumeroRifa] = useState('');
  const [rifaIdSelecionada, setRifaIdSelecionada] = useState('');
  const [loadingRifa, setLoadingRifa] = useState(false);
  const [resultadoRifa, setResultadoRifa] = useState<any | null>(null);
  const [buscadoRifa, setBuscadoRifa] = useState(false);

  useEffect(() => {
    supabase.from('rifas').select('id, nome').eq('status', 'ativa').order('nome').then(({ data }) => {
      if (data) setRifasAbertas(data);
    });
  }, []);

  useEffect(() => {
    if (urlCodigoRifa) buscarCartela(urlCodigoRifa);
    if (urlCodigoBingo) buscarBingo(urlCodigoBingo);
  }, [urlCodigoRifa, urlCodigoBingo]);

  const buscarBingo = async (codigoOverride?: string) => {
    const code = codigoOverride || codigoBingo;
    if (!code.trim()) { toast.error('Digite o código de validação do bingo.'); return; }
    
    setLoadingBingo(true);
    setBuscadoBingo(false);
    setResultadoBingo(null);
    setComprovanteFile(null);
    
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
        const tempCard: BingoCard = { id: `folha-${data.id}-grid-${index}`, name: `Cartela ${index + 1}`, numbers: gridMatrix, markedNumbers: calledNumbersSet };
        const winResult = checkWin(tempCard, match.game_type as any);
        return { gridMatrix, isWinner: !!winResult, winResult };
      });
      setResultadoBingo({ ...data, processedGrids, match });
    }
  };

  const handleEnviarComprovante = async () => {
    if (!clienteNome.trim() || !comprovanteFile || !resultadoBingo) return;
    
    setIsEnviandoComprovante(true);
    try {
      const ext = comprovanteFile.name.split('.').pop();
      const fileName = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      
      // 1. Upload do arquivo ( Bucket: comprovantes_bingo )
      const { error: uploadError } = await supabase.storage
        .from('comprovantes_bingo')
        .upload(fileName, comprovanteFile);

      if (uploadError) throw new Error('Erro ao enviar arquivo: ' + uploadError.message);

      // 2. Pegar a URL pública do arquivo enviado
      const { data: { publicUrl } } = supabase.storage
        .from('comprovantes_bingo')
        .getPublicUrl(fileName);

      // 3. Chamar a RPC para salvar os dados no banco
      const { data, error: rpcError } = await supabase.rpc('enviar_comprovante_cliente_bingo', {
        p_codigo: resultadoBingo.codigo_validacao,
        p_nome: clienteNome.trim(),
        p_telefone: clienteTelefone.trim() || null,
        p_endereco: clienteEndereco.trim() || null,
        p_comprovante: publicUrl
      });

      if (rpcError) {
          console.error("Erro na RPC:", rpcError);
          throw new Error('O servidor recusou a validação (Erro 400). Tente novamente em instantes.');
      }

      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido ao processar.');

      toast.success('Comprovante enviado com sucesso!');
      buscarBingo(resultadoBingo.codigo_validacao); // Atualiza a tela
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsEnviandoComprovante(false);
    }
  };

  const buscarCartela = async (codigoOverride?: string) => {
    const code = codigoOverride || codigoCartela;
    if (!code.trim()) { toast.error('Digite o código de validação.'); return; }
    setLoadingCartela(true); setBuscadoCartela(false); setResultadoCartela(null);
    const { data, error } = await supabase.from('cartelas_rifa').select('*, compras_rifa(*, rifas(nome, status, numero_ganhador)), numeros_rifa(numero, status, nome_comprador, telefone_comprador)').eq('codigo_validacao', code.toUpperCase().trim()).single();
    setLoadingCartela(false); setBuscadoCartela(true); setResultadoCartela(error || !data ? null : data);
  };

  const buscarNumeroRifa = async () => {
    if (!numeroRifa.trim()) { toast.error('Digite o número.'); return; }
    setLoadingRifa(true); setBuscadoRifa(false); setResultadoRifa(null);
    let query = supabase.from('numeros_rifa').select('*, rifas(id, nome, status, numero_ganhador, custo_por_numero, data_encerramento), cartelas_rifa(compras_rifa(status))').eq('numero', parseInt(numeroRifa)).in('status', ['reservado', 'vendido']);
    if (rifaIdSelecionada && rifaIdSelecionada !== 'todas') query = query.eq('rifa_id', rifaIdSelecionada);
    const { data, error } = await query.limit(10);
    setLoadingRifa(false); setBuscadoRifa(true); setResultadoRifa(error || !data || data.length === 0 ? null : data);
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="w-5 h-5" /></Button>
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
              <div className="card-container p-6 border-red-300 bg-red-50 text-center"><XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" /><p className="font-bold text-lg text-red-700">Código não encontrado</p></div>
            )}

            {buscadoBingo && resultadoBingo && (
              <div className="space-y-6">
                {resultadoBingo.status === 'pendente' ? (
                  <div className="card-container p-6 border-amber-400 bg-amber-50 shadow-md">
                    <div className="flex items-start gap-4 mb-4">
                      <AlertTriangle className="h-10 w-10 text-amber-600 shrink-0 mt-1" />
                      <div>
                        <h2 className="font-bold text-xl text-amber-800">Pagamento Pendente</h2>
                        <p className="text-amber-700 text-sm mt-1 font-medium leading-relaxed">
                          Esta cartela aguarda pagamento. Escaneie o QR Code PIX impresso no bilhete e envie o comprovante abaixo para ativá-la no sorteio.
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-amber-200 space-y-4">
                      <div className="space-y-2">
                        <Label>Seu Nome Completo *</Label>
                        <Input value={clienteNome} onChange={e => setClienteNome(e.target.value)} placeholder="Nome para identificar o prêmio" />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Seu Telefone/WhatsApp</Label>
                          <Input value={clienteTelefone} onChange={e => setClienteTelefone(e.target.value)} placeholder="(00) 00000-0000" />
                        </div>
                        <div className="space-y-2">
                          <Label>Endereço de Entrega</Label>
                          <Input value={clienteEndereco} onChange={e => setClienteEndereco(e.target.value)} placeholder="Rua, Bairro, Cidade..." />
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <Label>Comprovante do PIX *</Label>
                        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setComprovanteFile(e.target.files?.[0] || null)} />
                        <Button type="button" variant="outline" className="w-full h-12 border-dashed border-2 bg-muted/30" onClick={() => fileRef.current?.click()}>
                          <UploadCloud className="w-5 h-5 mr-2 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">{comprovanteFile ? comprovanteFile.name : 'Anexar imagem ou PDF do PIX pago'}</span>
                        </Button>
                      </div>
                      <Button className="w-full bg-amber-600 hover:bg-amber-700 h-12 text-white font-bold" onClick={handleEnviarComprovante} disabled={!clienteNome || !comprovanteFile || isEnviandoComprovante}>
                        {isEnviandoComprovante ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                        ENVIAR COMPROVANTE AGORA
                      </Button>
                    </div>
                  </div>
                ) : resultadoBingo.status === 'em_analise' ? (
                  <div className="card-container p-8 border-blue-400 bg-blue-50 shadow-md text-center">
                    <Clock className="w-14 h-14 text-blue-500 mx-auto mb-3 animate-pulse" />
                    <h2 className="font-bold text-xl text-blue-800">Comprovante em Análise</h2>
                    <p className="text-blue-700 mt-2 font-medium">O administrador está verificando o pagamento. Retorne a esta página em alguns minutos e faça a busca novamente para confirmar sua participação!</p>
                  </div>
                ) : (
                  <>
                    <div className="card-container p-5 border-purple-300">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b pb-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-8 w-8 text-green-500 shrink-0" />
                          <div><p className="font-bold text-lg text-green-700 leading-tight">Folha Autêntica e Válida</p><p className="text-sm text-muted-foreground">{resultadoBingo.partidas.name}</p></div>
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-1 bg-green-50/80 p-2.5 rounded-lg border border-green-200">
                           <Badge className="bg-green-600 text-white text-xs px-2.5 py-1 uppercase tracking-wider"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> PAGA E HABILITADA</Badge>
                        </div>
                      </div>
                    </div>
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
                                return <div key={cIdx} className={`aspect-square rounded flex items-center justify-center text-sm font-bold border ${isCalled ? (isWinningNum ? 'bg-success text-white border-success' : 'bg-primary/20 border-primary/30 text-primary') : 'border-border/50 text-muted-foreground/50'} ${isMeio ? 'bg-muted border-none text-muted-foreground' : ''}`}>{isMeio ? '★' : num}</div>;
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

          {/* Rifas tab remains intact... */}
          <TabsContent value="rifa" className="space-y-4 mt-4">
             <div className="card-container p-6 space-y-4 bg-muted/30">
               <div className="space-y-2">
                 <Label>Sorteio Específico (Opcional)</Label>
                 <Select value={rifaIdSelecionada} onValueChange={setRifaIdSelecionada}>
                   <SelectTrigger><SelectValue placeholder="Todas as rifas" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="todas">Todas as rifas ativas</SelectItem>
                     {rifasAbertas.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label>Número da Cota</Label>
                 <div className="flex gap-2">
                   <Input type="number" value={numeroRifa} onChange={e => setNumeroRifa(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarNumeroRifa()} placeholder="Ex: 42" className="text-lg h-12" />
                   <Button className="h-12 w-12" onClick={buscarNumeroRifa} disabled={loadingRifa}>{loadingRifa ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}</Button>
                 </div>
               </div>
             </div>
             {buscadoRifa && (!resultadoRifa || resultadoRifa.length === 0) && (
               <div className="card-container p-6 border-muted bg-muted/20 text-center"><Hash className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="font-bold text-lg text-muted-foreground">Número não encontrado ou ainda está disponível.</p></div>
             )}
             {buscadoRifa && resultadoRifa && resultadoRifa.length > 0 && (
               <div className="space-y-4">
                 {resultadoRifa.map((num: any, idx: number) => {
                   const isGanhador = num.rifas?.status === 'finalizada' && num.rifas?.numero_ganhador === num.numero;
                   const isPago = num.status === 'vendido';
                   const isFiado = num.status === 'reservado';
                   return (
                     <div key={idx} className={`card-container p-6 border-2 ${isGanhador ? 'border-success bg-success/10' : isPago ? 'border-primary/30 bg-primary/5' : 'border-amber-400 bg-amber-50'}`}>
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b pb-4">
                         <div className="flex items-center gap-3">
                           {isGanhador ? <Trophy className="h-8 w-8 text-success" /> : isPago ? <CheckCircle className="h-8 w-8 text-primary" /> : <AlertTriangle className="h-8 w-8 text-amber-500" />}
                           <div><p className={`font-bold text-lg leading-tight ${isGanhador ? 'text-success' : isPago ? 'text-primary' : 'text-amber-700'}`}>{isGanhador ? 'Cota Vencedora!' : isPago ? 'Cota Válida e Paga' : 'Cota Reservada (Fiado)'}</p><p className="text-sm font-medium opacity-80">{num.rifas?.nome}</p></div>
                         </div>
                         <div className="text-center sm:text-right">
                           <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Número</p>
                           <p className={`text-4xl font-black font-heading ${isGanhador ? 'text-success' : 'text-foreground'}`}>{String(num.numero).padStart(3, '0')}</p>
                         </div>
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                         <div className="space-y-1"><p className="text-xs text-muted-foreground font-bold uppercase">Comprador</p><p className="font-semibold text-base">{num.nome_comprador || 'Nome não registrado'}</p></div>
                         <div className="space-y-1"><p className="text-xs text-muted-foreground font-bold uppercase">Situação Financeira</p><p className="font-semibold flex items-center gap-1.5">{isPago ? <Badge className="bg-success text-white border-none">PAGO</Badge> : <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-100">AGUARDANDO PAGAMENTO</Badge>}</p></div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}
          </TabsContent>

          <TabsContent value="cartela" className="space-y-4 mt-4">
             <div className="card-container p-6 space-y-4 bg-muted/30">
               <div className="space-y-2">
                 <Label>Código de Validação da Cota (Rifa)</Label>
                 <div className="flex gap-2">
                   <Input value={codigoCartela} onChange={e => setCodigoCartela(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && buscarCartela()} placeholder="Ex: AB12CD" className="font-mono uppercase text-lg h-12" />
                   <Button className="h-12 w-12" onClick={() => buscarCartela()} disabled={loadingCartela}>{loadingCartela ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}</Button>
                 </div>
               </div>
             </div>
             {buscadoCartela && !resultadoCartela && (
               <div className="card-container p-6 border-red-300 bg-red-50 text-center"><XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" /><p className="font-bold text-lg text-red-700">Código não encontrado</p></div>
             )}
             {buscadoCartela && resultadoCartela && (() => {
               const c = resultadoCartela;
               const isPago = c.compras_rifa?.status === 'pago';
               const isFiado = c.compras_rifa?.status === 'pendente';
               const isGanhador = c.compras_rifa?.rifas?.status === 'finalizada' && c.compras_rifa?.rifas?.numero_ganhador === c.numeros_rifa?.numero;
               return (
                 <div className={`card-container p-6 border-2 ${isGanhador ? 'border-success bg-success/10' : isPago ? 'border-primary/30 bg-primary/5' : 'border-amber-400 bg-amber-50'}`}>
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b pb-4">
                     <div className="flex items-center gap-3">
                       {isGanhador ? <Trophy className="h-8 w-8 text-success" /> : isPago ? <CheckCircle className="h-8 w-8 text-primary" /> : <AlertTriangle className="h-8 w-8 text-amber-500" />}
                       <div><p className={`font-bold text-lg leading-tight ${isGanhador ? 'text-success' : isPago ? 'text-primary' : 'text-amber-700'}`}>{isGanhador ? 'Cota Vencedora!' : isPago ? 'Cota Válida e Paga' : 'Cota Reservada (Fiado)'}</p><p className="text-sm font-medium opacity-80">{c.compras_rifa?.rifas?.nome}</p></div>
                     </div>
                     <div className="text-center sm:text-right">
                       <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Número</p>
                       <p className={`text-4xl font-black font-heading ${isGanhador ? 'text-success' : 'text-foreground'}`}>{String(c.numeros_rifa?.numero).padStart(3, '0')}</p>
                     </div>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                     <div className="space-y-1"><p className="text-xs text-muted-foreground font-bold uppercase">Comprador</p><p className="font-semibold text-base">{c.numeros_rifa?.nome_comprador || 'Nome não registrado'}</p></div>
                     <div className="space-y-1"><p className="text-xs text-muted-foreground font-bold uppercase">Situação Financeira</p><p className="font-semibold flex items-center gap-1.5">{isPago ? <Badge className="bg-success text-white border-none">PAGO</Badge> : <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-100">AGUARDANDO PAGAMENTO</Badge>}</p></div>
                   </div>
                 </div>
               );
             })()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}