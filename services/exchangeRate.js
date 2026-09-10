const API_BASE = "https://api.frankfurter.dev/v2";

/**
 * Busca a cotação atual de um par.
 * Exemplo: EUR -> BRL
 */
export async function getCurrentRate(base, quote) {
  const response = await fetch(
    `${API_BASE}/rate/${base}/${quote}?providers=BCB`
  );

  if (!response.ok) {
    throw new Error(`Erro HTTP ${response.status}`);
  }

  const data = await response.json();

  validateRate(data.rate);

  return {
    date: data.date,
    rate: data.rate
  };
}

/**
 * Retorna uma data no formato YYYY-MM-DD.
 */
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

/**
 * Busca aproximadamente 6 meses de histórico.
 */
export async function getSixMonthHistory(base, quote) {
  const end = new Date();
  const start = new Date();

  start.setMonth(start.getMonth() - 6);

  const from = formatDate(start);
  const to = formatDate(end);

  const url =
    `${API_BASE}/rates?base=${base}` +
    `&quotes=${quote}` +
    `&from=${from}` +
    `&to=${to}` +
    `&providers=BCB`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Erro HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Histórico recebido em formato inválido.");
  }

  const history = data
    .filter(item => item.quote === quote)
    .map(item => ({
      date: item.date,
      rate: item.rate
    }))
    .filter(item => {
      try {
        validateRate(item.rate);
        return true;
      } catch {
        return false;
      }
    });

  if (history.length === 0) {
    throw new Error("Nenhuma cotação histórica válida encontrada.");
  }

  return history;
}

function validateRate(rate) {
  if (
    typeof rate !== "number" ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    throw new Error("Cotação inválida.");
  }
}