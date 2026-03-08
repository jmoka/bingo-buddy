import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Match } from '@/types/match';
import { useGame } from '@/contexts/GameContext';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, Ticket, Coins, Store, Globe, Trophy, AlertTriangle } from 'lucide-react';
import PlayerAvatar from '../PlayerAvatar';

interface Props {
  match: Match | null;
  onClose: () => void;
}

export function MatchDetailsModal({ match, onClose }: Props) {
  const { matchCards, players } = useGame();

  const { data: physicalSales = [], isLoading } = useQuery({
    queryKey: ['match-physical-sales', match?.id],
    queryFn: async () => {
      if (!match) return [];
      const { data } = await supabase
        .from('vendas_bingo_fisico')
        .select('*, vendedores_rifa(nome, codigo_ref)')
        .eq('match_id', match.id);
      return data || [];
    },
    enabled: !!match,
  });

  if (!match) return null;

  // --- CÁLCULOS ONLINE ---
  const onlineCards = matchCards.filter(c => c.match_id === match.id);
  const realCards = onlineCards.filter(c => c.credit_type === 'real');
  const fakeCards = onlineCards.filter(c => c.credit_type === 'fake');
  const onlinePlayersCount = new Set(realCards.map(c => c.player_id)).size;

  // --- CÁLCULOS FÍSICOS (VENDEDORES) ---
  let physicalPaidGrids = 0;
  let physicalFiadoGrids = 0;
  let physicalRevenue = 0;
  let physicalFiadoRevenue = 0;

  const sellerStats: Record<string, any> = {};

  physicalSales.forEach(sale => {
    const gridsCount = sale.grids?.length || 0;
    const isPaid = sale.status === 'pago';
    const isFiado = sale.status === 'pendente';
    
    if (isPaid) {
        physicalPaidGrids += gridsCount;
        physicalRevenue += Number(sale.valor_pago);
    } else if (isFiado) {
        physicalFiadoGrids += gridsCount;
        physicalFiadoRevenue += Number(sale.valor_pago);
    }

    const vId = sale.vendedor_id;
    if (!sellerStats[vId]) {
        sellerStats[vId] = { 
            nome: sale.vendedores_rifa?.nome || 'Desconhecido', 
            ref: sale.vendedores_rifa?.codigo_ref || '',
            impressas: 0, pagas: 0, fiadas: 0, valorPago: 0, valorFiado: 0 
        };
    }
    sellerStats[vId].impressas += gridsCount;
    if (isPaid) {
        sellerStats[vId].pagas += gridsCount;
        sellerStats[vId].valorPago += Number(sale.valor_pago);
    }
    if (isFiado) {
        sellerStats[vId].fiadas += gridsCount;
        sellerStats[vId].valorFiado += Number(sale.valor_pago);
    }
  });

  const sellersArray = Object.values(sellerStats).sort((a, b) => b.impressas - a.impressas);

  return (
    <Dialog open={!!match} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-muted/10">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading flex items-center gap-2">
            Raio-X da Partida: {match.name}
          </DialogTitle>
          <DialogDescription>
            Visão detalhada de vendas, vendedores e participantes.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
            <Tabs defaultValue="geral" className="mt-2">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="geral">Visão Geral</TabsTrigger>
                <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
                <TabsTrigger value="online">App Online</TabsTrigger>
                <TabsTrigger value="ganhadores" disabled={match.status !== 'finished'}>Ganhadores</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="card-container p-4 bg-primary/10 border-primary/20">
                        <p className="text-[10px] uppercase font-bold text-primary">Aposta Total (Pote)</p>
                        <p className="text-2xl font-black font-heading text-primary">{Number(match.pot).toFixed(2)} cr.</p>
                    </div>
                    <div className="card-container p-4">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Participantes Pagos (App)</p>
                        <p className="text-2xl font-black font-heading flex items-center gap-2"><Users className="w-5 h-5 text-muted-foreground" /> {onlinePlayersCount}</p>
                    </div>
                    <div className="card-container p-4">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Cartelas Reais (App)</p>
                        <p className="text-2xl font-black font-heading flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500" /> {realCards.length}</p>
                    </div>
                    <div className="card-container p-4">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Cartelas Brincar (App)</p>
                        <p className="text-2xl font-black font-heading flex items-center gap-2"><Ticket className="w-5 h-5 text-amber-500" /> {fakeCards.length}</p>
                    </div>
                </div>

                <div className="card-container p-0 overflow-hidden border-2 border-purple-500/20">
                    <div className="bg-purple-50 p-3 border-b border-purple-200">
                        <h3 className="font-bold text-purple-800 flex items-center gap-2"><Store className="w-4 h-4" /> Resumo Bingo Físico (Vendedores)</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4 p-4 text-center divide-x">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Impressas (Grids)</p>
                            <p className="text-xl font-black font-heading text-foreground">{physicalPaidGrids + physicalFiadoGrids}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-green-600">Pagas / Validadas</p>
                            <p className="text-xl font-black font-heading text-green-600">{physicalPaidGrids}</p>
                            <p className="text-xs text-green-700/80">R$ {physicalRevenue.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-red-500">Fiadas / Pendentes</p>
                            <p className="text-xl font-black font-heading text-red-500">{physicalFiadoGrids}</p>
                            <p className="text-xs text-red-600/80">R$ {physicalFiadoRevenue.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="vendedores" className="mt-4">
                <div className="card-container p-0 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Vendedor</TableHead>
                                <TableHead className="text-center">Impressas</TableHead>
                                <TableHead className="text-center text-green-600">Pagas</TableHead>
                                <TableHead className="text-center text-red-500">Fiadas</TableHead>
                                <TableHead className="text-right">Receita Paga</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sellersArray.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhuma venda física registrada.</TableCell></TableRow>
                            ) : (
                                sellersArray.map((s, i) => (
                                    <TableRow key={i}>
                                        <TableCell>
                                            <p className="font-bold">{s.nome}</p>
                                            <p className="text-[10px] font-mono text-muted-foreground">Ref: {s.ref}</p>
                                        </TableCell>
                                        <TableCell className="text-center font-mono font-bold">{s.impressas}</TableCell>
                                        <TableCell className="text-center font-mono font-bold text-green-600">{s.pagas}</TableCell>
                                        <TableCell className="text-center font-mono font-bold text-red-500">{s.fiadas > 0 ? s.fiadas : '-'}</TableCell>
                                        <TableCell className="text-right font-bold text-primary">R$ {s.valorPago.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>

            <TabsContent value="online" className="mt-4">
                <div className="card-container p-0 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Jogador</TableHead>
                                <TableHead>Nome da Cartela</TableHead>
                                <TableHead className="text-center">Tipo</TableHead>
                                <TableHead className="text-center">Modo</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {onlineCards.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nenhuma cartela online.</TableCell></TableRow>
                            ) : (
                                onlineCards.map((c) => {
                                    const player = players.find(p => p.id === c.player_id);
                                    return (
                                        <TableRow key={c.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <PlayerAvatar url={player?.avatar_url || null} fallback={player?.full_name} className="w-6 h-6" />
                                                    <span className="font-medium text-sm">{player?.full_name || 'Desconhecido'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">{c.name}</TableCell>
                                            <TableCell className="text-center">
                                                {c.credit_type === 'real' 
                                                    ? <Badge className="bg-blue-500/10 text-blue-600 border-none">Real</Badge> 
                                                    : <Badge className="bg-amber-500/10 text-amber-600 border-none">Brincar</Badge>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {c.marking_mode === 'manual'
                                                    ? <Badge variant="outline" className="border-amber-500 text-amber-600">Manual</Badge>
                                                    : <Badge variant="secondary" className="text-[10px]">Auto</Badge>}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>

            <TabsContent value="ganhadores" className="mt-4">
                <div className="grid gap-3">
                    {(!match.winners || match.winners.length === 0) ? (
                        <div className="card-container text-center py-10 text-muted-foreground">Nenhum ganhador registrado no sistema para esta partida.</div>
                    ) : (
                        match.winners.map((w: any, idx) => (
                            <div key={idx} className="card-container flex items-center justify-between border-l-4 border-success">
                                <div>
                                    <h4 className="font-bold flex items-center gap-2 text-lg">
                                        <Trophy className="w-5 h-5 text-amber-500" /> {w.playerName}
                                    </h4>
                                    <p className="text-sm text-muted-foreground mt-1">Cartela: <strong>{w.cardName}</strong></p>
                                </div>
                                <div className="text-right">
                                    {w.creditType === 'real' ? (
                                        <Badge className="bg-success text-white px-3 py-1">Prêmio Real</Badge>
                                    ) : w.creditType === 'fake' ? (
                                        <Badge className="bg-amber-500 text-white px-3 py-1">Apenas Brincadeira</Badge>
                                    ) : (
                                        <Badge variant="outline">Origem Desconhecida</Badge>
                                    )}
                                    <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold tracking-wider flex items-center justify-end gap-1">
                                        <Globe className="w-3 h-3" /> Jogado via App
                                    </p>
                                </div>
                            </div>
                        ))
                    )}

                    <div className="bg-muted/50 p-4 rounded-xl border border-border/50 flex items-start gap-3 mt-4 text-sm text-muted-foreground">
                        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                        <p>
                            <strong>Nota sobre o Bingo Físico:</strong> As cartelas de papel vendidas por cambistas não são validadas automaticamente pelo sistema durante o sorteio. Caso um jogador de cartela física grite BINGO, o administrador ou vendedor deve validar o código manualmente na aba <strong>Validar Cartelas</strong>.
                        </p>
                    </div>
                </div>
            </TabsContent>
            </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}