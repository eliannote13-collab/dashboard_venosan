export type MovementType = 'Comodato' | 'Demonstração' | 'Locação' | 'RETORNO';

export interface MovementItem {
  id: string;
  data_nf: string;
  mes_calc: string;
  nf: string;
  cfop: string;
  sku: string;
  descricao: string;
  cliente: string;
  tipo: MovementType;
  qtd: number;
  qtd_liquida: number;
  cidade?: string;
  uf?: string;
  observacao?: string;
}

export interface FilterState {
  globalSearch: string;
  tableSearch: string;
  selectedTypes: MovementType[];
  selectedYear: string; // 'all' | '2025' | '2026'
  activeModule: string;
  onlySemRetorno?: boolean;
}

export interface KpiSummary {
  totalSaidas: number;
  comodato: number;
  demonstracao: number;
  locacao: number;
  retorno: number;
  semRetorno: number;
  comodatoPct: string;
  demonstracaoPct: string;
  locacaoPct: string;
}
