const API_BASE =
  "https://economia.awesomeapi.com.br/json";


/**
 * Busca as cotações atuais de EUR/BRL e USD/BRL.
 *
 * Usamos o "ask" porque representa a cotação de venda
 * da moeda estrangeira, que é mais próxima do que interessa
 * para quem está comprando EUR ou USD com BRL.
 */
export async function getCurrentMarketRates() {

  const response = await fetch(
    `${API_BASE}/last/USD-BRL,EUR-BRL`
  );

  if (!response.ok) {
    throw new Error(
      `Erro HTTP ${response.status}`
    );
  }

  const data =
    await response.json();


  const usd =
    parseCurrency(data.USDBRL);

  const eur =
    parseCurrency(data.EURBRL);


  return {
    USD: usd,
    EUR: eur
  };
}


/**
 * Converte e valida os dados recebidos da API.
 */
function parseCurrency(data) {

  if (!data) {
    throw new Error(
      "Cotação não encontrada."
    );
  }


  const ask =
    Number(data.ask);

  const bid =
    Number(data.bid);

  const high =
    Number(data.high);

  const low =
    Number(data.low);

  const pctChange =
    Number(data.pctChange);


  if (
    !Number.isFinite(ask) ||
    ask <= 0
  ) {
    throw new Error(
      "Cotação ask inválida."
    );
  }


  return {

    rate: ask,

    bid:
      Number.isFinite(bid)
        ? bid
        : null,

    ask,

    high:
      Number.isFinite(high)
        ? high
        : null,

    low:
      Number.isFinite(low)
        ? low
        : null,

    pctChange:
      Number.isFinite(pctChange)
        ? pctChange
        : null,

    timestamp:
      data.timestamp,

    date:
      data.create_date,

    source:
      "AwesomeAPI"

  };

}