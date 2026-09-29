import React, { useState, useMemo } from 'react';
import { MovementItem } from '../types';

export interface MovementTableProps {
  data: MovementItem[];
  tableSearch: string;
  onTableSearchChange: (val: string) => void;
  onSelectRow: (item: MovementItem) => void;
}

type SortField =
  | 'data_nf'
  | 'nf'
  | 'cfop'
  | 'sku'
  | 'descricao'
  | 'cliente'
  | 'tipo'
  | 'qtd'
  | 'qtd_liquida';

type SortDirection = 'asc' | 'desc';

export const MovementTable: React.FC<MovementTableProps> = ({
  data,
  tableSearch,
  onTableSearchChange,
  onSelectRow,
}) => {
  const [sortField, setSortField] = useState<SortField>('data_nf');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    const list = [...data];
    list.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const strA = String(aVal ?? '').toLowerCase();
      const strB = String(bVal ?? '').toLowerCase();
      const cmp = strA.localeCompare(strB, 'pt-BR');
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [data, sortField, sortDirection]);

  const totalQtd = useMemo(() => data.reduce((acc, row) => acc + (row.qtd || 0), 0), [data]);
  const totalLiq = useMemo(
    () => data.reduce((acc, row) => acc + (row.qtd_liquida || 0), 0),
    [data]
  );

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Cabeçalho da Tabela */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px]">
            table_chart
          </span>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Detalhamento dos Lotes em Movimentação
          </h2>
          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            {data.length} {data.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {/* Campo de Busca */}
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">
            search
          </span>
          <input
            type="text"
            value={tableSearch}
            onChange={(e) => onTableSearchChange(e.target.value)}
            placeholder="Buscar na tabela..."
            className="w-full pl-9 pr-8 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
          {tableSearch && (
            <button
              onClick={() => onTableSearchChange('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Limpar busca"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Grade de Dados */}
      <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider sticky top-0 z-10 select-none border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th
                onClick={() => handleSort('data_nf')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Data NF</span>
                  {sortField === 'data_nf' && (
                    <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('nf')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Nº NF</span>
                  {sortField === 'nf' && (
                    <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('cfop')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>CFOP</span>
                  {sortField === 'cfop' && (
                    <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('sku')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Código SKU</span>
                  {sortField === 'sku' && (
                    <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('descricao')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors min-w-[240px]"
              >
                <div className="flex items-center gap-1">
                  <span>Descrição do Equipamento</span>
                  {sortField === 'descricao' && (
                    <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('cliente')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors min-w-[200px]"
              >
                <div className="flex items-center gap-1">
                  <span>Cliente</span>
                  {sortField === 'cliente' && (
                    <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('tipo')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Modalidade</span>
                  {sortField === 'tipo' && (
                    <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('qtd')}
                className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Qtd</span>
                  {sortField === 'qtd' && (
                    <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('qtd_liquida')}
                className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Qtd Líq.</span>
                  {sortField === 'qtd_liquida' && (
                    <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              sortedData.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onSelectRow(row)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-xs">
                    {row.data_nf || '-'}
                  </td>

                  <td className="py-2.5 px-4 whitespace-nowrap font-medium text-slate-800 dark:text-slate-100 font-mono text-xs">
                    {row.nf || '-'}
                  </td>

                  <td className="py-2.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-xs">
                    {row.cfop || '-'}
                  </td>

                  <td className="py-2.5 px-4 whitespace-nowrap font-semibold text-slate-900 dark:text-slate-100 font-mono text-xs">
                    {row.sku || '-'}
                  </td>

                  <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200 max-w-sm truncate" title={row.descricao}>
                    {row.descricao || '-'}
                  </td>

                  <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200 max-w-xs truncate" title={row.cliente}>
                    {row.cliente || '-'}
                  </td>

                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                        row.tipo === 'RETORNO'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          : row.tipo === 'Demonstração'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : row.tipo === 'Locação'
                          ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      {row.tipo}
                    </span>
                  </td>

                  <td className="py-2.5 px-4 text-right font-semibold font-mono text-xs text-slate-800 dark:text-slate-100 whitespace-nowrap">
                    {row.qtd}
                  </td>

                  <td
                    className={`py-2.5 px-4 text-right font-semibold font-mono text-xs whitespace-nowrap ${
                      row.qtd_liquida < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {row.qtd_liquida}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Rodapé de Totais */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-4">
        <div className="flex items-center gap-6">
          <span>
            Total de linhas:{' '}
            <strong className="text-slate-900 dark:text-slate-100 font-bold font-mono">
              {data.length}
            </strong>
          </span>
          <span>
            Soma Qtd:{' '}
            <strong className="text-slate-900 dark:text-slate-100 font-bold font-mono">
              {totalQtd}
            </strong>
          </span>
          <span>
            Saldo Líquido:{' '}
            <strong
              className={`font-bold font-mono ${
                totalLiq < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {totalLiq}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};
