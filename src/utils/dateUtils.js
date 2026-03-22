import { format, parseISO, subMonths } from 'date-fns';

export const formatDate = (dateStr) => {
  try { return format(parseISO(dateStr), 'MMM dd, yyyy'); } catch { return dateStr; }
};

export const currentMonthKey = () => format(new Date(), 'yyyy-MM');

export const todayStr = () => format(new Date(), 'yyyy-MM-dd');

export const getLastNMonths = (n) => {
  return Array.from({ length: n }, (_, i) => {
    const d = subMonths(new Date(), n - 1 - i);
    return format(d, 'yyyy-MM');
  });
};

export const isInMonth = (dateStr, monthKey) =>
  Boolean(dateStr && dateStr.startsWith(monthKey));
