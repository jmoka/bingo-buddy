import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSolicitacaoVendedor } from '@/hooks/useSolicitacaoVendedor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, UserCheck, Clock, XCircle, CheckCircle2, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SolicitarVendedor = () => {
  const navigate = useNavigate();
  const {
    minhasSolicitacoes,
    solicitacaoPendente,
    solicitacaoAprovada,
    solicitacaoRejeitada,
    isLoading,
    solicitarVendedor,
    cancelarSolicitacao,
  } = useSolicitacaoVendedor();

  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const handleSolicitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setIsSending(true);
    await solicitarVendedor(nome, documento, telefone, endereco, mensagem);
    setIsSending(false);
    setNome('');
    setDocumento('');
    setTelefone('');
    setEndereco('');
    setMensagem('');
  };

  const handleCancelar = async () => {
    if (!solicitacaoPendente) return;
    setIsCanceling(true);
    await cancelarSolicitacao(solicitacaoPendente.id);
    setIsCanceling(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-heading text-xl font-bold">Ser Vendedor de Rifas</h1>
      </div>

      {solicitacaoAprovada && (
        <div className="card-container border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 space-y-2">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold">
            <CheckCircle2 className="w-5 h-5" />
            Você é um vendedor aprovado!
          </div>
          <p className="text-sm text-green-700 dark:text-green-300">
            Sua solicitação foi aprovada. Acesse o painel do vendedor para começar a vender.
          </p>
          {solicitacaoAprovada.mensagem_admin && (
            <p className="text-xs text-green-600 dark:text-green-400 border-t border-green-200 dark:border-green-700 pt-2">
              Mensagem do admin: {solicitacaoAprovada.mensagem_admin}
            </p>
          )}
          <Button className="w-full mt-2 gradient-primary" onClick={() => navigate('/vendedor/painel')}>
            <UserCheck className="w-4 h-4 mr-2" />
            Ir para o Painel do Vendedor
          </Button>
        </div>
      )}

      {solicitacaoPendente && (
        <div className="card-container border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
            <Clock className="w-5 h-5" />
            Solicitação Pendente
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Sua solicitação está aguardando análise do administrador.
          </p>
          <div className="text-xs text-muted-foreground space-y-1 border-t border-amber-200 dark:border-amber-700 pt-2">
            <p><span className="font-medium">Nome:</span> {solicitacaoPendente.nome}</p>
            {solicitacaoPendente.documento && <p><span className="font-medium">Documento:</span> {solicitacaoPendente.documento}</p>}
            {solicitacaoPendente.telefone && <p><span className="font-medium">Telefone:</span> {solicitacaoPendente.telefone}</p>}
            {solicitacaoPendente.endereco && <p><span className="font-medium">Endereço:</span> {solicitacaoPendente.endereco}</p>}
            <p><span className="font-medium">Enviada em:</span> {format(new Date(solicitacaoPendente.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={handleCancelar}
            disabled={isCanceling}
          >
            {isCanceling ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
            Cancelar Solicitação
          </Button>
        </div>
      )}

      {solicitacaoRejeitada && !solicitacaoPendente && !solicitacaoAprovada && (
        <div className="card-container border-destructive/30 bg-destructive/5 space-y-2">
          <div className="flex items-center gap-2 text-destructive font-bold">
            <XCircle className="w-5 h-5" />
            Solicitação Rejeitada
          </div>
          {solicitacaoRejeitada.mensagem_admin && (
            <p className="text-sm text-muted-foreground">
              Motivo: {solicitacaoRejeitada.mensagem_admin}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Você pode enviar uma nova solicitação abaixo.</p>
        </div>
      )}

      {!solicitacaoPendente && !solicitacaoAprovada && (
        <div className="card-container space-y-5">
          <div>
            <h2 className="font-heading font-bold text-base mb-1">Solicitar status de Vendedor</h2>
            <p className="text-sm text-muted-foreground">
              Preencha o formulário abaixo. O administrador irá analisar sua solicitação e entrar em contato.
            </p>
          </div>
          <form onSubmit={handleSolicitar} className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Seu nome completo"
                required
              />
            </div>
            <div>
              <Label htmlFor="documento">CPF / CNPJ</Label>
              <Input
                id="documento"
                value={documento}
                onChange={e => setDocumento(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone / WhatsApp</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={e => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={endereco}
                onChange={e => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro, cidade..."
              />
            </div>
            <div>
              <Label htmlFor="mensagem">Mensagem (opcional)</Label>
              <Textarea
                id="mensagem"
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                placeholder="Conte um pouco sobre você ou por que quer ser vendedor..."
                rows={3}
              />
            </div>
            <Button type="submit" className="w-full gradient-primary" disabled={isSending || !nome.trim()}>
              {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar Solicitação
            </Button>
          </form>
        </div>
      )}

      {minhasSolicitacoes.length > 1 && (
        <div className="card-container space-y-2">
          <h3 className="font-heading font-semibold text-sm">Histórico de Solicitações</h3>
          <div className="space-y-2">
            {minhasSolicitacoes.map(s => (
              <div key={s.id} className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2 last:border-0">
                <span>{format(new Date(s.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                <Badge
                  variant={s.status === 'aprovado' ? 'default' : s.status === 'rejeitado' ? 'destructive' : 'secondary'}
                  className="text-[10px]"
                >
                  {s.status === 'pendente' ? 'Pendente' : s.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SolicitarVendedor;