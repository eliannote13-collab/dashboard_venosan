import { MovementItem, MovementType } from '../types';

export interface SheetTab {
  sheetId: number;
  title: string;
}

export interface SpreadsheetDetails {
  id: string;
  title: string;
  sheets: SheetTab[];
}

export interface SpreadsheetSummary {
  id: string;
  name: string;
  modifiedTime?: string;
}

export const SHEETS_HEADER = [
  'Data NF',
  'Mês Calc',
  'NF',
  'CFOP',
  'Cod.',
  'Descrição',
  'Cliente',
  'Tipo',
  'Qtd',
  'Qtd Líquida',
  'Cidade',
  'UF',
];

/**
 * Lists user spreadsheets from Google Drive API
 */
export async function listUserSpreadsheets(
  accessToken: string
): Promise<SpreadsheetSummary[]> {
  const query = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=30`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erro ao listar planilhas do Drive: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
  }));
}

/**
 * Fetches spreadsheet metadata (title and sheet tabs)
 */
export async function fetchSpreadsheetDetails(
  accessToken: string | null,
  spreadsheetId: string
): Promise<SpreadsheetDetails> {
  if (accessToken) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties(sheetId,title)`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        const sheets: SheetTab[] = (data.sheets || []).map((s: any) => ({
          sheetId: s.properties.sheetId,
          title: s.properties.title,
        }));

        return {
          id: data.spreadsheetId,
          title: data.properties?.title || 'Planilha Sem Título',
          sheets: sheets.length > 0 ? sheets : [{ sheetId: 0, title: 'base' }],
        };
      }
    } catch (e) {
      console.warn('API fetchSpreadsheetDetails failed, using fallback', e);
    }
  }

  // Fallback for public or direct link: try extracting title from HTML view
  let title = 'Planilha VENOSAN (base)';
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`);
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/<title>([^<]+)<\/title>/i);
      if (match && match[1]) {
        title = match[1].replace(/ - Google (Planilhas|Sheets)$/i, '').trim();
      }
    }
  } catch (e) {
    // ignore
  }

  return {
    id: spreadsheetId,
    title,
    sheets: [
      { sheetId: 0, title: 'base' },
      { sheetId: 1, title: 'Base' },
      { sheetId: 2, title: 'BASE' },
      { sheetId: 3, title: 'Fluxo_Saidas' },
    ],
  };
}

/**
 * Validates if the returned text is real CSV and not an HTML error or redirect
 */
function isValidCsvText(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.includes('<html') ||
    trimmed.includes('google.visualization.Query.setResponse') ||
    trimmed.startsWith('/*O_o*/') ||
    trimmed.includes('"status":"error"') ||
    trimmed.includes('ServiceLogin') ||
    trimmed.includes('accounts.google.com')
  ) {
    return false;
  }
  return true;
}

/**
 * Parses raw CSV string into 2D array of string values
 */
export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  // Determine delimiter: detect if semicolon is used
  const firstLine = csvText.split(/\r\n|\n|\r/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const isDelimiter = (c: string) => {
    if (semiCount > commaCount && semiCount > tabCount) return c === ';';
    if (tabCount > commaCount) return c === '\t';
    return c === ',' || c === ';';
  };

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (isDelimiter(char) && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Fetches Google Visualization JSON and extracts rows
 */
async function fetchGvizJson(
  spreadsheetId: string,
  sheetName?: string
): Promise<any[][] | null> {
  try {
    const url = sheetName
      ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
          sheetName
        )}`
      : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();

    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?$/);
    if (!jsonMatch || !jsonMatch[1]) return null;

    const json = JSON.parse(jsonMatch[1]);
    if (json.status !== 'ok' || !json.table) return null;

    const cols = (json.table.cols || []).map((c: any) => c.label || c.id || '');
    const rows: any[][] = [cols];

    for (const rowObj of json.table.rows || []) {
      if (!rowObj || !rowObj.c) continue;
      const rowVals = rowObj.c.map((cell: any) => {
        if (!cell) return '';
        if (cell.f !== undefined && cell.f !== null) return String(cell.f);
        if (cell.v !== undefined && cell.v !== null) return String(cell.v);
        return '';
      });
      rows.push(rowVals);
    }

    return rows.length > 1 ? rows : null;
  } catch (e) {
    return null;
  }
}

/**
 * Helper to normalize string for comparison (removes accents, lowercase, extra spaces)
 */
