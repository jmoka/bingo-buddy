import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Coins, Edit, Zap, ZapOff } from 'lucide-react';
import { Footer } from '@/components/Footer';
import PlayerAvatar from '@/components/PlayerAvatar';
import { Profile } from '@/contexts/AuthContext';

const PlayersAdmin = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { players, allPlayerCards, updatePlayerCredits } = useGame();
  const [selectedPlayer, setSelectedPlayer] = useState<Profile | null>(null);
  const [creditAmount, setCreditAmount] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!profile || profile.role !== 'admin') {
    navigate('/');
    return null;
  }

  const handleOpenDialog = (player: Profile) => {
    setSelectedPlayer(player);
    setCreditAmount(0);
    setIsDialogOpen(true);
  };

  const handleUpdateCredits = (amount: number) => {
    if (selectedPlayer && amount !== 0) {
      updatePlayerCredits(selectedPlayer.id, amount);
    }
  };

  const selectedPlayerCards = selectedPlayer ? allPlayerCards.filter(c => c.player_id === selectedPlayer.id) : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="gradient-hero py-6 px-4">
        <div className="container max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-primary-foreground">Gerenciar Jogadores</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto py-8 px-4 flex-grow">
        <div className="card-container">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jogador</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead className="text-center">Créditos</TableHead>
                <TableHead className="text-center">Cartelas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map(player => {
                const playerCardsCount = allPlayerCards.filter(c => c.player_id === player.id).length;
                return (
                  <TableRow key={player.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <PlayerAvatar url={player.avatar_url} />
                        <span className="font-medium">{player.full_name || 'Não definido'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{player.cpf || '-'}</TableCell>
                    <TableCell>{player.whatsapp || '-'}</TableCell>
                    <TableCell className="text-center font-mono">{player.credits}</TableCell>
                    <TableCell className="text-center font-mono">{playerCardsCount}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenDialog(player)}>
                        <Edit className="w-3 h-3 mr-2" />
                        Gerenciar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar: {selectedPlayer?.full_name}</DialogTitle>
            <DialogDescription>
              Visualize detalhes, gerencie créditos e veja as cartelas do jogador.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground border-t border-b py-4">
            <div><strong>CPF:</strong> {selectedPlayer?.cpf || 'Não informado'}</div>
            <div><strong>WhatsApp:</strong> {selectedPlayer?.whatsapp || 'Não informado'}</div>
            <div className="col-span-2"><strong>Endereço:</strong> {selectedPlayer?.address || 'Não informado'}</div>
          </div>

          <Tabs defaultValue="credits" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="credits">Gerenciar Créditos</TabsTrigger>
              <TabsTrigger value="cards">Cartelas ({selectedPlayerCards.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="credits">
              <div className="py-4 space-y-4">
                <p>Saldo atual: <strong className="font-mono">{selectedPlayer?.credits}</strong> créditos</p>
                <div>
                  <label htmlFor="creditAmount" className="text-sm font-medium">Valor a adicionar/remover</label>
                  <Input
                    id="creditAmount"
                    type="number"
                    value={creditAmount === 0 ? '' : creditAmount}
                    onChange={(e) => setCreditAmount(parseInt(e.target.value, 10) || 0)}
                    placeholder="Ex: 50 ou -20"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Fechar</Button>
                </DialogClose>
                <Button onClick={() => { handleUpdateCredits(creditAmount); setIsDialogOpen(false); }}>
                  <Coins className="w-4 h-4 mr-2" />
                  Confirmar
                </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="cards">
              <div className="max-h-64 overflow-y-auto mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead className="text-center">Usos</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPlayerCards.map(card => (
                      <TableRow key={card.id}>
                        <TableCell className="font-medium">{card.name}</TableCell>
                        <TableCell className="font-mono text-xs">...{card.id.slice(-6)}</TableCell>
                        <TableCell className="text-center font-mono">{card.uses_left}</TableCell>
                        <TableCell className="text-center">
                          {card.uses_left > 0 ? (
                            <Badge className="bg-success/10 text-success hover:bg-success/20">
                              <Zap className="w-3 h-3 mr-1" /> Válida
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <ZapOff className="w-3 h-3 mr-1" /> Sem Usos
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {selectedPlayerCards.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">Este jogador não possui cartelas.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default PlayersAdmin;