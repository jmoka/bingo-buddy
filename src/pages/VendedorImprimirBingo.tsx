import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Loader2, ShieldCheck, Banknote } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { FolhaBingoFisico } from '@/types/match';
import { format } from 'date-fns';
import { QrCodePix } from 'qrcode-pix';
import { cn } from '@/lib/utils';

const BASE_URL = window.location.origin;

export default function VendedorImprimirBingo() {
  const { folhaId } = useParams<{ folhaId: string }>();
  const navigate = useNavigate();
  const [folhas, setFolhas] = useState<FolhaBingoFisico[]>([]);
  const [loading, setLoading] = useState(true);
  const [pixKey, setPixKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadFolhas() {
      if (!folhaId) return;
      
      const ids = folhaId.split(',').filter(id => id.trim() !== '');
      if (ids.length === 0) return;

      const [{ data }, { data: configData }] = await Promise.all([
        supabase.from('vendas_bingo_fisico').select('*, partidas(name, start_time, game_type), vendedores_rifa(nome, codigo_ref)').in('id', ids).order('created_at', { ascending: false }),
        supabase.from('configuracoes').select('pix_key').single()
      ]);

      if (data) setFolhas(data as FolhaBingoFisico[]);
      if (configData) setPixKey(configData.pix_key);
      setLoading(false);
    }
    loadFolhas();
  }, [folhaId]);

  const gerarPixPayload = (folha: FolhaBingoFisico) => {
    if (!pixKey) return null;
    const valorCheio = Number(folha.valor_pago) / (1 - (Number(folha.desconto_aplicado || 0) / 100));
    try {
      return QrCodePix({
        version: '01', key: pixKey, name: 'Bingo App', city: 'WEB', transactionId: folha.codigo_validacao, message: `Bingo ${folha.codigo_validacao}`, value: parseFloat(valorCheio.toFixed(2)),
      }).payload();
    } catch { return null; }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="w-10 h-10 animate-spin text-purple-600" /></div>;
  }

  if (folhas.length === 0) return <div className="text-center py-20 text-muted-foreground">Nenhuma folha de bingo encontrada.</div>;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="print:hidden bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <div><h1 className="font-bold">Impressão em Lote</h1><p className="text-xs text-muted-foreground">{folhas.length} folha(s) carregada(s)</p></div>
        </div>
        <Button onClick={() => window.print()} className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"><Printer className="h-4 w-4 mr-2" /> Imprimir</Button>
      </div>

      <div className="flex flex-col gap-8 print:gap-0 print:bg-white">
        {folhas.map((folha, index) => {
          const grids = folha.grids;
          const pixPayload = folha.status === 'pendente' ? gerarPixPayload(folha) : null;
          const valorCheio = Number(folha.valor_pago) / (1 - (Number(folha.desconto_aplicado || 0) / 100));
          
          return (
            <div key={folha.id} className={cn("max-w-[210mm] mx-auto p-4 sm:p-8 print:p-0 w-full", index < folhas.length - 1 && "print:break-after-page")}>
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 print:shadow-none print:border-none print:p-0">
                
                <div className="flex justify-between items-start border-b-2 border-dashed border-gray-400 pb-4 mb-5">
                  <div className="flex flex-col h-full justify-between flex-1 pr-4">
                    <div>
                      <h2 className="text-2xl font-black uppercase text-gray-900">{folha.partidas?.name}</h2>
                      <p className="text-sm font-bold text-gray-600 mt-0.5 mb-3">
                        CÓDIGO OFICIAL: <span className="font-mono text-black text-base ml-1">{folha.codigo_validacao}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="shrink-0 flex flex-col items-center">
                        {folha.vendedores_rifa?.codigo_ref && <QRCodeSVG value={`${BASE_URL}/vendedor/perfil/${folha.vendedores_rifa.codigo_ref}`} size={45} />}
                        <p className="text-[6px] text-gray-400 font-bold mt-1 uppercase">Vendedor</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-purple-600">
                          <ShieldCheck className="h-3 w-3" />
                          <span className="text-[8px] font-black uppercase">Vendedor Autorizado</span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-700 truncate">{folha.vendedores_rifa?.nome || 'Desconhecido'}</p>
                        <p className="text-[8px] text-gray-500">Ref: {folha.vendedores_rifa?.codigo_ref} • Emitido: {format(new Date(folha.created_at), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 shrink-0">
                    {pixPayload && (
                      <div className="text-center flex flex-col items-center border border-green-500 bg-green-50 rounded p-1.5">
                        <p className="text-[8px] font-black text-green-700 flex items-center gap-1 mb-0.5"><Banknote className="w-3 h-3" /> PAGAR PIX (R$ {valorCheio.toFixed(2)})</p>
                        <div className="p-1 bg-white rounded shadow-sm"><QRCodeSVG value={pixPayload} size={60} /></div>
                        <p className="text-[6px] text-green-700 font-bold mt-0.5 max-w-[70px] leading-tight">Pague e Valide a cartela ao lado</p>
                      </div>
                    )}
                    <div className="text-center flex flex-col items-center">
                      <p className="text-[8px] font-black text-gray-600 mb-1 pt-1">VALIDAR BINGO</p>
                      <div className="p-1.5 border border-gray-300 rounded bg-white"><QRCodeSVG value={`${BASE_URL}/validar-cartela?bingo=${folha.codigo_validacao}`} size={60} /></div>
                    </div>
                  </div>
                </div>

                <div className={`grid gap-4 ${grids.length > 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-sm mx-auto'}`}>
                  {grids.map((grid, gridIdx) => (
                    <div key={gridIdx} className="border-2 border-gray-800 rounded-lg p-2 bg-gray-50/50">
                      <div className="flex justify-between items-center mb-2 px-1">
                        <p className="text-[10px] font-bold text-gray-400">CARTELA {gridIdx + 1}</p>
                        <p className="text-[10px] font-mono text-gray-400">{folha.codigo_validacao}-{gridIdx+1}</p>
                      </div>
                      <table className="w-full text-center border-collapse bg-white">
                        <thead>
                          <tr>{['B', 'I', 'N', 'G', 'O'].map((letra, i) => (<th key={letra} className={`w-1/5 py-1.5 text-xl font-black border-2 border-gray-800 ${['bg-blue-100', 'bg-red-100', 'bg-gray-100', 'bg-green-100', 'bg-orange-100'][i]}`}>{letra}</th>))}</tr>
                        </thead>
                        <tbody>
                          {grid.map((linha, rowIndex) => (
                            <tr key={rowIndex}>
                              {linha.map((num, colIndex) => {
                                const isMeio = rowIndex === 2 && colIndex === 2;
                                return <td key={colIndex} className={`py-2 text-xl sm:text-2xl font-bold border-2 border-gray-800 ${isMeio ? 'bg-gray-200' : ''}`}>{isMeio ? '★' : num}</td>;
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-4 border-t border-gray-200 text-center text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                  <p>Este bilhete é físico e oficial. Para concorrer, ele precisa ser validado no sistema antes do sorteio.</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } body { background: white !important; } }`}</style>
    </div>
  );
}