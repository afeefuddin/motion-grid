/**
 * Formats integer paise as rupees using Indian digit grouping.
 *
 * @param amountPaise monetary amount in integer paise
 * @returns an INR display value such as `₹1,50,000`
 */
export function formatInr(amountPaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amountPaise % 100 === 0 ? 0 : 2,
  }).format(amountPaise / 100);
}
