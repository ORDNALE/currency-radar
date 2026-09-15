import {
  getSixMonthHistory
} from "./services/exchangeRate.js";

import {
  getCurrentMarketRates
} from "./services/currentRates.js";

import {
  calculateStatistics,
  calculateTrend,
  analyzeOpportunity,
  analyzeRadar,
  analyzeDecision,
  calculateForecast,
  combineEngines,
  calculateRanges,
  suggestAlertTarget
} from "./services/analysis.js";

import {
  getFocusForecast,
  projectFromFocus
} from "./services/focus.js";


const currencies = {

  EUR: {
    name: "Euro",
    flag: "🇪🇺",
    pair: "EUR / BRL"
  },

  USD: {
    name: "Dólar",
    flag: "🇺🇸",
    pair: "USD / BRL"
  }

};


let selectedCurrency = "EUR";

/*
 * Preço-alvo sugerido por moeda.
 *
 * A oportunidade pode aparecer amanhã ou daqui a
 * meses, e o alerta só pega se já estiver armado —
 * mas ele exigia que o usuário inventasse um número.
 * Aqui a própria análise propõe um.
 */
const suggestedTarget = {
  EUR: null,
  USD: null
};


/**
 * Formatação apenas para apresentação.
 */
function formatBRL(value) {

  if (!Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }
  ).format(value);

}


/**
 * Formata a variação da cotação no dia.
 */
function formatTodayChange(value) {

  if (!Number.isFinite(value)) {
    return "--";
  }

  if (value > 0) {
    return `↑ +${value.toFixed(2)}% hoje`;
  }

  if (value < 0) {
    return `↓ ${value.toFixed(2)}% hoje`;
  }

  return "→ 0,00% hoje";

}


/**
 * Atualiza o cabeçalho.
 */
function updateCurrencyHeader() {

  const currency =
    currencies[selectedCurrency];

  const flag =
    document.getElementById(
      "currency-flag"
    );

  const name =
    document.getElementById(
      "currency-name"
    );

  const pair =
    document.getElementById(
      "currency-pair"
    );


  if (flag) {
    flag.textContent =
      currency.flag;
  }

  if (name) {
    name.textContent =
      currency.name;
  }

  if (pair) {
    pair.textContent =
      currency.pair;
  }

}


/**
 * Formata a decisão final do Radar.
 */
function formatDecision(
  decision,
  opportunity
) {

  const difference =
    opportunity.differenceFromAverage;


  const differenceText =
    `${Math.abs(difference).toFixed(1)}%`;


  let averageText;


  if (difference > 0) {

    averageText =
      `${differenceText} acima da média`;

  } else if (difference < 0) {

    averageText =
      `${differenceText} abaixo da média`;

  } else {

    averageText =
      "na média";

  }


  return (
    `${decision.icon} ${decision.action}\n` +
    `${averageText}`
  );

}


function isForecastSilent(forecast) {

  return (
    !forecast ||
    forecast.direction === "stable"
  );

}


/**
 * Renderiza o card do motor de previsão.
 */
function renderForecast(forecast) {

  const card =
    document.getElementById("forecast-card");

  const label =
    document.getElementById("forecast-label");

  const rate =
    document.getElementById("forecast-rate");

  const confidence =
    document.getElementById("forecast-confidence");


  const block =
    document.getElementById("forecast-block");

  const row =
    document.getElementById("engines-row");


  if (!card || !label || !rate || !confidence || !block || !row) {
    return;
  }


  /*
   * Sem tendência (o caso da maioria dos dias)
   * o card não tem nada a dizer — some, e o
   * card da esquerda ocupa a linha.
   */
  const silent =
    isForecastSilent(forecast);

  block.hidden = silent;

  row.classList.toggle("single", silent);

  if (silent) {
    return;
  }


  card.className =
    `forecast-card forecast-${forecast.direction}`;


  label.textContent =
    `${forecast.icon} ${forecast.label}`;


  /*
   * Tendência virando: a reta longa ainda
   * aponta o rumo antigo, que já não vale.
   * Projetar a partir dela enganaria.
   */
  if (forecast.direction === "turning") {

    rate.textContent = "";

    confidence.textContent =
      "rumo mudando, ainda sem confirmar";

    return;

  }


  rate.textContent =
    `${formatBRL(forecast.projectedRate)} em 30d`;


  confidence.textContent =
    `confiança ${forecast.confidence}`;

}


/**
 * Renderiza o veredito do cruzamento
 * entre os dois motores.
 */
function renderCombinedSignal(combined) {

  const element =
    document.getElementById("combined-signal");

  if (!element) {
    return;
  }


  element.hidden = false;

  element.className =
    `combined-signal signal-${combined.agreement}`;


  element.textContent =
    `${combined.icon} ${combined.message}`;

}


