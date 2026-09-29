import React from 'react';
import { MovementItem } from '../types';

interface MovementDetailModalProps {
  item: MovementItem | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export const MovementDetailModal: React.FC<MovementDetailModalProps> = ({
  item,
  onClose,
  onDelete,
}) => {
  if (!item) return null;

  const isRetorno = item.tipo === 'RETORNO';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/50 backdrop-blur-xs">
      <div className="bg-surface-container-lowest border border-surface-dim rounded-xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in duration-200">
        <div className="p-space-md bg-surface-container-low border-b border-surface-dim flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[22px]">
              receipt_long
            </span>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              Detalhes da Nota Fiscal Nº {item.nf}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-secondary hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-space-lg flex flex-col gap-space-md">
          <div className="flex items-center justify-between p-space-sm bg-surface-container-low rounded-lg border border-surface-dim">
            <div className="flex flex-col">
              <span className="font-table-header text-table-header text-secondary uppercase">
                Modalidade de Operação
              </span>
              <span
                className={`font-label-md text-label-md font-bold mt-0.5 ${
                  isRetorno ? 'text-secondary' : 'text-primary'
                }`}
              >
                {item.tipo}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-table-header text-table-header text-secondary uppercase">
                Saldo de Impacto
              </span>
              <span
                className={`font-data-tabular-bold text-headline-md ${
                  item.qtd_liquida < 0 ? 'text-primary' : 'text-on-surface'
                }`}
              >
                {item.qtd_liquida > 0 ? `+${item.qtd_liquida}` : item.qtd_liquida} un
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-space-sm text-body-sm">
            <div className="p-space-sm bg-surface-container-low/50 rounded border border-surface-dim">
              <span className="font-table-header text-table-header text-secondary uppercase block mb-0.5">
                Data de Emissão NF
              </span>
              <span className="font-data-tabular-bold text-on-surface">{item.data_nf}</span>
            </div>
            <div className="p-space-sm bg-surface-container-low/50 rounded border border-surface-dim">
              <span className="font-table-header text-table-header text-secondary uppercase block mb-0.5">
                Código CFOP
              </span>
              <span className="font-data-tabular-bold text-on-surface">{item.cfop}</span>
            </div>
            <div className="p-space-sm bg-surface-container-low/50 rounded border border-surface-dim">
              <span className="font-table-header text-table-header text-secondary uppercase block mb-0.5">
                Código (Cod.)
              </span>
              <span className="font-data-tabular-bold text-primary">{item.sku}</span>
            </div>
            <div className="p-space-sm bg-surface-container-low/50 rounded border border-surface-dim">
              <span className="font-table-header text-table-header text-secondary uppercase block mb-0.5">
                Volume da NF
              </span>
              <span className="font-data-tabular-bold text-on-surface">{item.qtd} un</span>
            </div>
          </div>

          <div className="p-space-sm bg-surface-container-low/50 rounded border border-surface-dim">
            <span className="font-table-header text-table-header text-secondary uppercase block mb-0.5">
              Equipamento
            </span>
            <span className="font-body-md text-on-surface font-medium">{item.descricao}</span>
          </div>

          <div className="p-space-sm bg-surface-container-low/50 rounded border border-surface-dim">
            <span className="font-table-header text-table-header text-secondary uppercase block mb-0.5">
              Cliente / Destinatário
            </span>
            <span className="font-label-md text-on-surface font-semibold">{item.cliente}</span>
            {item.cidade && (
              <span className="font-body-sm text-secondary block mt-0.5">
                {item.cidade}{item.uf ? ` - ${item.uf}` : ''}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-space-sm border-t border-surface-dim">
            <button
              onClick={() => {
                if (confirm(`Remover o registro da NF ${item.nf}?`)) {
                  onDelete(item.id);
                  onClose();
                }
              }}
              className="flex items-center gap-1 text-error hover:text-on-error-container font-label-md text-label-md py-1.5 px-space-sm rounded hover:bg-error-container/40 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              <span>Excluir Lote</span>
            </button>

            <button
              onClick={onClose}
              className="px-space-lg py-1.5 rounded bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
