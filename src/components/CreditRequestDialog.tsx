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
import { Copy, Upload, Loader2, Minus, Plus, CreditCard, SmartphoneNfc, FileWarning, Wallet } from 'lucide-react';
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
  const [isCardLoading, setIsCardLoading] = useState(false);
  
  const [isPagbankLoading, setIsPagbankLoading] = useState(false);
  const [pagbankData, setPagbankData] = useState<{qr_code: string, qr_code_text: string} | null>(null);
  const [cpfPagador, setCpfPagador] = useState('');

  const [isOpen, setIsOpen] = useState(false);
  const [credits, setCredits] = useState<number>(10);

  useEffect(() => {
    if (profile?.cpf && !cpfPagador) setCpfPagador(profile.cpf);
  }, [profile]);

  const amount = credits * (gameSettings?.valor_por_credito || 1);

  // Calcula simulacao de taxas (Apenas exibição)
  const calcFee = (method: 'pix' | 'card') => {
      if (!gameSettings?.pagbank_pass_fees_to_customer) return null;
      const perc = method === 'pix' ? (gameSettings.pagbank_pix_fee_percentage || 0) : (gameSettings.pagbank_card_fee_percentage || 0);
      const fix = method === 'pix' ? (gameSettings.pagbank_pix_fee_fixed || 0) : (gameSettings.pagbank_card_fee_fixed || 0);
      const final = (amount + fix) / (1 - (perc / 100));
      const finalRounded = Math.ceil(final * 100) / 100;
      return { final: finalRounded, fee: finalRounded - amount };
  };

  const pixFeeDetails = calcFee('pix');
  const cardFeeDetails = calcFee('card');

  const pixPayload = useMemo(() => {
    if (!gameSettings?.pix_key || !profile) return '';
    try {
      const cleanKey = gameSettings.pix_key.replace(/\s/g, '');
      const cleanName = (gameSettings.pix_name || 'BINGOSHOW').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '').toUpperCase();
      const cleanCity = (gameSettings.pix_city || 'SAOPAULO').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '').toUpperCase();
      return QrCodePix({ version: '01', key: cleanKey, name: cleanName, city: cleanCity, value: parseFloat(amount.toFixed(2)) }).payload();
    } catch (e) { return ''; }
  }, [gameSettings, profile, amount]);

  const handleCopyToClipboard = (textToCopy: string) => {
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      toast.success('PIX Copia e Cola copiado!');
    }
  };

  const handlePagbankPayment = async (method: 'pix' | 'CREDIT_CARD') => {
    if (!cpfPagador.trim()) {
       toast.error("Por favor, informe seu CPF para gerar a cobrança.");
       return;
    }

    if (method === 'pix') setIsPagbankLoading(true);
    else setIsCardLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-pagbank-payment', {
        body: { 
          amount, 
          type: 'credits',
          metadata: { credits_requested: credits, customer_cpf: cpfPagador, origin: window.location.origin },
          admin_id: gameSettings?.admin_id,
          payment_method: method
        }
      });

      if (error) throw error;
      if (data?.success) {
        if (method === 'CREDIT_CARD' && data.checkout_link) {
           window.location.href = data.checkout_link;
        } else if (method === 'pix' && data.qr_code) {
           setPagbankData({ qr_code: data.qr_code, qr_code_text: data.qr_code_text });
           toast.success("PIX Gerado! Realize o pagamento para liberar os créditos automaticamente.");
        }
      } else {
        throw new Error(data?.error || "Erro desconhecido na geração.");
      }
    } catch (e: any) {
      if (e.message.includes('CPF_REQUIRED')) {
        toast.error("Cadastro Incompleto", { description: "O Banco exige um CPF válido. Atualize seu perfil.", action: { label: "Atualizar Perfil", onClick: () => { setIsOpen(false); navigate('/account'); } }, duration: 8000 });
      } else if (e.message.includes('401') || e.message.includes('FetchError')) {
         toast.error("Sua sessão expirou. Por favor, recarregue a página (F5) e tente novamente.");
      } else {
         toast.error("Erro PagBank: " + e.message);
      }
    } finally {
      setIsPagbankLoading(false);
      setIsCardLoading(false);
    }
  };

  const handleSubmitManual = async () => {
    if (!file) { toast.error('Por favor, anexe o comprovante.'); return; }
    setIsLoading(true);
    try {
      const success = await requestCredits(file, credits, amount);
      if (success) {
        toast.success('Solicitação enviada!', { description: 'O administrador foi notificado.' });
        setFile(null);
        setIsOpen(false);
      }
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
          <DialogDescription className="text-center">Escolha a quantidade desejada.</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          {/* Seletor de Valor */}
          <div className="p-4 bg-white dark:bg-card rounded-xl border border-border shadow-sm flex flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-2">
              <Button size="icon" variant="outline" className="rounded-full" onClick={() => handleCreditsChange(Math.max(0.01, Number((credits - 10).toFixed(2))))}><Minus className="w-4 h-4" /></Button>
              <Input type="number" step="0.01" className="w-28 text-center text-xl font-bold bg-muted/50 border-0 h-12" value={credits} onChange={(e) => handleCreditsChange(Number(e.target.value) || 0)} />
              <Button size="icon" variant="outline" className="rounded-full" onClick={() => handleCreditsChange(Number((credits + 10).toFixed(2)))}><Plus className="w-4 h-4" /></Button>
            </div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor em Créditos</p>
          </div>

          {/* Opções de Pagamento */}
          <div className="space-y-4 pt-2">
             <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase before:flex-1 before:border-t after:flex-1 after:border-t">Escolha como Pagar</div>

             {/* CARTÃO DE CRÉDITO */}
             {gameSettings?.pagbank_enabled && (
                <div className="bg-white dark:bg-card p-4 rounded-xl border border-border shadow-sm space-y-3">
                   <div className="flex items-center justify-between">
                     <h3 className="font-bold flex items-center gap-2 text-blue-700 dark:text-blue-500"><CreditCard className="w-5 h-5" /> Cartão de Crédito</h3>
                     <span className="text-lg font-black text-blue-700 dark:text-blue-400">R$ {(cardFeeDetails?.final || amount).toFixed(2).replace('.', ',')}</span>
                   </div>
                   {cardFeeDetails && (
                     <p className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded-lg border border-dashed">
                       Acréscimo de <strong>R$ {cardFeeDetails.fee.toFixed(2)}</strong> ref. a taxa de serviço do cartão. O processamento é seguro e imediato.
                     </p>
                   )}
                   <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={() => handlePagbankPayment('CREDIT_CARD')} disabled={isCardLoading || amount <= 0}>
                      {isCardLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null} Pagar no Cartão Seguramente
                   </Button>
                </div>
             )}

             {/* PIX AUTOMÁTICO */}
             {gameSettings?.pagbank_enabled && (
                <div className="bg-white dark:bg-card p-4 rounded-xl border border-border shadow-sm space-y-3">
                   <div className="flex items-center justify-between">
                     <h3 className="font-bold flex items-center gap-2 text-green-700 dark:text-green-500"><SmartphoneNfc className="w-5 h-5" /> PIX Automático</h3>
                     <span className="text-lg font-black text-green-700 dark:text-green-400">R$ {(pixFeeDetails?.final || amount).toFixed(2).replace('.', ',')}</span>
                   </div>
                   
                   {!pagbankData ? (
                     <>
                        {pixFeeDetails && <p className="text-[10px] text-muted-foreground">Inclui taxa de serviço de R$ {pixFeeDetails.fee.toFixed(2)}</p>}
                        <div className="space-y-1.5 pt-2">
                            <Label className="text-xs text-muted-foreground uppercase font-bold">Seu CPF (Exigido pelo Banco)</Label>
                            <Input value={cpfPagador} onChange={e => setCpfPagador(e.target.value)} placeholder="000.000.000-00" className="border-green-200 focus-visible:ring-green-500 h-10" />
                        </div>
                        <Button className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold shadow-button" onClick={() => handlePagbankPayment('pix')} disabled={isPagbankLoading || amount <= 0}>
                            {isPagbankLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null} Gerar QR Code PIX
                        </Button>
                     </>
                   ) : (
                     <div className="space-y-3 animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                          <img src={pagbankData.qr_code} alt="QR Code PagBank" className="w-[160px] h-[160px]" />
                        </div>
                        <div className="w-full">
                          <Label className="text-xs text-muted-foreground uppercase font-bold text-left block mb-1">PIX Copia e Cola</Label>
                          <div className="relative">
                            <Input value={pagbankData.qr_code_text} readOnly className="pr-20 font-mono text-xs bg-muted" />
                            <Button size="sm" className="absolute right-1 top-1 h-8 bg-green-600 hover:bg-green-700" onClick={() => handleCopyToClipboard(pagbankData.qr_code_text)}>
                              <Copy className="w-3 h-3 mr-1" /> Copiar
                            </Button>
                          </div>
                        </div>
                        <p className="text-[10px] text-green-700 font-bold bg-green-500/20 p-2 rounded text-center">Seus créditos cairão na conta em até 1 minuto automaticamente.</p>
                     </div>
                   )}
                </div>
             )}

             {/* PIX MANUAL (FALLBACK) */}
             {gameSettings?.pix_key && (
                <div className="bg-white dark:bg-card p-4 rounded-xl border border-border shadow-sm space-y-4">
                   <div className="flex items-center justify-between">
                     <h3 className="font-bold flex items-center gap-2 text-amber-700 dark:text-amber-500"><FileWarning className="w-5 h-5" /> PIX Manual</h3>
                     <span className="text-lg font-black text-amber-700 dark:text-amber-400">R$ {amount.toFixed(2).replace('.', ',')}</span>
                   </div>
                   <p className="text-[10px] text-muted-foreground">Sem taxas extras. A confirmação depende da análise humana e pode levar mais tempo.</p>
                   
                   <div className="bg-muted/40 p-3 rounded-lg border border-dashed flex flex-col items-center">
                       {pixPayload && <QRCode value={pixPayload} size={130} className="mb-3 bg-white p-2 rounded" />}
                       <div className="relative w-full">
                           <Input value={pixPayload ? "Clique para copiar chave PIX" : "Erro"} readOnly className="pr-10 text-center cursor-pointer text-xs" onClick={() => handleCopyToClipboard(pixPayload)} />
                           <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => handleCopyToClipboard(pixPayload)} disabled={!pixPayload}><Copy className="w-4 h-4" /></Button>
                       </div>
                   </div>

                   <div className="space-y-2 pt-2">
                       <Label className="text-xs font-bold text-amber-900 dark:text-amber-500">Enviar Comprovante (Obrigatório)</Label>
                       <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} className="file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-amber-100 file:text-amber-700" />
                       <Button className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={handleSubmitManual} disabled={!file || isLoading}>
                          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} Enviar para Análise
                       </Button>
                   </div>
                </div>
             )}
          </div>
        </div>

        <DialogFooter className="mt-2">
          <DialogClose asChild><Button variant="ghost" className="w-full">Cancelar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};