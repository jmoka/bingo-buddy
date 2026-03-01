export type RifaStatus = 'ativa' | 'finalizada' | 'cancelada';
export type NumeroStatus = 'disponivel' | 'reservado' | 'vendido';
export type TipoPagamento = 'creditos' | 'vendedor';

export interface Rifa {
  id: string;
  nome: string;
  descricao: string | null;
  regulamento: string | null;
  fotos: string[];
  foto_capa: string | null;
  premio_descricao: string | null;
  premio_foto: string | null;
  quantidade_numeros: number;
  numero_inicial: number;
  custo_por_numero: number;
  data_inicio: string | null;
  data_encerramento: string | null;
  status: RifaStatus;
  numero_ganhador: number | null;
  ganhador_id: string | null;
  created_at: string;
  created_by: string | null;
}

export interface NumeroRifa {
  id: string;
  rifa_id: string;
  numero: number;
  status: NumeroStatus;
  comprador_id: string | null;
  vendedor_id: string | null;
  cliente_rifa_id: string | null;
  reservado_ate: string | null;
}

export interface CompraRifa {
  id: string;
  rifa_id: string;
  comprador_id: string | null;
  vendedor_id: string | null;
  cliente_rifa_id: string | null;
  numeros: number[];
  valor_total: number;
  desconto_aplicado: number;
  tipo_pagamento: TipoPagamento;
  created_at: string;
}

export interface VendedorRifa {
  id: string;
  user_id: string | null;
  nome: string;
  documento: string | null;
  telefone: string | null;
  percentual_desconto: number;
  ativo: boolean;
  created_at: string;
}

export interface ClienteRifa {
  id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  vendedor_id: string | null;
  created_at: string;
}

export interface CartelaRifa {
  id: string;
  numero_rifa_id: string;
  compra_id: string;
  codigo_validacao: string;
  qr_code_data: string | null;
  impresso: boolean;
  created_at: string;
}
