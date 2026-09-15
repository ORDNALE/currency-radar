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
 * Mínima e máxima por período.
 *
 * O recorte de 1 mês é por data real, não por
 * contagem de observações: o PTAX só tem dias
 * úteis, então "os últimos 30 registros" seriam
 * quase sete semanas de calendário.
 */
export function calculateRanges(history) {

  const valid =
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


  if (valid.length === 0) {
    return null;
  }


  const latest =
    parseDate(
      valid[valid.length - 1].date
    );


  const monthStart =
    new Date(latest);

  monthStart.setDate(
    monthStart.getDate() - 30
  );


  const monthCutoff =
    formatDate(monthStart);


  const monthRows =
    valid.filter(
      item => item.date >= monthCutoff
    );


  function rangeOf(rows) {

    if (rows.length === 0) {
      return null;
    }

    let min = rows[0].rate;
    let max = rows[0].rate;

    for (const item of rows) {

      if (item.rate < min) {
        min = item.rate;
      }

      if (item.rate > max) {
        max = item.rate;
      }

    }

    return { min, max, count: rows.length };

  }


  return {

    month:
      rangeOf(monthRows),

    sixMonths:
      rangeOf(valid)

  };

}


/*
 * Desconto do alvo sugerido para o alerta.
 *
 * Backtest de 4 anos de PTAX, medindo com que
 * frequência o alvo era atingido e quanto desconto
 * entregava. Duas regras baseadas em percentil
 * foram testadas e descartadas:
 *
 * - P25 do semestre: atingido em só 48% das vezes em
 *   30 dias (EUR), e podia cair abaixo da mínima do
 *   mês — pedia para esperar um preço que sumiu.
 *
 * - P10 do mês: pior ainda nas bordas. Com o preço já
 *   na parte baixa do mês, o desconto colapsava para
 *   0,3%; e o desconto mínimo medido foi -1,55%, ou
 *   seja, às vezes sugeria um alvo ACIMA do preço de
 *   hoje. O usuário só alerta para baixo — alvo
 *   invertido é sugestão sem sentido.
 *
 * Um desconto fixo sobre a cotação de hoje não tem
 * esse problema: nunca inverte e nunca degenera.
 * 1% é atingido em 67% (EUR) e 70% (USD) das vezes
 * em 30 dias. 1,5% derruba para 56% e 59%.
 */
const SUGGESTED_DISCOUNT = 0.01;


/**
 * Preço-alvo sugerido para o alerta de queda.
 */
