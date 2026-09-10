import {
  getCurrentMarketRates
} from "../services/currentRates.js";


let fromCurrency = "BRL";
let toCurrency = "EUR";

let initialized = false;


const currencyInfo = {

  BRL: {
    flag: "🇧🇷",
    name: "Real"
  },

  EUR: {
    flag: "🇪🇺",
    name: "Euro"
  },

  USD: {
    flag: "🇺🇸",
    name: "Dólar"
  }

};


/**
 * Formata valores monetários.
 */
function formatCurrency(
  value,
  currency
) {

  if (
    !Number.isFinite(value)
  ) {

    return "--";

  }


  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(value);

}


/**
 * Obtém a cotação do par.
 *
 * Para comprar moeda estrangeira:
 * BRL -> EUR/USD usa ASK.
 *
 * Para vender moeda estrangeira:
 * EUR/USD -> BRL usa BID.
 */
function getConversionRate(
  rates
) {

  if (
    fromCurrency === "BRL" &&
    toCurrency === "EUR"
  ) {

    return rates.EUR.ask;

  }


  if (
    fromCurrency === "BRL" &&
    toCurrency === "USD"
  ) {

    return rates.USD.ask;

  }


  if (
    fromCurrency === "EUR" &&
    toCurrency === "BRL"
  ) {

    return rates.EUR.bid;

  }


  if (
    fromCurrency === "USD" &&
    toCurrency === "BRL"
  ) {

    return rates.USD.bid;

  }


  throw new Error(
    "Par de moedas não suportado."
  );

}


/**
 * Atualiza os textos das moedas.
 */
function updateCurrencyLabels() {

  const from =
    currencyInfo[fromCurrency];

  const to =
    currencyInfo[toCurrency];


  document.getElementById(
    "calculator-from"
  ).textContent =
    `${from.flag} ${fromCurrency}`;


  document.getElementById(
    "calculator-to"
  ).textContent =
    `${to.flag} ${toCurrency}`;

}


/**
 * Calcula a conversão.
 */
export async function updateCalculator() {

  const amountElement =
    document.getElementById(
      "calculator-amount"
    );


  const resultElement =
    document.getElementById(
      "calculator-result"
    );


  const rateElement =
    document.getElementById(
      "calculator-rate"
    );


  const amount =
    Number(
      amountElement.value
    );


  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {

    resultElement.textContent =
      "--";

    rateElement.textContent =
      "Cotação: --";

    return;

  }


  try {

    const rates =
      await getCurrentMarketRates();


    const rate =
      getConversionRate(
        rates
      );


    const result =
      fromCurrency === "BRL"
        ? amount / rate
        : amount * rate;


    resultElement.textContent =
      formatCurrency(
        result,
        toCurrency
      );


    rateElement.textContent =
      `Cotação: ${formatCurrency(rate, "BRL")}`;


  } catch (error) {

    console.error(
      "Calculator:",
      error
    );


    resultElement.textContent =
      "--";

    rateElement.textContent =
      "Cotação indisponível";

  }

}


/**
 * Inverte as moedas.
 */
function swapCurrencies() {

  const oldFrom =
    fromCurrency;


  fromCurrency =
    toCurrency;


  toCurrency =
    oldFrom;


  updateCurrencyLabels();

  updateCalculator();

}


/**
 * Inicializa a calculadora.
 */
export function initCalculator() {

  const amount =
    document.getElementById(
      "calculator-amount"
    );


  const swap =
    document.getElementById(
      "calculator-swap"
    );


  if (!amount || !swap) {

    return;

  }


  if (!initialized) {

    amount.addEventListener(
      "input",
      updateCalculator
    );


    swap.addEventListener(
      "click",
      swapCurrencies
    );


    initialized = true;

  }


  updateCurrencyLabels();

  updateCalculator();

}