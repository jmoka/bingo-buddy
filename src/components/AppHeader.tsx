import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, User, Wallet, Plus, Banknote, History, Printer, LogOut, Star, RefreshCw } from 'lucide-react';
import { CreditRequestDialog } from './CreditRequestDialog';
import { MyCreditRequestsDialog } from './MyCreditRequestsDialog';
import { RedeemRequestDialog } from './RedeemRequestDialog';
import { MyRedeemRequestsDialog } from './MyRedeemRequestsDialog';
import { toast } from 'sonner';

export const AppHeader = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { gameSettings, playerCards, updatePlayerFakeCredits } = useGame();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isRecharging, setIsRecharging] = useState(false);

  if (!profile) return null;

  const myOwnedCards = playerCards.filter(c => c.player_id === profile.id);

  const handleRechargeFake = async () => {
    setIsRecharging(true);
    const success = await updatePlayerFakeCredits(profile.id, 1000);
    if (success) {
      toast.success('Você recebeu +1000 créditos de brincar!');
    }
    setIsRecharging(false);
  };

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
          {/* Saldo Real */}
          <div className="flex items-center gap-1 bg-muted rounded-full px-2 py-1.5 sm:px-3" title="Créditos Reais">
            <Wallet className="w-3.5 h-3.5 text-foreground" />
            <span className="font-heading font-bold text-sm sm:text-base text-foreground">{profile.credits}</span>
          </div>
          
          {/* Saldo de Brincar com Botão de Recarga */}
          <div className="flex items-center gap-1 bg-amber-400/10 rounded-full pl-2 pr-1 py-1 sm:pl-3 border border-amber-400/20" title="Créditos de Brincar">
            <Star className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-heading font-bold text-sm sm:text-base text-amber-600 mr-1">{profile.fake_credits || 0}</span>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-full hover:bg-amber-400/20 text-amber-600"
                onClick={handleRechargeFake}
                disabled={isRecharging}
            >
                <Plus className={`w-3 h-3 ${isRecharging ? 'animate-spin' : ''}`} />
            </Button>
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
                      <div key={index}>{item.dialog}</div>
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