/**
 * Renderiza o consenso do Focus/BCB.
 *
 * É informação adicional: some sem alarde quando
 * indisponível, e nunca entra no veredito dos dois
 * motores — o Focus projeta meses à frente, os
 * motores falam do agora.
 */
function renderFocus(projection, currency) {

  const block =
    document.getElementById("focus-block");

  const main =
    document.getElementById("focus-main");

  const detail =
    document.getElementById("focus-detail");


  if (!block || !main || !detail) {
    return;
  }


  if (!projection) {

    block.hidden = true;

    return;

  }


  block.hidden = false;


  const [month, year] =
    projection.referenceMonth.split("/");

  const monthNames = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez"
  ];

  const when =
    `${monthNames[Number(month) - 1]}/${year.slice(2)}`;


  main.className =
    `focus-main focus-${projection.direction}`;


  /*
   * A leitura útil não é a data futura, é o que ela
   * implica para hoje: se o mercado espera alta,
   * adiar a compra tende a sair mais caro.
   */
  const advice =
    projection.direction === "up"
      ? "↑ Esperar tende a sair mais caro"
      : projection.direction === "down"
        ? "↓ Esperar tende a compensar"
        : "→ Esperar não deve mudar muito";


  main.textContent = advice;


  const diff =
    Math.abs(projection.changePercent).toFixed(1);


  const movement =
    projection.direction === "flat"
      ? "estável"
      : `${projection.direction === "up" ? "+" : "−"}${diff}%`;


  detail.textContent =
    `Mercado projeta ${formatBRL(projection.projected)} ` +
    `até ${when} (${movement}) · ` +
    `${projection.respondents} instituições`;

}


/**
 * Carrega os dados do Radar.
 */
async function loadCurrency() {

  const status =
    document.getElementById(
      "status"
    );


  const currency =
    currencies[selectedCurrency];


  try {

    if (status) {

      status.textContent =
        `Buscando dados do ${currency.name}...`;

    }


    /*
     * Mercado atual + histórico.
     */
    const [
      marketRates,
      history
    ] = await Promise.all([

      getCurrentMarketRates(),

      getSixMonthHistory(
        selectedCurrency,
        "BRL"
      )

    ]);


    const current =
      marketRates[selectedCurrency];


    if (
      !current ||
      !Number.isFinite(current.rate)
    ) {

      throw new Error(
        "Cotação atual inválida."
      );

    }


    /*
     * Estatísticas dos 6 meses.
     */
    const statistics =
      calculateStatistics(
        history
      );


    /*
     * Tendência baseada exclusivamente
     * no histórico PTAX.
     */
    const trend =
      calculateTrend(
        history
      );


    /*
     * Oportunidade histórica.
     */
    const opportunity =
      analyzeOpportunity(
        current.rate,
        statistics
      );


    /*
     * Radar final.
     */
    const radar =
      analyzeRadar(
        current.rate,
        statistics,
        trend
      );


    /*
     * Decisão sugerida.
     */
    const decision =
      analyzeDecision(
        current.rate,
        statistics,
        trend,
        current.pctChange
      );


    /*
     * Segundo motor: projeção linear
     * dos próximos 30 dias.
     */
    const forecast =
      calculateForecast(
        history
      );


    /*
     * COTAÇÃO
     */

    const rateElement =
      document.getElementById(
        "currency-rate"
      );

    if (rateElement) {

      rateElement.textContent =
        formatBRL(
          current.rate
        );

    }


    const todayChangeElement =
      document.getElementById(
        "currency-today-change"
      );

    if (todayChangeElement) {

      todayChangeElement.textContent =
        formatTodayChange(
          current.pctChange
        );

    }


    /*
     * ESTATÍSTICAS
     */

    const ranges =
      calculateRanges(history);


    suggestedTarget[selectedCurrency] =
      suggestAlertTarget(current.rate);


    const statisticsMap = {

      "range-month-min":
        ranges?.month?.min,

      "range-month-max":
        ranges?.month?.max,

      "range-six-min":
        ranges?.sixMonths?.min,

      "range-six-max":
        ranges?.sixMonths?.max

    };


    Object.entries(
      statisticsMap
    ).forEach(
      ([id, value]) => {

        const element =
          document.getElementById(
            id
          );

        if (element) {

          element.textContent =
            formatBRL(
              value
            );

        }

      }
    );


    /*
     * MOTOR 1 — POSIÇÃO HISTÓRICA
     */

    const opportunityElement =
      document.getElementById(
        "currency-opportunity"
      );

    if (opportunityElement) {

      opportunityElement.textContent =
        formatDecision(
          decision,
          opportunity
        );

      opportunityElement.className =
        `opportunity zone-${decision.historicalZone}`;

    }


    /*
     * MOTOR 2 — PREVISÃO
     */

    renderForecast(forecast);


    /*
     * VEREDITO COMBINADO
     */

    renderCombinedSignal(
      combineEngines(
        decision,
        forecast
      )
    );


    /*
     * Sem tendência o veredito só repetiria o
     * card da esquerda ("Preço mediano, sem
     * tendência clara") — some junto.
     */
    const combinedElement =
      document.getElementById("combined-signal");

    if (combinedElement) {

      combinedElement.hidden =
        isForecastSilent(forecast);

    }


    /*
     * CONSENSO DE MERCADO
     *
     * Buscado depois do render principal, não junto:
     * é complemento, e não deve atrasar a tela se o
     * servidor do BCB estiver lento.
     */
    const requestedCurrency = selectedCurrency;

    getFocusForecast().then(focus => {

      /*
       * O usuário pode ter trocado de aba durante a
       * consulta — descartar resultado fora de contexto.
       */
      if (selectedCurrency !== requestedCurrency) {
        return;
      }

      renderFocus(
        projectFromFocus(
          focus,
          requestedCurrency,
          current.rate,
          marketRates.USD?.rate
        ),
        requestedCurrency
      );

    });


    updateAlertUI(selectedCurrency);


    /*
     * STATUS
     */

    if (status) {

      status.textContent =
        `Mercado: ${current.date} • ` +
        `Histórico: ${statistics.count} observações`;

    }


    /*
     * DEBUG
     */

    console.log(
      `${selectedCurrency}/BRL`,
      {
        current,
        statistics,
        trend,
        opportunity,
        radar,
        decision,
        forecast
      }
    );


  } catch (error) {

    console.error(
      "Currency Radar:",
      error
    );


    if (status) {

      status.textContent =
        "⚠️ Não foi possível carregar os dados.";

    }


    /*
     * Limpa os campos numéricos.
     */

    const elements = [

      "currency-rate",
      "range-month-min",
      "range-month-max",
      "range-six-min",
      "range-six-max",
      "currency-today-change"

    ];


    elements.forEach(
      id => {

        const element =
          document.getElementById(
            id
          );

        if (element) {

          element.textContent =
            "--";

        }

      }
    );


    const opportunityElement =
      document.getElementById(
        "currency-opportunity"
      );

    if (opportunityElement) {

      opportunityElement.className =
        "opportunity";

      opportunityElement.textContent =
        "Indisponível";

    }


    renderForecast(null);

    renderCombinedSignal({
      agreement: "unknown",
      icon: "⚠️",
      message: "Análise indisponível"
    });

    renderFocus(null);

    updateAlertUI(selectedCurrency);

  }

}


