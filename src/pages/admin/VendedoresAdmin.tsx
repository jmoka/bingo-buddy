import { useState } from 'react';
import { useRifaAdmin } from '@/hooks/useRifaAdmin';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Copy,
  ShieldBan,
  ShieldCheck,
  Edit,
  Download,
  Image as ImageIcon,
  Save
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SolicitacaoVendedor } from '@/types/rifa';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AcaoDialog {
  tipo: 'aprovar' | 'rejeitar';
  solicitacao: SolicitacaoVendedor;
}

const statusBadge = (status: SolicitacaoVendedor['status']) => {
  if (status === 'pendente') return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]">Pendente</Badge>;
  if (status === 'aprovado') return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 text-[10px]">Aprovado</Badge>;
  return <Badge variant="destructive" className="text-[10px]">Rejeitado</Badge>;
};

const SolicitacaoCard = ({
  solicitacao,
  onAprovar,
  onRejeitar,
}: {
  solicitacao: SolicitacaoVendedor;
  onAprovar?: () => void;
  onRejeitar?: () => void;
}) => (
  <div className="card-container space-y-2">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{solicitacao.nome}</p>
          {statusBadge(solicitacao.status)}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
          {solicitacao.documento && <span>Doc: {solicitacao.documento}</span>}
          {solicitacao.telefone && <span>Tel: {solicitacao.telefone}</span>}
          <span>{format(new Date(solicitacao.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
        </div>
        {solicitacao.endereco && (
          <p className="text-xs text-muted-foreground">Endereço: {solicitacao.endereco}</p>
        )}
        {solicitacao.perfis?.full_name && (
          <p className="text-xs text-muted-foreground">Conta: {solicitacao.perfis.full_name}</p>
        )}
        {solicitacao.mensagem && (
          <p className="text-xs text-foreground/70 mt-1 italic">"{solicitacao.mensagem}"</p>
        )}
        {solicitacao.mensagem_admin && (
          <p className="text-xs text-muted-foreground mt-1 border-t pt-1">
            Admin: {solicitacao.mensagem_admin}
          </p>
        )}
      </div>
    </div>
    {solicitacao.status === 'pendente' && onAprovar && onRejeitar && (
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1 h-8 text-xs gradient-primary" onClick={onAprovar}>
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar
        </Button>
        <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs" onClick={onRejeitar}>
          <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
        </Button>
      </div>
    )}
  </div>
);

const VendedoresAdmin = () => {
  const {
    solicitacoesVendedor,
    vendedoresComStats,
    isLoadingSolicitacoes,
    aprovarVendedor,
    rejeitarVendedor,
    atualizarVendedor,
    salvarEdicaoCompletaVendedor,
  } = useRifaAdmin();

  const [acaoDialog, setAcaoDialog] = useState<AcaoDialog | null>(null);
  const [mensagemAdmin, setMensagemAdmin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // States para o modal de Edição Completa
  const [editandoVendedor, setEditandoVendedor] = useState<any | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [formEdicao, setFormEdicao] = useState({
    nome_completo: '',
    telefone: '',
    cpf: '',
    rg: '',
    endereco: '',
    comissao: 0,
    desconto: 0,
  });

  const pendentes = solicitacoesVendedor.filter(s => s.status === 'pendente');
  const resolvidas = solicitacoesVendedor.filter(s => s.status !== 'pendente');

  const handleAcao = async () => {
    if (!acaoDialog) return;
    setIsProcessing(true);
    if (acaoDialog.tipo === 'aprovar') {
      await aprovarVendedor(acaoDialog.solicitacao.id, mensagemAdmin || undefined);
    } else {
      await rejeitarVendedor(acaoDialog.solicitacao.id, mensagemAdmin || undefined);
    }
    setIsProcessing(false);
    setAcaoDialog(null);
    setMensagemAdmin('');
  };

  const handleToggleAtivo = async (vendedorId: string, ativo: boolean) => {
    await atualizarVendedor(vendedorId, { ativo: !ativo });
  };

  const handleCopyRef = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    toast.success('Código copiado!');
  };

  const openEditModal = (vendedor: any) => {
    setEditandoVendedor(vendedor);
    setFormEdicao({
      nome_completo: vendedor.cadastro?.nome_completo || vendedor.nome || '',
      telefone: vendedor.cadastro?.telefone || vendedor.telefone || '',
      cpf: vendedor.cadastro?.cpf || vendedor.documento || '',
      rg: vendedor.cadastro?.rg || '',
      endereco: vendedor.cadastro?.endereco || '',
      comissao: vendedor.comissao_percentual || 0,
      desconto: vendedor.percentual_desconto || 0,
    });
  };

  const handleSaveEdit = async () => {
    if (!editandoVendedor) return;
    setIsSavingEdit(true);

    const payloadRifa = {
      nome: formEdicao.nome_completo,
      telefone: formEdicao.telefone,
      documento: formEdicao.cpf,
      comissao_percentual: Number(formEdicao.comissao),
      percentual_desconto: Number(formEdicao.desconto),
    };

    const payloadCadastro = {
      nome_completo: formEdicao.nome_completo,
      telefone: formEdicao.telefone,
      cpf: formEdicao.cpf,
      rg: formEdicao.rg,
      endereco: formEdicao.endereco,
    };

    const ok = await salvarEdicaoCompletaVendedor(editandoVendedor.id, editandoVendedor.user_id, payloadRifa, payloadCadastro);
    setIsSavingEdit(false);
    if (ok) setEditandoVendedor(null);
  };

  const downloadArquivo = async (path: string, bucket: string, nomeArquivo: string) => {
    try {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      toast.error('Erro ao baixar o arquivo.');
    }
  };

  if (isLoadingSolicitacoes) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Gestão de Vendedores
        </h2>
        {pendentes.length > 0 && (
          <Badge className="bg-amber-500 text-white">
            {pendentes.length} pendente{pendentes.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="solicitacoes">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="solicitacoes" className="relative">
            Solicitações
            {pendentes.length > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                {pendentes.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
        </TabsList>

        <TabsContent value="solicitacoes" className="space-y-4 mt-4">
          {solicitacoesVendedor.length === 0 ? (
            <div className="card-container text-center py-10 text-muted-foreground text-sm">
              Nenhuma solicitação ainda.
            </div>
          ) : (
            <>
              {pendentes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> Pendentes ({pendentes.length})
                  </h3>
                  {pendentes.map(s => (
                    <SolicitacaoCard
                      key={s.id}
                      solicitacao={s}
                      onAprovar={() => { setAcaoDialog({ tipo: 'aprovar', solicitacao: s }); setMensagemAdmin(''); }}
                      onRejeitar={() => { setAcaoDialog({ tipo: 'rejeitar', solicitacao: s }); setMensagemAdmin(''); }}
                    />
                  ))}
                </div>
              )}
              {resolvidas.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">Histórico</h3>
                  {resolvidas.map(s => (
                    <SolicitacaoCard key={s.id} solicitacao={s} />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="vendedores" className="space-y-3 mt-4">
          {vendedoresComStats.length === 0 ? (
            <div className="card-container text-center py-10 text-muted-foreground text-sm">
              Nenhum vendedor cadastrado.
            </div>
          ) : (
            vendedoresComStats.map((v: any) => (
              <div key={v.id} className={`card-container space-y-3 ${!v.ativo ? 'opacity-80 border-destructive/30' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{v.nome}</p>
                      <Badge
                        variant={v.ativo ? 'default' : 'destructive'}
                        className={`text-[10px] shrink-0 ${v.ativo ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30' : ''}`}
                      >
                        {v.ativo ? 'Ativo' : 'Bloqueado'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                      {v.telefone && <span>{v.telefone}</span>}
                      {v.documento && <span>Doc: {v.documento}</span>}
                      <span>Desconto: {v.percentual_desconto}%</span>
                      <span>Comissão: {v.comissao_percentual}%</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant={v.ativo ? 'outline' : 'default'}
                      className={`text-xs h-8 ${v.ativo ? 'text-destructive border-destructive/30 hover:bg-destructive/10' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                      onClick={() => handleToggleAtivo(v.id, v.ativo)}
                    >
                      {v.ativo ? <ShieldBan className="w-3.5 h-3.5 mr-1.5" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />}
                      {v.ativo ? 'Bloquear' : 'Desbloquear'}
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between border-t border-border pt-3">
                  {v.codigo_ref && (
                    <div className="flex items-center gap-1.5 bg-muted rounded px-2 py-1">
                      <span className="text-[10px] text-muted-foreground">Ref:</span>
                      <span className="text-xs font-mono font-bold tracking-widest">{v.codigo_ref}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCopyRef(v.codigo_ref)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  <Button size="sm" variant="secondary" className="h-8 text-xs font-semibold" onClick={() => openEditModal(v)}>
                    <Edit className="w-3.5 h-3.5 mr-1.5" />
                    Ver / Editar
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL DE EDIÇÃO / VISUALIZAÇÃO DO VENDEDOR */}
      <Dialog open={!!editandoVendedor} onOpenChange={open => !open && setEditandoVendedor(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              Editar Cadastro do Vendedor
            </DialogTitle>
          </DialogHeader>

          {editandoVendedor && (
            <div className="space-y-6 py-2">
              {/* DADOS PESSOAIS */}
              <div className="space-y-4">
                <h3 className="font-heading font-bold text-primary border-b pb-1 text-sm">Dados Pessoais</h3>
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input value={formEdicao.nome_completo} onChange={e => setFormEdicao(p => ({...p, nome_completo: e.target.value}))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input value={formEdicao.cpf} onChange={e => setFormEdicao(p => ({...p, cpf: e.target.value}))} />
                  </div>
                  <div className="space-y-2">
                    <Label>RG</Label>
                    <Input value={formEdicao.rg} onChange={e => setFormEdicao(p => ({...p, rg: e.target.value}))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Telefone / WhatsApp</Label>
                  <Input value={formEdicao.telefone} onChange={e => setFormEdicao(p => ({...p, telefone: e.target.value}))} />
                </div>
                <div className="space-y-2">
                  <Label>Endereço Completo</Label>
                  <Input value={formEdicao.endereco} onChange={e => setFormEdicao(p => ({...p, endereco: e.target.value}))} />
                </div>
              </div>

              {/* TAXAS E CONFIGURAÇÕES */}
              <div className="space-y-4">
                <h3 className="font-heading font-bold text-primary border-b pb-1 text-sm">Taxas na Rifa</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Comissão (%)</Label>
                    <Input type="number" step="0.1" value={formEdicao.comissao} onChange={e => setFormEdicao(p => ({...p, comissao: Number(e.target.value)}))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Desconto p/ Cliente (%)</Label>
                    <Input type="number" step="0.1" value={formEdicao.desconto} onChange={e => setFormEdicao(p => ({...p, desconto: Number(e.target.value)}))} />
                  </div>
                </div>
              </div>

              {/* DOCUMENTOS ANEXADOS */}
              <div className="space-y-4">
                <h3 className="font-heading font-bold text-primary border-b pb-1 text-sm">Documentos Anexados</h3>
                {!editandoVendedor.cadastro && (
                  <p className="text-xs text-muted-foreground italic">Este vendedor foi criado antes da implementação do envio de documentos ou seu cadastro está incompleto.</p>
                )}
                
                {editandoVendedor.cadastro && (
                  <div className="flex flex-col gap-2">
                    {editandoVendedor.cadastro.foto_url && (
                      <Button variant="outline" className="justify-start" onClick={() => downloadArquivo(editandoVendedor.cadastro.foto_url, 'avatars', 'foto_perfil.jpg')}>
                        <ImageIcon className="w-4 h-4 mr-2" /> Baixar Foto de Perfil
                      </Button>
                    )}
                    {editandoVendedor.cadastro.documento_url && (
                      <Button variant="outline" className="justify-start" onClick={() => downloadArquivo(editandoVendedor.cadastro.documento_url, 'receipts', 'documento.jpg')}>
                        <Download className="w-4 h-4 mr-2" /> Baixar Documento (RG/CNH)
                      </Button>
                    )}
                    {editandoVendedor.cadastro.comprovante_endereco_url && (
                      <Button variant="outline" className="justify-start" onClick={() => downloadArquivo(editandoVendedor.cadastro.comprovante_endereco_url, 'receipts', 'comprovante_endereco.jpg')}>
                        <Download className="w-4 h-4 mr-2" /> Baixar Comprovante de Endereço
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditandoVendedor(null)}>Cancelar</Button>
            <Button className="gradient-primary" onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE APROVAÇÃO (Antigo) */}
      <Dialog open={!!acaoDialog} onOpenChange={open => !open && setAcaoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {acaoDialog?.tipo === 'aprovar'
                ? <><CheckCircle2 className="w-5 h-5 text-green-600" /> Aprovar Vendedor</>
                : <><XCircle className="w-5 h-5 text-destructive" /> Rejeitar Solicitação</>
              }
            </DialogTitle>
          </DialogHeader>
          {acaoDialog && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                <p><span className="font-medium">Nome:</span> {acaoDialog.solicitacao.nome}</p>
                {acaoDialog.solicitacao.documento && <p><span className="font-medium">Documento:</span> {acaoDialog.solicitacao.documento}</p>}
                {acaoDialog.solicitacao.telefone && <p><span className="font-medium">Telefone:</span> {acaoDialog.solicitacao.telefone}</p>}
                {acaoDialog.solicitacao.endereco && <p><span className="font-medium">Endereço:</span> {acaoDialog.solicitacao.endereco}</p>}
                {acaoDialog.solicitacao.mensagem && <p><span className="font-medium">Mensagem:</span> {acaoDialog.solicitacao.mensagem}</p>}
              </div>
              <div>
                <Label htmlFor="msg-admin">Mensagem para o usuário (opcional)</Label>
                <Textarea
                  id="msg-admin"
                  value={mensagemAdmin}
                  onChange={e => setMensagemAdmin(e.target.value)}
                  placeholder={acaoDialog.tipo === 'aprovar' ? 'Ex: Bem-vindo! Acesse o painel do vendedor.' : 'Ex: Documentação insuficiente.'}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button
              className={acaoDialog?.tipo === 'aprovar' ? 'gradient-primary' : ''}
              variant={acaoDialog?.tipo === 'rejeitar' ? 'destructive' : 'default'}
              onClick={handleAcao}
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {acaoDialog?.tipo === 'aprovar' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendedoresAdmin;