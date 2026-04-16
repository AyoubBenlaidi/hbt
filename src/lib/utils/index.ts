/**
 * Utility: String padding/formatting
 */
export const cn = (...classes: (string | undefined | boolean)[]): string => {
  return classes.filter(Boolean).join(" ");
};

/**
 * Format currency amounts
 */
export const formatCurrency = (amount: string | number, currency = "EUR"): string => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(num);
};

/**
 * Format date
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

/**
 * Validate numeric amounts
 */
export const isValidAmount = (amount: string): boolean => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
};
