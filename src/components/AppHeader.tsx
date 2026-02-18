import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, User, Wallet, Plus, Banknote, History, Printer, LogOut } from 'lucide-react';
import { CreditRequestDialog } from './CreditRequestDialog';
import { MyCreditRequestsDialog } from './MyCreditRequestsDialog';
import { RedeemRequestDialog } from './RedeemRequestDialog';
import { MyRedeemRequestsDialog } from './MyRedeemRequestsDialog';

export const AppHeader = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { gameSettings, playerCards } = useGame();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  if (!profile) return null;

  const myOwnedCards = playerCards.filter(c => c.player_id === profile.id);

  const menuItems = [
    {
      dialog: <CreditRequestDialog gameSettings={gameSettings}><Button variant="ghost" className="w-full justify-start text-base py-6"><Plus className="w-5 h-5 mr-4" />Solicitar Créditos</Button></CreditRequestDialog>,
    },
    {
      dialog: <RedeemRequestDialog><Button variant="ghost" className="w-full justify-start text-base py-6"><Banknote className="w-5 h-5 mr-4" />Resgatar Créditos</Button></RedeemRequestDialog>,
    },
    {
      dialog: <MyCreditRequestsDialog><Button variant="ghost" className="w-full justify-start text-base py-6"><History className="w-5 h-5 mr-4" />Histórico de Créditos</Button></MyCreditRequestsDialog>,
    },
    {
      dialog: <MyRedeemRequestsDialog><Button variant="ghost" className="w-full justify-start text-base py-6"><Banknote className="w-5 h-5 mr-4" />Meus Resgates</Button></MyRedeemRequestsDialog>,
    },
    {
      action: () => navigate('/print'),
      label: 'Imprimir Cartelas',
      icon: Printer,
      disabled: myOwnedCards.length === 0,
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-6xl mx-auto flex h-16 items-center justify-between px-4">
        <a href="/" className="font-heading text-2xl font-bold text-foreground">
          🎱 Bingo
        </a>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-full px-3 py-1.5">
            <Wallet className="w-4 h-4 text-foreground" />
            <span className="font-heading font-bold text-base text-foreground">{profile.credits}</span>
          </div>
          <Button size="icon" variant="ghost" onClick={() => navigate('/account')}>
            <User className="w-5 h-5" />
          </Button>
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle className="font-heading">Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col h-full pb-10">
                <div className="flex-grow space-y-1">
                  {menuItems.map((item, index) => (
                    item.dialog ? (
                      <div key={index} onClick={() => setIsSheetOpen(false)}>{item.dialog}</div>
                    ) : (
                      <Button
                        key={index}
                        variant="ghost"
                        className="w-full justify-start text-base py-6"
                        onClick={() => { item.action(); setIsSheetOpen(false); }}
                        disabled={item.disabled}
                      >
                        <item.icon className="w-5 h-5 mr-4" />
                        {item.label}
                      </Button>
                    )
                  ))}
                </div>
                <Button variant="ghost" className="w-full justify-start text-base py-6 text-destructive mt-auto" onClick={signOut}>
                  <LogOut className="w-5 h-5 mr-4" />
                  Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};