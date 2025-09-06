

// This file provides a backwards-compatible wrapper around the
// canonical `cryptoRates` implementation. Some modules historically
// imported from `@/lib/exchangeRates` (default) and expected either
// a default object or named helpers — keep both to avoid build errors.

import * as cryptoRates from './cryptoRates';

const exchangeRates = {
  getRates: cryptoRates.getRates,
  updateRate: cryptoRates.updateRate,
  // keep old name for callers that used getExchangeRate
  getExchangeRate: (fromCurrency: string, toCurrency: string) => {
    return cryptoRates.getRateValue(fromCurrency, toCurrency);
  },
};

// Re-export types and helpers for compatibility
export type { ExchangeRate, Rates } from './cryptoRates';
export const getRateValue = cryptoRates.getRateValue;
export const getRates = cryptoRates.getRates;
export const updateRate = cryptoRates.updateRate;
export function getExchangeRate(fromCurrency: string, toCurrency: string) {
  return cryptoRates.getRateValue(fromCurrency, toCurrency);
}

export default exchangeRates;