/**
 * Troca a moeda do Radar.
 */
function selectCurrency(
  currency
) {

  selectedCurrency =
    currency;


  document
    .querySelectorAll(
      ".tab[data-currency]"
    )
    .forEach(tab => {

      tab.classList.toggle(
        "active",
        tab.dataset.currency === currency
      );

    });


  updateCurrencyHeader();

  loadCurrency();

}


/**
 * Troca entre Radar e Calculadora.
 */
function selectTab(tab) {

  const tabType =
    tab.dataset.tab;


  const radarView =
    document.getElementById(
      "radar-view"
    );


  const calculatorView =
    document.getElementById(
      "calculator-view"
    );


  document
    .querySelectorAll(".tab")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button === tab
      );

    });


  /*
   * CALCULADORA
   */
  if (
    tabType === "calculator"
  ) {

    radarView.hidden = true;

    calculatorView.hidden = false;


    /*
     * A calculadora é carregada somente
     * quando a aba é aberta.
     */
    import(
      "./services/calculator/calculator.js"
    )
      .then(module => {

        module.initCalculator();

      })
      .catch(error => {

        console.error(
          "Currency Radar - Calculadora:",
          error
        );

        calculatorView.innerHTML = `
          <div class="calculator-card">

            <div class="calculator-title">
              Conversor
            </div>

            <div class="calculator-subtitle">
              Não foi possível carregar a calculadora.
            </div>

          </div>
        `;

      });


    return;

  }


  /*
   * RADAR
   */

  radarView.hidden = false;

  calculatorView.hidden = true;


  if (
    tab.dataset.currency
  ) {

    selectCurrency(
      tab.dataset.currency
    );

  }

}


/**
 * Atualiza a UI do alerta para a moeda atual.
 */
