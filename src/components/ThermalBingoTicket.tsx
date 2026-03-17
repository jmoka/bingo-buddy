import { FolhaBingoFisico } from '@/types/match';
import { QRCodeSVG } from 'qrcode.react';
import { format  as formatDate} from 'date-fns';
import { cn } from '@/lib/utils';

interface ThermalBingoTicketProps {
  folha: FolhaBingoFisico;
  baseUrl: string;
  format: 'thermal_58' | 'thermal_80';
}

export function ThermalBingoTicket({ folha, baseUrl, format }: ThermalBingoTicketProps) {
  const pagarUrl = `${baseUrl}/pagar-cartela?codigo=${folha.codigo_validacao}`;
  const conferirUrl = `${baseUrl}/validar-cartela?bingo=${folha.codigo_validacao}`;
  const valorCheio = Number(folha.valor_pago) / (1 - (Number(folha.desconto_aplicado || 0) / 100));

  const widthClass = format === 'thermal_58' ? 'w-[54mm]' : 'w-[76mm]';

  return (
    <div className={cn("bg-white text-black font-mono p-1 break-after-page", widthClass)}>
      <div className="text-center mb-2">
        <h1 className="font-bold text-sm uppercase">{folha.partidas?.name}</h1>
        <p className="text-xs">
          {formatDate(new Date(folha.partidas?.start_time || ''), "dd/MM/yyyy 'às' HH:mm")}
        </p>
      </div>

      <div className="border-y-2 border-dashed border-black my-2 py-2 text-center">
        <p className="text-xs uppercase">Código do Bilhete</p>
        <p className="font-bold text-lg tracking-wider">{folha.codigo_validacao}</p>
      </div>

      {folha.grids.map((grid, gridIdx) => (
        <div key={gridIdx} className="mb-2 break-inside-avoid">
          <p className="text-center font-bold text-xs mb-1">CARTELA {gridIdx + 1}</p>
          <table className="w-full text-center border-collapse table-fixed border-2 border-black">
            <thead>
              <tr>
                {['B', 'I', 'N', 'G', 'O'].map((letra) => (
                  <th key={letra} className="w-1/5 py-0.5 text-xs font-bold border border-black bg-gray-200">
                    {letra}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((linha, rowIndex) => (
                <tr key={rowIndex}>
                  {linha.map((num, colIndex) => {
                    const isMeio = rowIndex === 2 && colIndex === 2;
                    return (
                      <td key={colIndex} className="py-0.5 text-xs font-bold border border-black h-[18px]">
                        {isMeio ? '★' : num}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {folha.status !== 'pago' && (
        <div className="mt-2 text-center">
          <p className="text-xs uppercase">Pagar e Validar (Use a Câmera)</p>
          <div className="flex justify-center p-1">
            <QRCodeSVG value={pagarUrl} size={120} />
          </div>
          <p className="font-bold text-lg">VALOR: R$ {valorCheio.toFixed(2)}</p>
        </div>
      )}

      <div className="mt-2 text-center">
        <p className="text-xs uppercase">Conferir / Validar Cartela</p>
        <div className="flex justify-center p-1">
          <QRCodeSVG value={conferirUrl} size={80} />
        </div>
      </div>

      <div className="border-t-2 border-dashed border-black mt-2 pt-2 text-[8px] text-center">
        <p className="font-bold">Vendedor: {folha.vendedores_rifa?.nome || 'N/A'}</p>
        <p>Ref: {folha.vendedores_rifa?.codigo_ref}</p>
        <p>Emitido: {formatDate(new Date(folha.created_at), "dd/MM/yyyy HH:mm")}</p>
        <p className="mt-1">Bilhete físico oficial. Valide antes do sorteio.</p>
      </div>
    </div>
  );
}
