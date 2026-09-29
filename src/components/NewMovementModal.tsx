import React, { useState } from 'react';
import { MovementItem, MovementType } from '../types';

interface NewMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMovement: (item: MovementItem) => void;
}

export const NewMovementModal: React.FC<NewMovementModalProps> = ({
  isOpen,
  onClose,
  onAddMovement,
}) => {
  const [dataNf, setDataNf] = useState('');
  const [nf, setNf] = useState('');
  const [cfop, setCfop] = useState('6.908');
  const [sku, setSku] = useState('620206');
  const [descricao, setDescricao] = useState('BOMBA PNEUMATICA DOCTOR LIFE DVT-2600');
  const [cliente, setCliente] = useState('');
  const [tipo, setTipo] = useState<MovementType>('Comodato');
  const [qtd, setQtd] = useState<number>(1);
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('SP');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nf || !cliente || qtd <= 0) return;

    const today = dataNf || new Date().toISOString().split('T')[0];
    const [year, month, day] = today.includes('-')
      ? today.split('-')
      : [today.split('/')[2], today.split('/')[1], today.split('/')[0]];

    const formattedDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    const mesCalc = `${year}-${month.padStart(2, '0')}`;
    const isRetorno = tipo === 'RETORNO';

    const newItem: MovementItem = {
      id: `mov-${Date.now()}`,
      data_nf: formattedDate,
      mes_calc: mesCalc,
      nf: nf.trim(),
      cfop: cfop.trim(),
      sku: sku.trim(),
      descricao: descricao.trim(),
      cliente: cliente.trim().toUpperCase(),
      tipo,
      qtd: Number(qtd),
      qtd_liquida: isRetorno ? -Number(qtd) : Number(qtd),
      cidade: cidade.trim() || undefined,
      uf: uf.trim() || undefined,
    };

    onAddMovement(newItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/50 backdrop-blur-xs">
      <div className="bg-surface-container-lowest border border-surface-dim rounded-xl max-w-lg w-full shadow-xl overflow-hidden animate-in fade-in duration-200">
        <div className="p-space-md bg-surface-container-low border-b border-surface-dim flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[22px]">
              post_add
            </span>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              Registrar Nova Movimentação
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-secondary hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-space-lg flex flex-col gap-space-md">
          <div className="grid grid-cols-2 gap-space-md">
            <div>
              <label className="font-table-header text-table-header uppercase text-secondary block mb-1">
                Data NF
              </label>
              <input
                type="date"
                value={dataNf}
                onChange={(e) => setDataNf(e.target.value)}
                className="w-full bg-surface-container-low border border-surface-dim rounded-xs px-space-sm py-1.5 font-data-tabular text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="font-table-header text-table-header uppercase text-secondary block mb-1">
                Número NF
              </label>
              <input
                type="text"
                value={nf}
                onChange={(e) => setNf(e.target.value)}
                placeholder="Ex: 432100"
                className="w-full bg-surface-container-low border border-surface-dim rounded-xs px-space-sm py-1.5 font-data-tabular text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-space-md">
            <div>
              <label className="font-table-header text-table-header uppercase text-secondary block mb-1">
                Modalidade
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as MovementType)}
                className="w-full bg-surface-container-low border border-surface-dim rounded-xs px-space-sm py-1.5 font-data-tabular text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="Comodato">Comodato</option>
                <option value="Demonstração">Demonstração</option>
                <option value="Locação">Locação</option>
                <option value="RETORNO">Retorno</option>
              </select>
            </div>
            <div>
              <label className="font-table-header text-table-header uppercase text-secondary block mb-1">
                CFOP
              </label>
              <input
                type="text"
                value={cfop}
                onChange={(e) => setCfop(e.target.value)}
                className="w-full bg-surface-container-low border border-surface-dim rounded-xs px-space-sm py-1.5 font-data-tabular text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="font-table-header text-table-header uppercase text-secondary block mb-1">
                Quantidade
              </label>
              <input
                type="number"
                min="1"
                value={qtd}
                onChange={(e) => setQtd(Number(e.target.value))}
                className="w-full bg-surface-container-low border border-surface-dim rounded-xs px-space-sm py-1.5 font-data-tabular text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-space-md">
            <div className="col-span-1">
              <label className="font-table-header text-table-header uppercase text-secondary block mb-1">
                Cod.
              </label>
              <select
                value={sku}
                onChange={(e) => {
                  const val = e.target.value;
                  setSku(val);
                  if (val === '620206') setDescricao('BOMBA PNEUMATICA DOCTOR LIFE DVT-2600');
                  else if (val === 'LF900-BOL') setDescricao('LF900- BOMBA COMPRESSIVA PARA LINFEDEMA 2 BOTAS TAM. G');
                  else if (val === 'LF900-BOM') setDescricao('LF900- BOMBA COMPRESSIVA PARA LINFEDEMA MÁQUINA');
                  else if (val === '31780') setDescricao('SUPRASORB CNP P3 UNIDADE DE TERAPIA POR PRESSAO NEGATIVA - UNID');
                }}
                className="w-full bg-surface-container-low border border-surface-dim rounded-xs px-space-sm py-1.5 font-data-tabular text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="620206">620206</option>
                <option value="LF900-BOL">LF900-BOL</option>
                <option value="LF900-BOM">LF900-BOM</option>
                <option value="31780">31780</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="font-table-header text-table-header uppercase text-secondary block mb-1">
                Descrição
              </label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full bg-surface-container-low border border-surface-dim rounded-xs px-space-sm py-1.5 font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          <div>
            <label className="font-table-header text-table-header uppercase text-secondary block mb-1">
              Cliente / Destinatário
            </label>
            <input
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Razão Social ou Nome do Cliente"
              className="w-full bg-surface-container-low border border-surface-dim rounded-xs px-space-sm py-1.5 font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-space-md">
            <div>
              <label className="font-table-header text-table-header uppercase text-secondary block mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex: São Paulo"
                className="w-full bg-surface-container-low border border-surface-dim rounded-xs px-space-sm py-1.5 font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-table-header text-table-header uppercase text-secondary block mb-1">
                UF
              </label>
              <input
                type="text"
                maxLength={2}
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
                placeholder="SP"
                className="w-full bg-surface-container-low border border-surface-dim rounded-xs px-space-sm py-1.5 font-data-tabular text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-space-sm pt-space-sm border-t border-surface-dim mt-space-xs">
            <button
              type="button"
              onClick={onClose}
              className="px-space-md py-1.5 rounded bg-surface-container-low hover:bg-surface-container text-secondary hover:text-on-surface font-label-md text-label-md transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-space-lg py-1.5 rounded bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-xs transition-colors"
            >
              Salvar Registro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
