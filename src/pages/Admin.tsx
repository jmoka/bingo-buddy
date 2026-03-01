import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users, ShieldCheck, Coins, Ticket } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGame } from '@/contexts/GameContext';
import MatchManager from '@/components/admin/MatchManager';
import SettingsManager from '@/components/admin/SettingsManager';

const Admin = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { allCreditRequests, allRedeemRequests, players, gameSettings } = useGame();

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      navigate('/');
    }
  }, [profile, navigate]);

  const totalUserCredits = useMemo(() => {
    return (players || []).reduce((acc, player) => acc + Number(player.credits || 0), 0);
  }, [players]);

  const adminProfit = Number(gameSettings?.admin_profit || 0);
  const totalCredits = totalUserCredits + adminProfit;

  if (!profile || profile.role !== 'admin') {
    return null;
  }

  const pendingRequestsCount = (allCreditRequests || []).filter(r => r.status === 'pending').length;
  const pendingRedeemsCount = (allRedeemRequests || []).filter(r => r.status === 'pending').length;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Painel Admin</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card-container p-4">
          <div className="flex items-center text-muted-foreground mb-2">
            <Users className="w-4 h-4 mr-2" />
            <h3 className="text-sm font-semibold">Saldo Jogadores</h3>
          </div>
          <p className="text-2xl font-bold font-heading">{totalUserCredits.toFixed(2)} cr.</p>
        </div>
        <div className="card-container p-4">
          <div className="flex items-center text-muted-foreground mb-2">
            <ShieldCheck className="w-4 h-4 mr-2" />
            <h3 className="text-sm font-semibold">Caixa Admin</h3>
          </div>
          <p className="text-2xl font-bold font-heading text-success">{adminProfit.toFixed(2)} cr.</p>
        </div>
        <div className="card-container p-4">
          <div className="flex items-center text-muted-foreground mb-2">
            <Coins className="w-4 h-4 mr-2" />
            <h3 className="text-sm font-semibold">Total em Jogo</h3>
          </div>
          <p className="text-2xl font-bold font-heading text-primary">{totalCredits.toFixed(2)} cr.</p>
        </div>
      </div>

      <Tabs defaultValue="matches" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6 h-auto mb-8">
          <TabsTrigger value="matches" className="py-3">Partidas</TabsTrigger>
          <TabsTrigger value="credits" className="py-3 relative">
            Entradas
            {pendingRequestsCount > 0 && <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white border border-background">{pendingRequestsCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="redeems" className="py-3 relative">
            Saídas
            {pendingRedeemsCount > 0 && <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white border border-background">{pendingRedeemsCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="players" className="py-3">Jogadores</TabsTrigger>
          <TabsTrigger value="rifas" className="py-3">Rifas</TabsTrigger>
          <TabsTrigger value="settings" className="py-3">Ajustes</TabsTrigger>
        </TabsList>

        <TabsContent value="matches">
          <MatchManager />
        </TabsContent>

        <TabsContent value="credits">
          <div className="card-container">
            <h2 className="font-heading text-xl font-bold text-foreground mb-4">Solicitações de Entrada</h2>
            <p className="text-muted-foreground mb-6">Aprovação de comprovantes e liberação de créditos.</p>
            <Button className="w-full py-6 text-lg gradient-primary" onClick={() => navigate('/admin/credit-requests')}>Gerenciar Entradas <ArrowRight className="w-5 h-5 ml-2" /></Button>
          </div>
        </TabsContent>

        <TabsContent value="redeems">
          <div className="card-container">
            <h2 className="font-heading text-xl font-bold text-foreground mb-4">Solicitações de Resgate (Saída)</h2>
            <p className="text-muted-foreground mb-6">Pagamento de prêmios e créditos aos jogadores via PIX.</p>
            <Button className="w-full py-6 text-lg gradient-primary" onClick={() => navigate('/admin/redeem-requests')}>Gerenciar Resgates <ArrowRight className="w-5 h-5 ml-2" /></Button>
          </div>
        </TabsContent>

        <TabsContent value="players">
          <div className="card-container">
            <h2 className="font-heading text-xl font-bold text-foreground mb-4">Base de Jogadores</h2>
            <p className="text-muted-foreground mb-6">Visualize detalhes de perfis e ajuste saldos manualmente.</p>
            <Button className="w-full py-6 text-lg" variant="outline" onClick={() => navigate('/admin/players')}>Gerenciar Jogadores <ArrowRight className="w-5 h-5 ml-2" /></Button>
          </div>
        </TabsContent>

        <TabsContent value="rifas">
          <div className="card-container">
            <h2 className="font-heading text-xl font-bold text-foreground mb-4 flex items-center gap-2"><Ticket className="w-5 h-5" />Módulo de Rifas</h2>
            <p className="text-muted-foreground mb-6">Crie e gerencie rifas, vendedores e registre vendas físicas.</p>
            <Button className="w-full py-6 text-lg gradient-primary" onClick={() => navigate('/admin/rifas')}>Gerenciar Rifas <ArrowRight className="w-5 h-5 ml-2" /></Button>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <SettingsManager />
        </TabsContent>
      </Tabs>
    </>
  );
};

export default Admin;