function cleanStr(val: any): string {
  return String(val || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Helper to test if a string value looks like a date
 */
function looksLikeDate(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim();
  if (s.startsWith('Date(')) return true;
  if (/^\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}/.test(s)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  // Excel serial dates (e.g. 40000 to 55000 correspond to dates between 2009 and 2050)
  const num = Number(s);
  if (!isNaN(num) && num >= 40000 && num <= 55000) return true;
  return false;
}

/**
 * Helper to test if a string looks like an integer invoice / NF number
 */
function looksLikeNf(val: any): boolean {
  if (!val) return false;
  if (looksLikeDate(val)) return false;
  const s = String(val).trim().replace(/\.0$/, '').replace(/\./g, '');
  return /^\d{1,9}$/.test(s) || /^(nf|nfe|danfe|nota)[\s\.-]*\d+/i.test(String(val).trim());
}

/**
 * Helper to test if a string value looks like an operation type (Comodato, Retorno, Locação, etc.)
 */
export function looksLikeOperationType(val: any): boolean {
  if (!val) return false;
  const s = cleanStr(val);
  if (!s) return false;
  return (
    s.includes('comodato') ||
    s.includes('retorno') ||
    s.includes('devolu') ||
    s.includes('demonstra') ||
    s.includes('locac') ||
    s.includes('alug') ||
    s.includes('remessa') ||
    s.includes('bonific') ||
    s.includes('doacao') ||
    s.includes('conserto') ||
    s.includes('industrializ') ||
    s.includes('transferencia') ||
    s.includes('venda') ||
    s === 'entrada' ||
    s === 'saida' ||
    s === 'saida definitiva'
  );
}

/**
 * Helper to test if a string looks like a CFOP
 */
function looksLikeCfop(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim().replace(/\.0$/, '');
  return /^[12567]\.?\d{3}$/.test(s) || /^[12567]\d{3}$/.test(s);
}

/**
 * Helper to test if a string value looks like a genuine product code (Cod. / SKU)
 */
export function looksLikeProductCode(val: any): boolean {
  if (!val) return false;
  const raw = String(val).trim();
  const s = raw.replace(/\.0$/, '');
  if (!s || s.length < 2 || s.length > 30) return false;
  if (looksLikeDate(s)) return false;
  if (looksLikeOperationType(s)) return false;
  if (looksLikeCfop(s)) return false;

  const lower = cleanStr(s);
  if (
    lower.includes('hospital') ||
    lower.includes('clinica') ||
    lower.includes('ltda') ||
    lower.includes('s/a') ||
    lower.includes('saude') ||
    lower.includes('secretaria') ||
    lower.includes('prefeitura') ||
    lower.includes('unimed') ||
    lower.includes('brasil') ||
    lower.includes('venosan') ||
    lower.includes('cliente') ||
    lower.includes('destinatario') ||
    lower.includes('total') ||
    lower.includes('observacao')
  ) {
    return false;
  }

  return /^[a-zA-Z0-9\-_./]+$/.test(s);
}

/**
 * Converts any date format to Brazilian DD/MM/YYYY
 */
function formatToPtBrDate(raw: any): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s) return '';

  // GViz Date(Y, M, D)
  if (s.startsWith('Date(') && s.endsWith(')')) {
    const match = s.match(/Date\((\d+),(\d+),(\d+)\)/);
    if (match) {
      const y = match[1];
      const m = (parseInt(match[2], 10) + 1).toString().padStart(2, '0');
      const d = match[3].padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
  }

  // Excel serial number (days since 1899-12-30)
  const num = Number(s);
  if (!isNaN(num) && num >= 40000 && num <= 55000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    return d.toLocaleDateString('pt-BR');
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const parts = s.substring(0, 10).split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}/.test(s)) {
    const parts = s.split(/[\/\.-]/);
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${day}/${month}/${year}`;
  }

  return s;
}

/**
 * Transforms raw 2D array rows (from Google Sheets API, GViz or CSV) into MovementItem[]
 */
export function parseRawRows(rows: any[][]): MovementItem[] {
  if (!rows || rows.length <= 1) {
    return [];
  }

  // Find the header row (test rows 0 to 4 to find the best match)
  const candidateKeywords = [
    'data',
    'dt',
    'emissao',
    'nf',
    'nota',
    'cliente',
    'codigo sku',
    'cod sku',
    'sku',
    'cod',
    'codigo',
    'descri',
    'produto',
    'tipo',
    'cfop',
    'qtd',
    'quant',
  ];

  let bestHeaderRowIndex = 0;
  let maxScore = -1;

  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const rowCleaned = (rows[r] || []).map((c) => cleanStr(c));
    let score = 0;
    for (const cell of rowCleaned) {
      if (candidateKeywords.some((kw) => cell.includes(kw))) {
        score++;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestHeaderRowIndex = r;
    }
  }

  const headerRow = (rows[bestHeaderRowIndex] || []).map((h) => cleanStr(h));

  // 1. Identify DATE column (Data NF / Emissão)
  let idxData = -1;
  for (let c = 0; c < headerRow.length; c++) {
    const h = headerRow[c];
    if (h.includes('venc') || h.includes('pag')) continue;
    if (
      h === 'data' ||
      h === 'data nf' ||
      h === 'data da nf' ||
      h === 'dt nf' ||
      h === 'dt. nf' ||
      h === 'dt emissao' ||
      h === 'dt. emissao' ||
      h === 'data emissao' ||
      h === 'data de emissao' ||
      h === 'emissao' ||
      h === 'dt movimento' ||
      h === 'data movimento' ||
      h === 'dia'
    ) {
      idxData = c;
      break;
    }
  }
  if (idxData === -1) {
    for (let c = 0; c < headerRow.length; c++) {
      const h = headerRow[c];
      if (h.includes('venc') || h.includes('pag')) continue;
      if (h.includes('data') || h.includes('emiss') || h.includes('dt')) {
        idxData = c;
        break;
      }
    }
  }

  // 2. Identify NF NUMBER column (Nº NF)
  let idxNf = -1;
  for (let c = 0; c < headerRow.length; c++) {
    if (c === idxData) continue;
    const h = headerRow[c];
    if (h.includes('data') || h.includes('dt') || h.includes('emiss') || h.includes('venc') || h.includes('pag') || h.includes('cfop') || h.includes('valor')) continue;
    if (
      h === 'nf' ||
      h === 'nfe' ||
      h === 'nota' ||
      h === 'nota fiscal' ||
      h === 'nº nf' ||
      h === 'no nf' ||
      h === 'n° nf' ||
      h === 'num nf' ||
      h === 'numero nf' ||
      h === 'nro nf' ||
      h === 'nr nf' ||
      h === 'numero da nota' ||
      h === 'numero nota' ||
      h === 'num nota' ||
      h === 'nro nota' ||
      h === 'nr nota' ||
      h === 'nº nota' ||
      h === 'numero' ||
      h === 'num' ||
      h === 'danfe' ||
      h === 'documento' ||
      h === 'doc'
    ) {
      idxNf = c;
      break;
    }
  }
  if (idxNf === -1) {
    for (let c = 0; c < headerRow.length; c++) {
      if (c === idxData) continue;
      const h = headerRow[c];
      if (h.includes('data') || h.includes('dt') || h.includes('emiss') || h.includes('venc') || h.includes('cfop') || h.includes('valor')) continue;
      if (h.includes('nf') || h.includes('nota') || h.includes('danfe') || h.includes('documento')) {
        idxNf = c;
        break;
      }
    }
  }

  // Helper to determine if a header definitely belongs to other fields (not product code)
  const isHeaderExcludedFromCod = (h: string) => {
    return (
      h.includes('oper') ||
      h.includes('tipo') ||
      h.includes('mov') ||
      h.includes('trans') ||
      h.includes('motivo') ||
      h.includes('finalidade') ||
      h.includes('status') ||
      h.includes('natureza') ||
      h.includes('cfop') ||
      h.includes('cli') ||
      h.includes('dest') ||
      h.includes('parceiro') ||
      h.includes('paciente') ||
      h.includes('favorec') ||
      h.includes('data') ||
      h.includes('dt') ||
      h.includes('emiss') ||
      h.includes('venc') ||
      h.includes('nf') ||
      h.includes('nota') ||
      h.includes('danfe') ||
      h.includes('doc') ||
      h.includes('munic') ||
      h.includes('cidade') ||
      h.includes('uf') ||
      h.includes('estado') ||
      h.includes('ibge') ||
      h.includes('vend') ||
      h.includes('rep') ||
      h.includes('qtd') ||
      h.includes('quant') ||
      h.includes('unid') ||
      h.includes('valor') ||
      h.includes('preco') ||
      h.includes('total') ||
      h.includes('unit') ||
      h.includes('desc') ||
      (h.includes('produto') && (h.includes('desc') || h.includes('nome') || h.includes('denominacao')))
    );
  };

  // 3. Identify OPERATION TYPE column FIRST (to prevent its header like 'Cod. Operação' from being picked as product code)
  let idxTipo = -1;
  for (let c = 0; c < headerRow.length; c++) {
    if (c === idxData || c === idxNf) continue;
    const h = headerRow[c];
    if (
      h === 'tipo' ||
      h === 'tipo de operacao' ||
      h === 'tipo operacao' ||
      h === 'modalidade' ||
      h === 'operacao' ||
      h === 'oper' ||
      h === 'motivo' ||
      h === 'cod. operacao' ||
      h === 'cod operacao' ||
      h === 'codigo operacao' ||
      h === 'cod oper' ||
      h === 'natureza' ||
      h === 'natureza da operacao' ||
      h === 'finalidade' ||
      h === 'status'
    ) {
      idxTipo = c;
      break;
    }
  }

  if (idxTipo === -1) {
    for (let c = 0; c < headerRow.length; c++) {
      if (c === idxData || c === idxNf) continue;
      const h = headerRow[c];
      if (h.includes('tipo') || h.includes('modalidade') || h.includes('operacao') || h.includes('motivo')) {
        idxTipo = c;
        break;
      }
    }
  }

  // 4. Identify PRODUCT CODE / "Cod." column
  // HIGHEST PRIORITY: Exact column "Código SKU" from base sheet as requested by user
  let idxCod = -1;

  // Pass 1: Explicit "Código SKU", "Codigo SKU", "Cod. SKU", "Cod SKU", or contains "sku"
  for (let c = 0; c < headerRow.length; c++) {
    if (c === idxData || c === idxNf || c === idxTipo) continue;
    const h = headerRow[c];
    if (
      h === 'codigo sku' ||
      h === 'código sku' ||
      h === 'cod. sku' ||
      h === 'cod sku' ||
      h === 'cód. sku' ||
      h === 'cód sku' ||
      h === 'cod_sku' ||
      h === 'codsku' ||
      h.includes('codigo sku') ||
      h.includes('código sku') ||
      h.includes('cod sku') ||
      h.includes('cód sku') ||
      h === 'sku' ||
      h.includes('sku')
    ) {
      idxCod = c;
      break;
    }
  }

  // Pass 2: Priority for other explicit product code headers ('cod. produto', 'codigo produto', 'cod. item', etc.)
  if (idxCod === -1) {
    for (let c = 0; c < headerRow.length; c++) {
      if (c === idxData || c === idxNf || c === idxTipo) continue;
      const h = headerRow[c];
      if (isHeaderExcludedFromCod(h)) continue;
      if (
        h === 'cod. produto' ||
        h === 'cod produto' ||
        h === 'codigo produto' ||
        h === 'codigo do produto' ||
        h === 'código produto' ||
        h === 'código do produto' ||
        h === 'cod. item' ||
        h === 'cod item' ||
        h === 'codigo item' ||
        h === 'cod. prod' ||
        h === 'cod prod' ||
        h === 'codigo prod' ||
        h === 'cod. mat' ||
        h === 'cod mat' ||
        h === 'cod. mercadoria' ||
        h === 'cod mercadoria' ||
        h === 'ref' ||
        h === 'referencia' ||
        h === 'referência' ||
        h === 'material' ||
        h === 'item'
      ) {
        idxCod = c;
        break;
      }
    }
  }

  // Pass 3: Generic 'cod.', 'cod', 'codigo', 'cód.' (only if no specific product/sku code column exists)
  if (idxCod === -1) {
    for (let c = 0; c < headerRow.length; c++) {
      if (c === idxData || c === idxNf || c === idxTipo) continue;
      const h = headerRow[c];
      if (isHeaderExcludedFromCod(h)) continue;
      if (
        h === 'cod.' ||
        h === 'cod' ||
        h === 'codigo' ||
        h === 'código' ||
        h === 'cód.' ||
        h === 'cód' ||
        h.startsWith('cod. prod') ||
        h.startsWith('cod prod') ||
        h.startsWith('codigo prod') ||
        h.startsWith('cod. item') ||
        h.startsWith('cod item') ||
        h.startsWith('codigo ') ||
        h.includes('ref')
      ) {
        idxCod = c;
        break;
      }
    }
  }

  // 5. Description Column (Descrição do Equipamento)
  let idxDesc = -1;
  for (let c = 0; c < headerRow.length; c++) {
    if (c === idxData || c === idxNf || c === idxTipo || c === idxCod) continue;
    const h = headerRow[c];
    if (
      h === 'descricao' ||
      h === 'descrição' ||
      h === 'descricao do produto' ||
      h === 'descrição do produto' ||
      h === 'descricao do equipamento' ||
      h === 'descrição do equipamento' ||
      h === 'descricao produto' ||
      h === 'descricao equipamento' ||
      h === 'equipamento' ||
      h === 'produto' ||
      h === 'material' ||
      h === 'mercadoria' ||
      h.includes('descricao') ||
      h.includes('equipamento') ||
      (h.includes('produto') && !h.includes('cod'))
    ) {
      idxDesc = c;
      break;
    }
  }

  // 6. Client Column (Cliente / Destinatário)
  let idxCliente = -1;
  for (let c = 0; c < headerRow.length; c++) {
    if (c === idxData || c === idxNf || c === idxTipo || c === idxCod || c === idxDesc) continue;
    const h = headerRow[c];
    if (
      h === 'cliente' ||
      h === 'destinatario' ||
      h === 'destinatário' ||
      h === 'razao social' ||
      h === 'razão social' ||
      h === 'razao' ||
      h === 'hospital' ||
      h === 'parceiro' ||
      h === 'favorecido' ||
      h === 'nome do cliente' ||
      h.includes('cliente') ||
      h.includes('destinat') ||
      h.includes('razao') ||
      h.includes('hospital')
    ) {
      idxCliente = c;
      break;
    }
  }

  // 7. CFOP Column
  let idxCfop = -1;
  for (let c = 0; c < headerRow.length; c++) {
    if (c === idxData || c === idxNf || c === idxTipo || c === idxCod || c === idxDesc || c === idxCliente) continue;
    const h = headerRow[c];
    if (h === 'cfop' || h.includes('cfop') || h === 'natureza' || h.includes('natureza')) {
      idxCfop = c;
      break;
    }
  }

  // 8. Liquid Quantity Column (Qtd Líquida / Saldo) - Check BEFORE Qtd to avoid conflict
  let idxQtdLiq = -1;
  for (let c = 0; c < headerRow.length; c++) {
    if (c === idxData || c === idxNf || c === idxTipo || c === idxCod || c === idxDesc || c === idxCliente || c === idxCfop) continue;
    const h = headerRow[c];
    if (
      h === 'qtd liquida' ||
      h === 'qtd. liquida' ||
      h === 'qtd líquida' ||
      h === 'qtd. líquida' ||
      h === 'quantidade liquida' ||
      h === 'quantidade líquida' ||
      h === 'qtd liq' ||
      h === 'qtd. liq' ||
      h === 'saldo liquido' ||
      h === 'saldo líquido' ||
      h === 'saldo liq' ||
      h === 'saldo' ||
      h === 'impacto' ||
      h.includes('liq') ||
      h.includes('saldo')
    ) {
      idxQtdLiq = c;
      break;
    }
  }

  // 9. Quantity Column (Qtd)
  let idxQtd = -1;
  for (let c = 0; c < headerRow.length; c++) {
    if (c === idxData || c === idxNf || c === idxTipo || c === idxCod || c === idxDesc || c === idxCliente || c === idxCfop || c === idxQtdLiq) continue;
    const h = headerRow[c];
    if (
      h === 'qtd' ||
      h === 'qtd.' ||
      h === 'quantidade' ||
      h === 'qtde' ||
      h === 'volume' ||
      h === 'quant' ||
      h === 'unidades' ||
      h === 'itens' ||
      h.includes('qtd') ||
      h.includes('quant') ||
      h.includes('volume')
    ) {
      idxQtd = c;
      break;
    }
  }

  // 10. Month / Competence Column
  let idxMes = -1;
  for (let c = 0; c < headerRow.length; c++) {
    if (c === idxData || c === idxNf || c === idxTipo || c === idxCod || c === idxDesc || c === idxCliente || c === idxCfop || c === idxQtd || c === idxQtdLiq) continue;
    const h = headerRow[c];
    if (h.includes('mes') || h.includes('mês') || h.includes('competencia') || h.includes('competência') || h.includes('periodo') || h.includes('período')) {
      idxMes = c;
      break;
    }
  }

  // 11. Cidade & UF
  let idxCidade = -1;
  let idxUf = -1;
  for (let c = 0; c < headerRow.length; c++) {
    const h = headerRow[c];
    if (c === idxData || c === idxNf || c === idxTipo || c === idxCod || c === idxDesc || c === idxCliente || c === idxCfop || c === idxQtd || c === idxQtdLiq || c === idxMes) continue;
    if (idxCidade === -1 && (h === 'cidade' || h === 'municipio' || h === 'município' || h.includes('cidade') || h.includes('municip'))) {
      idxCidade = c;
    } else if (idxUf === -1 && (h === 'uf' || h === 'estado' || h.includes('uf') || h.includes('estado'))) {
      idxUf = c;
    }
  }

  // Data-Driven Sanity Check on Sample Rows (Only fix if idxNf points to dates or idxCod has operation types)
  const sampleRows = rows.slice(bestHeaderRowIndex + 1, Math.min(rows.length, bestHeaderRowIndex + 15));

  if (idxNf >= 0 && sampleRows.length > 0) {
    const datesInNf = sampleRows.filter((r) => looksLikeDate(r[idxNf])).length;
    if (datesInNf > sampleRows.length / 2) {
      const wrongCol = idxNf;
      idxNf = -1;
      if (idxData === -1) {
        idxData = wrongCol;
      }
      for (let c = 0; c < headerRow.length; c++) {
        if (c === wrongCol || c === idxData) continue;
        const nfMatches = sampleRows.filter((r) => looksLikeNf(r[c])).length;
        if (nfMatches > sampleRows.length / 2) {
          idxNf = c;
          break;
        }
      }
    }
  } else if (idxNf === -1 && sampleRows.length > 0) {
    for (let c = 0; c < headerRow.length; c++) {
      if (c === idxData) continue;
      const nfMatches = sampleRows.filter((r) => looksLikeNf(r[c])).length;
      if (nfMatches > sampleRows.length / 2) {
        idxNf = c;
        break;
      }
    }
  }

  // ONLY search for product code if idxCod was NOT found from headers
  if (idxCod === -1 && sampleRows.length > 0) {
    for (let c = 0; c < headerRow.length; c++) {
      if (c === idxData || c === idxNf || c === idxTipo || c === idxCfop || c === idxQtd || c === idxDesc || c === idxCliente) continue;
      if (isHeaderExcludedFromCod(headerRow[c])) continue;
      const nonEmpties = sampleRows.filter((r) => r[c] && String(r[c]).trim() !== '');
      if (nonEmpties.length >= sampleRows.length / 3) {
        const prodCodeMatches = nonEmpties.filter((r) => looksLikeProductCode(r[c])).length;
        if (prodCodeMatches >= nonEmpties.length / 2) {
          idxCod = c;
          break;
        }
      }
    }
  }

  const parsedItems: MovementItem[] = [];

  for (let i = bestHeaderRowIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0 || !r.some((c) => String(c).trim() !== '')) {
      continue;
    }

    // 1. Data NF: Exact date from cell, formatted if date pattern
    let dataNfRaw = idxData >= 0 && r[idxData] !== undefined ? String(r[idxData]).trim() : '';
    if (!dataNfRaw && looksLikeDate(r[0])) {
      dataNfRaw = String(r[0]).trim();
    }
    const formattedDataNf = dataNfRaw ? formatToPtBrDate(dataNfRaw) : '';

    // 2. Nº NF: Exact invoice number from cell (cleaned of trailing .0 and extra whitespace)
    let nfRaw = idxNf >= 0 && r[idxNf] !== undefined ? String(r[idxNf]).trim() : '';
    if (looksLikeDate(nfRaw)) {
      const altNf = r.find((cell, cellIdx) => cellIdx !== idxData && looksLikeNf(cell));
      if (altNf) {
        nfRaw = String(altNf).trim();
      }
    }
    const cleanNf = nfRaw.replace(/\.0$/, '').replace(/\s+/g, ' ').trim();

    // 3. CFOP: Exact CFOP from cell
    const cfopRaw = idxCfop >= 0 && r[idxCfop] !== undefined ? String(r[idxCfop]).trim().replace(/\.0$/, '') : '';

    // 4. Product Code ("Cod."): Direct 1:1 copy of cell value as raw string text (no inferences, no guesswork)
    const cellCod = idxCod >= 0 ? r[idxCod] : undefined;
    const cod_sku = cellCod !== null && cellCod !== undefined ? String(cellCod).trim() : '';

    // 5. Description: Exact description from cell (1:1 copy-paste)
    const descRaw = idxDesc >= 0 && r[idxDesc] !== undefined && r[idxDesc] !== null
      ? String(r[idxDesc]).trim()
      : '';

    // 6. Client: Exact client from cell
    const clienteRaw = idxCliente >= 0 && r[idxCliente] !== undefined && r[idxCliente] !== null
      ? String(r[idxCliente]).trim()
      : '';

    // 7. Operation Type: Exact operation type from cell normalized
    let tipoRaw = idxTipo >= 0 && r[idxTipo] !== undefined && r[idxTipo] !== null
      ? r[idxTipo].toString().trim()
      : '';
    if (!tipoRaw) {
      const altOp = r.find((cell) => looksLikeOperationType(cell));
      if (altOp) {
        tipoRaw = String(altOp).trim();
      }
    }

    let normalizedTipo: MovementType = 'Comodato';
    const tLower = cleanStr(tipoRaw);
    if (tLower.includes('retorno') || tLower.includes('devolu') || tLower.includes('entrada')) {
      normalizedTipo = 'RETORNO';
    } else if (tLower.includes('demonstra') || tLower.includes('demo')) {
      normalizedTipo = 'Demonstração';
    } else if (tLower.includes('loca') || tLower.includes('alug')) {
      normalizedTipo = 'Locação';
    } else {
      normalizedTipo = 'Comodato';
    }

    // 8. Quantity: Exact quantity from cell
    const qtdStr = idxQtd >= 0 && r[idxQtd] !== undefined ? String(r[idxQtd]).trim() : '0';
    const cleanedQtd = qtdStr.replace(/\./g, '').replace(',', '.').trim();
    const parsedQtd = parseFloat(cleanedQtd);
    const qtd = isNaN(parsedQtd) ? 0 : Math.abs(parsedQtd);

    // 9. Liquid Quantity: Exact liquid quantity from base sheet if column exists
    let qtdLiq = normalizedTipo === 'RETORNO' ? -qtd : qtd;
    if (idxQtdLiq >= 0 && r[idxQtdLiq] !== undefined && String(r[idxQtdLiq]).trim() !== '') {
      const liqStr = String(r[idxQtdLiq]).replace(/\./g, '').replace(',', '.').trim();
      const parsedLiq = parseFloat(liqStr);
      if (!isNaN(parsedLiq)) {
        qtdLiq = parsedLiq;
      }
    }

    // 10. Month / Competence: Exact from cell or calculated from date
    let mesCalc = '';
    if (idxMes >= 0 && r[idxMes] && String(r[idxMes]).includes('-')) {
      mesCalc = String(r[idxMes]).trim();
    } else if (formattedDataNf && formattedDataNf.includes('/')) {
      const parts = formattedDataNf.split('/');
      if (parts.length === 3) {
        const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        const m = parts[1].padStart(2, '0');
        mesCalc = `${y}-${m}`;
      }
    }
    if (!mesCalc) {
      mesCalc = new Date().toISOString().substring(0, 7);
    }

    // 11. Cidade and UF: Exact from cells
    const cidadeRaw = idxCidade >= 0 && r[idxCidade] ? String(r[idxCidade]).trim() : undefined;
    const ufRaw = idxUf >= 0 && r[idxUf] ? String(r[idxUf]).trim().toUpperCase() : undefined;

    parsedItems.push({
      id: `gsheet-row-${i}-${Date.now()}`,
      data_nf: formattedDataNf,
      mes_calc: mesCalc,
      nf: cleanNf,
      cfop: cfopRaw,
      sku: cod_sku,
      descricao: descRaw,
      cliente: clienteRaw,
      tipo: normalizedTipo,
      qtd,
      qtd_liquida: qtdLiq,
      cidade: cidadeRaw,
      uf: ufRaw,
    });
  }

  return parsedItems;
}

/**
 * Reads all rows from a given sheet tab and converts them to MovementItem[].
 * Supports authenticated Google Sheets API and public/shared GViz endpoint.
 */
export async function fetchSheetData(
  accessToken: string | null,
  spreadsheetId: string,
  sheetName: string
): Promise<MovementItem[]> {
  const targetTabs = [sheetName, 'base', 'Base', 'BASE', 'Fluxo_Saidas'].filter(
    (v, i, a) => Boolean(v) && a.indexOf(v) === i
  );

  // Strategy 1: Authenticated API call if accessToken is provided
  if (accessToken) {
    for (const tab of targetTabs) {
      try {
        const range = encodeURIComponent(`${tab}!A:ZZ`);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          const rows: any[][] = data.values || [];
          if (rows.length > 1) {
            const parsed = parseRawRows(rows);
            if (parsed.length > 0) return parsed;
          }
        }
      } catch (err) {
        console.warn(`Authenticated Sheets API call failed for tab ${tab}:`, err);
      }
    }
  }

  // Strategy 2: Standard export format=csv (Direct native exporter - NEVER nullifies alphanumeric cells in numeric columns)
  for (const tab of targetTabs) {
    try {
      // First try native direct Google Sheets export (file/download style)
      const nativeExportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&sheet=${encodeURIComponent(
        tab
      )}`;
      const res = await fetch(nativeExportUrl);
      if (res.ok) {
        const csvText = await res.text();
        if (isValidCsvText(csvText)) {
          const rows = parseCsvRows(csvText);
          if (rows.length > 1) {
            const parsed = parseRawRows(rows);
            if (parsed.length > 0) return parsed;
          }
        }
      }
    } catch (err) {
      // ignore
    }
  }

  // Strategy 3: Standard active tab export format=csv
  try {
    const exportCsvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    const res = await fetch(exportCsvUrl);

    if (res.ok) {
      const csvText = await res.text();
      if (isValidCsvText(csvText)) {
        const rows = parseCsvRows(csvText);
        if (rows.length > 1) {
          const parsed = parseRawRows(rows);
          if (parsed.length > 0) return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Export format=csv failed:', err);
  }

  // Strategy 4: GViz CSV export with target tabs
  for (const tab of targetTabs) {
    try {
      const gvizCsvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
        tab
      )}`;
      const res = await fetch(gvizCsvUrl);
      if (res.ok) {
        const csvText = await res.text();
        if (isValidCsvText(csvText)) {
          const rows = parseCsvRows(csvText);
          if (rows.length > 1) {
            const parsed = parseRawRows(rows);
            if (parsed.length > 0) return parsed;
          }
        }
      }
    } catch (err) {
      // ignore
    }
  }

  // Strategy 4: Google Visualization JSON endpoint (fallback for shared sheets)
  for (const tab of targetTabs) {
    const rows = await fetchGvizJson(spreadsheetId, tab);
    if (rows && rows.length > 1) {
      const parsed = parseRawRows(rows);
      if (parsed.length > 0) return parsed;
    }
  }

  // Try GViz JSON WITHOUT tab name (Google Sheets automatically serves the first/active sheet)
  const defaultRows = await fetchGvizJson(spreadsheetId);
  if (defaultRows && defaultRows.length > 1) {
    const parsed = parseRawRows(defaultRows);
    if (parsed.length > 0) return parsed;
  }

  // Strategy 6: Standard export format=csv with sheet=base
  try {
    const exportBaseUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&sheet=base`;
    const res = await fetch(exportBaseUrl);

    if (res.ok) {
      const csvText = await res.text();
      if (isValidCsvText(csvText)) {
        const rows = parseCsvRows(csvText);
        if (rows.length > 1) {
          const parsed = parseRawRows(rows);
          if (parsed.length > 0) return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Export format=csv&sheet=base failed:', err);
  }

  throw new Error(
    `Não foi possível carregar os dados da aba '${sheetName}'. Verifique se a planilha no Google Drive está compartilhada como "Qualquer pessoa com o link" (Leitor ou Editor).`
  );
}

/**
 * Creates a brand new Google Sheet formatted specifically for the VENOSAN dashboard
 */
export async function createNewSpreadsheet(
  accessToken: string,
  title: string,
  seedData: MovementItem[]
): Promise<SpreadsheetDetails> {
  const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

  const rows = [
    SHEETS_HEADER,
    ...seedData.map((d) => [
      d.data_nf,
      d.mes_calc,
      d.nf,
      d.cfop,
      d.sku,
      d.descricao,
      d.cliente,
      d.tipo,
      d.qtd,
      d.qtd_liquida,
      d.cidade || '',
      d.uf || '',
    ]),
  ];

  const body = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: 'base',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: rows.map((r) => ({
              values: r.map((cell) => ({
                userEnteredValue: {
                  stringValue: String(cell),
                },
              })),
            })),
          },
        ],
      },
    ],
  };

  const res = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Falha ao criar planilha: ${res.status} ${errorText}`);
  }

  const result = await res.json();
  return {
    id: result.spreadsheetId,
    title: result.properties?.title || title,
    sheets: [{ sheetId: 0, title: 'base' }],
  };
}

/**
 * Appends a new movement row into the connected Google Sheet
 */
export async function appendRowToSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  item: MovementItem
): Promise<boolean> {
  const range = encodeURIComponent(`${sheetName || 'base'}!A:L`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;

  const row = [
    item.data_nf,
    item.mes_calc,
    item.nf,
    item.cfop,
    item.sku,
    item.descricao,
    item.cliente,
    item.tipo,
    item.qtd,
    item.qtd_liquida,
    item.cidade || '',
    item.uf || '',
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [row],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Falha ao adicionar linha à planilha: ${res.status} ${errorText}`);
  }

  return true;
}

export const appendMovementRow = appendRowToSheet;
