/*
 * Gera o som de alerta via Web Audio API.
 * Não precisa de arquivo externo.
 */
function playChime(urgent) {

  try {

    const ctx = new AudioContext();

    const notes = urgent
      ? [
          { freq: 440,  time: 0.00 },
          { freq: 554,  time: 0.14 },
          { freq: 440,  time: 0.28 },
          { freq: 554,  time: 0.42 },
          { freq: 659,  time: 0.56 }
        ]
      : [
          { freq: 523,  time: 0.00 },
          { freq: 659,  time: 0.18 },
          { freq: 784,  time: 0.36 }
        ];


    notes.forEach(({ freq, time }) => {

      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, ctx.currentTime + time);
      gain.gain.linearRampToValueAtTime(
        0.35,
        ctx.currentTime + time + 0.02
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + time + 0.55
      );

      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + 0.60);

    });

  } catch (err) {

    console.log("Currency Radar - audio:", err.message);

  }

}


/*
 * Número no formato brasileiro, igual ao popup.
 */
function br(value, decimals = 2) {
  return value.toFixed(decimals).replace(".", ",");
}


const params   = new URLSearchParams(location.search);
const type     = params.get("type")     || "hit";
const currency = params.get("currency") || "";
const rate     = Number(params.get("rate"));
const target   = Number(params.get("target"));

const iconEl    = document.getElementById("alert-icon");
const pairEl    = document.getElementById("alert-pair");
const rateEl    = document.getElementById("alert-rate");
const messageEl = document.getElementById("alert-message");
const closeBtn  = document.getElementById("close-btn");
const root      = document.documentElement;

pairEl.textContent = `${currency} / BRL`;
rateEl.textContent = `R$ ${br(rate, 4)}`;

if (type === "abrupt") {

  iconEl.textContent = "🚨";
  root.style.setProperty("--bg-base",  "#e8f8ff");
  root.style.setProperty("--bg-flash", "#00e5ff");
  root.style.setProperty("--accent",   "#0057ff");

  const drop = br(target - rate);
  messageEl.textContent =
    `Queda abrupta! Cotação caiu R$ ${drop} abaixo da sua ` +
    `meta de R$ ${br(target)}.`;

  document.title = "🚨 Queda abrupta — Currency Radar";

  playChime(true);


} else if (type === "drop") {

  /*
   * Queda forte sem relação com a meta: o preço
   * ainda não chegou onde o usuário quer, mas o
   * movimento é grande o bastante para valer uma
   * olhada — pode não continuar caindo.
   */
  iconEl.textContent = "📉";
  root.style.setProperty("--bg-base",  "#f2f7ff");
  root.style.setProperty("--bg-flash", "#93c2ff");
  root.style.setProperty("--accent",   "#1c4fd8");

  const change =
    br(Math.abs(Number(params.get("change")) || 0));

  messageEl.textContent =
    `Queda de ${change}% hoje. Ainda acima da sua meta ` +
    `de R$ ${br(target)}, mas é um movimento forte — ` +
    `pode ser hora de olhar.`;

  document.title = "📉 Queda forte — Currency Radar";

  playChime(false);


} else if (type === "proximity") {

  iconEl.textContent = "🟡";
  root.style.setProperty("--bg-base",  "#fffef0");
  root.style.setProperty("--bg-flash", "#fff176");
  root.style.setProperty("--accent",   "#c79000");

  const diff = br(rate - target, 4);
  messageEl.textContent =
    `Próxima da sua meta! Faltam R$ ${diff} ` +
    `para atingir R$ ${br(target)}.`;

  document.title = "🟡 Cotação próxima — Currency Radar";

  playChime(false);


} else {

  iconEl.textContent = "🟢";

  messageEl.textContent =
    `Sua meta de R$ ${br(target)} foi atingida. ` +
    `Boa hora para comprar!`;

  document.title = "🟢 Meta atingida — Currency Radar";

  playChime(false);

}

closeBtn.addEventListener("click", () => window.close());


/*
 * Alterna o título da aba para chamar atenção
 * quando o Chrome estiver minimizado ou em outra aba.
 */
let titleFlash = false;
const baseTitle = document.title;

setInterval(() => {

  document.title = titleFlash ? baseTitle : "🔔 🔔 🔔";
  titleFlash = !titleFlash;

}, 800);
