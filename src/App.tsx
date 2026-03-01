import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GameProvider } from "@/contexts/GameContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import Lobby from "./pages/Lobby";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Account from "./pages/Account";
import MatchView from "./pages/MatchView";
import PrintView from "./pages/PrintView";
import NotFound from "./pages/NotFound";
import PlayersAdmin from "./pages/PlayersAdmin";
import CreditRequestsAdmin from "./pages/CreditRequestsAdmin";
import RedeemRequestsAdmin from "./pages/RedeemRequestsAdmin";
import ActivePlayers from "./pages/ActivePlayers";
import Trophies from "./pages/Trophies";
import Ranking from "./pages/Ranking";
import Rifas from "./pages/Rifas";
import RifaView from "./pages/RifaView";
import RifasAdmin from "./pages/admin/RifasAdmin";
import RifaDetalheAdmin from "./pages/admin/RifaDetalheAdmin";
import VendedorRifa from "./pages/VendedorRifa";
import VendedorCartelas from "./pages/VendedorCartelas";
import ValidarCartela from "./pages/ValidarCartela";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <Layout>{children}</Layout>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <GameProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
              <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/admin/players" element={<ProtectedRoute><PlayersAdmin /></ProtectedRoute>} />
              <Route path="/admin/credit-requests" element={<ProtectedRoute><CreditRequestsAdmin /></ProtectedRoute>} />
              <Route path="/admin/redeem-requests" element={<ProtectedRoute><RedeemRequestsAdmin /></ProtectedRoute>} />
              <Route path="/match/:id" element={<ProtectedRoute><MatchView /></ProtectedRoute>} />
              <Route path="/print" element={<ProtectedRoute><PrintView /></ProtectedRoute>} />
              <Route path="/active-players" element={<ProtectedRoute><ActivePlayers /></ProtectedRoute>} />
              <Route path="/trophies" element={<ProtectedRoute><Trophies /></ProtectedRoute>} />
              <Route path="/ranking" element={<ProtectedRoute><Ranking /></ProtectedRoute>} />
              <Route path="/rifas" element={<ProtectedRoute><Rifas /></ProtectedRoute>} />
              <Route path="/rifas/:id" element={<ProtectedRoute><RifaView /></ProtectedRoute>} />
              <Route path="/admin/rifas" element={<ProtectedRoute><RifasAdmin /></ProtectedRoute>} />
              <Route path="/admin/rifas/:id" element={<ProtectedRoute><RifaDetalheAdmin /></ProtectedRoute>} />
              <Route path="/vendedor" element={<ProtectedRoute><VendedorRifa /></ProtectedRoute>} />
              <Route path="/vendedor/cartelas/:compraId" element={<ProtectedRoute><VendedorCartelas /></ProtectedRoute>} />
              <Route path="/validar-cartela" element={<ProtectedRoute><ValidarCartela /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </GameProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;