import { getCurrentMarketRates } from "../currentRates.js";
import { getSixMonthHistory } from "../exchangeRate.js";


let fromCurrency = "BRL";
let toCurrency = "EUR";

let initialized = false;
let lastRates = null;

let historyCache = { EUR: null, USD: null };
let currentPeriodMonths = 1;
let hoverX = null;
let chartAnimFrame = null;


const currencyInfo = {

  BRL: { flag: "🇧🇷" },
  EUR: { flag: "🇪🇺" },
  USD: { flag: "🇺🇸" }

};


// ─── Formatadores ────────────────────────────────────────────────────────────

function formatCurrency(value, currency) {

  if (!Number.isFinite(value)) {
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


// ─── Gráfico ─────────────────────────────────────────────────────────────────

function filterByPeriod(history, months) {

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  return history.filter(d => d.date >= cutoffStr);

}


function drawChart(canvas, history, currentRate) {

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.offsetWidth || 302;
  const cssH = 150;

  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.height = cssH + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);


  const data = filterByPeriod(history, currentPeriodMonths);

  if (data.length < 2) {
    return;
  }


  const PAD = { left: 44, right: 10, top: 10, bottom: 26 };
  const W = cssW - PAD.left - PAD.right;
  const H = cssH - PAD.top - PAD.bottom;


  const rates = data.map(d => d.rate);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const rawRange = maxRate - minRate || 0.01;

  /*
   * 5% de margem vertical para a linha
   * não ficar colada nas bordas.
   */
  const yPad = rawRange * 0.08;
  const yMin = minRate - yPad;
  const yMax = maxRate + yPad;
  const yRange = yMax - yMin;


  const xPos = i => PAD.left + (i / (data.length - 1)) * W;
  const yPos = r => PAD.top + (1 - (r - yMin) / yRange) * H;


  /*
   * Grid + labels do eixo Y.
   */
  const ySteps = 3;
  for (let i = 0; i <= ySteps; i++) {

    const r = yMin + (i / ySteps) * yRange;
    const y = yPos(r);

    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + W, y);
    ctx.stroke();

    ctx.fillStyle = "#bbb";
    ctx.font = "9px Arial";
    ctx.textAlign = "right";
    ctx.fillText(r.toFixed(2), PAD.left - 4, y + 3);

  }


  /*
   * Reutiliza o path da linha para o fill
   * e para o stroke (evita desenhar duas vezes
   * percorrendo o array).
   */
  function buildLinePath() {
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = xPos(i);
      const y = yPos(d.rate);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
  }


  /*
   * Preenchimento com gradiente abaixo da linha.
   */
  const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + H);
  grad.addColorStop(0, "rgba(0, 87, 255, 0.18)");
  grad.addColorStop(1, "rgba(0, 87, 255, 0)");

  buildLinePath();
  ctx.lineTo(xPos(data.length - 1), PAD.top + H);
  ctx.lineTo(xPos(0), PAD.top + H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();


  /*
   * Linha.
   */
  buildLinePath();
  ctx.strokeStyle = "#0057ff";
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.stroke();


  /*
   * Linha tracejada da cotação atual.
   */
  if (Number.isFinite(currentRate)) {

    const y = yPos(currentRate);

    if (y >= PAD.top && y <= PAD.top + H) {

      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = "#00aa44";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + W, y);
      ctx.stroke();
      ctx.restore();

    }

  }


  /*
   * Labels do eixo X: início, meio e fim.
   */
  [0, Math.floor(data.length / 2), data.length - 1].forEach(idx => {

    const x = xPos(idx);
    const [year, month, day] = data[idx].date.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

    ctx.fillStyle = "#bbb";
    ctx.font = "9px Arial";
    ctx.textAlign = "center";
    ctx.fillText(label, x, PAD.top + H + 16);

  });


  /*
   * Hover: crosshair + dot + tooltip.
   */
  if (hoverX !== null) {

    const relX = hoverX - PAD.left;

    if (relX >= 0 && relX <= W) {

      const idx = Math.max(
        0,
        Math.min(
          data.length - 1,
          Math.round((relX / W) * (data.length - 1))
        )
      );

      const x = xPos(idx);
      const y = yPos(data[idx].rate);


      ctx.strokeStyle = "#ddd";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, PAD.top + H);
      ctx.stroke();


      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#0057ff";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();


      const dateStr = data[idx].date;
      const rateStr = data[idx].rate.toFixed(4);
      const text = `${dateStr}   R$ ${rateStr}`;

      ctx.font = "bold 10px Arial";
      const tW = ctx.measureText(text).width + 14;
      const tH = 20;
      let tX = x - tW / 2;
      const tY = PAD.top + 4;

      tX = Math.max(PAD.left, Math.min(PAD.left + W - tW, tX));

      ctx.fillStyle = "rgba(30, 30, 30, 0.88)";
      ctx.beginPath();
      ctx.roundRect(tX, tY, tW, tH, 4);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.textAlign = "left";
      ctx.fillText(text, tX + 7, tY + 13);

    }

  }

}


function scheduleChartDraw() {

  if (chartAnimFrame) {
    cancelAnimationFrame(chartAnimFrame);
  }

  chartAnimFrame = requestAnimationFrame(() => {

    const canvas = document.getElementById("rate-chart");
    if (!canvas) return;

    const currency = getForeignCurrency();
    const data = historyCache[currency];
    if (!data) return;

    const currentRate = lastRates?.[currency]?.ask ?? null;

    drawChart(canvas, data, currentRate);

  });

}