export function suggestAlertTarget(currentRate) {

  if (
    !Number.isFinite(currentRate) ||
    currentRate <= 0
  ) {
    return null;
  }

  return {

    price:
      currentRate * (1 - SUGGESTED_DISCOUNT),

    discountPercent:
      SUGGESTED_DISCOUNT * 100

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

/*
 * Janelas do motor de previsão.
 *
 * A longa define a tendência de fundo.
 * A curta existe só para detectar quando
 * essa tendência está virando.
 *
 * SHORT_WINDOW abaixo de 15 passa a acusar
 * direção em série lateral ruidosa — ou seja,
 * inventa sinal onde só há oscilação.
 */
const LONG_WINDOW  = 60;
const SHORT_WINDOW = 15;

/*
 * Variação projetada menor que isso não é
 * direção, é ruído.
 */
const NEUTRAL_THRESHOLD = 1.5;

/*
 * R² mínimo para acreditar na reta.
 *
 * Estes dois números foram calibrados contra
 * passeios aleatórios — séries sem tendência
 * por construção, que é o mais parecido com
 * câmbio real. Com 0.35 / 0.8% o motor afirmava
 * direção em 32% deles (97 de 300): invenção
 * pura. Com 0.55 / 1.5% cai para 19%, e ainda
 * detecta 117 de 120 tendências reais.
 *
 * Afrouxar estes valores volta a gerar sinal
 * onde não há; apertar mais (2.5%) derruba a
 * detecção real para 68% e não compensa.
 */
const MIN_R2 = 0.55;

/*
 * Quebra estrutural: quantos erros-padrão o
 * último preço pode fugir da reta antes de a
 * reta ser considerada inválida.
 *
 * Uma queda brusca é o evento mais informativo
 * da série, mas a regressão a trata como 1 ponto
 * entre 60 — media a reta continuava dizendo
 * "tende a subir" no dia seguinte a um tombo de
 * 5%, justo quando o motor histórico já gritava
 * para comprar.
 *
 * Medido: no dia da quebra o desvio é 7,2 e cai
 * para 4,0 no terceiro dia; séries normais ficam
 * em 1,3 em média e o pior passeio aleatório
 * chegou a 3,21. Daí 3,5.
 */
const MAX_DEVIATION = 3.5;


/**
 * Ajusta uma reta por mínimos quadrados
 * e a projeta `daysAhead` à frente.
 */
function fitLine(rows, daysAhead) {

  const n = rows.length;

  if (n < 8) {
    return null;
  }


  let sumX  = 0;
  let sumY  = 0;
  let sumXY = 0;
  let sumX2 = 0;


  for (let i = 0; i < n; i++) {

    const rate = rows[i].rate;

    sumX  += i;
    sumY  += rate;
    sumXY += i * rate;
    sumX2 += i * i;

  }


  const denominator =
    n * sumX2 - sumX * sumX;

  if (denominator === 0) {
    return null;
  }


  const slope =
    (n * sumXY - sumX * sumY) / denominator;

  const intercept =
    (sumY - slope * sumX) / n;


  /*
   * R² indica o quanto a reta explica
   * a variação real dos dados.
   * Perto de 1 = tendência consistente.
   */
  const meanY = sumY / n;

  let totalVariance    = 0;
  let residualVariance = 0;


  for (let i = 0; i < n; i++) {

    const predicted =
      intercept + slope * i;

    totalVariance +=
      (rows[i].rate - meanY) ** 2;

    residualVariance +=
      (rows[i].rate - predicted) ** 2;

  }


  const r2 =
    totalVariance > 0
      ? Math.max(
          0,
          1 - residualVariance / totalVariance
        )
      : 0;


  const lastRate =
    rows[n - 1].rate;

  const projectedRate =
    intercept + slope * (n - 1 + daysAhead);


  /*
   * Quanto o último preço destoa da reta,
   * medido em erros-padrão dos resíduos.
   * Valor alto = a série quebrou e a reta
   * descreve um regime que acabou.
   */
  const standardError =
    Math.sqrt(
      residualVariance / Math.max(1, n - 2)
    );

  const lastPredicted =
    intercept + slope * (n - 1);

  const deviation =
    standardError > 0
      ? Math.abs(lastRate - lastPredicted) / standardError
      : 0;


  return {

    r2,

    deviation,

    projectedRate,

    projectedChange:
      ((projectedRate - lastRate) / lastRate) * 100,

    samples: n

  };

}


/**
 * Traduz uma reta ajustada em direção.
 *
 * R² baixo significa que a reta não descreve
 * os dados — o preço só oscilou. Projetar a
 * partir dela viraria sinal falso, que
 * confirmaria indevidamente o motor histórico.
 */
function directionOf(fit) {

  if (!fit || fit.r2 < MIN_R2) {
    return "stable";
  }

  if (fit.projectedChange < -NEUTRAL_THRESHOLD) {
    return "down";
  }

  if (fit.projectedChange > NEUTRAL_THRESHOLD) {
    return "up";
  }

  return "stable";

}


/**
 * Projeta a cotação futura por regressão
 * linear sobre o histórico recente.
 *
 * Serve como segundo motor de análise,
 * independente da posição histórica.
 *
 * Uma reta única sobre uma série que dobra
 * fica refém dos dados anteriores à dobra:
 * medindo uma reversão real, a reta de 60
 * pregões levava 35 dias para perceber, e
 * nos 15 primeiros afirmava a direção velha
 * com confiança alta — ativamente errada.
 * Por isso comparamos uma janela curta com a
 * longa: quando discordam, a tendência está
 * virando e nenhuma direção é afirmada.
 */
export function calculateForecast(
  history,
  daysAhead = 30
) {

  const sorted =
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


  if (sorted.length < 10) {
    return null;
  }


  const longFit =
    fitLine(
      sorted.slice(-LONG_WINDOW),
      daysAhead
    );

  if (!longFit) {
    return null;
  }


  const shortFit =
    fitLine(
      sorted.slice(-SHORT_WINDOW),
      daysAhead
    );


  const longDirection  = directionOf(longFit);
  const shortDirection = directionOf(shortFit);


  let confidence;

  if (longFit.r2 >= 0.60) {

    confidence = "alta";

  } else if (longFit.r2 >= MIN_R2) {

    confidence = "média";

  } else {

    confidence = "baixa";

  }


  let direction;
  let label;
  let icon;


  /*
   * A série quebrou: o último preço fugiu da
   * reta longa. O regime que a reta descreve
   * acabou, então a direção dela não vale mais.
   */
  const broken =
    longFit.deviation > MAX_DEVIATION;


  const turning =
    broken ||
    (
      longDirection  !== "stable" &&
      shortDirection !== "stable" &&
      longDirection  !== shortDirection
    );


  if (turning) {

    direction = "turning";
    label     = "Tendência virando";
    icon      = "🔄";

  } else {

    /*
     * A janela longa é a única que afirma
     * direção. A curta serve só de gatilho
     * de reversão, acima.
     *
     * Deixar a curta decidir sozinha quando a
     * longa está indecisa reintroduz o sinal
     * falso: 15 pregões de uma série lateral
     * são localmente uma reta com R² alto, e
     * a oscilação virava "tende a subir".
     */
    direction = longDirection;


    if (direction === "down") {

      label = "Tende a cair";
      icon  = "📉";

    } else if (direction === "up") {

      label = "Tende a subir";
      icon  = "📈";

    } else {

      label = "Sem tendência clara";
      icon  = "➡️";

    }

  }


  return {

    projectedRate:
      longFit.projectedRate,

    projectedChange:
      longFit.projectedChange,

    direction,

    label,

    icon,

    r2: longFit.r2,

    confidence,

    turning,

    broken,

    deviation: longFit.deviation,

    longDirection,

    shortDirection,

    daysAhead,

    samples: longFit.samples

  };

}


/**
 * Cruza os dois motores de análise.
 *
 * Motor 1: posição histórica (onde o preço está)
 * Motor 2: projeção linear   (para onde aponta)
 *
 * Concordância entre eles aumenta a confiança
 * da decisão.
 */
export function combineEngines(
  decision,
  forecast
) {

  if (!forecast) {

    return {
      agreement: "unknown",
      icon: "ℹ️",
      message:
        "Previsão indisponível — usando só o histórico"
    };

  }


  const cheapNow =
    decision.historicalZone === "very-favorable" ||
    decision.historicalZone === "favorable";


  const expensiveNow =
    decision.historicalZone === "expensive" ||
    decision.historicalZone === "very-expensive";


  /*
   * TENDÊNCIA VIRANDO
   *
   * As janelas curta e longa discordam: a
   * direção antiga já não vale e a nova ainda
   * não se firmou. Afirmar qualquer rumo aqui
   * seria repetir o erro que a detecção existe
   * para evitar.
   */
  if (forecast.direction === "turning") {

    if (cheapNow) {

      return {
        agreement: "mixed",
        icon: "🔄",
        message:
          "Preço bom, mas a tendência está virando — " +
          "se for comprar, compre em partes"
      };

    }

    if (expensiveNow) {

      return {
        agreement: "mixed",
        icon: "🔄",
        message:
          "Preço alto e tendência virando — " +
          "acompanhe antes de decidir"
      };

    }

    return {
      agreement: "mixed",
      icon: "🔄",
      message:
        "Tendência virando — aguarde o rumo se firmar"
    };

  }


  const fallingAhead =
    forecast.direction === "down";

  const risingAhead =
    forecast.direction === "up";


  /*
   * PREÇO BARATO HOJE
   */

  if (cheapNow) {

    if (fallingAhead) {

      return {
        agreement: "buy",
        icon: "✅",
        message:
          "Os dois motores concordam: bom momento para comprar"
      };

    }

    if (risingAhead) {

      return {
        agreement: "mixed",
        icon: "⚠️",
        message:
          "Preço bom agora, mas a projeção aponta alta — " +
          "considere comprar em partes"
      };

    }

    return {
      agreement: "buy",
      icon: "✅",
      message:
        "Preço bom e estável — momento favorável"
    };

  }


  /*
   * PREÇO CARO HOJE
   */

  if (expensiveNow) {

    if (fallingAhead) {

      return {
        agreement: "mixed",
        icon: "🟡",
        message:
          "Ainda caro, mas a projeção aponta queda — " +
          "vale esperar"
      };

    }

    if (risingAhead) {

      return {
        agreement: "wait",
        icon: "⛔",
        message:
          "Os dois motores concordam: não é hora de comprar"
      };

    }

    return {
      agreement: "wait",
      icon: "⛔",
      message:
        "Preço alto e sem sinal de queda — aguarde"
    };

  }


  /*
   * PREÇO NA MÉDIA
   */

  if (fallingAhead) {

    return {
      agreement: "mixed",
      icon: "🟡",
      message:
        "Preço mediano, mas a projeção aponta queda — " +
        "pode melhorar"
    };

  }

  if (risingAhead) {

    return {
      agreement: "wait",
      icon: "🟠",
      message:
        "Preço mediano e a projeção aponta alta — aguarde"
    };

  }

  return {
    agreement: "neutral",
    icon: "➡️",
    message:
      "Preço mediano, sem tendência clara"
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