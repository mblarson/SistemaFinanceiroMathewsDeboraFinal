
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

export interface Expense {
  id: number;
  mes_id: number;
  descricao: string;
  valor: number;
  pago: boolean;
  data: string;
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
  criado_em?: string;
}