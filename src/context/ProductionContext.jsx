import { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
import { useAuth } from './AuthContext';
import { currentMonthKey } from '../utils/dateUtils';
import * as db from '../lib/db';

const ProductionContext = createContext();

function reducer(state, action) {
  switch (action.type) {
    case 'SET_HELPERS': return { ...state, helpers: action.payload };
    case 'SET_OPERATORS': return { ...state, operators: action.payload };
    case 'SET_SHEETS': return { ...state, sheets: action.payload };
    case 'ADD_HELPER': return { ...state, helpers: [...state.helpers, action.payload] };
    case 'DELETE_HELPER': return { ...state, helpers: state.helpers.filter(h => h.id !== action.payload) };
    case 'ADD_OPERATOR': return { ...state, operators: [...state.operators, action.payload] };
    case 'DELETE_OPERATOR': return { ...state, operators: state.operators.filter(o => o.id !== action.payload) };
    case 'ADD_SHEET': return { ...state, sheets: [...state.sheets, action.payload] };
    case 'UPDATE_SHEET': return { ...state, sheets: state.sheets.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_SHEET': return { ...state, sheets: state.sheets.filter(s => s.id !== action.payload) };
    default: return state;
  }
}

const INITIAL = { helpers: [], operators: [], sheets: [] };

export function ProductionProvider({ children }) {
  const { currentUser, activeDataKey } = useAuth();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!activeDataKey) { dispatch({ type: 'SET_HELPERS', payload: [] }); dispatch({ type: 'SET_OPERATORS', payload: [] }); dispatch({ type: 'SET_SHEETS', payload: [] }); setLoading(false); return; }
    setLoading(true);
    const [helpers, operators, sheets] = await Promise.all([
      db.fetchHelpers(activeDataKey),
      db.fetchOperators(activeDataKey),
      db.fetchSheets(activeDataKey),
    ]);
    // Map DB fields to app fields
    dispatch({ type: 'SET_HELPERS', payload: helpers.map(h => ({ id: h.id, name: h.name, userId: h.user_id })) });
    dispatch({ type: 'SET_OPERATORS', payload: operators.map(o => ({ id: o.id, name: o.name, machine: o.machine, head: o.head, defaultHelperId: o.default_helper_id, userId: o.user_id })) });
    dispatch({ type: 'SET_SHEETS', payload: sheets });
    setLoading(false);
  }, [activeDataKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const helpers = state.helpers;
  const operators = state.operators;
  const sheets = state.sheets;
  const uid = activeDataKey;

  const addHelper = async (name) => {
    const h = await db.insertHelper(uid, name.trim());
    const mapped = { id: h.id, name: h.name, userId: h.user_id };
    dispatch({ type: 'ADD_HELPER', payload: mapped });
    return mapped;
  };
  const deleteHelper = async (id) => { await db.removeHelper(id); dispatch({ type: 'DELETE_HELPER', payload: id }); };
  const getHelperName = (id) => state.helpers.find(h => h.id === id)?.name || '-';

  const addOperator = async (data) => {
    const o = await db.insertOperator(uid, { name: data.name.trim(), machine: data.machine || 'M1', head: Number(data.head), defaultHelperId: data.defaultHelperId });
    const mapped = { id: o.id, name: o.name, machine: o.machine, head: o.head, defaultHelperId: o.default_helper_id, userId: o.user_id };
    dispatch({ type: 'ADD_OPERATOR', payload: mapped });
    // Auto-create sheet for current month
    const month = currentMonthKey();
    const s = await db.insertSheet(uid, { month, operatorId: o.id, machine: o.machine });
    dispatch({ type: 'ADD_SHEET', payload: { id: s.id, userId: s.user_id, month: s.month, operatorId: s.operator_id, machine: s.machine, days: {} } });
    return mapped;
  };
  const deleteOperator = async (id) => { await db.removeOperator(id); dispatch({ type: 'DELETE_OPERATOR', payload: id }); };
  const getOperator = (id) => state.operators.find(o => o.id === id);

  const ensureSheet = async (operatorId, month) => {
    const existing = state.sheets.find(s => s.operatorId === operatorId && s.month === month);
    if (existing) return existing;
    const op = state.operators.find(o => o.id === operatorId);
    const s = await db.insertSheet(uid, { month, operatorId, machine: op?.machine || 'M1' });
    const mapped = { id: s.id, userId: s.user_id, month: s.month, operatorId: s.operator_id, machine: s.machine, days: {} };
    dispatch({ type: 'ADD_SHEET', payload: mapped });
    return mapped;
  };

  const addDayEntry = async (operatorId, month, day, entry) => {
    let sheet = state.sheets.find(s => s.operatorId === operatorId && s.month === month);
    if (!sheet) {
      const op = state.operators.find(o => o.id === operatorId);
      const s = await db.insertSheet(uid, { month, operatorId, machine: op?.machine || 'M1' });
      sheet = { id: s.id, userId: s.user_id, month: s.month, operatorId: s.operator_id, machine: s.machine, days: {} };
      dispatch({ type: 'ADD_SHEET', payload: sheet });
    }
    await db.upsertDayEntry(sheet.id, day, entry);
    const updated = { ...sheet, days: { ...sheet.days, [String(day)]: entry } };
    dispatch({ type: 'UPDATE_SHEET', payload: updated });
  };

  const deleteDayEntry = async (sheetId, day) => {
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    await db.removeDayEntry(sheetId, day);
    const days = { ...sheet.days };
    delete days[String(day)];
    dispatch({ type: 'UPDATE_SHEET', payload: { ...sheet, days } });
  };

  const deleteSheet = async (id) => { await db.removeSheet(id); dispatch({ type: 'DELETE_SHEET', payload: id }); };

  const calcGenIncome = (production, head, type, rate, savedGenHead) => {
    let effectiveHead;
    if (savedGenHead != null) {
      effectiveHead = Number(savedGenHead);
    } else {
      const mh = Number(head);
      effectiveHead = mh;
      if (type === 'alternet') effectiveHead = mh / 2;
      else if (type === 'duble_alternet') effectiveHead = mh / 3;
    }
    return (Number(production) / 1000) * Number(rate) * effectiveHead;
  };

  return (
    <ProductionContext.Provider value={{
      helpers, operators, sheets, loading,
      addHelper, deleteHelper, getHelperName,
      addOperator, deleteOperator, getOperator,
      ensureSheet, addDayEntry, deleteDayEntry, deleteSheet,
      calcGenIncome, loadData,
    }}>
      {children}
    </ProductionContext.Provider>
  );
}

export const useProduction = () => useContext(ProductionContext);
