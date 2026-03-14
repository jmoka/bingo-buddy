import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Copy, CheckCircle2, AlertTriangle, ShieldCheck, Camera, CreditCard } from 'lucide-react';
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

  // Alerta de sucesso se voltar do Stripe
  useEffect(() => {
    if (paymentStatus === 'success') {
      toast.success("Pagamento aprovado com sucesso! Sua cartela está válida.");
      window.history.replaceState({}, document.title, window.location.pathname + "?codigo=" + codigo);
    }
  }, [paymentStatus, codigo]);

  useEffect(() => {
    async function loadData() {
      if (!codigo) {
        setLoading(false);
        return;
      }

      // 1. Busca Configurações
      const { data: resConfig } = await supabase.from('configuracoes').select('*').single();
      if (resConfig) setGameSettings(resConfig);

      // 2. Tenta buscar no Bingo
      const { data: resBingo } = await supabase
        .from('vendas_bingo_fisico')
        .select('*, partidas(name), vendedores_rifa(nome)')
        .eq('codigo_validacao', codigo.toUpperCase().trim())
        .maybeSingle();

      if (resBingo) {
        setVenda(resBingo);
        setTipoVenda('bingo');
        setLoading(false);
        return;
      }

      // 3. Se não achou no bingo, tenta buscar na Rifa
      const { data: resRifa } = await supabase
        .from('cartelas_rifa')
        .select('*, compras_rifa(*, rifas(nome), vendedores_rifa(nome))')
        .eq('codigo_validacao', codigo.toUpperCase().trim())
        .maybeSingle();

      if (resRifa && resRifa.compras_rifa) {
        // Normaliza os dados da rifa para o formato esperado pelo componente
        // O ID TEM que ser o da COMPRA para o Webhook achar no banco e dar baixa
        setVenda({
            id: resRifa.compras_rifa.id, 
            cartela_id: resRifa.id,
            status: resRifa.compras_rifa.status,
            codigo_validacao: resRifa.codigo_validacao,
            valor_pago: resRifa.compras_rifa.valor_total,
            desconto_aplicado: resRifa.compras_rifa.desconto_aplicado,
            partidas: { name: resRifa.compras_rifa.rifas?.nome },
            vendedores_rifa: resRifa.compras_rifa.vendedores_rifa
        });
        setTipoVenda('rifa');
      }

      setLoading(false);
    }
    loadData();
  }, [codigo]);

  const valorCheio = useMemo(() => {
    if (!venda) return 0;
    // Se o desconto for 100% (improvável), evita divisão por zero
    const desc = Number(venda.desconto_aplicado || 0);
    if (desc >= 100) return Number(venda.valor_pago);
    return Number(venda.valor_pago) / (1 - (desc / 100));
  }, [venda]);

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

  const handleCopiarPix = () => {
    if (pixPayload) {
      navigator.clipboard.writeText(pixPayload);
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
        <h2 className="text-2xl font-bold text-success mb-2">Bilhete Pago!</h2>
        <p className="text-muted-foreground mb-6">Este bilhete já está validado e pronto para o sorteio.</p>
        <Button className="w-full bg-success hover:bg-success/90" onClick={() => navigate('/')}>Ir para o Lobby</Button>
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
          Siga as instruções abaixo para validar sua participação.
        </p>
      </div>

      <div className="card-container border-2 border-primary/20 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-primary" />
        
        <div className="p-2 mb-4 text-center">
           <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">{venda.partidas?.name}</p>
           <p className="text-3xl font-black font-heading text-primary">R$ {valorCheio.toFixed(2).replace('.', ',')}</p>
           <p className="text-xs font-mono bg-muted inline-block px-3 py-1 rounded-full mt-2 font-bold">Cód: {venda.codigo_validacao}</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="font-bold flex items-center gap-2 text-foreground">
              <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0">1</span>
              Escolha a forma de pagamento
            </h3>
            
            {gameSettings?.stripe_enabled && (
              <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-3 text-center">
                <p className="text-xs text-primary font-bold uppercase tracking-wider">Pagamento Imediato via Cartão</p>
                <Button 
                  className="w-full h-14 bg-primary hover:bg-primary/90 text-white shadow-button font-bold text-lg" 
                  onClick={handleStripePayment}
                  disabled={isStripeLoading}
                >
                  {isStripeLoading ? <Loader2 className="w-6 h-6 mr-2 animate-spin" /> : <CreditCard className="w-6 h-6 mr-2" />}
                  PAGAR COM CARTÃO
                </Button>
                <p className="text-[10px] text-muted-foreground italic">A cartela é validada na mesma hora. Não precisa enviar comprovante.</p>
              </div>
            )}

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Ou Pague com PIX Copia e Cola</span></div>
            </div>

            <div className="bg-muted/40 p-4 rounded-xl border border-border/50 text-center">
              {pixPayload ? (
                <div className="bg-white p-3 rounded-lg inline-block shadow-sm border border-gray-200 mb-4">
                  <QRCodeSVG value={pixPayload} size={180} />
                </div>
              ) : (
                <div className="p-8 text-destructive flex flex-col items-center gap-2">
                  <AlertTriangle className="w-8 h-8" />
                  <p className="text-xs font-bold">Erro ao gerar QR Code PIX. Tente novamente ou contate o suporte.</p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase font-bold">PIX Copia e Cola</Label>
                <div className="relative">
                  <Input value={pixPayload} readOnly className="pr-24 font-mono text-xs bg-white" />
                  <Button 
                    size="sm" 
                    className="absolute right-1 top-1 h-8"
                    onClick={handleCopiarPix}
                    disabled={!pixPayload}
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copiar
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <h3 className="font-bold flex items-center gap-2 text-foreground">
              <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0">2</span>
              Valide seu Bilhete (Apenas PIX Manual)
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Se você realizou o PIX no app do seu banco, anexe o comprovante abaixo.
            </p>

            <div className="text-center pt-2">
              <Button 
                className="w-full h-14 text-xl font-bold bg-green-600 hover:bg-green-700 text-white shadow-button animate-pulse"
                onClick={() => navigate(`/validar-cartela?codigo=${venda.codigo_validacao}`)}
              >
                <Camera className="w-5 h-5 mr-2" />
                Validar Comprovante PIX
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-sm">
        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
        <p><strong>Atenção:</strong> Seu bilhete só terá validade no sorteio após o pagamento ser confirmado!</p>
      </div>
    </div>
  );
}