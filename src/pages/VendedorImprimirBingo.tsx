import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { FolhaBingoFisico } from '@/types/match';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const BASE_URL = window.location.origin;

export default function VendedorImprimirBingo() {
  // folhaId agora pode ser uma string com vários IDs separados por vírgula
  const { folhaId } = useParams<{ folhaId: string }>();
  const navigate = useNavigate();
  const [folhas, setFolhas] = useState<FolhaBingoFisico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFolhas() {
      if (!folhaId) return;
      
      const ids = folhaId.split(',').filter(id => id.trim() !== '');
      if (ids.length === 0) return;

      const { data, error } = await supabase
        .from('vendas_bingo_fisico')
        .select('*, partidas(name, start_time, game_type), vendedores_rifa(nome, codigo_ref)')
        .in('id', ids)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setFolhas(data as FolhaBingoFisico[]);
      }
      setLoading(false);
    }
    loadFolhas();
  }, [folhaId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
      </div>
    );
  }

  if (folhas.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Nenhuma folha de bingo encontrada.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* HEADER DE CONTROLE (não impresso) */}
      <div className="print:hidden bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-bold">Impressão em Lote</h1>
            <p className="text-xs text-muted-foreground">{folhas.length} folha(s) carregada(s) para impressão</p>
          </div>
        </div>
        <Button onClick={() => window.print()} className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
          <Printer className="h-4 w-4 mr-2" /> Imprimir Tudo
        </Button>
      </div>

      <div className="flex flex-col gap-8 print:gap-0 print:bg-white">
        {folhas.map((folha, index) => {
          const grids = folha.grids;
          const totalGrids = grids.length;
          
          return (
            <div key={folha.id} className={cn("max-w-[210mm] mx-auto p-4 sm:p-8 print:p-0 w-full", index < folhas.length - 1 && "print:break-after-page")}>
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 print:shadow-none print:border-none print:p-0">
                
                {/* CABEÇALHO DA FOLHA (VISÍVEL NO PAPEL) */}
                <div className="flex justify-between items-center border-b-2 border-dashed border-gray-400 pb-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-black uppercase text-gray-900">{folha.partidas?.name}</h2>
                    <p className="text-sm font-bold text-gray-600 mt-1">
                      CÓDIGO OFICIAL: <span className="font-mono text-black text-base ml-1">{folha.codigo_validacao}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-500 uppercase font-bold">
                      <p>Vendedor: <span className="text-gray-900">{folha.vendedores_rifa?.nome || 'Desconhecido'}</span></p>
                      <p>Emitido em: <span className="text-gray-900">{format(new Date(folha.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span></p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <p className="text-[8px] font-bold text-gray-500 mb-1">VALIDAR BINGO</p>
                      <div className="p-1 border border-gray-300 rounded bg-white">
                        <QRCodeSVG value={`${BASE_URL}/validar-cartela?bingo=${folha.codigo_validacao}`} size={55} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* AS CARTELAS GERADAS (GRIDS) */}
                <div className={`grid gap-4 ${totalGrids > 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-sm mx-auto'}`}>
                  {grids.map((grid, gridIdx) => (
                    <div key={gridIdx} className="border-2 border-gray-800 rounded-lg p-2 bg-gray-50/50">
                      <div className="flex justify-between items-center mb-2 px-1">
                        <p className="text-[10px] font-bold text-gray-400">CARTELA {gridIdx + 1}</p>
                        <p className="text-[10px] font-mono text-gray-400">{folha.codigo_validacao}-{gridIdx+1}</p>
                      </div>
                      
                      <table className="w-full text-center border-collapse bg-white">
                        <thead>
                          <tr>
                            {['B', 'I', 'N', 'G', 'O'].map((letra, i) => (
                              <th key={letra} className={`w-1/5 py-1.5 text-xl font-black border-2 border-gray-800 ${
                                ['bg-blue-100', 'bg-red-100', 'bg-gray-100', 'bg-green-100', 'bg-orange-100'][i]
                              }`}>
                                {letra}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {grid.map((linha, rowIndex) => (
                            <tr key={rowIndex}>
                              {linha.map((num, colIndex) => {
                                const isMeio = rowIndex === 2 && colIndex === 2;
                                return (
                                  <td key={colIndex} className={`py-2 text-xl sm:text-2xl font-bold border-2 border-gray-800 ${isMeio ? 'bg-gray-200' : ''}`}>
                                    {isMeio ? '★' : num}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
                  <p>Este bilhete é físico e válido apenas para a partida indicada. Guarde-o com segurança.</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}