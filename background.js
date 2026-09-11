const ALARM_NAME = "checkRates";
const INTERVAL_MINUTES = 30;

const API_URL =
  "https://economia.awesomeapi.com.br/json/last";

const PROXIMITY_MARGIN = 0.03;
const PROXIMITY_COOLDOWN_HOURS = 6;


chrome.runtime.onInstalled.addListener(() => {

  chrome.alarms.create(
    ALARM_NAME,
    { periodInMinutes: INTERVAL_MINUTES }
  );

});


chrome.runtime.onStartup.addListener(() => {

  checkAlerts();

});


chrome.alarms.onAlarm.addListener(alarm => {

  if (alarm.name === ALARM_NAME) {
    checkAlerts();
  }

});


chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.type === "checkNow") {

    checkAlerts().then(() => sendResponse({ done: true }));

    return true;

  }

});


/*
 * Abre uma aba com animação de flash — comportamento
 * igual a sites de Pomodoro. Quando o Chrome estiver
 * minimizado, a barra de tarefas também pisca.
 */
function openAlertTab(type, currency, rate, targetPrice) {

  const query = new URLSearchParams({
    type,
    currency,
    rate:   rate.toFixed(4),
    target: targetPrice.toFixed(2)
  });

  chrome.tabs.create({
    url: chrome.runtime.getURL(`alert.html?${query}`)
  });

}


async function checkAlerts() {

  const storage =
    await chrome.storage.local.get(["alerts"]);

  const alerts = storage.alerts || {};


  const activeEntries =
    Object.entries(alerts).filter(
      ([, a]) => a.active
    );


  if (activeEntries.length === 0) {
    return;
  }


  const pairs =
    activeEntries
      .map(([currency]) => `${currency}-BRL`)
      .join(",");


  try {

    const res = await fetch(`${API_URL}/${pairs}`);

    if (!res.ok) {
      return;
    }

    const data = await res.json();

    let changed = false;


    for (const [currency, alert] of activeEntries) {

      const rate =
        Number(data[`${currency}BRL`]?.ask);

      if (!Number.isFinite(rate) || rate <= 0) {
        continue;
      }


      if (rate <= alert.targetPrice) {

        /*
         * META ATINGIDA.
         * Queda >= R$ 0,10 abaixo da meta = abrupta.
         */
        const drop = alert.targetPrice - rate;
        const type = drop >= 0.10 ? "abrupt" : "hit";

        openAlertTab(type, currency, rate, alert.targetPrice);


        alerts[currency] = {
          ...alert,
          active: false,
          triggeredAt: new Date().toISOString(),
          triggeredRate: rate
        };

        changed = true;


      } else if (rate <= alert.targetPrice + PROXIMITY_MARGIN) {

        /*
         * ZONA DE PROXIMIDADE.
         * Abre a aba de alerta uma vez por período de cooldown.
         */
        const now = Date.now();

        const lastMs = alert.proximityNotifiedAt
          ? new Date(alert.proximityNotifiedAt).getTime()
          : 0;

        const hoursSince = (now - lastMs) / 3_600_000;


        if (hoursSince >= PROXIMITY_COOLDOWN_HOURS) {

          openAlertTab("proximity", currency, rate, alert.targetPrice);


          alerts[currency] = {
            ...alert,
            proximityNotifiedAt: new Date().toISOString(),
            proximityRate: rate
          };

          changed = true;

        }

      }

    }


    if (changed) {
      await chrome.storage.local.set({ alerts });
    }


  } catch (err) {

    console.error("Currency Radar - checkAlerts:", err);

  }

}
