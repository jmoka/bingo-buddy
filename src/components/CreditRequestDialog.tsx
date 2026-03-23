import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { GameSettings } from '@/types/match';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { toast } from 'sonner';
import { Copy, Upload, Loader2, Minus, Plus, CreditCard, SmartphoneNfc, User, FileWarning } from 'lucide-react';
import { QrCodePix } from 'qrcode-pix';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface CreditRequestDialogProps {
  gameSettings: GameSettings | undefined;
  children: React.ReactNode;
}

export const CreditRequestDialog = ({ gameSettings, children }: CreditRequestDialogProps) => {
  const navigate = useNavigate();
  const { requestCredits } = useGame();
  const { profile, user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  
  // PagBank States
  const [isPagbankLoading, setIsPagbankLoading] = useState(false);
  const [pagbankData, setPagbankData] = useState<{qr_code: string, qr_code_text: string} | null>(null);
  const [cpfPagador, setCpfPagador] = useState('');

  const [isOpen, setIsOpen] = useState(false);
  const [credits, setCredits] = useState<number>(10);

  useEffect(() => {
    if (profile?.cpf && !cpfPagador) {
        setCpfPagador(profile.cpf);
    }
  }, [profile]);

  const amount = credits * (gameSettings?.valor_por_credito || 1);

  // === CÁLCULO DE TAXAS (STRIPE) ===
  const stripeFeeDetails = useMemo(() => {
    if (!gameSettings?.pagbank_pass_fees_to_customer) return null;
    const perc = gameSettings.pagbank_card_fee_percentage || 0;
    const fix = gameSettings.pagbank_card_fee_fixed || 0;
    const final = (amount + fix) / (1 - (perc / 100));
    const finalRounded = Math.ceil(final * 100) / 100;
    const fee = finalRounded - amount;
    return { final: finalRounded, fee };
  }, [amount, gameSettings]);
  const finalStripeAmount = stripeFeeDetails ? stripeFeeDetails.final : amount;

  // === CÁLCULO DE TAXAS (PAGBANK) ===
  const calcPagbankFee = (method: 'pix' | 'card') => {
      if (!gameSettings?.pagbank_pass_fees_to_customer) return null;
      const perc = method === 'pix' ? (gameSettings.pagbank_pix_fee_percentage || 0) : (gameSettings.pagbank_card_fee_percentage || 0);
      const fix = method === 'pix' ? (gameSettings.pagbank_pix_fee_fixed || 0) : (gameSettings.pagbank_card_fee_fixed || 0);
      const final = (amount + fix) / (1 - (perc / 100));
      const finalRounded = Math.ceil(final * 100) / 100;
      return { final: finalRounded, fee: finalRounded - amount };
  };
  const pixFeeDetails = calcPagbankFee('pix');
  const cardFeeDetails = calcPagbankFee('card');
  const finalPixAmount = pixFeeDetails ? pixFeeDetails.final : amount;
  const finalPagbankCardAmount = cardFeeDetails ? cardFeeDetails.final : amount;

  // PIX MANUAL
  const pixPayload = useMemo(() => {
    if (!gameSettings?.pix_key || !profile) return '';
    try {
      const cleanKey = gameSettings.pix_key.replace(/\s/g, '');
      const cleanName = (gameSettings.pix_name || 'BINGOSHOW').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '').toUpperCase();
      const cleanCity = (gameSettings.pix_city || 'SAOPAULO').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '').toUpperCase();

      return QrCodePix({
        version: '01',
        key: cleanKey,
        name: cleanName,
        city: cleanCity,
        value: parseFloat(amount.toFixed(2)),
      }).payload();
    } catch (e) {
      console.error("Erro ao gerar PIX:", e);
      return '';
    }
  }, [gameSettings, profile, amount]);

  const handleCopyToClipboard = (textToCopy: string) => {
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      toast.success('Copiado para a área de transferência!');
    }
  };

  const handleStripePayment = async () => {
    setIsStripeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-session', {
        body: { amount, type: 'credits', metadata: { credits_requested: credits } }
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) { toast.error("Erro: " + e.message); } finally { setIsStripeLoading(false); }
  };

  const handlePagbankPayment = async (method: 'pix' | 'CREDIT_CARD') => {
    if (!cpfPagador.trim() || cpfPagador.replace(/\D/g, '').length < 11) {
       toast.error("Por favor, preencha um CPF válido no quadro de Identificação para prosseguir.");
       return;
    }
    if (method === 'pix') setIsPagbankLoading(true);
    else setIsStripeLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-pagbank-payment', {
        body: { 
          amount, type: 'credits', admin_id: gameSettings?.admin_id, payment_method: method,
          metadata: { credits_requested: credits, customer_cpf: cpfPagador, origin: window.location.origin }
        }
      });
      if (error) throw error;
      if (data?.success) {
        if (method === 'CREDIT_CARD' && data.checkout_link) {
           window.open(data.checkout_link, '_blank', 'noreferrer,noopener');
           toast.info("A página de pagamento foi aberta em uma nova guia.");
        } else if (method === 'pix' && data.qr_code) { 
           setPagbankData({ qr_code: data.qr_code, qr_code_text: data.qr_code_text }); 
           toast.success("PIX Gerado!"); 
        }
      } else {
        if (data?.error?.includes('CPF_REQUIRED')) toast.error("CPF Inválido! Corrija no campo acima.");
        else throw new Error(data?.error || "Erro desconhecido.");
      }
    } catch (e: any) {
      toast.error("Sua sessão expirou ou o servidor falhou. Atualize a página (F5). " + e.message);
    } finally {
      setIsPagbankLoading(false); setIsStripeLoading(false);
    }
  };

  const handleSubmitManual = async () => {
    if (!file) { toast.error('Anexe o comprovante.'); return; }
    setIsLoading(true);
    try {
      const success = await requestCredits(file, credits, amount);
      if (success) { toast.success('Solicitação enviada!'); setFile(null); setIsOpen(false); }
    } finally { setIsLoading(false); }
  };

  const handleCreditsChange = (newCredits: number) => {
    setCredits(newCredits);
    setPagbankData(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-muted/10">
        <DialogHeader>
          <DialogTitle className="font-heading text-center text-xl">Comprar Créditos</DialogTitle>
          <DialogDescription className="text-center">{gameSettings?.credit_request_text || 'Escolha a quantidade de créditos e a forma de pagamento.'}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4 text-center">
          <div className="p-4 bg-white dark:bg-card rounded-xl border shadow-sm flex flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-2">
              <Button size="icon" variant="outline" className="rounded-full" onClick={() => handleCreditsChange(Math.max(0.01, Number((credits - 10).toFixed(2))))}><Minus className="w-4 h-4" /></Button>
              <Input type="number" step="0.01" className="w-24 text-center text-lg font-bold bg-muted/50 border-0 h-12" value={credits} onChange={(e) => handleCreditsChange(Number(e.target.value) || 0)} />
              <Button size="icon" variant="outline" className="rounded-full" onClick={() => handleCreditsChange(Number((credits + 10).toFixed(2)))}><Plus className="w-4 h-4" /></Button>
            </div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor em Créditos</p>
          </div>

          <p className="text-xl font-heading font-black text-primary">Total: R$ {amount.toFixed(2).replace('.', ',')}</p>

          {gameSettings?.pagbank_enabled && (
             <div className="bg-muted/30 p-3 rounded-xl border border-border/50 text-left space-y-2">
                <Label className="text-xs uppercase font-bold text-primary flex items-center gap-1.5 border-b pb-1.5"><User className="w-3.5 h-3.5" /> Identificação Obrigatória (PagBank)</Label>
                <div className="space-y-1"><Label className="text-xs font-bold text-gray-700">Seu CPF *</Label><Input value={cpfPagador} onChange={e => { setCpfPagador(e.target.value); setPagbankData(null); }} placeholder="000.000.000-00" className="h-9 text-xs bg-white border-primary/20" /></div>
             </div>
          )}

          <div className="space-y-4 pt-2">
             <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase before:flex-1 before:border-t after:flex-1 after:border-t">Escolha como Pagar</div>

             {/* CARTÃO DE CRÉDITO PAGBANK */}
             {gameSettings?.pagbank_enabled && (
                <div className="bg-white dark:bg-card p-4 rounded-xl border border-border shadow-sm space-y-3">
                   <div className="flex items-center justify-between">
                     <h3 className="font-bold flex items-center gap-2 text-blue-700 dark:text-blue-500"><CreditCard className="w-5 h-5" /> Cartão de Crédito</h3>
                     <span className="text-lg font-black text-blue-700 dark:text-blue-400">R$ {finalPagbankCardAmount.toFixed(2).replace('.', ',')}</span>
                   </div>
                   {cardFeeDetails && <p className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded-lg border border-dashed">Acréscimo de <strong>R$ {cardFeeDetails.fee.toFixed(2)}</strong> ref. a taxa de serviço do cartão.</p>}
                   <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={() => handlePagbankPayment('CREDIT_CARD')} disabled={isStripeLoading || amount <= 0}>
                      {isStripeLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null} Pagar no Cartão Seguramente
                   </Button>
                </div>
             )}

             {/* PIX AUTOMÁTICO PAGBANK */}
             {gameSettings?.pagbank_enabled && (
                <div className="bg-white dark:bg-card p-4 rounded-xl border border-border shadow-sm space-y-3">
                   <div className="flex items-center justify-between">
                     <h3 className="font-bold flex items-center gap-2 text-green-700 dark:text-green-500"><SmartphoneNfc className="w-5 h-5" /> PIX Automático</h3>
                     <span className="text-lg font-black text-green-700 dark:text-green-400">R$ {finalPixAmount.toFixed(2).replace('.', ',')}</span>
                   </div>
                   
                   {!pagbankData ? (
                     <div className="space-y-3 w-full">
                        {pixFeeDetails && <p className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded-lg border border-dashed">Inclui taxa bancária de R$ {pixFeeDetails.fee.toFixed(2)}.</p>}
                        <Button className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold shadow-button" onClick={() => handlePagbankPayment('pix')} disabled={isPagbankLoading || amount <= 0}>
                            {isPagbankLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null} Gerar QR Code PIX
                        </Button>
                     </div>
                   ) : (
                     <div className="space-y-3 animate-in fade-in zoom-in flex flex-col items-center border-t pt-3 mt-3">
                        <div className="bg-white p-3 rounded-lg shadow-sm border"><img src={pagbankData.qr_code} className="w-[160px] h-[160px]" /></div>
                        <div className="w-full text-left">
                          <Label className="text-xs uppercase font-bold text-muted-foreground mb-1 block">PIX Copia e Cola</Label>
                          <div className="relative">
                            <Input value={pagbankData.qr_code_text} readOnly className="pr-20 font-mono text-xs bg-white text-black" />
                            <Button size="sm" className="absolute right-1 top-1 h-8 bg-green-600 hover:bg-green-700" onClick={() => handleCopyToClipboard(pagbankData.qr_code_text)}><Copy className="w-3 h-3 mr-1" /> Copiar</Button>
                          </div>
                        </div>
                     </div>
                   )}
                </div>
             )}

             {/* PIX MANUAL (Fallback) */}
             {gameSettings?.pix_key && (
              <div className="bg-white dark:bg-card p-4 rounded-xl border border-border shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2 text-amber-700 dark:text-amber-500"><FileWarning className="w-5 h-5" /> PIX Manual</h3>
                    <span className="text-lg font-black text-amber-700 dark:text-amber-400">R$ {amount.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded-lg border border-dashed">Sem taxas extras. A liberação não é imediata e exige envio de comprovante.</p>
                  
                  <div className="bg-muted/40 p-3 rounded-lg border border-dashed flex flex-col items-center">
                      {pixPayload && <QRCode value={pixPayload} size={130} className="mb-3 bg-white p-2 rounded" />}
                      <div className="relative w-full">
                          <Input value={pixPayload ? "Clique para copiar chave PIX" : "Erro"} readOnly className="pr-10 text-center cursor-pointer text-xs" onClick={() => handleCopyToClipboard(pixPayload)} />
                          <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => handleCopyToClipboard(pixPayload)} disabled={!pixPayload}><Copy className="w-4 h-4" /></Button>
                      </div>
                  </div>

                  <div className="space-y-2 text-left pt-2">
                      <Label htmlFor="receipt" className="text-xs font-bold text-amber-900">Anexe o Comprovante:</Label>
                      <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} className="file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-amber-100 file:text-amber-700" />
                      <Button className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={handleSubmitManual} disabled={!file || isLoading}>
                         {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} Enviar para Análise
                      </Button>
                  </div>
              </div>
             )}

             {/* STRIPE CARTÃO (Se ativo e Pagbank Desativo) */}
             {gameSettings?.stripe_enabled && !gameSettings?.pagbank_enabled && (
                <div className="space-y-2 mt-4 pt-4 border-t">
                  <Button className="w-full h-12 bg-primary text-white shadow-button font-bold text-sm" onClick={handleStripePayment} disabled={isStripeLoading}>
                    {isStripeLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin shrink-0" /> : <CreditCard className="w-5 h-5 mr-2 shrink-0" />} PAGAR R$ {finalStripeAmount.toFixed(2).replace('.', ',')} VIA STRIPE
                  </Button>
                </div>
             )}
          </div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="ghost">Fechar</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};