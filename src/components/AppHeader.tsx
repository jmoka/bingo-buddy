import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGame } from '@/contexts/GameContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Wallet, Plus, Banknote, History, Printer, LogOut, Star, Crown, Ticket, Search, UserCheck, ShieldCheck, User } from 'lucide-react';
import { CreditRequestDialog } from './CreditRequestDialog';
import { MyCreditRequestsDialog } from './MyCreditRequestsDialog';
import { RedeemRequestDialog } from './RedeemRequestDialog';
import { MyRedeemRequestsDialog } from './MyRedeemRequestsDialog';
import { toast } from 'sonner';

export const AppHeader = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { gameSettings, playerCards, rechargeFakeCredits } = useGame();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isRecharging, setIsRecharging] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.avatar_url) { setAvatarSrc(null); return; }
    supabase.storage.from('avatars').download(profile.avatar_url).then(({ data, error }) => {
      if (error || !data) return;
      setAvatarSrc(URL.createObjectURL(data));
    });
  }, [profile?.avatar_url]);

  if (!profile) return null;

  const myOwnedCards = playerCards.filter(c => c.player_id === profile.id);

  const roleBadge = {
    admin: { label: 'Admin', className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
    vendedor: { label: 'Vendedor', className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30' },
    user: { label: 'Usuário', className: 'bg-muted text-muted-foreground border-border' },
  }[profile.role] ?? { label: profile.role, className: '' };

  const handleRechargeFake = async () => {
    setIsRecharging(true);
    const success = await rechargeFakeCredits();
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
      action: () => navigate('/ranking'),
      label: 'Hall da Fama (Ranking)',
      icon: Crown,
    },
    {
      action: () => navigate('/rifas'),
      label: 'Rifas',
      icon: Ticket,
    },
    {
      action: () => navigate('/validar-cartela'),
      label: 'Validar Cartela de Rifa',
      icon: Search,
    },
    ...(profile.role === 'vendedor' ? [{
      action: () => navigate('/vendedor/painel'),
      label: 'Painel do Vendedor',
      icon: UserCheck,
    }] : []),
    ...(profile.role !== 'vendedor' ? [{
      action: () => navigate('/solicitar-vendedor'),
      label: 'Ser Vendedor de Rifas',
      icon: UserCheck,
    }] : []),
    ...(profile.role === 'admin' ? [{
      action: () => navigate('/admin'),
      label: 'Painel Admin',
      icon: ShieldCheck,
    }] : []),
    {
      action: () => navigate('/print'),
      label: 'Imprimir Cartelas',
      icon: Printer,
      disabled: myOwnedCards.length === 0,
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-6xl mx-auto flex h-16 items-center justify-between">
        <a href="/" className="font-heading text-2xl font-bold text-foreground">
          🎱 Bingo
        </a>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Saldo Real */}
          <div className="flex items-center gap-1 bg-muted rounded-full px-2 py-1.5 sm:px-3" title="Créditos Reais">
            <Wallet className="w-3.5 h-3.5 text-foreground" />
            <span className="font-heading font-bold text-sm sm:text-base text-foreground">{Number(profile.credits || 0).toFixed(2)}</span>
          </div>
          
          {/* Saldo de Brincar com Botão de Recarga */}
          <div className="flex items-center gap-1 bg-amber-400/10 rounded-full pl-2 pr-1 py-1 sm:pl-3 border border-amber-400/20" title="Créditos de Brincar">
            <Star className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-heading font-bold text-sm sm:text-base text-amber-600 mr-1">{Number(profile.fake_credits || 0).toFixed(2)}</span>
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

          <button
            onClick={() => navigate('/account')}
            className="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity"
            title="Meu perfil"
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="avatar" className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <span className={`text-[9px] font-bold px-1.5 py-0 rounded-full border ${roleBadge.className}`}>
              {roleBadge.label}
            </span>
          </button>
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[300px] sm:w-[400px] flex flex-col">
              <SheetHeader>
                <SheetTitle className="font-heading">Menu</SheetTitle>
              </SheetHeader>
              <div className="flex items-center gap-3 px-1 py-3 border-b">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="avatar" className="w-12 h-12 rounded-full object-cover border-2 border-border shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border-2 border-border shrink-0">
                    <User className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{profile.full_name || 'Usuário'}</p>
                  <Badge className={`text-[10px] mt-0.5 ${roleBadge.className}`}>{roleBadge.label}</Badge>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-1 py-2">
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
              </div>
              <div className="border-t pt-2 pb-6">
                <Button variant="ghost" className="w-full justify-start text-base py-6 text-destructive" onClick={signOut}>
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