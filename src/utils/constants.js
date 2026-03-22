export const ROUTES = {
  DASHBOARD: '/',
  PRODUCTION: '/production',
  INCOME: '/income',
  SALARY: '/salary',
  GEXP: '/g-exp',
  THREAD: '/thread',
  LEDGER: '/ledger',
  SALARY_SHEET: '/salary-sheet',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
};

export const OPERATORS = ['Operator A', 'Operator B', 'Operator C', 'Operator D'];

export const INCOME_CATEGORIES = ['Sales', 'Service', 'Investment', 'Freelance', 'Other'];
export const EXPENSE_CATEGORIES = ['Utilities', 'Rent', 'Supplies', 'Salaries', 'Marketing', 'Transport', 'Other'];

export const STORAGE_KEYS = {
  GEXP: 'wd_gexp',
  THREAD: 'wd_thread',
  LEDGER: 'wd_ledger',
  SALARY_SHEET: 'wd_salary_sheet',
  THEME: 'wd_theme',
  PRODUCTION: 'wd_production',
  INCOME: 'wd_income',
  PARTIES: 'wd_parties',
  SALARY: 'wd_salary',
  SETTINGS: 'wd_settings',
  USERS: 'wd_users',
  CURRENT_USER: 'wd_current_user',
};

export const generateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
