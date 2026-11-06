
export type MonthStatus = 'ativo' | 'fechado' | 'provisionamento';

export interface Month {
  id: number;
  nome: string;
  ano: number;
  status: MonthStatus;
  saldo_final: number;
  criado_em?: string;
}

export interface Bank {
  id: number;
  nome: string;
  cor: string;
}

export interface Revenue {
  id: number;
  mes_id: number;
  descricao: string;
  valor: number;
  data: string;
}

export interface AbastecimentoItem {
  id: string | number;
  data: string;
  valor: number;
  criado_em?: string;
}

export interface Expense {
  id: number;
  mes_id: number;
  descricao: string;
  valor: number;
  pago: boolean;
  data: string;
  historico_abastecimentos?: AbastecimentoItem[];
}

export interface PixExpense {
  id: number;
  mes_id: number;
  descricao: string;
  valor_original: number;
  taxa_percentual: number;
  valor_final: number;
  pago: boolean;
  data: string;
}

export interface BankExpense {
  id: number;
  mes_id: number;
  banco_id: number;
  descricao: string;
  valor: number;
  pago: boolean;
  data: string;
}

export interface Installment {
  id: number;
  mes_id: number;
  descricao: string;
  valor_parcela: number;
  parcela_atual: number;
  total_parcelas: number;
  banco_id?: number | null;
  criado_em?: string;
}

export type GastoCategoria = 'Restaurante' | 'Lazer' | 'Conveniência';

export interface GastoItem {
  id: number | string;
  categoria: GastoCategoria | string;
  valor: number;
  data: string;
  estabelecimento?: string | null;
  mes_referencia: string;
  request_id?: string | null;
  origem?: string;
  created_at?: string;
  observacao?: string;
}

export interface ContaReceberVenda {
  id: string;
  descricao: string;
  valor_total: number;
  valor_parcela: number;
  total_parcelas: number;
  mes_inicio: string;
  created_at?: string;
}

export interface ContaReceberParcela {
  id: string;
  venda_id: string;
  descricao: string;
  numero_parcela: number;
  total_parcelas: number;
  valor_parcela: number;
  mes_referencia: string;
  mes_id?: number | null;
  status: 'pendente' | 'recebido';
  data_recebimento?: string | null;
  created_at?: string;
}