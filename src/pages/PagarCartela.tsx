import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Copy, CheckCircle2, AlertTriangle, ShieldCheck, Camera, CreditCard, SmartphoneNfc, User } from 'lucide-react';
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
  
  // PagBank States & User Identification
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

      // 0. DESMEMBRA O BILHETE SE ELE FIZER PARTE DE UM CARRINHO GRANDE!
      // Isso garante que o valor_pago que vamos buscar no passo 3 seja exato ao bilhete único.
      await supabase.rpc('preparar_cartela_para_pagamento', { p_codigo: codigo.toUpperCase().trim() });

      // 1. Busca Configurações
      const { data: resConfig } = await supabase.from('configuracoes').select('*').single();
      if (resConfig) setGameSettings(resConfig);

      // 2. Tenta buscar no Bingo
      const { data: resBingo, error: errBingo } = await supabase
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
      const { data: resRifa, error: errRifa } = await supabase
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
        
        // Se a rifa já tiver os dados do comprador (vendedor preencheu na hora), puxa aqui
        const info = Array.isArray(resRifa.numeros_rifa) ? resRifa.numeros_rifa[0] : resRifa.numeros_rifa;
        if (info?.nome_comprador) setNomePagador(info.nome_comprador);
        if (info?.telefone_comprador) setTelefonePagador(info.telefone_comprador);
      }

      setLoading(false);
    }
    loadData();
  }, [codigo]);

  // Alerta e redirecionamento de sucesso se voltar do Stripe
  useEffect(() => {
    if (paymentStatus === 'success' && codigo && tipoVenda) {
      toast.success("Pagamento confirmado via Cartão! Agora só falta preencher seus dados.");
      navigate(`/validar-cartela?${tipoVenda === 'rifa' ? 'codigo' : 'bingo'}=${codigo}`, { replace: true });
    }
  }, [paymentStatus, codigo, tipoVenda, navigate]);


  const valorCheio = useMemo(() => {
    if (!venda) return 0;
    const desc = Number(venda.desconto_aplicado || 0);
    if (desc >= 100) return Number(venda.valor_pago);
    return Number(venda.valor_pago) / (1 - (desc / 100));
  }, [venda]);

  const stripeFeeDetails = useMemo(() => {
    if (!gameSettings?.stripe_pass_fees_to_customer) return null;
    const perc = gameSettings.stripe_fee_percentage || 0;
    const fix = gameSettings.stripe_fee_fixed || 0;
    const final = (valorCheio + fix) / (1 - (perc / 100));
    const finalRounded = Math.ceil(final * 100) / 100;
    const fee = finalRounded - valorCheio;
    return { final: finalRounded, fee };
  }, [valorCheio, gameSettings]);

  const finalStripeAmount = stripeFeeDetails ? stripeFeeDetails.final : valorCheio;

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
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      toast.error("Erro ao iniciar pagamento: " + e.message);
    } finally {
      setIsStripeLoading(false);
    }
  };

  const handlePagbankPayment = async () => {
    if (!nomePagador.trim() || !telefonePagador.trim() || !cpfPagador.trim()) {
      toast.error("Por favor, preencha Nome, WhatsApp e CPF para garantir sua cartela.");
      return;
    }

    setIsPagbankLoading(true);
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
            cliente_telefone: telefonePagador.trim()
          },
          admin_id: venda.admin_id || gameSettings?.admin_id
        }
      });

      if (error) throw error;
      if (data?.success && data?.qr_code) {
        setPagbankData({ qr_code: data.qr_code, qr_code_text: data.qr_code_text });
        toast.success("PIX Gerado! Como você já preencheu seus dados, seu bilhete será ativado automaticamente após o pagamento.");
      } else {
        throw new Error(data?.error || "Erro desconhecido ao gerar PIX.");
      }
    } catch (e: any) {
      if (e.message.includes('CPF_REQUIRED')) {
        toast.error("CPF Inválido. Digite um CPF correto com 11 números para gerar o pagamento.");
      } else if (e.message.includes('401') || e.message.includes('FetchError') || e.message.includes('Failed to load resource')) {
         toast.error("Sua conexão caiu. Por favor, atualize a página (F5) e tente novamente.");
      } else {
         toast.error("Erro ao gerar PIX PagBank: " + e.message);
      }
    } finally {
      setIsPagbankLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!venda) {
    return (
      <div className="card-container text-center py-20 max-w-md mx-auto mt-10">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold mb-2">Código não encontrado</h2>
        <p className="text-muted-foreground mb-6">Não conseguimos localizar o bilhete informado.</p>
        <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
      </div>
    );
  }

  if (venda.status === 'pago') {
    return (
      <div className="card-container text-center py-16 max-w-md mx-auto mt-10 border-success/30 bg-success/5">
        <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-success mb-2">Pagamento Confirmado!</h2>
        <p className="text-muted-foreground mb-6">Verifique se você precisa validar seus dados para concorrer ao sorteio.</p>
        <Button className="w-full bg-success hover:bg-success/90" onClick={() => navigate(`/validar-cartela?${tipoVenda === 'rifa' ? 'codigo' : 'bingo'}=${venda.codigo_validacao}`)}>Validar / Conferir Cartela</Button>
      </div>
    );
  }

  if (venda.status === 'em_analise') {
    return (
      <div className="card-container text-center py-16 max-w-md mx-auto mt-10 border-blue-300 bg-blue-50">
        <ShieldCheck className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-blue-700 mb-2">Comprovante em Análise</h2>
        <p className="text-blue-600/80 mb-6">Você já enviou o comprovante. O administrador está revisando o pagamento.</p>
        <Button variant="outline" className="w-full border-blue-300 text-blue-700" onClick={() => navigate('/')}>Voltar ao Início</Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pt-4 pb-20 px-2">
      <div className="text-center space-y-2">
        <h1 className="font-heading text-2xl font-black text-foreground">Pagamento do Bilhete</h1>
        <p className="text-muted-foreground text-sm">
          Siga as instruções abaixo para pagar e liberar sua cartela.
        </p>
      </div>

      <div className="card-container border-2 border-primary/20 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-primary" />
        
        <div className="p-2 mb-4 text-center">
           <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">{venda.partidas?.name}</p>
           <p className="text-xs font-mono bg-muted inline-block px-3 py-1 rounded-full font-bold">Cód: {venda.codigo_validacao}</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="font-bold flex items-center gap-2 text-foreground">
              <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0">1</span>
              Escolha a forma de pagamento
            </h3>
            
            {gameSettings?.stripe_enabled && (
              <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-2 text-center">
                <Button
                  className="w-full min-h-14 h-auto py-3 px-2 bg-primary hover:bg-primary/90 text-white shadow-button font-bold text-sm sm:text-lg whitespace-normal leading-tight"
                  onClick={handleStripePayment}
                  disabled={isStripeLoading}
                >
                  {isStripeLoading ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2 animate-spin shrink-0" /> : <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 mr-2 shrink-0" />}
                  <span>PAGAR R$ {finalStripeAmount.toFixed(2).replace('.', ',')} NO CARTÃO</span>
                </Button>
                {stripeFeeDetails ? (
                  <div className="text-[10px] text-muted-foreground bg-white/60 p-2 rounded border border-primary/10 flex justify-between items-center px-4">
                    <span>Valor Bilhete: <strong>R$ {valorCheio.toFixed(2).replace('.', ',')}</strong></span>
                    <span>+ Taxa Cartão: <strong>R$ {stripeFeeDetails.fee.toFixed(2).replace('.', ',')}</strong></span>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">A cartela é validada instantaneamente.</p>
                )}
              </div>
            )}

            {gameSettings?.pagbank_enabled ? (
              <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20 space-y-3 mt-4 text-center">
                <h4 className="font-bold text-green-800 flex justify-center items-center gap-2"><SmartphoneNfc className="w-5 h-5" /> PIX Automático</h4>
                
                {!pagbankData ? (
                  <>
                    <div className="p-3 bg-white/60 border border-green-500/20 rounded-lg text-left space-y-3 mb-3">
                      <p className="text-[10px] uppercase font-bold text-green-800 flex items-center gap-1.5 border-b border-green-200 pb-1.5">
                        <User className="w-3.5 h-3.5" /> Identificação Obrigatória
                      </p>

                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-gray-700">Nome Completo *</Label>
                        <Input value={nomePagador} onChange={e => setNomePagador(e.target.value)} placeholder="Seu nome" className="h-9 text-xs bg-white border-green-200" />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-gray-700">WhatsApp *</Label>
                        <Input value={telefonePagador} onChange={e => setTelefonePagador(e.target.value)} placeholder="(00) 00000-0000" className="h-9 text-xs bg-white border-green-200" />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-green-800">CPF (Exigido pelo Banco) *</Label>
                        <Input
                          value={cpfPagador}
                          onChange={e => setCpfPagador(e.target.value)}
                          placeholder="000.000.000-00"
                          className="h-9 text-xs bg-white border-green-400 focus-visible:ring-green-500"
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 text-white font-bold shadow-button"
                      onClick={handlePagbankPayment}
                      disabled={isPagbankLoading}
                    >
                      {isPagbankLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
                      Gerar PIX de R$ {valorCheio.toFixed(2).replace('.', ',')}
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3 animate-in fade-in zoom-in duration-300">
                    <div className="bg-white p-3 rounded-lg inline-block shadow-sm border border-gray-200">
                      <img src={pagbankData.qr_code} alt="QR Code PagBank" className="w-[160px] h-[160px]" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase font-bold text-left block">PIX Copia e Cola</Label>
                      <div className="relative">
                        <Input value={pagbankData.qr_code_text} readOnly className="pr-20 font-mono text-xs bg-white text-black" />
                        <Button size="sm" className="absolute right-1 top-1 h-8 bg-green-600 hover:bg-green-700" onClick={() => handleCopiarPix(pagbankData.qr_code_text)}>
                          <Copy className="w-3 h-3 mr-1" /> Copiar
                        </Button>
                      </div>
                    </div>
                    <div className="text-[10px] text-green-800 font-bold bg-green-500/20 p-3 rounded text-left border border-green-500/30">
                      <p className="flex items-center gap-1.5 mb-1"><CheckCircle2 className="w-3.5 h-3.5" /> Cartela cadastrada para <strong>{nomePagador}</strong>!</p>
                      <p className="opacity-90 leading-tight">Você não precisará enviar comprovante. O seu bilhete oficial será ativado automaticamente após você concluir o pagamento do PIX acima.</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="pt-4">
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Ou PIX Manual (Sem taxas extras)</span></div>
                </div>

                <div className="bg-muted/40 p-4 rounded-xl border border-border/50 text-center space-y-4">
                  <p className="text-2xl font-black font-heading text-primary">R$ {valorCheio.toFixed(2).replace('.', ',')}</p>
                  
                  {pixPayload ? (
                    <div className="bg-white p-3 rounded-lg inline-block shadow-sm border border-gray-200">
                      <QRCodeSVG value={pixPayload} size={160} />
                    </div>
                  ) : (
                    <div className="p-8 text-destructive flex flex-col items-center gap-2">
                      <AlertTriangle className="w-8 h-8" />
                      <p className="text-xs font-bold">Erro ao gerar QR Code PIX.</p>
                    </div>
                  )}
                  
                  <div className="space-y-2 text-left">
                    <Label className="text-xs text-muted-foreground uppercase font-bold">PIX Copia e Cola</Label>
                    <div className="relative">
                      <Input value={pixPayload} readOnly className="pr-24 font-mono text-xs bg-white" />
                      <Button 
                        size="sm" 
                        className="absolute right-1 top-1 h-8"
                        onClick={() => handleCopiarPix(pixPayload)}
                        disabled={!pixPayload}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copiar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!gameSettings?.pagbank_enabled && (
            <div className="space-y-3 pt-4 border-t">
              <h3 className="font-bold flex items-center gap-2 text-foreground">
                <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0">2</span>
                Envio de Comprovante e Validação
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Você já fez o pagamento do PIX Manual no seu banco? Avance para enviar o comprovante e se identificar!
              </p>

              <div className="text-center pt-2">
                <Button 
                  className="w-full h-14 text-xl font-bold bg-green-600 hover:bg-green-700 text-white shadow-button animate-pulse"
                  onClick={() => navigate(`/validar-cartela?${tipoVenda === 'rifa' ? 'codigo' : 'bingo'}=${venda.codigo_validacao}`)}
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Continuar p/ Validar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}