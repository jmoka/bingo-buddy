import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut, ArrowRight } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGame } from '@/contexts/GameContext';
import MatchManager from '@/components/admin/MatchManager';
import SettingsManager from '@/components/admin/SettingsManager';

const Admin = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { allCreditRequests, allRedeemRequests } = useGame();

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      navigate('/');
    }
  }, [profile, navigate]);

  if (!profile || profile.role !== 'admin') {
    return null;
  }

  const pendingRequestsCount = (allCreditRequests || []).filter(r => r.status === 'pending').length;
  const pendingRedeemsCount = (allRedeemRequests || []).filter(r => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="gradient-hero py-6 px-4">
        <div className="container max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => navigate('/')}><ArrowLeft className="w-5 h-5" /></Button>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-primary-foreground">Painel Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-primary-foreground" onClick={signOut}><LogOut className="w-4 h-4 mr-1" />Sair</Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto py-8 px-4 flex-grow">
        <Tabs defaultValue="matches" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto mb-8">
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

          <TabsContent value="settings">
            <SettingsManager />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;