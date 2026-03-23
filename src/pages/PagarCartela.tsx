import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Copy, CheckCircle2, AlertTriangle, ShieldCheck, Camera, CreditCard, SmartphoneNfc, User, FileWarning } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCodePix } from 'qrcode-pix';
import { toast } from 'sonner';

export default function PagarCartela() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codigo = searchParams.get('codigo');
  const paymentStatus = searchParams.get('payment');

  const [venda, setVenda] = useState<any | null>(null);
  const [tipoVenda, setTipoVenda] = useState<'bingo' | 'rifa' | null>(null);
  const [gameSettings, setGameSettings] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  
  // PagBank States
  const [isPagbankLoading, setIsPagbankLoading] = useState(false);
  const [pagbankData, setPagbankData] = useState<{qr_code: string, qr_code_text: string} | null>(null);
  const [nomePagador, setNomePagador] = useState('');
  const [telefonePagador, setTelefonePagador] = useState('');
  const [cpfPagador, setCpfPagador] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!codigo) {
        setLoading(false);
        return;
      }

      // 0. DESMEMBRA O BILHETE
      await supabase.rpc('preparar_cartela_para_pagamento', { p_codigo: codigo.toUpperCase().trim() });

      // 1. Busca Configurações
      const { data: resConfig } = await supabase.from('configuracoes').select('*').single();
      if (resConfig) setGameSettings(resConfig);

      // 2. Tenta buscar no Bingo
      const { data: resBingo } = await supabase
        .from('vendas_bingo_fisico')
        .select('*, partidas(name)')
        .eq('codigo_validacao', codigo.toUpperCase().trim())
        .maybeSingle();

      if (resBingo) {
        setVenda(resBingo);
        setTipoVenda('bingo');
        if (resBingo.nome_comprador) setNomePagador(resBingo.nome_comprador);
        if (resBingo.telefone_comprador) setTelefonePagador(resBingo.telefone_comprador);
        setLoading(false);
        return;
      }

      // 3. Se não achou no bingo, tenta buscar na Rifa
      const { data: resRifa } = await supabase
        .from('cartelas_rifa')
        .select('*, compras_rifa(*, rifas(nome)), numeros_rifa(nome_comprador, telefone_comprador)')
        .eq('codigo_validacao', codigo.toUpperCase().trim())
        .maybeSingle();

      if (resRifa && resRifa.compras_rifa) {
        setVenda({
            id: resRifa.compras_rifa.id, 
            cartela_id: resRifa.id,
            status: resRifa.compras_rifa.status,
            codigo_validacao: resRifa.codigo_validacao,
            valor_pago: resRifa.compras_rifa.valor_total,
            desconto_aplicado: resRifa.compras_rifa.desconto_aplicado,
            partidas: { name: resRifa.compras_rifa.rifas?.nome },
            admin_id: resRifa.admin_id
        });
        setTipoVenda('rifa');
        
        const info = Array.isArray(resRifa.numeros_rifa) ? resRifa.numeros_rifa[0] : resRifa.numeros_rifa;
        if (info?.nome_comprador) setNomePagador(info.nome_comprador);
        if (info?.telefone_comprador) setTelefonePagador(info.telefone_comprador);
      }

      setLoading(false);
    }
    loadData();
  }, [codigo]);

  useEffect(() => {
    if (paymentStatus === 'success' && codigo && tipoVenda) {
      toast.success("Pagamento confirmado via Cartão! Cartela ativada.");
      navigate(`/validar-cartela?${tipoVenda === 'rifa' ? 'codigo' : 'bingo'}=${codigo}`, { replace: true });
    }
  }, [paymentStatus, codigo, tipoVenda, navigate]);


  const valorCheio = useMemo(() => {
    if (!venda) return 0;
    const desc = Number(venda.desconto_aplicado || 0);
    if (desc >= 100) return Number(venda.valor_pago);
    return Number(venda.valor_pago) / (1 - (desc / 100));
  }, [venda]);

  const calcFee = (method: 'pix' | 'card') => {
      if (!gameSettings?.pagbank_pass_fees_to_customer) return null;
      const perc = method === 'pix' ? (gameSettings.pagbank_pix_fee_percentage || 0) : (gameSettings.pagbank_card_fee_percentage || 0);
      const fix = method === 'pix' ? (gameSettings.pagbank_pix_fee_fixed || 0) : (gameSettings.pagbank_card_fee_fixed || 0);
      const final = (valorCheio + fix) / (1 - (perc / 100));
      const finalRounded = Math.ceil(final * 100) / 100;
      return { final: finalRounded, fee: finalRounded - valorCheio };
  };

  const pixFeeDetails = calcFee('pix');
  const cardFeeDetails = calcFee('card');

  const pixPayload = useMemo(() => {
    if (!gameSettings?.pix_key || !venda) return '';
    try {
      const cleanKey = gameSettings.pix_key.replace(/\s/g, '');
      const cleanName = (gameSettings.pix_name || 'BINGOSHOW').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '').toUpperCase();
      const cleanCity = (gameSettings.pix_city || 'SAOPAULO').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '').toUpperCase();

      return QrCodePix({
        version: '01',
        key: cleanKey,
        name: cleanName,
        city: cleanCity,
        value: parseFloat(valorCheio.toFixed(2)),
      }).payload();
    } catch (e) {
      console.error("Erro ao gerar payload PIX:", e);
      return '';
    }
  }, [gameSettings, venda, valorCheio]);

  const handleCopiarPix = (textToCopy: string) => {
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      toast.success('Código PIX Copia e Cola copiado com sucesso!');
    }
  };

  const handlePagbankPayment = async (method: 'pix' | 'CREDIT_CARD') => {
    if (!nomePagador.trim() || !telefonePagador.trim() || !cpfPagador.trim()) {
      toast.error("Por favor, preencha Nome, WhatsApp e CPF para identificar sua cartela.");
      return;
    }

    if (method === 'pix') setIsPagbankLoading(true);
    else setIsStripeLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-pagbank-payment', {
        body: { 
          amount: valorCheio,
          type: tipoVenda === 'bingo' ? 'venda_bingo' : 'venda_rifa',
          metadata: { 
            venda_id: venda.id, 
            codigo: venda.codigo_validacao, 
            customer_cpf: cpfPagador,
            cliente_nome: nomePagador.trim(),
            cliente_telefone: telefonePagador.trim(),
            origin: window.location.origin
          },
          admin_id: venda.admin_id || gameSettings?.admin_id,
          payment_method: method
        }
      });

      if (error) throw error;
      if (data?.success) {
        if (method === 'CREDIT_CARD' && data.checkout_link) {
           window.location.href = data.checkout_link;
        } else if (method === 'pix' && data.qr_code) {
           setPagbankData({ qr_code: data.qr_code, qr_code_text: data.qr_code_text });
           toast.success("PIX Gerado! Realize o pagamento para ativar a cartela.");
        }
      } else {
        if (data?.error?.includes('CPF_REQUIRED')) {
           toast.error("CPF Inválido! Digite os 11 números corretamente.", { duration: 6000 });
        } else {
           throw new Error(data?.error || "Erro desconhecido na geração.");
        }
      }
    } catch (e: any) {
      if (e.message === 'Failed to fetch' || e.message.includes('NetworkError')) {
         toast.error("Sua conexão de internet falhou. Verifique seu sinal e tente novamente.");
      } else {
         toast.error("Erro do Banco: " + e.message);
      }
    } finally {
      setIsPagbankLoading(false);
      setIsStripeLoading(false);
    }
  };

  const handleStripePayment = async () => {
    setIsStripeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-session', {
        body: { 
          amount: valorCheio,
          type: tipoVenda === 'bingo' ? 'venda_bingo' : 'venda_rifa',
          metadata: { venda_id: venda.id, codigo: venda.codigo_validacao }
        }
      });

      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) { toast.error("Erro ao iniciar pagamento: " + e.message); } finally { setIsStripeLoading(false); }
  };

  if (loading) return <div className="min-h-[70vh] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (!venda) return <div className="card-container text-center py-20 max-w-md mx-auto mt-10"><AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4 opacity-50" /><h2 className="text-xl font-bold mb-2">Código não encontrado</h2><Button onClick={() => navigate('/')}>Início</Button></div>;
  if (venda.status === 'pago') return <div className="card-container text-center py-16 max-w-md mx-auto mt-10 border-success/30 bg-success/5"><CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" /><h2 className="text-2xl font-bold text-success mb-2">Pagamento Confirmado!</h2><Button className="w-full bg-success" onClick={() => navigate(`/validar-cartela?${tipoVenda === 'rifa' ? 'codigo' : 'bingo'}=${venda.codigo_validacao}`)}>Conferir Cartela</Button></div>;
  if (venda.status === 'em_analise') return <div className="card-container text-center py-16 max-w-md mx-auto mt-10 border-blue-300 bg-blue-50"><ShieldCheck className="w-16 h-16 text-blue-500 mx-auto mb-4" /><h2 className="text-2xl font-bold text-blue-700 mb-2">Em Análise</h2><Button variant="outline" className="w-full border-blue-300 text-blue-700" onClick={() => navigate('/')}>Início</Button></div>;

  return (
    <div className="max-w-md mx-auto space-y-6 pt-4 pb-20 px-2">
      <div className="text-center space-y-2">
        <h1 className="font-heading text-2xl font-black text-foreground">Pagamento do Bilhete</h1>
        <p className="text-muted-foreground text-sm">Siga as instruções para ativar sua cartela.</p>
      </div>

      <div className="card-container border-2 border-primary/20 shadow-lg p-0 overflow-hidden">
        <div className="bg-primary/5 p-4 text-center border-b border-primary/20">
           <p className="text-sm font-bold text-primary uppercase tracking-wider mb-1">{venda.partidas?.name}</p>
           <p className="text-xs font-mono bg-white inline-block px-3 py-1 rounded border font-bold">Cód: {venda.codigo_validacao}</p>
        </div>

        <div className="p-4 space-y-6">
          {gameSettings?.pagbank_enabled ? (
             <div className="space-y-4">
                <div className="bg-muted/30 p-4 border rounded-xl space-y-3">
                  <p className="text-[10px] uppercase font-bold text-primary flex items-center gap-1.5 border-b pb-2"><User className="w-4 h-4" /> Identificação (Obrigatório)</p>
                  <div className="space-y-1"><Label className="text-xs">Nome Completo</Label><Input value={nomePagador} onChange={e => setNomePagador(e.target.value)} className="h-9 text-xs bg-white" /></div>
                  <div className="space-y-1"><Label className="text-xs">WhatsApp</Label><Input value={telefonePagador} onChange={e => setTelefonePagador(e.target.value)} className="h-9 text-xs bg-white" /></div>
                  <div className="space-y-1"><Label className="text-xs">CPF</Label><Input value={cpfPagador} onChange={e => setCpfPagador(e.target.value)} placeholder="000.000.000-00" className="h-9 text-xs bg-white" /></div>
                </div>

                <div className="space-y-3">
                   <p className="text-[10px] uppercase font-bold text-muted-foreground text-center">Opções de Pagamento</p>

                   {/* Cartão Checkout */}
                   <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold flex items-center gap-2 text-blue-700"><CreditCard className="w-5 h-5"/> Cartão</span>
                        <span className="font-black text-lg text-blue-700">R$ {(cardFeeDetails?.final || valorCheio).toFixed(2).replace('.', ',')}</span>
                      </div>
                      {cardFeeDetails && <p className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded">Inclui taxa de R$ {cardFeeDetails.fee.toFixed(2)}. Liberação imediata.</p>}
                      <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handlePagbankPayment('CREDIT_CARD')} disabled={isStripeLoading || valorCheio <= 0}>
                         {isStripeLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Pagar no Cartão
                      </Button>
                   </div>

                   {/* PIX PagBank */}
                   <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold flex items-center gap-2 text-green-700"><SmartphoneNfc className="w-5 h-5"/> PIX Rápido</span>
                        <span className="font-black text-lg text-green-700">R$ {(pixFeeDetails?.final || valorCheio).toFixed(2).replace('.', ',')}</span>
                      </div>
                      {!pagbankData ? (
                        <>
                          {pixFeeDetails && <p className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded">Inclui taxa bancária de R$ {pixFeeDetails.fee.toFixed(2)}.</p>}
                          <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handlePagbankPayment('pix')} disabled={isPagbankLoading || valorCheio <= 0}>
                             {isPagbankLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Gerar QR Code PIX
                          </Button>
                        </>
                      ) : (
                        <div className="space-y-3 flex flex-col items-center bg-green-50/50 p-3 rounded-lg border border-green-100">
                          <div className="bg-white p-2 rounded shadow-sm"><img src={pagbankData.qr_code} className="w-[140px] h-[140px]" /></div>
                          <div className="w-full">
                            <Label className="text-xs mb-1 block">PIX Copia e Cola</Label>
                            <div className="flex gap-2">
                              <Input value={pagbankData.qr_code_text} readOnly className="font-mono text-[10px] bg-white" />
                              <Button size="icon" onClick={() => handleCopiarPix(pagbankData.qr_code_text)}><Copy className="w-4 h-4" /></Button>
                            </div>
                          </div>
                        </div>
                      )}
                   </div>
                </div>
             </div>
          ) : null}

          {/* PIX MANUAL FALLBACK */}
          {gameSettings?.pix_key && (
             <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 mt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold flex items-center gap-2 text-amber-800"><FileWarning className="w-5 h-5"/> PIX Manual</span>
                  <span className="font-black text-lg text-amber-800">R$ {valorCheio.toFixed(2).replace('.', ',')}</span>
                </div>
                <p className="text-[10px] text-amber-700">Sem taxas bancárias, porém exige envio de comprovante e a liberação pode demorar.</p>
                
                <div className="flex flex-col items-center bg-white p-3 rounded-lg border border-amber-200">
                   {pixPayload && <QRCodeSVG value={pixPayload} size={120} className="mb-3" />}
                   <div className="w-full flex gap-2">
                     <Input value={pixPayload} readOnly className="font-mono text-[10px]" />
                     <Button size="icon" variant="outline" className="text-amber-700" onClick={() => handleCopiarPix(pixPayload)}><Copy className="w-4 h-4" /></Button>
                   </div>
                </div>

                <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-12" onClick={() => navigate(`/validar-cartela?${tipoVenda === 'rifa' ? 'codigo' : 'bingo'}=${venda.codigo_validacao}`)}>
                  <Camera className="w-5 h-5 mr-2" /> Enviar Comprovante
                </Button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}