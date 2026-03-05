import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCheck, Phone, MapPin, ArrowLeft, ShieldCheck } from 'lucide-react';
import PlayerAvatar from '@/components/PlayerAvatar';

export default function VendedorPerfilPublico() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const [vendedor, setVendedor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVendedor() {
      if (!codigo) return;
      setLoading(true);
      
      // Chamamos a função RPC que criamos para buscar dados públicos com segurança
      const { data, error } = await supabase.rpc('get_public_vendedor_by_codigo', {
        p_codigo_ref: codigo.toUpperCase()
      });

      if (!error && data && data.length > 0) {
        setVendedor(data[0]); // A função retorna uma lista (tabela), pegamos o primeiro
      }
      setLoading(false);
    }
    loadVendedor();
  }, [codigo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!vendedor || !vendedor.ativo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center space-y-4">
        <ShieldCheck className="h-16 w-16 text-muted-foreground opacity-20" />
        <h1 className="text-2xl font-bold text-foreground">Vendedor não encontrado</h1>
        <p className="text-muted-foreground">Este código de vendedor é inválido ou não está mais ativo.</p>
        <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
      </div>
    );
  }

  const whatsappLink = vendedor.telefone 
    ? `https://wa.me/55${vendedor.telefone.replace(/\D/g, '')}`
    : null;

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="card-container p-8 text-center relative overflow-hidden border-2 border-green-500/20">
          <div className="absolute top-4 right-4">
            <Badge className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 gap-1.5 animate-bounce-in border-none">
              <UserCheck className="h-3.5 w-3.5" />
              AUTORIZADO
            </Badge>
          </div>

          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <PlayerAvatar 
                url={vendedor.avatar_url} 
                className="h-24 w-24 border-4 border-background shadow-xl"
              />
              <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-1 border-2 border-background">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold font-heading text-foreground">{vendedor.nome}</h1>
              <p className="text-xs font-mono font-bold text-muted-foreground tracking-widest uppercase">
                CÓDIGO: {vendedor.codigo_ref}
              </p>
            </div>

            <div className="w-full pt-4 space-y-3">
              <div className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border/50 text-left">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">WhatsApp / Telefone</p>
                  <p className="font-medium truncate">{vendedor.telefone || 'Não informado'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border/50 text-left">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Localização</p>
                  <p className="font-medium text-sm line-clamp-2">
                    {vendedor.address || 'Vendedor Externo Autorizado'}
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full pt-4 grid grid-cols-1 gap-3">
              {whatsappLink && (
                <Button className="w-full gradient-primary h-12 font-bold" asChild>
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <Phone className="h-4 w-4 mr-2" />
                    Falar com Vendedor
                  </a>
                </Button>
              )}
              <Button variant="outline" className="w-full h-12" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Bingo
              </Button>
            </div>
          </div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-green-500" />
            Verificação de Segurança Oficial Bingo App
          </p>
        </div>
      </div>
    </div>
  );
}