import { useState, useMemo, useEffect } from 'react';
import { User } from 'firebase/auth';
import { INITIAL_DATA } from './data/mockData';
import { MovementItem, MovementType, FilterState, KpiSummary } from './types';
import { Sidebar } from './components/Sidebar';
import { HeaderBanner } from './components/HeaderBanner';
import { KpiCards } from './components/KpiCards';
import { MonthlyChart } from './components/MonthlyChart';
import { RankingsSection } from './components/RankingsSection';
import { MovementTable } from './components/MovementTable';
import { NewMovementModal } from './components/NewMovementModal';
import { MovementDetailModal } from './components/MovementDetailModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { MutationConfirmModal } from './components/MutationConfirmModal';
import {
  initAuth,
  googleSignIn,
  logout,
} from './lib/auth';
import {
  SpreadsheetDetails,
  fetchSheetData,
  appendMovementRow,
} from './lib/sheetsService';

const STORAGE_KEY_SPREADSHEET = 'venosan_connected_spreadsheet';
const STORAGE_KEY_DATA = 'venosan_sheet_cached_data';

export const DEFAULT_SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/178EySNqiOxJPDwDW5G2VrY-ZGNfgVeMn6j0pGmZizFM/edit?usp=sharing';
export const DEFAULT_SPREADSHEET_ID = '178EySNqiOxJPDwDW5G2VrY-ZGNfgVeMn6j0pGmZizFM';
export const DEFAULT_SPREADSHEET_TITLE = 'Base de Movimentação (Padrão)';
export const DEFAULT_SHEET_NAME = 'base';

