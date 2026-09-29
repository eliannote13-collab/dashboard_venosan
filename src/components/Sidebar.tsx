import React from 'react';
import { MovementType, FilterState } from '../types';

interface SidebarProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  filteredCount: number;
  totalCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  typeCounts: Record<MovementType, number>;
  onOpenSheetsModal: () => void;
  currentSpreadsheetTitle?: string;
  isSyncing?: boolean;
  semRetornoCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  filters,
  onFilterChange,
  filteredCount,
  isOpenMobile,
  onCloseMobile,
  typeCounts,
  onOpenSheetsModal,
  currentSpreadsheetTitle,
  isSyncing,
  semRetornoCount = 0,
}) => {
  const toggleType = (type: MovementType) => {
    const exists = filters.selectedTypes.includes(type);
    let newTypes: MovementType[];
    if (exists) {
      newTypes = filters.selectedTypes.filter((t) => t !== type);
    } else {
      newTypes = [...filters.selectedTypes, type];
    }
    onFilterChange({ selectedTypes: newTypes });
  };

  const selectAllAndShowAll = () => {
    onFilterChange({
      selectedTypes: ['Comodato', 'Demonstração', 'Locação', 'RETORNO'],
      onlySemRetorno: false,
    });
  };

  const clearAllTypes = () => {
    onFilterChange({ selectedTypes: [] });
  };

  const modules = [
    { id: 'fluxo', label: 'Fluxo de Saídas', code: '01' },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-on-surface/40 z-30 lg:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed left-0 top-0 bottom-0 w-64 bg-surface-container-lowest border-r border-surface-dim z-40 flex flex-col justify-between overflow-y-auto transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-space-md">
          {/* Logo / Brand Header */}
          <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-surface-dim">
            <div className="flex items-center gap-space-xs">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-on-primary font-bold text-xs tracking-tighter">
                VL
              </div>
              <div className="flex flex-col">
                <span className="font-headline-md text-[14px] leading-tight font-bold text-on-surface tracking-tight">
                  VENOSAN L&H
                </span>
              </div>
            </div>
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1 text-secondary hover:text-on-surface rounded"
              title="Fechar menu"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Módulos do Painel */}
          <div className="px-space-sm pb-space-xs mb-space-xs border-b border-surface-dim flex items-center justify-between">
            <span className="font-table-header text-table-header uppercase text-secondary tracking-wider">
              Módulos do Painel
            </span>
          </div>
          <nav className="flex flex-col gap-space-2xs">
            {modules.map((m) => {
              const isActive = filters.activeModule === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onFilterChange({ activeModule: m.id })}
                  className={`flex items-center justify-between px-space-md py-space-sm rounded transition-all font-bold text-left ${
                    isActive
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-secondary hover:bg-surface-container-low hover:text-on-surface font-medium'
                  }`}
                >
                  <span className="font-body-md text-body-md">{m.label}</span>
                  <span
                    className={`font-data-tabular text-label-sm ${
                      isActive ? 'text-on-primary' : 'text-secondary'
                    }`}
                  >
                    {m.code}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Filtro de Modalidade e Retenção */}
          <div className="mt-space-lg px-space-sm pb-space-xs mb-space-xs border-b border-surface-dim flex items-center justify-between">
            <span className="font-table-header text-table-header uppercase text-secondary tracking-wider">
              Filtro de Modalidade
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllAndShowAll}
                className="text-[10px] font-table-header text-primary hover:underline font-bold"
              >
                Mostrar Todos
              </button>
              <span className="text-[10px] text-surface-dim">|</span>
              <button
                type="button"
                onClick={clearAllTypes}
                className="text-[10px] font-table-header text-secondary hover:text-on-surface hover:underline"
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Filtro Especial: Clientes Sem Retorno */}
          <div className="px-space-sm mb-space-xs">
            <label
              className={`flex items-center justify-between text-body-sm cursor-pointer py-1.5 px-2 rounded-lg border transition-all select-none ${
                filters.onlySemRetorno
                  ? 'bg-error-container border-primary/40 text-on-error-container font-semibold shadow-xs'
                  : 'bg-surface-container-low/70 border-surface-dim hover:bg-surface-container text-on-surface'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!filters.onlySemRetorno}
                  onChange={(e) => onFilterChange({ onlySemRetorno: e.target.checked })}
                  className="accent-primary rounded-xs w-4 h-4 cursor-pointer"
                />
                <span className="text-body-sm font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  Clientes Sem Retorno
                </span>
              </div>
              <span
                className={`font-data-tabular-bold text-[11px] px-1.5 py-0.5 rounded ${
                  filters.onlySemRetorno
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-primary font-bold'
                }`}
              >
                {semRetornoCount} un
              </span>
            </label>
          </div>

          {/* Modalidades Individuais */}
          <div className="flex flex-col gap-space-xs px-space-sm">
            {(['Comodato', 'Demonstração', 'Locação', 'RETORNO'] as MovementType[]).map((type) => {
              const checked = filters.selectedTypes.includes(type);
              const count = typeCounts[type] || 0;
              return (
                <label
                  key={type}
                  className="flex items-center justify-between text-body-sm cursor-pointer py-1 px-1 rounded hover:bg-surface-container-low transition-colors select-none"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleType(type)}
                      className="accent-primary rounded-xs w-4 h-4 cursor-pointer"
                    />
                    <span className={`text-body-sm ${checked ? 'text-on-surface font-medium' : 'text-secondary'}`}>
                      {type === 'RETORNO' ? 'Retorno' : type}
                    </span>
                  </div>
                  <span className="font-data-tabular text-[11px] text-secondary bg-surface-container px-1.5 py-0.5 rounded">
                    {count}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Filtro de Exercício / Ano */}
          <div className="mt-space-lg px-space-sm pb-space-xs mb-space-xs border-b border-surface-dim">
            <span className="font-table-header text-table-header uppercase text-secondary tracking-wider">
              Exercício Fiscal
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 px-space-sm mt-1">
            {[
              { id: 'all', label: 'Todos' },
              { id: '2025', label: '2025' },
              { id: '2026', label: '2026' },
            ].map((y) => (
              <button
                key={y.id}
                type="button"
                onClick={() => onFilterChange({ selectedYear: y.id })}
                className={`py-1 text-center font-data-tabular text-[11px] rounded transition-colors ${
                  filters.selectedYear === y.id
                    ? 'bg-primary-fixed text-on-primary-fixed font-bold border border-primary/20'
                    : 'bg-surface-container-low text-secondary hover:text-on-surface'
                }`}
              >
                {y.label}
              </button>
            ))}
          </div>

          {/* Banco de Dados Google Sheets */}
          <div className="mt-space-lg p-space-sm rounded-lg bg-surface-container border border-surface-dim flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-table-header text-[10px] uppercase text-secondary tracking-wider font-bold">
                Banco de Dados
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  currentSpreadsheetTitle ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              ></span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                {currentSpreadsheetTitle || 'Armazenamento Local'}
              </span>
              <span className="font-data-tabular text-[10px] text-primary truncate font-medium">
                fiscalvenosanbrasil@gmail.com
              </span>
              <span className="font-data-tabular text-[9px] text-secondary">
                {currentSpreadsheetTitle ? 'Google Sheets Conectado' : 'Google Drive Oficial'}
              </span>
            </div>
            <button
              onClick={onOpenSheetsModal}
              className="mt-1 w-full py-1 px-2 rounded bg-surface-container-lowest hover:bg-surface-container-high text-on-surface border border-surface-dim font-label-sm text-[11px] flex items-center justify-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px] text-emerald-600">
                {isSyncing ? 'sync' : 'link'}
              </span>
              <span>{currentSpreadsheetTitle ? 'Gerenciar Planilha' : 'Conectar Planilha'}</span>
            </button>
          </div>
        </div>

        {/* Footer Sidebar */}
        <div className="p-space-md border-t border-surface-dim bg-surface-container-low">
          <div className="flex items-center justify-between font-label-sm text-label-sm text-secondary">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">database</span>
              Registros Processados
            </span>
            <span className="font-data-tabular text-on-surface font-bold">
              {filteredCount}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-dim/60 font-table-header text-[10px] text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sincronização Ativa
            </span>
            <span className="font-data-tabular">v2.6</span>
          </div>
        </div>
      </aside>
    </>
  );
};
