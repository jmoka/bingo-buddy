import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRifaAdmin } from '@/hooks/useRifaAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Ticket, Eye, Loader2, ArrowLeft, Calendar, DollarSign, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Rifa } from '@/types/rifa';

const statusConfig: Record<string, { label: string; className: string }> = {
  ativa: { label: 'Ativa', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  finalizada: { label: 'Finalizada', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  cancelada: { label: 'Cancelada', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const defaultForm = {
  nome: '',
  descricao: '',
  regulamento: '',
  premio_descricao: '',
  premio_foto: '',
  quantidade_numeros: 100,
  numero_inicial: 1,
  custo_por_numero: 1,
  data_encerramento: '',
};

const RifasAdmin = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { todasRifas, isLoading, criarRifa } = useRifaAdmin();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novaRifaForm, setNovaRifaForm] = useState(defaultForm);
  const [criandoRifa, setCriandoRifa] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'ativa' | 'finalizada'>('todas');

  const rifasFiltradas = filtroStatus === 'todas'
    ? todasRifas
    : todasRifas.filter(r => r.status === filtroStatus);

  if (profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground text-lg">Acesso negado.</p>
      </div>
    );
  }

  const handleFormChange = (field: string, value: string | number) => {
    setNovaRifaForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCriarRifa = async (e: React.FormEvent) => {
    e.preventDefault();
    setCriandoRifa(true);
    
    // Mapeia os campos para o formato que o banco de dados espera
    const payload: Partial<Rifa> = {
      nome: novaRifaForm.nome,
      descricao: novaRifaForm.descricao || null,
      regulamento: novaRifaForm.regulamento || null,
      premio_descricao: novaRifaForm.premio_descricao || null,
      // Transforma a URL única em uma lista (array) para a coluna premio_fotos
      premio_fotos: novaRifaForm.premio_foto ? [novaRifaForm.premio_foto] : [],
      quantidade_numeros: Number(novaRifaForm.quantidade_numeros),
      numero_inicial: Number(novaRifaForm.numero_inicial),
      custo_por_numero: Number(novaRifaForm.custo_por_numero),
      data_encerramento: novaRifaForm.data_encerramento || null,
      status: 'ativa',
    };
    
    const id = await criarRifa(payload);
    setCriandoRifa(false);
    if (id) {
      setNovaRifaForm(defaultForm);
      setDialogOpen(false);
    }
  };

  const ativas = todasRifas.filter(r => r.status === 'ativa').length;
  const finalizadas = todasRifas.filter(r => r.status === 'finalizada').length;

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Ticket className="w-6 h-6 text-primary" />
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
              Gestão de Rifas
            </h1>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Nova Rifa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2">
                <Ticket className="w-5 h-5 text-primary" />
                Nova Rifa
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCriarRifa} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  required
                  value={novaRifaForm.nome}
                  onChange={e => handleFormChange('nome', e.target.value)}
                  placeholder="Ex: Rifa do Carro"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={novaRifaForm.descricao}
                  onChange={e => handleFormChange('descricao', e.target.value)}
                  placeholder="Descrição da rifa (opcional)"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="regulamento">Regulamento</Label>
                <Textarea
                  id="regulamento"
                  value={novaRifaForm.regulamento}
                  onChange={e => handleFormChange('regulamento', e.target.value)}
                  placeholder="Regras e regulamento da rifa (opcional)"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="premio_descricao">Descrição do Prêmio</Label>
                <Textarea
                  id="premio_descricao"
                  value={novaRifaForm.premio_descricao}
                  onChange={e => handleFormChange('premio_descricao', e.target.value)}
                  placeholder="Descreva o prêmio da rifa"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="premio_foto">URL da Foto do Prêmio</Label>
                <Input
                  id="premio_foto"
                  value={novaRifaForm.premio_foto}
                  onChange={e => handleFormChange('premio_foto', e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="quantidade_numeros">Qtd. Números</Label>
                  <Input
                    id="quantidade_numeros"
                    type="number"
                    min={1}
                    value={novaRifaForm.quantidade_numeros}
                    onChange={e => handleFormChange('quantidade_numeros', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="numero_inicial">Número Inicial</Label>
                  <Input
                    id="numero_inicial"
                    type="number"
                    min={0}
                    value={novaRifaForm.numero_inicial}
                    onChange={e => handleFormChange('numero_inicial', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custo_por_numero">Custo por Número (R$)</Label>
                <Input
                  id="custo_por_numero"
                  type="number"
                  step="0.01"
                  min={0}
                  value={novaRifaForm.custo_por_numero}
                  onChange={e => handleFormChange('custo_por_numero', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="data_encerramento">Data de Encerramento</Label>
                <Input
                  id="data_encerramento"
                  type="datetime-local"
                  value={novaRifaForm.data_encerramento}
                  onChange={e => handleFormChange('data_encerramento', e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full gradient-primary" disabled={criandoRifa}>
                {criandoRifa ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Criar Rifa
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {([
              { key: 'todas', label: 'Total', icon: Ticket, value: todasRifas.length, color: 'text-foreground', bg: 'bg-primary/10 border-primary/30' },
              { key: 'ativa', label: 'Ativas', icon: Users, value: ativas, color: 'text-green-600', bg: 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-700/30' },
              { key: 'finalizada', label: 'Finalizadas', icon: DollarSign, value: finalizadas, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-700/30' },
            ] as const).map(({ key, label, icon: Icon, value, color, bg }) => (
              <button
                key={key}
                onClick={() => setFiltroStatus(key)}
                className={`card-container p-4 text-center transition-all border-2 ${filtroStatus === key ? `${bg} ring-2 ring-offset-1 ring-primary/40` : 'border-transparent'}`}
              >
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
                </div>
                <p className={`text-2xl font-bold font-heading ${color}`}>{value}</p>
              </button>
            ))}
          </div>

          {rifasFiltradas.length === 0 ? (
            <div className="card-container p-10 text-center">
              <Ticket className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma rifa criada ainda.</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Clique em "Nova Rifa" para começar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rifasFiltradas.map(rifa => (
                <RifaCard
                  key={rifa.id}
                  rifa={rifa}
                  onVerDetalhes={() => navigate(`/admin/rifas/${rifa.id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
};

const RifaCard = ({ rifa, onVerDetalhes }: { rifa: Rifa; onVerDetalhes: () => void }) => {
  const cfg = statusConfig[rifa.status] ?? statusConfig.cancelada;
  return (
    <div className="card-container p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-heading font-bold text-lg leading-tight">{rifa.nome}</h2>
        <Badge variant="outline" className={`shrink-0 ${cfg.className}`}>
          {cfg.label}
        </Badge>
      </div>

      {rifa.descricao && (
        <p className="text-sm text-muted-foreground line-clamp-2">{rifa.descricao}</p>
      )}

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1">
            <Ticket className="w-3 h-3" /> Números
          </span>
          <span className="font-bold">{rifa.quantidade_numeros}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Custo
          </span>
          <span className="font-bold">
            R${Number(rifa.custo_por_numero).toFixed(2).replace('.', ',')}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Encerramento
          </span>
          <span className="font-bold text-xs">
            {rifa.data_encerramento
              ? format(new Date(rifa.data_encerramento), 'dd/MM/yy HH:mm', { locale: ptBR })
              : '—'}
          </span>
        </div>
      </div>

      <Button variant="outline" size="sm" className="w-full mt-1" onClick={onVerDetalhes}>
        <Eye className="w-4 h-4 mr-2" />
        Ver Detalhes
      </Button>
    </div>
  );
};

export default RifasAdmin;