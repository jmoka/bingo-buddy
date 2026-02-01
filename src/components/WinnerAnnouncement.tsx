import { WinResult } from '@/types/bingo';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { Trophy, PartyPopper, X } from 'lucide-react';
import { Button } from './ui/button';

interface WinnerAnnouncementProps {
  winners: WinResult[];
  onClose: () => void;
}

export const WinnerAnnouncement = ({ winners, onClose }: WinnerAnnouncementProps) => {
  if (winners.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-3xl p-8 max-w-md w-full animate-bounce-in shadow-2xl">
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="text-center">
          <div className="flex justify-center gap-2 mb-4">
            <PartyPopper className="w-10 h-10 text-accent animate-bounce" />
            <Trophy className="w-12 h-12 text-success" />
            <PartyPopper className="w-10 h-10 text-accent animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>

          <h2 className="font-heading text-3xl font-bold text-foreground mb-2">
            BINGO! 🎉
          </h2>

          <div className="space-y-3 mt-6">
            {winners.map((winner, index) => (
              <div
                key={`${winner.cardId}-${index}`}
                className="bg-success/10 rounded-xl p-4 border-2 border-success"
              >
                <p className="font-heading font-bold text-xl text-success">
                  {winner.cardName}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {gameTypeLabels[winner.type]}
                </p>
              </div>
            ))}
          </div>

          <Button
            onClick={onClose}
            className="mt-6 gradient-accent shadow-button px-8"
          >
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
};
