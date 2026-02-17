import { PlayerCard } from '@/types/match';

interface PrintableBingoCardProps {
  card: PlayerCard;
}

export const PrintableBingoCard = ({ card }: PrintableBingoCardProps) => {
  return (
    <div className="w-[18rem] h-[20rem] border-2 border-black p-2 flex flex-col break-inside-avoid bg-white">
      <h2 className="text-center text-xl font-bold mb-2 text-black">{card.name}</h2>
      <table className="w-full border-collapse border-2 border-black">
        <thead>
          <tr>
            {['B', 'I', 'N', 'G', 'O'].map(letter => (
              <th key={letter} className="w-1/5 bg-black text-white text-2xl font-bold p-1">
                {letter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {card.numbers.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((num, colIndex) => (
                <td
                  key={`${rowIndex}-${colIndex}`}
                  className="h-12 text-center border-2 border-black text-2xl font-bold text-black"
                >
                  {rowIndex === 2 && colIndex === 2 ? '★' : num}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};