async function updateAlertUI(currency) {

  const storage =
    await chrome.storage.local.get(["alerts"]);

  const alerts = storage.alerts || {};
  const alert = alerts[currency];


  const form =
    document.getElementById("alert-form");

  const active =
    document.getElementById("alert-active");

  const pairEl =
    document.getElementById("alert-pair");

  const activeText =
    document.getElementById("alert-active-text");

  const prevTrigger =
    document.getElementById("alert-prev-trigger");


  if (!form || !active) {
    return;
  }


  if (pairEl) {
    pairEl.textContent = `${currency}/BRL`;
  }


  const proximityInfo =
    document.getElementById("alert-proximity-info");


  if (alert?.active) {

    form.hidden = true;
    active.hidden = false;

    if (activeText) {
      activeText.textContent =
        `${currency}/BRL abaixo de ` +
        `R$ ${alert.targetPrice.toFixed(2)}`;
    }


    if (proximityInfo) {

      if (alert.proximityNotifiedAt) {

        const date =
          new Date(
            alert.proximityNotifiedAt
          ).toLocaleDateString("pt-BR");

        proximityInfo.textContent =
          `🟡 Aviso de proximidade enviado em ${date} ` +
          `(R$ ${Number(alert.proximityRate).toFixed(4)})`;

        proximityInfo.hidden = false;

      } else {

        proximityInfo.hidden = true;

      }

    }


  } else {

    form.hidden = false;
    active.hidden = true;


    if (prevTrigger) {

      if (alert?.triggeredAt) {

        const date =
          new Date(
            alert.triggeredAt
          ).toLocaleDateString("pt-BR");

        prevTrigger.textContent =
          `Último alerta disparou em ${date} ` +
          `(R$ ${Number(alert.triggeredRate).toFixed(4)})`;

        prevTrigger.hidden = false;

      } else {

        prevTrigger.hidden = true;

      }

    }

    /*
     * Limpa o input ao trocar de moeda.
     */
    const priceInput =
      document.getElementById("alert-price");

    if (priceInput) {
      priceInput.value = "";
    }


    const suggest =
      document.getElementById("alert-suggest");

    const target =
      suggestedTarget[currency];

    if (suggest) {

      if (target) {

        suggest.hidden = false;

        /*
         * Descreve o que o número é, não o que ele
         * vai fazer: prometer "boa compra" soa como
         * garantia, e alvo nenhum tem garantia.
         */
        suggest.textContent =
          `💡 Sugestão: R$ ` +
          `${target.price.toFixed(2).replace(".", ",")} — ` +
          `${target.discountPercent.toFixed(0)}% abaixo de hoje`;

        suggest.dataset.price =
          target.price.toFixed(2);

      } else {

        suggest.hidden = true;

      }

    }

  }

}


/**
 * Inicializa os event listeners da seção de alertas.
 */
function initAlertListeners() {

  const saveBtn =
    document.getElementById("alert-save");

  const removeBtn =
    document.getElementById("alert-remove");

  const priceInput =
    document.getElementById("alert-price");


  if (!saveBtn || !removeBtn || !priceInput) {
    return;
  }


  saveBtn.addEventListener("click", async () => {

    const price = Number(priceInput.value);

    if (!Number.isFinite(price) || price <= 0) {
      priceInput.focus();
      return;
    }


    const storage =
      await chrome.storage.local.get(["alerts"]);

    const alerts = storage.alerts || {};

    alerts[selectedCurrency] = {
      active: true,
      targetPrice: price,
      createdAt: new Date().toISOString()
    };

    await chrome.storage.local.set({ alerts });

    await updateAlertUI(selectedCurrency);

  });


  removeBtn.addEventListener("click", async () => {

    const storage =
      await chrome.storage.local.get(["alerts"]);

    const alerts = storage.alerts || {};

    delete alerts[selectedCurrency];

    await chrome.storage.local.set({ alerts });

    await updateAlertUI(selectedCurrency);

  });


  const suggestBtn =
    document.getElementById("alert-suggest");

  if (suggestBtn) {

    suggestBtn.addEventListener("click", () => {

      const price = suggestBtn.dataset.price;

      if (price) {
        priceInput.value = price;
        priceInput.focus();
      }

    });

  }


  const checkBtn =
    document.getElementById("alert-check-now");

  if (checkBtn) {

    checkBtn.addEventListener("click", () => {

      checkBtn.textContent = "Verificando...";
      checkBtn.disabled = true;


      chrome.runtime.sendMessage(
        { type: "checkNow" },
        async () => {

          await updateAlertUI(selectedCurrency);

          checkBtn.textContent = "Verificar agora";
          checkBtn.disabled = false;

        }
      );

    });

  }

}


/**
 * Eventos das abas.
 */
document
  .querySelectorAll(
    ".tab"
  )
  .forEach(
    tab => {

      tab.addEventListener(
        "click",
        () => {

          selectTab(
            tab
          );

        }
      );

    }
  );


/**
 * Inicialização.
 */
updateCurrencyHeader();

initAlertListeners();

loadCurrency();