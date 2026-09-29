import React, { useState, useEffect } from 'react';
import {
  fetchSpreadsheetDetails,
  SpreadsheetDetails,
} from '../lib/sheetsService';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
  accessToken?: string | null;
  onSignIn?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
  currentSpreadsheet: SpreadsheetDetails | null;
  currentSheetName: string;
  onSelectSpreadsheet: (details: SpreadsheetDetails, sheetName: string) => Promise<void>;
  onDisconnectSpreadsheet?: () => void;
  onResetToDefault?: () => Promise<void>;
  defaultUrl?: string;
  localSeedData?: any;
  isSyncing: boolean;
  onManualSync: () => Promise<void>;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  currentSpreadsheet,
  currentSheetName,
  onSelectSpreadsheet,
  onDisconnectSpreadsheet,
  onResetToDefault,
  defaultUrl,
  isSyncing,
  onManualSync,
}) => {
  const [manualIdOrUrl, setManualIdOrUrl] = useState(() => {
    if (currentSpreadsheet) {
      return `https://docs.google.com/spreadsheets/d/${currentSpreadsheet.id}/edit`;
    }
    return defaultUrl || '';
  });
  const [loadedDetails, setLoadedDetails] = useState<SpreadsheetDetails | null>(
    currentSpreadsheet
  );
  const [selectedTab, setSelectedTab] = useState<string>(currentSheetName || 'base');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync internal state when currentSpreadsheet changes
  useEffect(() => {
    if (currentSpreadsheet) {
      setLoadedDetails(currentSpreadsheet);
      setSelectedTab(currentSheetName || currentSpreadsheet.sheets[0]?.title || 'base');
      setManualIdOrUrl(`https://docs.google.com/spreadsheets/d/${currentSpreadsheet.id}/edit`);
    }
  }, [currentSpreadsheet, currentSheetName]);

  const extractSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
    return trimmed;
  };

  const handleManualIdLookup = async () => {
    if (!manualIdOrUrl.trim()) {
      setErrorMessage('Por favor, cole o link ou ID da planilha do Google Sheets.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const extractedId = extractSpreadsheetId(manualIdOrUrl);

    try {
      const details = await fetchSpreadsheetDetails(null, extractedId);
      setLoadedDetails(details);
      const tabToUse =
        details.sheets.find((s) => s.title.toLowerCase() === 'base')?.title ||
        selectedTab ||
        details.sheets[0]?.title ||
        'base';
      setSelectedTab(tabToUse);

      // Automatically test connection and save
      await onSelectSpreadsheet(details, tabToUse);
      setSuccessMessage(`Planilha conectada e dados da aba "${tabToUse}" carregados com sucesso!`);
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          'Não foi possível conectar a esta planilha. Verifique se o compartilhamento no Google Drive está definido como "Qualquer pessoa com o link".'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmConnection = async () => {
    if (!loadedDetails || !selectedTab) return;
    setErrorMessage(null);
    try {
      await onSelectSpreadsheet(loadedDetails, selectedTab);
      setSuccessMessage('Conexão permanente confirmada e sincronizada!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao sincronizar com a planilha selecionada.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/50 backdrop-blur-xs">
      <div className="bg-surface-container-lowest border border-surface-dim rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-space-md bg-surface-container-low border-b border-surface-dim flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">link</span>
            </div>
            <div>
              <h3 className="font-headline-md text-[17px] font-bold text-on-surface">
                Conexão Direta por Link da Planilha
              </h3>
              <p className="font-body-sm text-[12px] text-secondary">
                Banco de Dados: Google Sheets (VENOSAN Brasil)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-secondary hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-space-lg overflow-y-auto flex flex-col gap-space-md flex-1">
          {/* Notification Messages */}
          {errorMessage && (
            <div className="p-space-sm rounded-xl bg-error-container text-on-error-container font-body-sm text-[12px] flex items-start gap-2 shadow-xs">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
              <span className="leading-tight">{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-space-sm rounded-xl bg-emerald-100 text-emerald-900 font-body-sm text-[12px] flex items-center gap-2 shadow-xs">
              <span className="material-symbols-outlined text-[18px] shrink-0 text-emerald-700">check_circle</span>
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* Official Google Drive Repository Badge */}
          <div className="p-space-sm px-space-md rounded-xl bg-surface-container border border-surface-dim flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">
                folder_shared
              </span>
              <span className="font-table-header text-[11px] uppercase text-secondary tracking-wider font-bold">
                Drive Oficial:
              </span>
              <span className="font-data-tabular-bold text-[12px] text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                fiscalvenosanbrasil@gmail.com
              </span>
            </div>
            <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              Repositório Ativo
            </span>
          </div>

          {/* Direct Link Input Section */}
          <div className="p-space-md rounded-xl bg-surface-container-low border border-primary/40 flex flex-col gap-space-sm shadow-xs">
            <label className="font-label-md text-label-md text-on-surface font-bold flex items-center justify-between">
              <span>Cole o Link ou ID da Planilha</span>
              <span className="text-[10px] text-secondary font-normal font-data-tabular">
                Google Sheets URL
              </span>
            </label>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={manualIdOrUrl}
                onChange={(e) => setManualIdOrUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5.../edit"
                className="flex-1 bg-surface-container-lowest border border-surface-dim rounded-xl px-space-sm py-2 font-data-tabular text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 text-[12px]"
              />
              <button
                type="button"
                onClick={handleManualIdLookup}
                disabled={isLoading || isSyncing}
                className="px-space-lg py-2 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-label-md text-label-md font-bold transition-all cursor-pointer shrink-0 shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isLoading || isSyncing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
                    <span>Conectando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">link</span>
                    <span>Buscar e Conectar</span>
                  </>
                )}
              </button>
            </div>

            {defaultUrl && (
              <div className="flex items-center justify-between text-[11px] px-1 text-secondary">
                <span>Planilha padrão pré-configurada no sistema</span>
                <button
                  type="button"
                  onClick={() => {
                    setManualIdOrUrl(defaultUrl);
                  }}
                  className="text-primary hover:underline font-semibold cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">restart_alt</span>
                  Preencher Link Padrão
                </button>
              </div>
            )}

            {/* Passo a Passo */}
            <div className="mt-1 p-2.5 rounded-lg bg-surface-container border border-surface-dim/60 text-[11px] text-secondary flex flex-col gap-1 leading-snug">
              <span className="font-bold text-on-surface text-[11px] flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-primary">info</span>
                Como obter o link correto no Google Drive:
              </span>
              <ol className="list-decimal list-inside space-y-0.5 pl-1 text-[11px]">
                <li>Abra a planilha no Google Drive da conta <strong>fiscalvenosanbrasil@gmail.com</strong>.</li>
                <li>Clique no botão azul <strong>Compartilhar</strong> (canto superior direito).</li>
                <li>Em <em>Acesso geral</em>, altere para <strong>"Qualquer pessoa com o link"</strong>.</li>
                <li>Clique em <strong>Copiar link</strong> e cole no campo acima.</li>
              </ol>
            </div>
          </div>

          {/* Current Connected Sheet Details */}
          {loadedDetails && (
            <div className="p-space-md bg-surface-container-high/40 rounded-xl border border-emerald-500/30 flex flex-col gap-space-sm shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-emerald-600 text-[22px]">
                    check_circle
                  </span>
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface font-bold">
                      {loadedDetails.title}
                    </span>
                    <span className="font-data-tabular text-[10px] text-secondary">
                      ID: {loadedDetails.id}
                    </span>
                  </div>
                </div>
                <a
                  href={`https://docs.google.com/spreadsheets/d/${loadedDetails.id}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline font-table-header text-[11px] bg-primary/10 px-2 py-1 rounded"
                >
                  <span>Abrir no Google Sheets</span>
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>
              </div>

              {/* Aba da Planilha */}
              <div className="flex items-center gap-2 pt-2 border-t border-surface-dim/60 flex-wrap">
                <label className="font-table-header text-[11px] uppercase text-secondary font-bold">
                  Aba da Planilha:
                </label>
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  {loadedDetails.sheets.length > 0 ? (
                    <select
                      value={selectedTab}
                      onChange={(e) => setSelectedTab(e.target.value)}
                      className="bg-surface-container-lowest border border-surface-dim rounded-lg px-2 py-1 font-data-tabular text-[12px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary flex-1"
                    >
                      {loadedDetails.sheets.map((tab) => (
                        <option key={tab.sheetId} value={tab.title}>
                          {tab.title}
                        </option>
                      ))}
                      {!loadedDetails.sheets.some((s) => s.title === selectedTab) && selectedTab && (
                        <option value={selectedTab}>{selectedTab}</option>
                      )}
                    </select>
                  ) : null}
                  <input
                    type="text"
                    value={selectedTab}
                    onChange={(e) => setSelectedTab(e.target.value)}
                    placeholder="Nome da aba (ex: Fluxo_Saidas)"
                    className="bg-surface-container-lowest border border-surface-dim rounded-lg px-2 py-1 font-data-tabular text-[12px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-36"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Conexão Permanente Info */}
          <div className="p-space-sm rounded-xl bg-surface-container border border-surface-dim flex items-center gap-2 text-[11px] text-secondary">
            <span className="material-symbols-outlined text-primary text-[16px] shrink-0">
              lock
            </span>
            <span>
              <strong>Conexão Gravada:</strong> A planilha permanece conectada permanentemente no seu navegador e sincroniza a cada atualização.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-space-md bg-surface-container-low border-t border-surface-dim flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {currentSpreadsheet && (
              <>
                <button
                  type="button"
                  onClick={onManualSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-[12px] cursor-pointer transition-colors"
                >
                  <span
                    className={`material-symbols-outlined text-[16px] text-primary ${
                      isSyncing ? 'animate-spin' : ''
                    }`}
                  >
                    sync
                  </span>
                  <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
                </button>

                {onDisconnectSpreadsheet && (
                  <button
                    type="button"
                    onClick={onDisconnectSpreadsheet}
                    className="text-error hover:underline font-label-md text-[11px] ml-1 cursor-pointer"
                  >
                    Desconectar
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-space-sm">
            <button
              type="button"
              onClick={onClose}
              className="px-space-md py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface font-label-md text-[12px] transition-colors cursor-pointer"
            >
              Fechar
            </button>

            {loadedDetails && (
              <button
                type="button"
                onClick={handleConfirmConnection}
                disabled={isSyncing}
                className="px-space-lg py-1.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-[12px] font-bold shadow-xs transition-colors cursor-pointer"
              >
                Salvar Conexão
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
