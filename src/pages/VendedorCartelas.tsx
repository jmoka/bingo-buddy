import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRifaAdmin } from '@/hooks/useRifaAdmin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Printer, Ticket, CheckCircle, Loader2 } from 'lucide-react';
import type { CartelaRifa } from '@/types/rifa';

export default function VendedorCartelas() {
  const navigate = useNavigate();
  const { compraId } = useParams<{ compraId: string }>();
  const { getCartelasCompra, todasCompras } = useRifaAdmin();

  const [cartelas, setCartelas] = useState<CartelaRifa[]>([]);
  const [loading, setLoading] = useState(true);

  const compra = todasCompras.find((c) => c.id === compraId);

  useEffect(() => {
    if (!compraId) return;
    (async () => {
      setLoading(true);
      const result = await getCartelasCompra(compraId);
      setCartelas(result);
      setLoading(false);
    })();
  }, [compraId]);

  return (
    <div className="min-h-screen bg-background p-4 print:p-0">
      <div className="max-w-4xl mx-auto space-y-6 print:space-y-2">
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Printer className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Cartelas para Impressão</h1>
          </div>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir Tudo
          </Button>
        </div>

        {compra && (
          <div className="card-container p-4 space-y-2 print:hidden">
            <p className="text-sm text-muted-foreground">
              Data: {new Date(compra.created_at).toLocaleString('pt-BR')}
            </p>
            <p className="text-sm">
              Números: <span className="font-medium">{compra.numeros.join(', ')}</span>
            </p>
            <p className="text-sm">
              Valor total:{' '}
              <span className="font-bold text-green-600">R$ {compra.valor_total.toFixed(2)}</span>
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : cartelas.length === 0 ? (
          <div className="card-container p-8 text-center space-y-3 print:hidden">
            <Ticket className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Nenhuma cartela encontrada para esta compra.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
            {cartelas.map((cartela, index) => (
              <div
                key={cartela.id}
                className="border rounded-lg p-4 space-y-3 print:border print:rounded print:p-2 print:break-inside-avoid"
              >
                <div className="text-center">
                  <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                    Cartela Oficial
                  </p>
                  <p className="text-sm font-medium mt-1">#{index + 1}</p>
                </div>

                <div className="text-center border rounded p-2">
                  <p className="text-xs text-muted-foreground mb-1">Código de Validação</p>
                  <p className="font-mono text-lg font-bold tracking-wider">
                    {cartela.codigo_validacao}
                  </p>
                </div>

                <div className="flex justify-center">
                  {cartela.qr_code_data ? (
                    <img
                      src={cartela.qr_code_data}
                      alt="QR Code"
                      className="w-20 h-20 object-contain"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 flex items-center justify-center rounded border">
                      <span className="text-xs text-muted-foreground">QR Code</span>
                    </div>
                  )}
                </div>

                {cartela.impresso && (
                  <div className="flex justify-center">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Impressa
                    </Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