export default function App() {
  const [data, setData] = useState<MovementItem[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_DATA);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar dados em cache:', e);
    }
    return INITIAL_DATA;
  });

  const [filters, setFilters] = useState<FilterState>({
    globalSearch: '',
    tableSearch: '',
    selectedTypes: ['Comodato', 'Demonstração', 'Locação', 'RETORNO'],
    selectedYear: 'all',
    activeModule: 'fluxo',
  });
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<MovementItem | null>(null);

  // Google Workspace / Sheets State
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  
  // Persistent Spreadsheet Connection State (Default to the specified Google Sheet)
  const [currentSpreadsheet, setCurrentSpreadsheet] = useState<SpreadsheetDetails | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SPREADSHEET);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id) {
          return {
            id: parsed.id,
            title: parsed.title || DEFAULT_SPREADSHEET_TITLE,
            sheets: [{ sheetId: 0, title: parsed.sheetName || DEFAULT_SHEET_NAME }],
          };
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar planilha salva:', e);
    }
    // Planilha padrão do sistema (não exige inserção manual pelo usuário)
    return {
      id: DEFAULT_SPREADSHEET_ID,
      title: DEFAULT_SPREADSHEET_TITLE,
      sheets: [{ sheetId: 0, title: DEFAULT_SHEET_NAME }],
    };
  });

  const [currentSheetName, setCurrentSheetName] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SPREADSHEET);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.sheetName || DEFAULT_SHEET_NAME;
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_SHEET_NAME;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SPREADSHEET);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.lastSyncTime || null;
      }
    } catch (e) {
      // ignore
    }
    return null;
  });

  // Mutation Confirmation Modal State (MANDATORY for Workspace operations)
  const [pendingMovementItem, setPendingMovementItem] = useState<MovementItem | null>(null);
  const [isAppendingToSheet, setIsAppendingToSheet] = useState(false);

  // Core Sync Function
  const syncSpreadsheet = async (sheetId: string, tabName: string, token: string | null) => {
    setIsSyncing(true);
    try {
      const items = await fetchSheetData(token, sheetId, tabName);
      if (items && items.length > 0) {
        setData(items);
        try {
          localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(items));
        } catch (e) {
          console.warn('Quota de localStorage excedida ao salvar cache de dados');
        }
      }
      const syncStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(syncStr);

      // Update stored metadata
      try {
        const stored = localStorage.getItem(STORAGE_KEY_SPREADSHEET);
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.lastSyncTime = syncStr;
          localStorage.setItem(STORAGE_KEY_SPREADSHEET, JSON.stringify(parsed));
        }
      } catch (e) {
        // ignore
      }
    } catch (err: any) {
      console.warn('Falha na sincronização em segundo plano:', err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Init Auth listener on load
  useEffect(() => {
    const unsubscribe = initAuth(
      (u, token) => {
        setUser(u);
        setAccessToken(token);
        // If we have a saved spreadsheet, auto-sync with the fresh access token
        const stored = localStorage.getItem(STORAGE_KEY_SPREADSHEET);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.id) {
              syncSpreadsheet(parsed.id, parsed.sheetName || 'base', token);
            }
          } catch (e) {
            // ignore
          }
        }
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Startup auto-sync for connected spreadsheet (runs immediately on mount)
  useEffect(() => {
    let sheetId = DEFAULT_SPREADSHEET_ID;
    let sheetName = DEFAULT_SHEET_NAME;

    const stored = localStorage.getItem(STORAGE_KEY_SPREADSHEET);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.id) {
          sheetId = parsed.id;
          sheetName = parsed.sheetName || DEFAULT_SHEET_NAME;
        }
      } catch (e) {
        // ignore
      }
    }
    syncSpreadsheet(sheetId, sheetName, accessToken);
  }, []);

  // Re-sync automatically when user returns to this browser tab
  useEffect(() => {
    const handleFocus = () => {
      let sheetId = DEFAULT_SPREADSHEET_ID;
      let sheetName = DEFAULT_SHEET_NAME;

      const stored = localStorage.getItem(STORAGE_KEY_SPREADSHEET);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.id) {
            sheetId = parsed.id;
            sheetName = parsed.sheetName || DEFAULT_SHEET_NAME;
          }
        } catch (e) {
          // ignore
        }
      }
      syncSpreadsheet(sheetId, sheetName, accessToken);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [accessToken]);

  const handleFilterChange = (updated: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updated }));
  };

  // Type counts for sidebar badges
  const typeCounts = useMemo(() => {
    const counts: Record<MovementType, number> = {
      Comodato: 0,
      Demonstração: 0,
      Locação: 0,
      RETORNO: 0,
    };
    data.forEach((item) => {
      counts[item.tipo] = (counts[item.tipo] || 0) + 1;
    });
    return counts;
  }, [data]);

  // Main filtered dataset
  const filteredData = useMemo(() => {
    const gSearch = filters.globalSearch.toLowerCase().trim();
    const tSearch = filters.tableSearch.toLowerCase().trim();

    // Calculate balances for each client to check retention
    const clientBalances: Record<string, number> = {};
    data.forEach((item) => {
      clientBalances[item.cliente] = (clientBalances[item.cliente] || 0) + item.qtd_liquida;
    });

    return data.filter((item) => {
      // Clientes Sem Retorno filter (only clients with positive retention)
      if (filters.onlySemRetorno) {
        if ((clientBalances[item.cliente] || 0) <= 0) {
          return false;
        }
      }

      // Accent-insensitive normalization helper
      const clean = (s: string) =>
        (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

      const itemSearchText = clean(
        `${item.sku} ${item.cliente} ${item.descricao} ${item.nf} ${item.cfop} ${item.tipo} ${item.cidade || ''} ${item.uf || ''} ${item.data_nf} ${item.mes_calc}`
      );

      // Global Search
      const matchesGlobal = !gSearch || itemSearchText.includes(clean(gSearch));

      // Table Search
      const matchesTable = !tSearch || itemSearchText.includes(clean(tSearch));

      // Type Filter
      const matchesType = filters.selectedTypes.includes(item.tipo);

      // Year Filter
      const matchesYear =
        filters.selectedYear === 'all' || item.mes_calc.startsWith(filters.selectedYear);

      return matchesGlobal && matchesTable && matchesType && matchesYear;
    });
  }, [data, filters]);

  // KPI Calculations
  const summary: KpiSummary = useMemo(() => {
    const saidas = filteredData.filter(
      (d) => d.tipo === 'Comodato' || d.tipo === 'Demonstração' || d.tipo === 'Locação'
    );
    const totalSaidas = saidas.reduce((acc, d) => acc + d.qtd, 0);

    const comodato = filteredData
      .filter((d) => d.tipo === 'Comodato')
      .reduce((acc, d) => acc + d.qtd, 0);

    const demonstracao = filteredData
      .filter((d) => d.tipo === 'Demonstração')
      .reduce((acc, d) => acc + d.qtd, 0);

    const locacao = filteredData
      .filter((d) => d.tipo === 'Locação')
      .reduce((acc, d) => acc + d.qtd, 0);

    const retorno = filteredData
      .filter((d) => d.tipo === 'RETORNO')
      .reduce((acc, d) => acc + d.qtd, 0);

    // Sem Retorno: Positive cumulative balances across clients
    const balances: Record<string, number> = {};
    filteredData.forEach((d) => {
      balances[d.cliente] = (balances[d.cliente] || 0) + d.qtd_liquida;
    });
    const semRetorno = Object.values(balances)
      .filter((b) => b > 0)
      .reduce((acc, b) => acc + b, 0);

    const baseVal = totalSaidas || 1;

    return {
      totalSaidas,
      comodato,
      demonstracao,
      locacao,
      retorno,
      semRetorno,
      comodatoPct: ((comodato / baseVal) * 100).toFixed(1),
      demonstracaoPct: ((demonstracao / baseVal) * 100).toFixed(1),
      locacaoPct: ((locacao / baseVal) * 100).toFixed(1),
    };
  }, [filteredData]);

  // Google Sign In handler
  const handleGoogleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
      }
    } catch (err) {
      console.error('Falha ao autenticar com o Google:', err);
    }
  };

  // Google Sign Out handler
  const handleGoogleSignOut = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setCurrentSpreadsheet(null);
    setLastSyncTime(null);
  };

  // Spreadsheet selection & immediate sync
  const handleSelectSpreadsheet = async (details: SpreadsheetDetails, sheetName: string) => {
    setIsSyncing(true);
    try {
      const items = await fetchSheetData(accessToken, details.id, sheetName);
      if (items.length > 0) {
        setData(items);
        try {
          localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(items));
        } catch (e) {
          console.warn('Quota excedida ao salvar cache de dados');
        }
      }
      setCurrentSpreadsheet(details);
      setCurrentSheetName(sheetName);
      const syncStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(syncStr);

      // Persist permanently in localStorage so user never has to re-connect upon re-entering
      try {
        localStorage.setItem(
          STORAGE_KEY_SPREADSHEET,
          JSON.stringify({
            id: details.id,
            title: details.title,
            sheetName,
            lastSyncTime: syncStr,
          })
        );
      } catch (e) {
        console.warn('Erro ao salvar conexão permanente');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Disconnect spreadsheet
  const handleDisconnectSpreadsheet = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_SPREADSHEET);
      localStorage.removeItem(STORAGE_KEY_DATA);
    } catch (e) {
      // ignore
    }
    setCurrentSpreadsheet(null);
    setCurrentSheetName(DEFAULT_SHEET_NAME);
    setLastSyncTime(null);
  };

  // Reset to default spreadsheet
  const handleResetToDefaultSpreadsheet = async () => {
    try {
      localStorage.removeItem(STORAGE_KEY_SPREADSHEET);
    } catch (e) {
      // ignore
    }
    const defaultDetails: SpreadsheetDetails = {
      id: DEFAULT_SPREADSHEET_ID,
      title: DEFAULT_SPREADSHEET_TITLE,
      sheets: [{ sheetId: 0, title: DEFAULT_SHEET_NAME }],
    };
    await handleSelectSpreadsheet(defaultDetails, DEFAULT_SHEET_NAME);
  };

  // Manual Sync
  const handleManualSync = async () => {
    if (!currentSpreadsheet || !currentSheetName) return;
    await syncSpreadsheet(currentSpreadsheet.id, currentSheetName, accessToken);
  };

  // Requesting new movement: if connected to Sheets, ask for confirmation
  const handleRequestAddMovement = (newItem: MovementItem) => {
    if (currentSpreadsheet && accessToken) {
      setPendingMovementItem(newItem);
    } else {
      setData((prev) => [newItem, ...prev]);
    }
  };

  // Confirm writing new movement to Google Sheet
  const handleConfirmAddMovementToSheet = async () => {
    if (!pendingMovementItem) return;

    if (currentSpreadsheet && accessToken && currentSheetName) {
      setIsAppendingToSheet(true);
      try {
        await appendMovementRow(
          accessToken,
          currentSpreadsheet.id,
          currentSheetName,
          pendingMovementItem
        );
        setData((prev) => [pendingMovementItem, ...prev]);
        setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
      } catch (err: any) {
        console.error('Erro ao salvar na planilha:', err);
        // Fallback to saving in local state
        setData((prev) => [pendingMovementItem, ...prev]);
      } finally {
        setIsAppendingToSheet(false);
        setPendingMovementItem(null);
      }
    } else {
      setData((prev) => [pendingMovementItem, ...prev]);
      setPendingMovementItem(null);
    }
  };

  // Handler to delete item
  const handleDeleteItem = (id: string) => {
    setData((prev) => prev.filter((item) => item.id !== id));
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Data NF',
      'Mes Calc',
      'NF',
      'CFOP',
      'SKU',
      'Descricao',
      'Cliente',
      'Tipo',
      'Qtd',
      'Qtd Liquida',
    ];

    const rows = filteredData.map((d) => [
      d.data_nf,
      d.mes_calc,
      d.nf,
      d.cfop,
      d.sku,
      `"${d.descricao.replace(/"/g, '""')}"`,
      `"${d.cliente.replace(/"/g, '""')}"`,
      d.tipo,
      d.qtd,
      d.qtd_liquida,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `venosan_estoque_saidas_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      {/* Navigation Sidebar Lateral */}
      <Sidebar
        filters={filters}
        onFilterChange={handleFilterChange}
        filteredCount={filteredData.length}
        totalCount={data.length}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
        typeCounts={typeCounts}
        onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
        currentSpreadsheetTitle={currentSpreadsheet?.title}
        isSyncing={isSyncing}
        semRetornoCount={summary.semRetorno}
      />

      {/* Conteúdo Principal */}
      <div className="lg:pl-64 transition-all duration-200">
        <main className="relative pt-space-lg w-full min-h-screen bg-background px-gutter md:px-gutter-desktop pb-space-2xl">
          <div className="flex flex-col w-full gap-space-lg max-w-[1600px] mx-auto">
            {/* Banner de Título com Busca Global e Integração Google Sheets */}
            <HeaderBanner
              globalSearch={filters.globalSearch}
              onSearchChange={(val) => handleFilterChange({ globalSearch: val })}
              onExportCsv={handleExportCsv}
              onToggleSidebarMobile={() => setIsOpenMobile(true)}
              onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
              currentSpreadsheet={currentSpreadsheet}
              currentSheetName={currentSheetName}
              isSyncing={isSyncing}
              onManualSync={handleManualSync}
              lastSyncTime={lastSyncTime}
            />

            {/* Banner info when connected to Google Sheets */}
            {currentSpreadsheet && (
              <div className="flex flex-wrap items-center justify-between px-space-md py-2 rounded-xl bg-emerald-50/70 border border-emerald-200 font-body-sm text-emerald-950">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[20px]">
                    cloud_done
                  </span>
                  <span>
                    Conectado à planilha <strong>{currentSpreadsheet.title}</strong> (Aba:{' '}
                    <strong>{currentSheetName}</strong>)
                  </span>
                  {lastSyncTime && (
                    <span className="text-secondary font-data-tabular text-[11px]">
                      · Última sincronização: {lastSyncTime}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 sm:mt-0">
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="flex items-center gap-1 font-label-md text-emerald-700 hover:text-emerald-900 font-semibold"
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        isSyncing ? 'animate-spin' : ''
                      }`}
                    >
                      sync
                    </span>
                    <span>{isSyncing ? 'Sincronizando...' : 'Atualizar Dados'}</span>
                  </button>
                  <span>·</span>
                  <button
                    onClick={() => setIsSheetsModalOpen(true)}
                    className="font-label-md text-secondary hover:text-on-surface"
                  >
                    Alterar Planilha
                  </button>
                </div>
              </div>
            )}

            {/* Banner info when filter is active */}
            {(filters.globalSearch ||
              filters.tableSearch ||
              filters.selectedTypes.length < 4 ||
              filters.selectedYear !== 'all' ||
              filters.onlySemRetorno) && (
              <div className="flex items-center justify-between px-space-md py-1.5 rounded-lg bg-surface-container-high border border-surface-dim font-body-sm text-secondary">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="material-symbols-outlined text-[16px] text-primary">
                    filter_alt
                  </span>
                  <span>Filtros ativos:</span>
                  {filters.onlySemRetorno && (
                    <span className="bg-error-container text-on-error-container px-2 py-0.5 rounded font-data-tabular text-[11px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                      Apenas Clientes Sem Retorno
                    </span>
                  )}
                  {filters.globalSearch && (
                    <span className="bg-surface-container-lowest px-2 py-0.5 rounded font-data-tabular text-on-surface">
                      Busca: "{filters.globalSearch}"
                    </span>
                  )}
                  {filters.selectedYear !== 'all' && (
                    <span className="bg-surface-container-lowest px-2 py-0.5 rounded font-data-tabular text-on-surface">
                      Ano: {filters.selectedYear}
                    </span>
                  )}
                  {filters.selectedTypes.length < 4 && (
                    <span className="bg-surface-container-lowest px-2 py-0.5 rounded font-data-tabular text-on-surface">
                      Tipos: {filters.selectedTypes.join(', ')}
                    </span>
                  )}
                </div>
                <button
                  onClick={() =>
                    setFilters({
                      globalSearch: '',
                      tableSearch: '',
                      selectedTypes: ['Comodato', 'Demonstração', 'Locação', 'RETORNO'],
                      selectedYear: 'all',
                      activeModule: 'fluxo',
                      onlySemRetorno: false,
                    })
                  }
                  className="text-primary hover:underline text-body-sm font-semibold shrink-0"
                >
                  Mostrar Todos / Redefinir
                </button>
              </div>
            )}

            {/* 1. CARDS DE KPI */}
            <KpiCards summary={summary} />

            {/* 2. PROPORÇÃO MENSAL DE MOVIMENTAÇÕES DE SAÍDAS */}
            <MonthlyChart data={filteredData} />

            {/* 3. SEÇÃO DE RANKINGS */}
            <RankingsSection
              data={filteredData}
              onSelectClient={(client) => handleFilterChange({ globalSearch: client })}
            />

            {/* 4. DETALHAMENTO DOS LOTES EM MOVIMENTAÇÃO */}
            <MovementTable
              data={filteredData}
              tableSearch={filters.tableSearch}
              onTableSearchChange={(val) => handleFilterChange({ tableSearch: val })}
              onSelectRow={(item) => setSelectedDetailItem(item)}
            />
          </div>
        </main>
      </div>

      {/* Modal: Nova Movimentação */}
      <NewMovementModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onAddMovement={handleRequestAddMovement}
      />

      {/* Modal: Detalhes do Lote */}
      <MovementDetailModal
        item={selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
        onDelete={handleDeleteItem}
      />

      {/* Modal: Conexão com Google Sheets */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        user={user}
        accessToken={accessToken}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleGoogleSignOut}
        currentSpreadsheet={currentSpreadsheet}
        currentSheetName={currentSheetName}
        onSelectSpreadsheet={handleSelectSpreadsheet}
        onDisconnectSpreadsheet={handleDisconnectSpreadsheet}
        onResetToDefault={handleResetToDefaultSpreadsheet}
        defaultUrl={DEFAULT_SPREADSHEET_URL}
        localSeedData={INITIAL_DATA}
        isSyncing={isSyncing}
        onManualSync={handleManualSync}
      />

      {/* Modal: Confirmação de Operação Mutante no Google Sheets (MANDATÓRIO) */}
      <MutationConfirmModal
        isOpen={!!pendingMovementItem}
        title="Salvar no Google Sheets"
        description={`Deseja gravar a nova Nota Fiscal na planilha "${currentSpreadsheet?.title}" (Aba: "${currentSheetName}")? Essa operação adicionará uma nova linha na sua base de dados do Google Drive.`}
        details={
          pendingMovementItem
            ? [
                { label: 'Nota Fiscal', value: pendingMovementItem.nf },
                { label: 'Cliente', value: pendingMovementItem.cliente },
                { label: 'Modalidade', value: pendingMovementItem.tipo },
                { label: 'SKU', value: pendingMovementItem.sku },
                { label: 'Quantidade', value: `${pendingMovementItem.qtd} un` },
              ]
            : []
        }
        confirmLabel="Confirmar e Gravar na Planilha"
        cancelLabel="Cancelar"
        isLoading={isAppendingToSheet}
        onConfirm={handleConfirmAddMovementToSheet}
        onCancel={() => setPendingMovementItem(null)}
      />
    </div>
  );
}