function showChartLoading(canvas) {

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.offsetWidth || 302;
  const cssH = 150;

  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.height = cssH + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  ctx.fillStyle = "#ccc";
  ctx.font = "11px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Carregando...", cssW / 2, 78);

}


// ─── Dados do gráfico ─────────────────────────────────────────────────────────

function getForeignCurrency() {
  return fromCurrency === "BRL" ? toCurrency : fromCurrency;
}


async function loadChartData() {

  const currency = getForeignCurrency();

  if (historyCache[currency]) {
    scheduleChartDraw();
    return;
  }

  const canvas = document.getElementById("rate-chart");
  if (canvas) {
    showChartLoading(canvas);
  }

  try {

    const history = await getSixMonthHistory(currency, "BRL");
    historyCache[currency] = history;
    scheduleChartDraw();

  } catch (err) {

    console.error("Currency Radar - Chart:", err);

  }

}


function updateChartPairLabel() {

  const label = document.getElementById("chart-pair-label");
  if (label) {
    label.textContent = `${getForeignCurrency()} / BRL`;
  }

}


// ─── Conversão ───────────────────────────────────────────────────────────────

function getConversionRate(rates) {

  if (fromCurrency === "BRL" && toCurrency === "EUR") return rates.EUR.ask;
  if (fromCurrency === "BRL" && toCurrency === "USD") return rates.USD.ask;
  if (fromCurrency === "EUR" && toCurrency === "BRL") return rates.EUR.bid;
  if (fromCurrency === "USD" && toCurrency === "BRL") return rates.USD.bid;

  throw new Error("Par de moedas não suportado.");

}


function updateCurrencyLabels() {

  const from = currencyInfo[fromCurrency];
  const to = currencyInfo[toCurrency];

  document.getElementById("calculator-from").textContent =
    `${from.flag} ${fromCurrency}`;

  document.getElementById("calculator-to").textContent =
    `${to.flag} ${toCurrency}`;

}


export async function updateCalculator() {

  const amountEl = document.getElementById("calculator-amount");
  const resultEl = document.getElementById("calculator-result");
  const rateEl = document.getElementById("calculator-rate");

  const amount = Number(amountEl.value);

  if (!Number.isFinite(amount) || amount < 0) {
    resultEl.textContent = "--";
    rateEl.textContent = "Cotação: --";
    return;
  }

  try {

    const rates = await getCurrentMarketRates();
    lastRates = rates;

    const rate = getConversionRate(rates);
    const result = fromCurrency === "BRL" ? amount / rate : amount * rate;

    resultEl.textContent = formatCurrency(result, toCurrency);
    rateEl.textContent = `Cotação: ${formatCurrency(rate, "BRL")}`;

    scheduleChartDraw();

  } catch (err) {

    console.error("Calculator:", err);

    resultEl.textContent = "--";
    rateEl.textContent = "Cotação indisponível";

  }

}


function swapCurrencies() {

  const prevForeign = getForeignCurrency();

  const tmp = fromCurrency;
  fromCurrency = toCurrency;
  toCurrency = tmp;

  updateCurrencyLabels();
  updateCalculator();

  /*
   * A moeda estrangeira não muda ao inverter
   * a direção (EUR/BRL → BRL/EUR), então o
   * histórico e o gráfico continuam válidos.
   */
  if (getForeignCurrency() !== prevForeign) {
    updateChartPairLabel();
    loadChartData();
  }

}


function toggleForeignCurrency() {

  /*
   * Alterna o par entre EUR e USD
   * sem mudar a direção (BRL→X ou X→BRL).
   */
  const newForeign = getForeignCurrency() === "EUR" ? "USD" : "EUR";

  if (fromCurrency === "BRL") {
    toCurrency = newForeign;
  } else {
    fromCurrency = newForeign;
  }

  updateCurrencyLabels();
  updateChartPairLabel();
  loadChartData();
  updateCalculator();

}


// ─── Inicialização ────────────────────────────────────────────────────────────

function initChartListeners(canvas) {

  canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    hoverX = e.clientX - rect.left;
    scheduleChartDraw();
  });

  canvas.addEventListener("mouseleave", () => {
    hoverX = null;
    scheduleChartDraw();
  });

  document.querySelectorAll(".period-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentPeriodMonths = Number(btn.dataset.period);
      scheduleChartDraw();
    });
  });

}


export function initCalculator() {

  if (initialized) {
    updateCurrencyLabels();
    updateChartPairLabel();
    scheduleChartDraw();
    updateCalculator();
    return;
  }

  const amount = document.getElementById("calculator-amount");
  const swap = document.getElementById("calculator-swap");
  const fromBtn = document.getElementById("calculator-from");
  const toBtn = document.getElementById("calculator-to");
  const canvas = document.getElementById("rate-chart");

  if (!amount || !swap || !canvas) {
    return;
  }

  amount.addEventListener("input", updateCalculator);
  swap.addEventListener("click", swapCurrencies);
  fromBtn.addEventListener("click", toggleForeignCurrency);
  toBtn.addEventListener("click", toggleForeignCurrency);

  initChartListeners(canvas);

  initialized = true;

  updateCurrencyLabels();
  updateChartPairLabel();
  loadChartData();
  updateCalculator();

}
