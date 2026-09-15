/*
 * Boletim Focus — Banco Central do Brasil.
 *
 * Pesquisa semanal com ~100 instituições financeiras
 * sobre o câmbio futuro. É o "consenso de analistas"
 * na fonte primária: oficial, público e sem chave.
 *
 * Diferente dos dois motores locais, que só olham
 * preço passado, aqui há gente lendo juros, fiscal
 * e inflação — informação que uma regressão sobre
 * cotação não enxerga.
 *
 * LIMITE IMPORTANTE: o Focus projeta somente o
 * dólar. Não existe EUR/BRL na pesquisa, e o bloco
 * simplesmente não aparece na aba do euro — ver
 * projectFromFocus.
 */

const API_URL =
  "https://olinda.bcb.gov.br/olinda/servico/Expectativas" +
  "/versao/v1/odata/ExpectativaMercadoMensais";

const CACHE_KEY = "focusCache";

/*
 * A pesquisa sai uma vez por semana (segunda).
 * Reconsultar a cada abertura do popup seria
 * desperdício.
 */
const CACHE_HOURS = 12;

/*
 * Horizonte da projeção.
 *
 * Na prática o consenso é achatado — em set/2026 a
 * mediana era 5,20 para todo mês de out/26 a mar/27 —
 * então o horizonte quase não muda o número, só o
 * quanto ele soa relevante. Três meses é perto o
 * bastante para quem vai comprar em breve, e é onde
 * mais instituições respondem.
 */
const HORIZON_MONTHS = 3;

/*
 * Variação menor que isso é empate: não vale
 * anunciar rumo.
 */
const NEUTRAL_THRESHOLD = 1.0;


/**
 * Mês-alvo no formato MM/AAAA.
 */
function targetMonth() {

  const now = new Date();

  const target =
    new Date(
      now.getFullYear(),
      now.getMonth() + HORIZON_MONTHS,
      1
    );

  const month =
    String(
      target.getMonth() + 1
    ).padStart(2, "0");

  return `${month}/${target.getFullYear()}`;

}


/**
 * Lê o cache. Silencioso: fora do contexto da
 * extensão (testes, preview) chrome.storage não
 * existe e a ausência de cache não é erro.
 */
async function readCache() {

  try {

    const stored =
      await chrome.storage.local.get([CACHE_KEY]);

    const cached = stored[CACHE_KEY];

    if (!cached || !cached.savedAt) {
      return null;
    }


    const ageHours =
      (Date.now() - cached.savedAt) / 3_600_000;


    if (ageHours >= CACHE_HOURS) {
      return null;
    }


    /*
     * O horizonte anda com o calendário: cache
     * de outro mês-alvo não serve.
     */
    if (cached.data?.referenceMonth !== targetMonth()) {
      return null;
    }


    return cached.data;

  } catch {

    return null;

  }

}


async function writeCache(data) {

  try {

    await chrome.storage.local.set({
      [CACHE_KEY]: {
        savedAt: Date.now(),
        data
      }
    });

  } catch {

    /* sem storage, segue sem cache */

  }

}


/**
 * Busca o consenso de USD/BRL para o mês-alvo.
 *
 * Retorna null quando a consulta falha — o Focus
 * é informação adicional, nunca pode derrubar o
 * resto da análise.
 */
export async function getFocusForecast() {

  const cached = await readCache();

  if (cached) {
    return cached;
  }


  const reference = targetMonth();


  /*
   * baseCalculo 0 = respostas dos últimos 30 dias,
   * que é a leitura mais ampla e estável.
   */
  const filter =
    `Indicador eq 'Câmbio'` +
    ` and baseCalculo eq 0` +
    ` and DataReferencia eq '${reference}'`;


  const url =
    `${API_URL}?$top=1` +
    `&$filter=${encodeURIComponent(filter)}` +
    `&$orderby=Data desc` +
    `&$format=json`;


  try {

    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }


    const payload = await response.json();

    const row = payload?.value?.[0];

    if (!row) {
      return null;
    }


    const median = Number(row.Mediana);

    if (!Number.isFinite(median) || median <= 0) {
      return null;
    }


    const data = {

      median,

      mean: Number(row.Media),

      min: Number(row.Minimo),

      max: Number(row.Maximo),

      respondents: Number(row.numeroRespondentes),

      referenceMonth: reference,

      surveyDate: row.Data

    };


    await writeCache(data);

    return data;

  } catch (error) {

    console.log(
      "Currency Radar - Focus indisponível:",
      error.message
    );

    return null;

  }

}


/**
 * Traduz o consenso para a moeda escolhida.
 *
 * Só o dólar tem leitura. Chegou a existir aqui uma
 * projeção derivada para o euro — aplicando a
 * variação do real ao cross EUR/USD de hoje — mas ela
 * dependia de premissa forte (EUR/USD parado) e
 * exigia um parágrafo de ressalva na tela para não
 * passar por dado oficial do Banco Central. Número
 * que precisa de tanta explicação não paga o espaço
 * que ocupa: para o euro, não mostramos nada.
 */
export function projectFromFocus(
  focus,
  currency,
  currentRate
) {

  if (
    !focus ||
    currency !== "USD" ||
    !Number.isFinite(currentRate) ||
    currentRate <= 0
  ) {
    return null;
  }


  const projected = focus.median;


  const changePercent =
    ((projected - currentRate) / currentRate) * 100;


  let direction;

  if (changePercent > NEUTRAL_THRESHOLD) {

    direction = "up";

  } else if (changePercent < -NEUTRAL_THRESHOLD) {

    direction = "down";

  } else {

    direction = "flat";

  }


  return {

    projected,

    changePercent,

    direction,

    referenceMonth: focus.referenceMonth,

    respondents: focus.respondents,

    surveyDate: focus.surveyDate,

    min: focus.min,

    max: focus.max

  };

}
