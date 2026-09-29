import React from 'react';
import { SpreadsheetDetails } from '../lib/sheetsService';

interface HeaderBannerProps {
  globalSearch: string;
  onSearchChange: (value: string) => void;
  onExportCsv: () => void;
  onToggleSidebarMobile: () => void;
  onOpenSheetsModal: () => void;
  currentSpreadsheet: SpreadsheetDetails | null;
  currentSheetName: string;
  isSyncing: boolean;
  onManualSync: () => void;
  lastSyncTime: string | null;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  globalSearch,
  onSearchChange,
  onExportCsv,
  onToggleSidebarMobile,
  onOpenSheetsModal,
  currentSpreadsheet,
  isSyncing,
  onManualSync,
}) => {
  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-dim">
      <div className="flex items-center gap-space-md">
        <button
          onClick={onToggleSidebarMobile}
          className="lg:hidden p-1.5 text-secondary hover:text-on-surface bg-surface-container-low rounded border border-surface-dim"
          aria-label="Abrir menu lateral"
        >
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>

        <div className="w-2 h-7 bg-primary rounded-full shrink-0"></div>
        <div className="flex flex-col">
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            Operações Remessas e Devoluções
          </h1>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="flex items-center gap-space-sm flex-1 max-w-md">
        <div className="relative flex w-full items-center gap-space-xs bg-surface-container-low px-space-md py-space-xs rounded border border-surface-dim focus-within:border-primary transition-colors">
          <span className="material-symbols-outlined text-secondary text-[18px] shrink-0">
            search
          </span>
          <input
            id="globalSearchInput"
            type="text"
            value={globalSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent border-0 p-0 font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:outline-none focus:ring-0"
            placeholder="Filtrar por Cod. (ex: 620206), NF ou Cliente..."
          />
          {globalSearch && (
            <button
              onClick={() => onSearchChange('')}
              className="text-secondary hover:text-on-surface p-0.5"
              title="Limpar busca"
            >
              <span className="material-symbols-outlined text-[16px]">cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Action Buttons and Google Sheets Connection */}
      <div className="flex flex-wrap items-center gap-space-xs">
        {/* Google Sheets Connection Pill */}
        {currentSpreadsheet ? (
          <div className="flex items-center bg-surface-container-low border border-surface-dim rounded-lg p-0.5 pr-2">
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              title="Clique para sincronizar com o Google Sheets"
              className="p-1.5 text-secondary hover:text-primary rounded hover:bg-surface-container transition-colors"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  isSyncing ? 'animate-spin text-primary' : 'text-emerald-600'
                }`}
              >
                sync
              </span>
            </button>
            <button
              onClick={onOpenSheetsModal}
              className="flex items-center gap-1.5 text-left text-on-surface hover:text-primary transition-colors cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="font-table-header text-[9px] uppercase text-emerald-700 font-bold leading-none flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Google Sheets Ativo
                </span>
                <span className="font-data-tabular-bold text-[11px] truncate max-w-[130px] leading-tight">
                  {currentSpreadsheet.title}
                </span>
              </div>
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenSheetsModal}
            className="flex items-center gap-1.5 px-space-sm py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md border border-surface-dim transition-colors"
            title="Conectar painel a uma planilha do Google Sheets"
          >
            <span className="material-symbols-outlined text-[18px] text-emerald-600">
              table_chart
            </span>
            <span className="whitespace-nowrap">Conectar Google Sheets</span>
          </button>
        )}

        <button
          onClick={onExportCsv}
          className="flex items-center gap-1 px-space-sm py-1.5 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md border border-surface-dim transition-colors"
          title="Exportar dados filtrados para CSV"
        >
          <span className="material-symbols-outlined text-[16px] text-secondary">download</span>
          <span>CSV</span>
        </button>
      </div>
    </div>
  );
};

