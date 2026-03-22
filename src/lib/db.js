import { supabase, supabaseAdmin } from './supabase';

// ─── Helpers ───
export const fetchHelpers = async (userId) => {
  const { data } = await supabase.from('helpers').select('*').eq('user_id', userId).order('created_at');
  return data || [];
};
export const insertHelper = async (userId, name) => {
  const { data, error } = await supabase.from('helpers').insert({ user_id: userId, name }).select().single();
  if (error) throw error;
  return data;
};
export const removeHelper = async (id) => {
  await supabase.from('helpers').delete().eq('id', id);
};

// ─── Operators ───
export const fetchOperators = async (userId) => {
  const { data } = await supabase.from('operators').select('*').eq('user_id', userId).order('created_at');
  return data || [];
};
export const insertOperator = async (userId, op) => {
  const { data, error } = await supabase.from('operators').insert({ user_id: userId, name: op.name, machine: op.machine, head: op.head, default_helper_id: op.defaultHelperId }).select().single();
  if (error) throw error;
  return data;
};
export const removeOperator = async (id) => {
  await supabase.from('operators').delete().eq('id', id);
};

// ─── Production Sheets ───
export const fetchSheets = async (userId) => {
  const { data: sheets } = await supabase.from('production_sheets').select('*, production_day_entries(*)').eq('user_id', userId).order('created_at');
  // Convert day entries array to days object
  return (sheets || []).map(s => {
    const days = {};
    (s.production_day_entries || []).forEach(de => {
      days[String(de.day)] = {
        production: de.production, useDefaultHelper: de.use_default_helper,
        extraHelperId: de.extra_helper_id, type: de.type, rate: de.rate,
        substituteOperatorId: de.substitute_operator_id,
      };
    });
    return { id: s.id, userId: s.user_id, month: s.month, operatorId: s.operator_id, machine: s.machine, days };
  });
};
export const insertSheet = async (userId, sheet) => {
  const { data, error } = await supabase.from('production_sheets').insert({
    user_id: userId, month: sheet.month, operator_id: sheet.operatorId, machine: sheet.machine
  }).select().single();
  if (error) throw error;
  return data;
};
export const upsertDayEntry = async (sheetId, day, entry) => {
  const { error } = await supabase.from('production_day_entries').upsert({
    sheet_id: sheetId, day,
    production: entry.production, use_default_helper: entry.useDefaultHelper,
    extra_helper_id: entry.extraHelperId || null, type: entry.type, rate: entry.rate,
    substitute_operator_id: entry.substituteOperatorId || null,
  }, { onConflict: 'sheet_id,day' });
  if (error) throw error;
};
export const removeDayEntry = async (sheetId, day) => {
  await supabase.from('production_day_entries').delete().eq('sheet_id', sheetId).eq('day', day);
};
export const removeSheet = async (id) => {
  await supabase.from('production_sheets').delete().eq('id', id);
};

// ─── Parties ───
export const fetchParties = async () => {
  const { data } = await supabase.from('parties').select('*').order('created_at');
  return data || [];
};
export const insertParty = async (name) => {
  const { data, error } = await supabase.from('parties').insert({ name }).select().single();
  if (error) throw error;
  return data;
};
export const removeParty = async (id) => {
  await supabase.from('parties').delete().eq('id', id);
};

// ─── Articles ───
export const fetchArticles = async (userId) => {
  const { data } = await supabase.from('articles').select('*, article_components(*)').eq('user_id', userId).order('created_at', { ascending: false });
  return (data || []).map(a => ({
    id: a.id, userId: a.user_id, partyId: a.party_id, articleName: a.article_name,
    machineHead: a.machine_head, avgProduction: a.avg_production, status: a.status, date: a.date,
    components: (a.article_components || []).sort((x, y) => x.sort_order - y.sort_order).map(c => ({
      id: c.id, componentName: c.name, stitch: c.stitch, qtyOrMeter: c.qty_or_meter,
      value: c.value, type: c.type,
    })),
  }));
};
export const insertArticle = async (userId, article) => {
  const { data: a, error } = await supabase.from('articles').insert({
    user_id: userId, party_id: article.partyId, article_name: article.articleName,
    machine_head: article.machineHead, avg_production: article.avgProduction || 0,
    status: article.status || 'pending', date: article.date,
  }).select().single();
  if (error) throw error;
  // Insert components
  if (article.components?.length > 0) {
    const comps = article.components.map((c, i) => ({
      article_id: a.id, name: c.componentName, stitch: c.stitch || 0,
      qty_or_meter: c.qtyOrMeter, value: c.value || 0, type: c.type, sort_order: i,
    }));
    await supabase.from('article_components').insert(comps);
  }
  return a;
};
export const updateArticle = async (article) => {
  await supabase.from('articles').update({
    party_id: article.partyId, article_name: article.articleName,
    machine_head: article.machineHead, avg_production: article.avgProduction || 0,
    status: article.status, date: article.date,
  }).eq('id', article.id);
  // Replace components
  await supabase.from('article_components').delete().eq('article_id', article.id);
  if (article.components?.length > 0) {
    const comps = article.components.map((c, i) => ({
      article_id: article.id, name: c.componentName, stitch: c.stitch || 0,
      qty_or_meter: c.qtyOrMeter, value: c.value || 0, type: c.type, sort_order: i,
    }));
    await supabase.from('article_components').insert(comps);
  }
};
export const removeArticle = async (id) => {
  await supabase.from('articles').delete().eq('id', id);
};

