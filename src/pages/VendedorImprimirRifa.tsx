// Forçando a atualização do HMR para resolver possíveis problemas de renderização.
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Loader2, ShieldCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CompraRifa } from '@/types/rifa';
import { ThermalRifaTicket } from '@/components/ThermalRifaTicket';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const BASE_URL = window.location.origin;

type PrintFormat = 'a4' | 'thermal_58' | 'thermal_80';

export default function VendedorImprimirRifa() {
  const { compraId } = useParams<{ compraId: string }>();
  const navigate = useNavigate();
  const [compra, setCompra] = useState<CompraRifa | null>(null);
  const [loading, setLoading] = useState(true);
  const [printFormat, setPrintFormat] = useState<PrintFormat>('a4');

  useEffect(() => {
    async function loadCompra() {
      if (!compraId) return;

      const { data } = await supabase
        .from('compras_rifa')
        .select('*, rifas(*), clientes_rifa(*), vendedores_rifa(*)')
        .eq('id', compraId)
        .single();

      if (data) setCompra(data as CompraRifa);
      setLoading(false);
    }
    loadCompra();
  }, [compraId]);

  const printStyles = {
    a4: `@media print { @page { size: A4 portrait; margin: 10mm; } body { background: white !important; -webkit-print-color-adjust: exact; } .no-print { display: none; } }`,
    thermal_58: `@media print { @page { size: 58mm 300mm; margin: 0; } body { background: white !important; -webkit-print-color-adjust: exact; } .no-print { display: none; } }`,
    thermal_80: `@media print { @page { size: 80mm 300mm; margin: 0; } body { background: white !important; -webkit-print-color-adjust: exact; } .no-print { display: none; } }`,
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="w-10 h-10 animate-spin text-purple-600" /></div>;
  }

  if (!compra) return <div className="text-center py-20 text-muted-foreground">Compra não encontrada.</div>;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white overflow-visible">
      <div className="print:hidden bg-white border-b px-4 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <div><h1 className="font-bold">Impressão de Rifa</h1><p className="text-xs text-muted-foreground">Compra #{compra.id.substring(0,6)}</p></div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Select value={printFormat} onValueChange={(value) => setPrintFormat(value as PrintFormat)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Formato de Impressão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a4">Folha A4</SelectItem>
              <SelectItem value="thermal_58">Térmica 58mm</SelectItem>
              <SelectItem value="thermal_80">Térmica 80mm</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => window.print()} className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"><Printer className="h-4 w-4 mr-2" /> Imprimir</Button>
        </div>
      </div>

      {printFormat === 'a4' ? (
        <div className="max-w-4xl mx-auto p-4 sm:p-8 print:p-0 w-full">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 print:shadow-none print:border-none print:p-0">
            <div className="flex justify-between items-start border-b-2 border-dashed border-gray-400 pb-4 mb-4">
              <div>
                <h2 className="text-2xl font-black uppercase text-gray-900 leading-tight">{compra.rifas.nome}</h2>
                <p className="text-sm font-bold text-gray-600 mt-1">Sorteio: {compra.rifas.data_sorteio ? format(new Date(compra.rifas.data_sorteio), "dd/MM/yyyy") : 'Não definido'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase font-bold">Comprovante</p>
                <p className="text-lg font-mono font-bold text-black tracking-wider">{compra.id.substring(0,8).toUpperCase()}</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase">Seus Números da Sorte</h3>
              <div className="flex flex-wrap gap-2">
                {compra.numeros.map((num: number) => (
                  <div key={num} className="bg-purple-100 border border-purple-300 text-purple-800 font-bold text-xl px-3 py-1 rounded">
                    {num.toString().padStart(compra.rifas.quantidade_numeros > 999 ? 4 : 3, '0')}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t-2 border-dashed border-gray-200 pt-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Cliente</p>
                <p className="text-sm font-bold">{compra.clientes_rifa?.nome || 'Não identificado'}</p>
                {compra.clientes_rifa?.telefone && <p className="text-xs text-gray-600">{compra.clientes_rifa.telefone}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Vendedor</p>
                <p className="text-sm font-bold flex items-center gap-1">
                  {compra.vendedores_rifa.nome}
                  <ShieldCheck className="w-3 h-3 text-green-600" />
                </p>
                <p className="text-xs text-gray-600">Ref: {compra.vendedores_rifa.codigo_ref}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-between items-end border-t-2 border-dashed border-gray-200 pt-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Data da Compra</p>
                <p className="text-sm font-bold">{format(new Date(compra.created_at), "dd/MM/yyyy HH:mm")}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase font-bold">Valor Total</p>
                <p className="text-2xl font-black text-green-700">R$ {compra.valor_total.toFixed(2)}</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center pt-6 border-t border-gray-200 print:hidden">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Acompanhe a Rifa</p>
              <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                <QRCodeSVG value={`${BASE_URL}/rifa/${compra.rifa_id}`} size={100} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 p-4">
          <ThermalRifaTicket 
            compra={compra} 
            baseUrl={BASE_URL} 
            format={printFormat as 'thermal_58' | 'thermal_80'} 
          />
        </div>
      )}
      <style>{printStyles[printFormat]}</style>
    </div>
  );
}
