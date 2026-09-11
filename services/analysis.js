/**
 * Calcula um percentil usando interpolação linear.
 */
export function calculatePercentile(
  sortedRates,
  percentile
) {

  const n =
    sortedRates.length;

  if (n === 0) {
    return null;
  }

  if (n === 1) {
    return sortedRates[0];
  }

  const position =
    (percentile / 100) * (n - 1);

  const lower =
    Math.floor(position);

  const upper =
    Math.ceil(position);

  if (lower === upper) {
    return sortedRates[lower];
  }

  const weight =
    position - lower;

  return (
    sortedRates[lower] +
    (
      sortedRates[upper] -
      sortedRates[lower]
    ) * weight
  );
}


/**
 * Calcula as estatísticas do histórico.
 */
export function calculateStatistics(history) {

  const rates =
    history
      .map(item => item.rate)
      .filter(rate =>
        typeof rate === "number" &&
        Number.isFinite(rate) &&
        rate > 0
      );

  if (rates.length === 0) {

    throw new Error(
      "Nenhuma cotação válida encontrada."
    );

  }

  const sortedRates =
    [...rates].sort(
      (a, b) => a - b
    );

  const sum =
    rates.reduce(
      (total, rate) => total + rate,
      0
    );

  return {

    average:
      sum / rates.length,

    min:
      sortedRates[0],

    max:
      sortedRates[
        sortedRates.length - 1
      ],

    median:
      calculatePercentile(
        sortedRates,
        50
      ),

    p10:
      calculatePercentile(
        sortedRates,
        10
      ),

    p25:
      calculatePercentile(
        sortedRates,
        25
      ),

    p50:
      calculatePercentile(
        sortedRates,
        50
      ),

    p75:
      calculatePercentile(
        sortedRates,
        75
      ),

    p90:
      calculatePercentile(
        sortedRates,
        90
      ),

    count:
      rates.length,

    sortedRates

  };

}


/**
 * Converte YYYY-MM-DD para Date.
 */
function parseDate(dateString) {

  const [
    year,
    month,
    day
  ] = dateString
    .split("-")
    .map(Number);

  return new Date(
    year,
    month - 1,
    day
  );

}


/**
 * Retorna uma data YYYY-MM-DD.
 */
function formatDate(date) {

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return (
    `${year}-${month}-${day}`
  );

}


/**
 * Encontra a observação histórica
 * mais próxima anterior ou igual
 * à data desejada.
 */
function findHistoricalRateAtOrBefore(
  history,
  targetDate
) {

  let result = null;

  for (
    const item of history
  ) {

    if (
      item.date <= targetDate
    ) {

      result = item;

    } else {

      break;

    }

  }

  return result;

}


/**
 * Calcula a tendência histórica.
 *
 * A tendência utiliza somente o histórico
 * BCB/PTAX.
 */