// ─── Salary Overrides ───
export const fetchSalaryOverrides = async (userId) => {
  const { data } = await supabase.from('salary_overrides').select('*').eq('user_id', userId);
  const map = {};
  (data || []).forEach(o => { map[`${o.user_id}_${o.operator_id}_${o.month}_${o.day}`] = { production: o.production, description: o.description }; });
  return map;
};
export const upsertSalaryOverride = async (userId, operatorId, month, day, overrideData) => {
  await supabase.from('salary_overrides').upsert({
    user_id: userId, operator_id: operatorId, month, day,
    production: overrideData.production, description: overrideData.description,
  }, { onConflict: 'user_id,operator_id,month,day' });
};
export const removeSalaryOverride = async (userId, operatorId, month, day) => {
  await supabase.from('salary_overrides').delete().eq('user_id', userId).eq('operator_id', operatorId).eq('month', month).eq('day', day);
};

// ─── G-Exp ───
export const fetchGexpEntries = async (userId) => {
  const { data } = await supabase.from('gexp_entries').select('*').eq('user_id', userId).order('date').order('sort_order');
  return (data || []).map(e => ({ id: e.id, userId: e.user_id, date: e.date, component: e.component, debit: e.debit, credit: e.credit, order: e.sort_order }));
};
export const insertGexpEntry = async (userId, entry) => {
  const { data, error } = await supabase.from('gexp_entries').insert({
    user_id: userId, date: entry.date, component: entry.component, debit: entry.debit || 0, credit: entry.credit || 0, sort_order: entry.order || 0,
  }).select().single();
  if (error) throw error;
  return data;
};
export const updateGexpEntry = async (id, entry) => {
  await supabase.from('gexp_entries').update({ date: entry.date, component: entry.component, debit: entry.debit || 0, credit: entry.credit || 0 }).eq('id', id);
};
export const removeGexpEntry = async (id) => {
  await supabase.from('gexp_entries').delete().eq('id', id);
};

// ─── Thread ───
export const fetchThreadAccounts = async (userId) => {
  const { data } = await supabase.from('thread_accounts').select('*').eq('user_id', userId).order('created_at');
  return data || [];
};
export const insertThreadAccount = async (userId, name) => {
  const { data, error } = await supabase.from('thread_accounts').insert({ user_id: userId, name }).select().single();
  if (error) throw error;
  return data;
};
export const removeThreadAccount = async (id) => {
  await supabase.from('thread_accounts').delete().eq('id', id);
};
export const fetchThreadEntries = async (userId) => {
  const { data } = await supabase.from('thread_entries').select('*').eq('user_id', userId).order('date').order('sort_order');
  return (data || []).map(e => ({ id: e.id, userId: e.user_id, accountId: e.account_id, date: e.date, description: e.description, amount: e.amount, pay: e.pay, order: e.sort_order }));
};
export const insertThreadEntry = async (userId, entry) => {
  const { data, error } = await supabase.from('thread_entries').insert({
    user_id: userId, account_id: entry.accountId, date: entry.date, description: entry.description, amount: entry.amount || 0, pay: entry.pay || 0, sort_order: entry.order || 0,
  }).select().single();
  if (error) throw error;
  return data;
};
export const updateThreadEntry = async (id, entry) => {
  await supabase.from('thread_entries').update({ date: entry.date, description: entry.description, amount: entry.amount || 0, pay: entry.pay || 0 }).eq('id', id);
};
export const removeThreadEntry = async (id) => {
  await supabase.from('thread_entries').delete().eq('id', id);
};

