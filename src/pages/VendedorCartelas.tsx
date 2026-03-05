import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Loader2, Ticket, ShieldCheck, User, Phone, MapPin, ExternalLink } from 'lucide-react';
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
    codigo_ref: string | null;
  } | null;
  compra: {
    created_at: string;
    valor_total: number;
    numeros: number[];
    id: string;
  } | null;
}

export default function VendedorCartelas() {
  const navigate = useNavigate();
  const { rifaId } = useParams<{ rifaId?: string }>();
  const { user } = useAuth();
  const [bilhetes, setBilhetes] = useState<BilheteData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      if (!user || !rifaId) { setLoading(false); return; }

      const { data: v } = await supabase
        .from('vendedores_rifa')
        .select('id, nome, telefone, codigo_ref')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .single();
      if (!v) { setLoading(false); return; }

      const { data: numerosDb } = await supabase
        .from('numeros_rifa')
        .select('id, numero, nome_comprador, telefone_comprador, endereco_comprador, rifas(nome, data_encerramento, custo_por_numero)')
        .eq('rifa_id', rifaId)
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
        vendedor: { nome: v.nome, telefone: v.telefone, codigo_ref: v.codigo_ref },
        compra: null,
      }));

      setBilhetes(lista);
      setLoading(false);
    })();
  }, [rifaId, user]);

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
            <h1 className="text-base font-bold leading-tight">Impressão de Bilhetes</h1>
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
          <div className="flex flex-col gap-4 max-w-4xl mx-auto print:max-w-none print:mx-0 print:gap-2">
            {bilhetes.map((b, idx) => (
              <div key={`${b.numero}-${idx}`} className="print:break-inside-avoid">
                <div className="bg-white rounded-xl overflow-hidden shadow border border-gray-200 print:shadow-none print:border print:border-gray-400 print:rounded-none flex min-w-0 h-[180px]">
                  
                  {/* CANHOTO DO CLIENTE (MAIOR) */}
                  <div className="flex-1 flex min-w-0">
                    {/* Faixa Lateral */}
                    <div className="bg-emerald-600 flex flex-col items-center justify-center px-3 shrink-0 text-white">
                      <p className="text-[8px] uppercase font-bold rotate-180 [writing-mode:vertical-lr]">BILHETE OFICIAL</p>
                      <p className="text-2xl font-black font-mono mt-2">{String(b.numero).padStart(3, '0')}</p>
                    </div>

                    {/* Conteúdo Cliente */}
                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <h2 className="text-lg font-black text-gray-800 uppercase truncate leading-tight">{b.rifa?.nome}</h2>
                          <p className="text-[10px] text-gray-500 font-bold mt-0.5">CÓDIGO: <span className="text-gray-800 font-mono">{b.codigoValidacao}</span></p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[8px] text-gray-400 uppercase font-bold">Valor</p>
                          <p className="text-sm font-black text-emerald-600">R$ {Number(b.rifa?.custo_por_numero).toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-y border-gray-100 py-2 my-1">
                        <div>
                          <p className="text-[7px] text-gray-400 uppercase font-bold">Data do Sorteio</p>
                          <p className="text-[10px] font-bold text-gray-700">{formatDate(b.rifa?.data_encerramento ?? null)}</p>
                        </div>
                        <div>
                          <p className="text-[7px] text-gray-400 uppercase font-bold">Cadastre-se e Jogue</p>
                          <p className="text-[9px] font-mono text-emerald-600 font-bold truncate">{BASE_URL.replace('https://', '')}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="shrink-0 flex flex-col items-center">
                          {b.vendedor?.codigo_ref && (
                            <QRCodeSVG value={`${BASE_URL}/vendedor/perfil/${b.vendedor.codigo_ref}`} size={45} />
                          )}
                          <p className="text-[6px] text-gray-400 font-bold mt-1 uppercase">Vendedor</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-emerald-600">
                            <ShieldCheck className="h-3 w-3" />
                            <span className="text-[8px] font-black uppercase">Vendedor Autorizado</span>
                          </div>
                          <p className="text-[10px] font-bold text-gray-700 truncate">{b.vendedor?.nome}</p>
                          <p className="text-[8px] text-gray-500">Ref: {b.vendedor?.codigo_ref}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* LINHA DE CORTE */}
                  <div className="w-0 border-l-2 border-dashed border-gray-300 relative">
                    <div className="absolute -top-2 -left-2 w-4 h-4 bg-gray-100 rounded-full border border-gray-300 print:bg-white" />
                    <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-gray-100 rounded-full border border-gray-300 print:bg-white" />
                  </div>

                  {/* CANHOTO DO VENDEDOR (MENOR) */}
                  <div className="w-[220px] bg-gray-50/50 p-3 flex flex-col shrink-0">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[8px] font-black text-gray-400 uppercase">Canhoto Vendedor</p>
                      <p className="text-sm font-black font-mono text-gray-800">Nº {String(b.numero).padStart(3, '0')}</p>
                    </div>

                    {/* Campos para preencher */}
                    <div className="space-y-2 flex-1">
                      <div className="border-b border-gray-300 pb-0.5">
                        <p className="text-[7px] text-gray-400 uppercase font-bold">Nome Comprador</p>
                        <div className="h-4" /> {/* Espaço para escrever */}
                      </div>
                      <div className="border-b border-gray-300 pb-0.5">
                        <p className="text-[7px] text-gray-400 uppercase font-bold">Telefone / WhatsApp</p>
                        <div className="h-4" />
                      </div>
                      <div className="border-b border-gray-300 pb-0.5">
                        <p className="text-[7px] text-gray-400 uppercase font-bold">Endereço</p>
                        <div className="h-4" />
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[7px] text-gray-400 uppercase font-bold truncate">{b.rifa?.nome}</p>
                        <p className="text-[8px] font-black text-emerald-600 mt-0.5">VALIDAR VENDA →</p>
                      </div>
                      <div className="shrink-0 bg-white p-1 border border-gray-200 rounded shadow-sm">
                        <QRCodeSVG value={`${BASE_URL}/validar-cartela?codigo=${b.codigoValidacao}`} size={40} />
                      </div>
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
          @page { size: A4; margin: 10mm; }
          body { background: white !important; }
          .bg-emerald-600 { background-color: #059669 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .text-white { color: white !important; }
          .bg-gray-50\/50 { background-color: #f9fafb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}