export function calculateTrend(
  history
) {

  const validHistory =
    history
      .filter(item =>
        item &&
        typeof item.date === "string" &&
        typeof item.rate === "number" &&
        Number.isFinite(item.rate) &&
        item.rate > 0
      )
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date)
      );


  if (
    validHistory.length < 2
  ) {

    throw new Error(
      "Histórico insuficiente para calcular tendência."
    );

  }


  const latest =
    validHistory[
      validHistory.length - 1
    ];


  const latestDate =
    parseDate(
      latest.date
    );


  const date7 =
    new Date(latestDate);

  date7.setDate(
    date7.getDate() - 7
  );


  const date30 =
    new Date(latestDate);

  date30.setDate(
    date30.getDate() - 30
  );


  const reference7 =
    findHistoricalRateAtOrBefore(
      validHistory,
      formatDate(date7)
    );


  const reference30 =
    findHistoricalRateAtOrBefore(
      validHistory,
      formatDate(date30)
    );


  function calculateChange(
    current,
    reference
  ) {

    if (
      !reference ||
      !Number.isFinite(reference.rate) ||
      reference.rate === 0
    ) {

      return null;

    }


    return (
      (
        (current - reference.rate) /
        reference.rate
      ) * 100
    );

  }


  const change7d =
    calculateChange(
      latest.rate,
      reference7
    );


  const change30d =
    calculateChange(
      latest.rate,
      reference30
    );


  /*
   * Classificação da tendência.
   *
   * Usamos uma pequena faixa neutra de
   * ±0,15% para evitar chamar uma variação
   * muito pequena de alta ou queda.
   */
  const NEUTRAL_THRESHOLD = 0.15;


  const shortTerm =
    change7d === null
      ? "unknown"
      : change7d < -NEUTRAL_THRESHOLD
        ? "down"
        : change7d > NEUTRAL_THRESHOLD
          ? "up"
          : "stable";


  const mediumTerm =
    change30d === null
      ? "unknown"
      : change30d < -NEUTRAL_THRESHOLD
        ? "down"
        : change30d > NEUTRAL_THRESHOLD
          ? "up"
          : "stable";


  let direction;
  let icon;
  let label;


  /*
   * 7 dias tem prioridade para identificar
   * movimentos recentes.
   */

  if (
    shortTerm === "down" &&
    mediumTerm === "down"
  ) {

    direction = "down";
    icon = "📉";
    label = "Queda";

  } else if (
    shortTerm === "down" &&
    (
      mediumTerm === "stable" ||
      mediumTerm === "up"
    )
  ) {

    direction = "down";
    icon = "📉";
    label = "Queda recente";

  } else if (
    shortTerm === "up" &&
    mediumTerm === "up"
  ) {

    direction = "up";
    icon = "📈";
    label = "Alta";

  } else if (
    shortTerm === "up" &&
    (
      mediumTerm === "stable" ||
      mediumTerm === "down"
    )
  ) {

    direction = "up";
    icon = "📈";
    label = "Alta recente";

  } else {

    direction = "stable";
    icon = "➡️";
    label = "Estável";

  }


  return {

    latestDate:
      latest.date,

    latestRate:
      latest.rate,

    reference7:
      reference7
        ? {
            date: reference7.date,
            rate: reference7.rate
          }
        : null,

    reference30:
      reference30
        ? {
            date: reference30.date,
            rate: reference30.rate
          }
        : null,

    change7d,

    change30d,

    shortTerm,

    mediumTerm,

    direction,

    icon,

    label

  };

}


/**
 * Calcula a posição da cotação atual
 * dentro da distribuição histórica.
 */
export function calculateCurrentPercentile(
  currentRate,
  sortedRates
) {

  const n =
    sortedRates.length;


  if (
    n === 0 ||
    !Number.isFinite(currentRate)
  ) {

    throw new Error(
      "Dados insuficientes para calcular o percentil."
    );

  }


  if (
    currentRate <= sortedRates[0]
  ) {

    return 0;

  }


  if (
    currentRate >=
    sortedRates[n - 1]
  ) {

    return 100;

  }


  for (
    let i = 0;
    i < n - 1;
    i++
  ) {

    const lower =
      sortedRates[i];

    const upper =
      sortedRates[i + 1];


    if (
      currentRate >= lower &&
      currentRate <= upper
    ) {

      const position =
        i +
        (
          (currentRate - lower) /
          (upper - lower)
        );


      return (
        position /
        (n - 1)
      ) * 100;

    }

  }


  return 100;

}


/**
 * Analisa a oportunidade histórica.
 *
 * A tendência ainda NÃO altera o score.
 */