// ─── Ledger ───
export const fetchLedgerAccounts = async (userId) => {
  const { data } = await supabase.from('ledger_accounts').select('*').eq('user_id', userId).order('created_at');
  return data || [];
};
export const insertLedgerAccount = async (userId, name) => {
  const { data, error } = await supabase.from('ledger_accounts').insert({ user_id: userId, name }).select().single();
  if (error) throw error;
  return data;
};
export const removeLedgerAccount = async (id) => {
  await supabase.from('ledger_accounts').delete().eq('id', id);
};
export const fetchLedgerEntries = async (userId) => {
  const { data } = await supabase.from('ledger_entries').select('*').eq('user_id', userId).order('date').order('sort_order');
  return (data || []).map(e => ({ id: e.id, userId: e.user_id, accountId: e.account_id, date: e.date, description: e.description, debit: e.debit, credit: e.credit, order: e.sort_order }));
};
export const insertLedgerEntry = async (userId, entry) => {
  const { data, error } = await supabase.from('ledger_entries').insert({
    user_id: userId, account_id: entry.accountId, date: entry.date, description: entry.description, debit: entry.debit || 0, credit: entry.credit || 0, sort_order: entry.order || 0,
  }).select().single();
  if (error) throw error;
  return data;
};
export const updateLedgerEntry = async (id, entry) => {
  await supabase.from('ledger_entries').update({ date: entry.date, description: entry.description, debit: entry.debit || 0, credit: entry.credit || 0 }).eq('id', id);
};
export const removeLedgerEntry = async (id) => {
  await supabase.from('ledger_entries').delete().eq('id', id);
};

// ─── Workers ───
export const fetchWorkers = async (userId) => {
  const { data } = await supabase.from('workers').select('*').eq('user_id', userId).order('created_at');
  return data || [];
};
export const insertWorker = async (userId, name) => {
  const { data, error } = await supabase.from('workers').insert({ user_id: userId, name }).select().single();
  if (error) throw error;
  return data;
};
export const removeWorker = async (id) => {
  await supabase.from('workers').delete().eq('id', id);
};

// ─── Worker Salary ───
export const fetchWorkerSalaryEntries = async (userId) => {
  const { data } = await supabase.from('worker_salary_entries').select('*').eq('user_id', userId).order('date');
  return (data || []).map(e => ({ id: e.id, userId: e.user_id, workerId: e.worker_id, date: e.date, description: e.description, amount: e.amount }));
};
export const insertWorkerSalaryEntry = async (userId, entry) => {
  const { data, error } = await supabase.from('worker_salary_entries').insert({
    user_id: userId, worker_id: entry.workerId, date: entry.date, description: entry.description, amount: entry.amount,
  }).select().single();
  if (error) throw error;
  return data;
};
export const updateWorkerSalaryEntry = async (id, entry) => {
  await supabase.from('worker_salary_entries').update({ date: entry.date, description: entry.description, amount: entry.amount }).eq('id', id);
};
export const removeWorkerSalaryEntry = async (id) => {
  await supabase.from('worker_salary_entries').delete().eq('id', id);
};

// ─── Advances ───
export const fetchAdvances = async (userId) => {
  const { data } = await supabase.from('advances').select('*').eq('user_id', userId).order('date');
  return (data || []).map(a => ({ id: a.id, userId: a.user_id, personId: a.person_id, personType: a.person_type, date: a.date, description: a.description, amount: a.amount }));
};
export const insertAdvance = async (userId, adv) => {
  const { data, error } = await supabase.from('advances').insert({
    user_id: userId, person_id: adv.personId, person_type: adv.personType, date: adv.date, description: adv.description, amount: adv.amount,
  }).select().single();
  if (error) throw error;
  return data;
};
export const removeAdvance = async (id) => {
  await supabase.from('advances').delete().eq('id', id);
};

// ─── Analytics Goals ───
export const fetchGoal = async (userId, month) => {
  const { data } = await supabase.from('analytics_goals').select('*').eq('user_id', userId).eq('month', month).single();
  return data?.billing_goal || 0;
};
export const upsertGoal = async (userId, month, goal) => {
  await supabase.from('analytics_goals').upsert({ user_id: userId, month, billing_goal: goal }, { onConflict: 'user_id,month' });
};

// ─── User Settings (uses admin client to bypass RLS for cross-user access) ───
export const fetchSettings = async (userId) => {
  const { data } = await supabaseAdmin.from('user_settings').select('*').eq('user_id', userId).single();
  return data || { theme: 'light', settings: {} };
};
export const upsertSettings = async (userId, settings) => {
  await supabaseAdmin.from('user_settings').upsert({ user_id: userId, ...settings }, { onConflict: 'user_id' });
};
