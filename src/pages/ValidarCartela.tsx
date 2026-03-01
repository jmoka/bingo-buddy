import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, CheckCircle, XCircle, Ticket, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ValidarCartela() {
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);
  const [buscado, setBuscado] = useState(false);

  const buscarCartela = async () => {
    if (!codigo.trim()) {
      toast.error('Digite o código de validação.');
      return;
    }
    setLoading(true);
    setBuscado(false);
    setResultado(null);

    const { data, error } = await supabase
      .from('cartelas_rifa')
      .select('*, compras_rifa(*, rifas(nome, status, numero_ganhador)), numeros_rifa(numero)')
      .eq('codigo_validacao', codigo.toUpperCase().trim())
      .single();

    setLoading(false);
    setBuscado(true);

    if (error || !data) {
      setResultado(null);
    } else {
      setResultado(data);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') buscarCartela();
  };

  const rifa = resultado?.compras_rifa?.rifas;
  const numeroCartela = resultado?.numeros_rifa?.numero;
  const isGanhador =
    rifa?.status === 'finalizada' &&
    rifa?.numero_ganhador != null &&
    rifa.numero_ganhador === numeroCartela;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Search className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Validar Cartela</h1>
        </div>

        <div className="card-container p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="codigo">Código de validação</Label>
            <Input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="Ex: AB12CD34EF"
              className="font-mono uppercase"
            />
          </div>
          <Button className="w-full" onClick={buscarCartela} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Buscar
          </Button>
        </div>

        {buscado && resultado && (
          <div className="card-container p-6 space-y-4 border-green-300">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="font-bold text-lg text-green-700">Cartela encontrada</p>
                {rifa?.nome && (
                  <p className="text-sm text-muted-foreground">{rifa.nome}</p>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {numeroCartela != null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Número da cartela</span>
                  <span className="font-bold">{numeroCartela}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Código</span>
                <span className="font-mono font-bold tracking-wider">
                  {resultado.codigo_validacao}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {isGanhador ? (
                <Badge className="bg-yellow-400 text-yellow-900 font-bold text-base px-4 py-1">
                  GANHADOR!
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Ticket className="h-3 w-3" />
                  Cartela válida
                </Badge>
              )}
              {resultado.impresso && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Impressa
                </Badge>
              )}
            </div>
          </div>
        )}

        {buscado && !resultado && (
          <div className="card-container p-6 space-y-3 border-red-300">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="font-bold text-lg text-red-700">Cartela não encontrada</p>
                <p className="text-sm text-muted-foreground">
                  Verifique o código digitado.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