export function analyzeOpportunity(
  currentRate,
  statistics
) {

  const percentile =
    calculateCurrentPercentile(
      currentRate,
      statistics.sortedRates
    );


  const score =
    Math.max(
      0,
      Math.min(
        100,
        100 - percentile
      )
    );


  const differenceFromAverage =
    (
      (currentRate - statistics.average) /
      statistics.average
    ) * 100;


  const differenceFromMedian =
    (
      (currentRate - statistics.median) /
      statistics.median
    ) * 100;


  let icon;
  let message;
  let range;


  if (percentile <= 10) {

    icon = "🟢";
    message = "Preço excepcional";
    range = "Abaixo do P10";

  } else if (percentile <= 25) {

    icon = "🟢";
    message = "Preço muito bom";
    range = "Entre P10 e P25";

  } else if (percentile <= 50) {

    icon = "🟡";
    message = "Preço interessante";
    range = "Entre P25 e P50";

  } else if (percentile <= 75) {

    icon = "🟠";
    message = "Preço normal";
    range = "Entre P50 e P75";

  } else if (percentile <= 90) {

    icon = "🔴";
    message = "Preço caro";
    range = "Entre P75 e P90";

  } else {

    icon = "🔴";
    message = "Preço muito caro";
    range = "Acima do P90";

  }


  return {

    percentile,

    score,

    differenceFromAverage,

    differenceFromMedian,

    icon,

    message,

    range

  };

}

/**
 * Analisa o cenário completo do Radar.
 *
 * Combina:
 *
 * 1. posição histórica do preço
 * 2. tendência recente
 *
 * O score estatístico continua separado.
 */
export function analyzeRadar(
  currentRate,
  statistics,
  trend
) {

  /*
   * Primeiro encontramos a posição
   * do preço atual no histórico.
   */
  const percentile =
    calculateCurrentPercentile(
      currentRate,
      statistics.sortedRates
    );


  /*
   * Determina em qual faixa histórica
   * estamos.
   */
  let historicalZone;


  if (percentile <= 25) {

    historicalZone = "low";

  } else if (percentile <= 50) {

    historicalZone = "below-average";

  } else if (percentile <= 75) {

    historicalZone = "above-average";

  } else {

    historicalZone = "high";

  }


  /*
   * Tendência:
   *
   * down   = queda
   * stable = estável
   * up     = alta
   */
  const direction =
    trend.direction;


  let icon;
  let message;
  let detail;


  /*
   * PREÇO MUITO BAIXO
   */

  if (
    historicalZone === "low" &&
    direction === "down"
  ) {

    icon = "🟢";

    message =
      "Boa oportunidade";

    detail =
      "Preço abaixo do P25 e tendência de queda";


  } else if (
    historicalZone === "low" &&
    direction === "stable"
  ) {

    icon = "🟢";

    message =
      "Preço muito bom";

    detail =
      "Preço abaixo do P25 e tendência estável";


  } else if (
    historicalZone === "low" &&
    direction === "up"
  ) {

    icon = "🟡";

    message =
      "Bom preço, mas subindo";

    detail =
      "Preço abaixo do P25, porém com tendência de alta";


  /*
   * PREÇO ENTRE P25 E P50
   */

  } else if (
    historicalZone === "below-average" &&
    direction === "down"
  ) {

    icon = "🟢";

    message =
      "Oportunidade interessante";

    detail =
      "Preço entre P25 e P50 e tendência de queda";


  } else if (
    historicalZone === "below-average" &&
    direction === "stable"
  ) {

    icon = "🟡";

    message =
      "Preço interessante";

    detail =
      "Preço entre P25 e P50 e tendência estável";


  } else if (
    historicalZone === "below-average" &&
    direction === "up"
  ) {

    icon = "🟡";

    message =
      "Interessante, mas subindo";

    detail =
      "Preço entre P25 e P50, porém com tendência de alta";


  /*
   * PREÇO ENTRE P50 E P75
   */

  } else if (
    historicalZone === "above-average" &&
    direction === "down"
  ) {

    icon = "🟡";

    message =
      "Pode ficar interessante";

    detail =
      "Preço entre P50 e P75 e tendência de queda";


  } else if (
    historicalZone === "above-average" &&
    direction === "stable"
  ) {

    icon = "🟠";

    message =
      "Preço normal";

    detail =
      "Preço entre P50 e P75 e tendência estável";


  } else if (
    historicalZone === "above-average" &&
    direction === "up"
  ) {

    icon = "🟠";

    message =
      "Preço normal, tendência de alta";

    detail =
      "Preço entre P50 e P75 e tendência de alta";


  /*
   * PREÇO ALTO
   */

  } else if (
    historicalZone === "high" &&
    direction === "down"
  ) {

    icon = "🟠";

    message =
      "Caro, mas melhorando";

    detail =
      "Preço acima do P75, mas com tendência de queda";


  } else if (
    historicalZone === "high" &&
    direction === "stable"
  ) {

    icon = "🔴";

    message =
      "Preço caro";

    detail =
      "Preço acima do P75 e tendência estável";


  } else {

    icon = "🔴";

    message =
      "Preço caro e subindo";

    detail =
      "Preço acima do P75 e tendência de alta";

  }


  return {

    percentile,

    historicalZone,

    direction,

    icon,

    message,

    detail

  };

}

