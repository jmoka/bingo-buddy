import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Loader2, Ticket } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const BASE_URL = window.location.origin;

interface BilheteData {
  numero: number;
  codigoValidacao: string | null;
  nome_comprador: string | null;
  telefone_comprador: string | null;
  endereco_comprador: string | null;
  rifa: {
    nome: string;
    descricao: string | null;
    data_encerramento: string | null;
    custo_por_numero: number;
  } | null;
  vendedor: {
    nome: string;
    telefone: string | null;
  } | null;
  compra: {
    created_at: string;
    valor_total: number;
    numeros: number[];
    id: string;
  } | null;}

export default function VendedorCartelas() {
  const navigate = useNavigate();
  const { compraId, rifaId } = useParams<{ compraId?: string; rifaId?: string }>();
  const { user } = useAuth();
  const [bilhetes, setBilhetes] = useState<BilheteData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      if (!user) { setLoading(false); return; }

      const { data: v } = await supabase
        .from('vendedores_rifa')
        .select('id, nome, telefone')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .single();
      if (!v) { setLoading(false); return; }

      const targetRifaId = rifaId ?? null;
      if (!targetRifaId) { setLoading(false); return; }

      const { data: numerosDb } = await supabase
        .from('numeros_rifa')
        .select('id, numero, nome_comprador, telefone_comprador, endereco_comprador, rifas(nome, data_encerramento, custo_por_numero)')
        .eq('rifa_id', targetRifaId)
        .eq('vendedor_id', v.id)
        .eq('status', 'reservado')
        .order('numero');

      if (!numerosDb || numerosDb.length === 0) { setLoading(false); return; }

      const numeroIds = numerosDb.map(n => n.id);
      const { data: cartelas } = await supabase
        .from('cartelas_rifa')
        .select('numero_rifa_id, codigo_validacao')
        .in('numero_rifa_id', numeroIds);

      const codigoMap: Record<string, string> = {};
      for (const c of (cartelas ?? [])) {
        codigoMap[c.numero_rifa_id] = c.codigo_validacao;
      }

      const lista: BilheteData[] = numerosDb.map(nData => ({
        numero: nData.numero,
        codigoValidacao: codigoMap[nData.id] ?? null,
        nome_comprador: nData.nome_comprador ?? null,
        telefone_comprador: nData.telefone_comprador ?? null,
        endereco_comprador: nData.endereco_comprador ?? null,
        rifa: nData.rifas as any,
        vendedor: { nome: v.nome, telefone: v.telefone },
        compra: null,
      }));

      setBilhetes(lista);
      setLoading(false);
    })();
  }, [compraId, rifaId, user]);

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  };

  const rifaInfo = bilhetes[0]?.rifa;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="print:hidden bg-white border-b px-3 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight">Bilhetes — Impressão</h1>
            {rifaInfo && <p className="text-xs text-muted-foreground truncate">{rifaInfo.nome} · {bilhetes.length} bilhete(s)</p>}
          </div>
        </div>
        <Button onClick={() => window.print()} className="gradient-primary shrink-0 h-8 text-xs px-3">
          <Printer className="h-3.5 w-3.5 mr-1.5" />
          Imprimir
        </Button>
      </div>

      <div className="p-4 print:p-0">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : bilhetes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground print:hidden">
            <Ticket className="h-10 w-10 opacity-30" />
            <p>Nenhum bilhete reservado encontrado.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-3xl mx-auto print:max-w-none print:mx-0 print:gap-2">
            {bilhetes.map((b, idx) => (
              <div key={`${b.numero}-${idx}`} className="print:break-inside-avoid">
                {/* BILHETE PRINCIPAL — horizontal */}
                <div className="bg-white rounded-xl overflow-hidden shadow border border-gray-200 print:shadow-none print:border print:border-gray-400 print:rounded-md flex min-w-0">

                  {/* Lateral esquerda verde — número em destaque */}
                  <div className="bg-gradient-to-b from-emerald-600 to-teal-500 flex flex-col items-center justify-center px-3 py-4 shrink-0 min-w-[72px]">
                    <p className="text-white/70 text-[8px] uppercase tracking-widest">Bilhete</p>
                    <p className="text-white font-black text-4xl leading-none font-mono">{String(b.numero).padStart(3, '0')}</p>
                    <p className="text-white/60 text-[8px] mt-1 uppercase tracking-widest">{b.rifa?.nome ?? 'Rifa'}</p>
                  </div>

                  {/* Corpo central */}
                  <div className="flex-1 p-3 flex flex-col justify-between gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="text-[8px] text-gray-400 uppercase tracking-widest">Código de Validação</p>
                        <p className="font-mono font-black text-base tracking-widest text-gray-800">{b.codigoValidacao ?? '—'}</p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <p className="text-[8px] text-gray-400 uppercase tracking-widest">Valor</p>
                        <p className="font-bold text-sm text-gray-800">R$ {b.rifa ? Number(b.rifa.custo_por_numero).toFixed(2) : '—'}</p>
                        <p className="text-[8px] text-gray-400 uppercase tracking-widest">Sorteio</p>
                        <p className="font-bold text-sm text-gray-800">{formatDate(b.rifa?.data_encerramento ?? null)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 border-t border-dashed border-gray-200 pt-2">
                      {b.codigoValidacao && (
                        <QRCodeSVG value={`${BASE_URL}/validar?codigo=${b.codigoValidacao}`} size={52} className="shrink-0" />
                      )}
                      <div className="flex-1 space-y-0.5">
                        <p className="text-[8px] text-gray-400 uppercase tracking-widest">Verifique em:</p>
                        <p className="text-[8px] font-mono text-gray-600">{BASE_URL}/validar</p>
                        <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-1">Comprador</p>
                        <p className="text-xs font-semibold text-gray-800">
                          {b.nome_comprador || <span className="italic text-gray-400 font-normal">A preencher</span>}
                        </p>
                        {b.telefone_comprador && <p className="text-[9px] text-gray-500">{b.telefone_comprador}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Canhoto do vendedor — separado por linha tracejada vertical */}
                  <div className="border-l-2 border-dashed border-gray-300 flex flex-col items-center justify-center px-3 py-3 shrink-0 w-[100px] gap-1.5 relative">
                    <div className="absolute -left-2 -top-2 w-4 h-4 bg-gray-100 rounded-full border border-gray-300 print:bg-white" />
                    <div className="absolute -left-2 -bottom-2 w-4 h-4 bg-gray-100 rounded-full border border-gray-300 print:bg-white" />
                    <p className="text-[7px] text-gray-400 uppercase tracking-widest text-center">Canhoto</p>
                    <div className="text-center space-y-0.5">
                      <p className="text-[7px] text-gray-400 uppercase tracking-widest">Nº</p>
                      <p className="font-black text-xl font-mono text-emerald-700">{String(b.numero).padStart(3, '0')}</p>
                    </div>
                    <div className="text-center space-y-0.5">
                      <p className="text-[7px] text-gray-400 uppercase tracking-widest">Vendedor</p>
                      <p className="text-[8px] font-semibold text-gray-700 text-center leading-tight">{b.vendedor?.nome ?? '—'}</p>
                      {b.vendedor?.telefone && <p className="text-[7px] text-gray-500 text-center">{b.vendedor.telefone}</p>}
                    </div>
                    <div className="text-center space-y-0.5">
                      <p className="text-[7px] text-gray-400 uppercase tracking-widest">Código</p>
                      <p className="font-mono text-[7px] font-bold text-gray-600 break-all">{b.codigoValidacao ?? '—'}</p>
                    </div>
                    <div className="mt-auto pt-1 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full border border-amber-500" />
                      <p className="text-[6px] font-bold text-amber-600 uppercase">Pendente</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          body { background: white !important; }
          .from-emerald-600 { background: #059669 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-gradient-to-b { background: #059669 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .text-white { color: white !important; }
        }
      `}</style>
    </div>
  );
}
