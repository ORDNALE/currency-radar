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
  analyzeDecision
} from "./services/analysis.js";


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
 * Formata uma variação percentual.
 */
function formatPercent(value) {

  if (!Number.isFinite(value)) {
    return "--";
  }

  const sign =
    value > 0
      ? "+"
      : "";

  return `${sign}${value.toFixed(2)}%`;

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
    `${Math.abs(difference).toFixed(2)}%`;


  let averageText;


  if (difference > 0) {

    averageText =
      `${differenceText} acima da média`;

  } else if (difference < 0) {

    averageText =
      `${differenceText} abaixo da média`;

  } else {

    averageText =
      "igual à média";

  }


  /*
   * Texto da tendência.
   */
  let trendText;


  if (
    decision.trendDirection === "down"
  ) {

    trendText =
      "📉 tendência de queda";

  } else if (
    decision.trendDirection === "up"
  ) {

    trendText =
      "📈 tendência de alta";

  } else {

    trendText =
      "➡️ tendência estável";

  }


  return (
    `${decision.icon} ${decision.action}\n` +
    `${decision.detail}\n` +
    `${trendText} • ${averageText}`
  );

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

    const statisticsMap = {

      "currency-average":
        statistics.average,

      "currency-median":
        statistics.median,

      "currency-min":
        statistics.min,

      "currency-max":
        statistics.max,

      "currency-p10":
        statistics.p10,

      "currency-p25":
        statistics.p25,

      "currency-p50":
        statistics.p50,

      "currency-p75":
        statistics.p75,

      "currency-p90":
        statistics.p90

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
     * TENDÊNCIA
     */

    const trendLabel =
      document.getElementById(
        "currency-trend-label"
      );

    if (trendLabel) {

      trendLabel.textContent =
        `${trend.icon} ${trend.label}`;

    }


    const trend7 =
      document.getElementById(
        "currency-trend-7d"
      );

    if (trend7) {

      trend7.textContent =
        formatPercent(
          trend.change7d
        );

    }


    const trend30 =
      document.getElementById(
        "currency-trend-30d"
      );

    if (trend30) {

      trend30.textContent =
        formatPercent(
          trend.change30d
        );

    }


    /*
     * DECISÃO SUGERIDA
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
        decision
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
      "currency-average",
      "currency-median",
      "currency-min",
      "currency-max",
      "currency-p10",
      "currency-p25",
      "currency-p50",
      "currency-p75",
      "currency-p90",
      "currency-trend-7d",
      "currency-trend-30d",
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


    const trendLabel =
      document.getElementById(
        "currency-trend-label"
      );

    if (trendLabel) {

      trendLabel.textContent =
        "Tendência indisponível";

    }


    const opportunityElement =
      document.getElementById(
        "currency-opportunity"
      );

    if (opportunityElement) {

      opportunityElement.className =
        "opportunity";

      opportunityElement.textContent =
        "Análise indisponível";

    }

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