/**
 * Gera a decisão final do Radar.
 *
 * A decisão considera:
 *
 * - posição histórica
 * - tendência
 * - movimento de hoje
 *
 * O score estatístico não participa
 * diretamente da decisão.
 */
export function analyzeDecision(
  currentRate,
  statistics,
  trend,
  todayChange
) {

  /*
   * Posição do preço atual
   * dentro do histórico de 6 meses.
   */
  const percentile =
    calculateCurrentPercentile(
      currentRate,
      statistics.sortedRates
    );


  /*
   * Define a faixa histórica.
   */
  let historicalZone;


  if (percentile <= 25) {

    historicalZone = "very-favorable";

  } else if (percentile <= 50) {

    historicalZone = "favorable";

  } else if (percentile <= 75) {

    historicalZone = "normal";

  } else if (percentile <= 90) {

    historicalZone = "expensive";

  } else {

    historicalZone = "very-expensive";

  }


  /*
   * Movimento de hoje é apenas contexto.
   *
   * Não usamos isso para invalidar
   * uma condição historicamente favorável.
   */
  let todayDirection;


  if (
    !Number.isFinite(todayChange)
  ) {

    todayDirection = "unknown";

  } else if (
    todayChange < -0.10
  ) {

    todayDirection = "down";

  } else if (
    todayChange > 0.10
  ) {

    todayDirection = "up";

  } else {

    todayDirection = "stable";

  }


  /*
   * ==================================================
   * DECISÃO PRINCIPAL
   * ==================================================
   *
   * A posição histórica é o fator principal.
   */


  if (
    historicalZone === "very-favorable"
  ) {

    return {

      percentile,
      historicalZone,
      trendDirection: trend.direction,
      todayDirection,
      todayChange,

      icon: "🟢",

      action:
        "BOA HORA PARA COMPRAR",

      detail:
        "Entre os 25% mais baratos dos últimos 6 meses"

    };

  }


  if (
    historicalZone === "favorable"
  ) {

    return {

      percentile,
      historicalZone,
      trendDirection: trend.direction,
      todayDirection,
      todayChange,

      icon: "🟡",

      action:
        "MOMENTO FAVORÁVEL",

      detail:
        "Abaixo da mediana histórica dos últimos 6 meses"

    };

  }


  if (
    historicalZone === "normal"
  ) {

    return {

      percentile,
      historicalZone,
      trendDirection: trend.direction,
      todayDirection,
      todayChange,

      icon: "🟠",

      action:
        "AGUARDA UM POUCO",

      detail:
        "Acima da mediana dos últimos 6 meses"

    };

  }


  if (
    historicalZone === "expensive"
  ) {

    return {

      percentile,
      historicalZone,
      trendDirection: trend.direction,
      todayDirection,
      todayChange,

      icon: "🔴",

      action:
        "PREÇO ALTO — ESPERA",

      detail:
        "Entre os 25% mais caros dos últimos 6 meses"

    };

  }


  return {

    percentile,
    historicalZone,
    trendDirection: trend.direction,
    todayDirection,
    todayChange,

    icon: "🔴",

    action:
      "PREÇO MUITO ALTO",

    detail:
      "Entre os 10% mais caros dos últimos 6 meses"

  };

}