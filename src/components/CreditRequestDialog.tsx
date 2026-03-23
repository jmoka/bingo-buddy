import { useState, useMemo } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { GameSettings } from '@/types/match';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { toast } from 'sonner';
import { Copy, Upload, Loader2, Minus, Plus, CreditCard, SmartphoneNfc } from 'lucide-react';
import { QrCodePix } from 'qrcode-pix';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface CreditRequestDialogProps {
  gameSettings: GameSettings | undefined;
  children: React.ReactNode;
}

export const CreditRequestDialog = ({ gameSettings, children }: CreditRequestDialogProps) => {
  const { requestCredits } = useGame();
  const { profile, user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  
  // PagBank States
  const [isPagbankLoading, setIsPagbankLoading] = useState(false);
  const [pagbankData, setPagbankData] = useState<{qr_code: string, qr_code_text: string} | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [credits, setCredits] = useState<number>(10);

  const amount = credits * (gameSettings?.valor_por_credito || 1);

  const stripeFeeDetails = useMemo(() => {
    if (!gameSettings?.stripe_pass_fees_to_customer) return null;
    const perc = gameSettings.stripe_fee_percentage || 0;
    const fix = gameSettings.stripe_fee_fixed || 0;
    const final = (amount + fix) / (1 - (perc / 100));
    const finalRounded = Math.ceil(final * 100) / 100;
    const fee = finalRounded - amount;
    return { final: finalRounded, fee };
  }, [amount, gameSettings]);

  const finalStripeAmount = stripeFeeDetails ? stripeFeeDetails.final : amount;

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
      toast.success('PIX Copia e Cola copiado!');
    }
  };

  const handleStripePayment = async () => {
    setIsStripeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-session', {
        body: { 
          amount, 
          type: 'credits',
          metadata: { credits_requested: credits }
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
    setIsPagbankLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-pagbank-payment', {
        body: { 
          amount, 
          type: 'credits',
          metadata: { credits_requested: credits },
          admin_id: gameSettings?.admin_id
        }
      });

      if (error) throw error;
      if (data?.success && data?.qr_code) {
        setPagbankData({ qr_code: data.qr_code, qr_code_text: data.qr_code_text });
        toast.success("PIX Gerado! Realize o pagamento para liberar os créditos automaticamente.");
      } else {
        throw new Error(data?.error || "Erro desconhecido ao gerar PIX.");
      }
    } catch (e: any) {
      // Correção e Segurança para Erro 401
      if (e.message.includes('401') || e.message.includes('FetchError') || e.message.includes('Failed to load resource')) {
         toast.error("Sua sessão expirou ou o servidor foi atualizado. Por favor, recarregue a página (F5) e tente novamente.");
      } else {
         toast.error("Erro ao gerar PIX PagBank: " + e.message);
      }
    } finally {
      setIsPagbankLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Por favor, anexe o comprovante de pagamento.');
      return;
    }
    setIsLoading(true);
    try {
      const success = await requestCredits(file, credits, amount);
      if (success) {
        toast.success('Solicitação enviada!', {
          description: 'O administrador foi notificado. Aguarde a liberação dos seus créditos.',
        });
        setFile(null);
        setIsOpen(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Zera o PIX dinâmico se o usuário alterar o valor
  const handleCreditsChange = (newCredits: number) => {
    setCredits(newCredits);
    setPagbankData(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Solicitar Créditos</DialogTitle>
          <DialogDescription>
            {gameSettings?.credit_request_text || 'Escolha a quantidade de créditos e a forma de pagamento.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4 text-center">
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <Label htmlFor="credits-input">Quantidade de Créditos</Label>
            <div className="flex items-center justify-center gap-2">
              <Button size="icon" variant="outline" onClick={() => handleCreditsChange(Math.max(0.01, Number((credits - 1).toFixed(2))))}>
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                id="credits-input"
                type="number"
                step="0.01"
                className="w-24 text-center text-lg font-bold"
                value={credits}
                onChange={(e) => handleCreditsChange(Number(e.target.value) || 0)}
              />
              <Button size="icon" variant="outline" onClick={() => handleCreditsChange(Number((credits + 1).toFixed(2)))}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <p className="text-xl font-heading font-black text-primary">Total: R$ {amount.toFixed(2).replace('.', ',')}</p>

          {/* === PAGBANK PIX AUTOMÁTICO === */}
          {gameSettings?.pagbank_enabled ? (
             <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20 space-y-3">
                <h3 className="font-bold flex items-center justify-center gap-2 text-green-800 dark:text-green-400">
                  <SmartphoneNfc className="w-5 h-5" /> PIX Automático
                </h3>
                
                {!pagbankData ? (
                  <Button
                    className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold shadow-button"
                    onClick={handlePagbankPayment}
                    disabled={isPagbankLoading || amount <= 0}
                  >
                    {isPagbankLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
                    Gerar PIX de R$ {amount.toFixed(2).replace('.', ',')}
                  </Button>
                ) : (
                  <div className="space-y-3 animate-in fade-in zoom-in duration-300">
                    <div className="bg-white p-3 rounded-lg inline-block shadow-sm border border-gray-200">
                      <img src={pagbankData.qr_code} alt="QR Code PagBank" className="w-[160px] h-[160px]" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase font-bold">PIX Copia e Cola</Label>
                      <div className="relative">
                        <Input value={pagbankData.qr_code_text} readOnly className="pr-20 font-mono text-xs bg-white text-black" />
                        <Button size="sm" className="absolute right-1 top-1 h-8 bg-green-600 hover:bg-green-700" onClick={() => handleCopyToClipboard(pagbankData.qr_code_text)}>
                          <Copy className="w-3 h-3 mr-1" /> Copiar
                        </Button>
                      </div>
                    </div>
                    <p className="text-[10px] text-green-700 font-bold bg-green-500/20 p-2 rounded">
                      Após o pagamento, seus créditos cairão na conta em até 1 minuto automaticamente.
                    </p>
                  </div>
                )}
             </div>
          ) : (
             /* === PIX MANUAL (Fallback) === */
             gameSettings?.pix_key && (
              <div className="space-y-4">
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">PIX Manual</span></div>
                  </div>
                  
                  {pixPayload && (
                  <div className="p-4 bg-white rounded-lg inline-block border">
                      <QRCode value={pixPayload} size={140} />
                  </div>
                  )}
                  
                  <div className="relative">
                  <Input value={pixPayload ? "Clique para copiar chave PIX" : "Erro ao gerar PIX"} readOnly className="pr-10 text-center cursor-pointer text-xs" onClick={() => handleCopyToClipboard(pixPayload)} />
                  <Button
                      size="icon"
                      variant="ghost"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => handleCopyToClipboard(pixPayload)}
                      disabled={!pixPayload}
                  >
                      <Copy className="w-4 h-4" />
                  </Button>
                  </div>

                  <div className="space-y-2 text-left pt-2">
                      <Label htmlFor="receipt" className="text-xs font-bold">Já pagou o PIX manual? Anexe aqui:</Label>
                      <Input
                      id="receipt"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                      />
                      <Button 
                      variant="outline" 
                      className="w-full h-10" 
                      onClick={handleSubmit} 
                      disabled={!file || isLoading}
                      >
                      {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                      Enviar Comprovante p/ Admin
                      </Button>
                  </div>
              </div>
             )
          )}

          {/* === STRIPE === */}
          {gameSettings?.stripe_enabled && (
            <div className="space-y-2 mt-4 pt-4 border-t">
              <Button
                className="w-full min-h-14 h-auto py-3 px-2 bg-primary text-white shadow-button font-bold text-sm sm:text-lg whitespace-normal leading-tight"
                onClick={handleStripePayment}
                disabled={isStripeLoading}
              >
                {isStripeLoading ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2 animate-spin shrink-0" /> : <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 mr-2 shrink-0" />}
                <span>PAGAR R$ {finalStripeAmount.toFixed(2).replace('.', ',')} NO CARTÃO</span>
              </Button>
              {stripeFeeDetails && (
                <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded border border-border/50 flex justify-between items-center px-4">
                  <span>Créditos: <strong>R$ {amount.toFixed(2).replace('.', ',')}</strong></span>
                  <span>+ Taxa Cartão: <strong>R$ {stripeFeeDetails.fee.toFixed(2).replace('.', ',')}</strong></span>
                </div>
              )}
            </div>
          )}

        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Fechar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};