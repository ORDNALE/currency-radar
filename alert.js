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
rateEl.textContent = `R$ ${rate.toFixed(4)}`;

if (type === "abrupt") {

  iconEl.textContent = "🚨";
  root.style.setProperty("--bg-base",  "#e8f8ff");
  root.style.setProperty("--bg-flash", "#00e5ff");
  root.style.setProperty("--accent",   "#0057ff");

  const drop = (target - rate).toFixed(2);
  messageEl.textContent =
    `Queda abrupta! Cotação caiu R$ ${drop} abaixo da sua ` +
    `meta de R$ ${target.toFixed(2)}.`;

  document.title = "🚨 Queda abrupta — Currency Radar";

  playChime(true);


} else if (type === "proximity") {

  iconEl.textContent = "🟡";
  root.style.setProperty("--bg-base",  "#fffef0");
  root.style.setProperty("--bg-flash", "#fff176");
  root.style.setProperty("--accent",   "#c79000");

  const diff = (rate - target).toFixed(4);
  messageEl.textContent =
    `Próxima da sua meta! Faltam R$ ${diff} ` +
    `para atingir R$ ${target.toFixed(2)}.`;

  document.title = "🟡 Cotação próxima — Currency Radar";

  playChime(false);


} else {

  iconEl.textContent = "🟢";

  messageEl.textContent =
    `Sua meta de R$ ${target.toFixed(2)} foi atingida. ` +
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
