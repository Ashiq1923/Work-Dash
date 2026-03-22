import { createContext, useContext, useReducer, useEffect } from 'react';
import { STORAGE_KEYS, generateId } from '../utils/constants';
import { loadFromStorage, saveToStorage } from '../utils/storageUtils';
import { useAuth } from './AuthContext';
import { currentMonthKey } from '../utils/dateUtils';

const ProductionContext = createContext();

/*
  helpers:   [{ id, name, userId }]
  operators: [{ id, name, machine, head, defaultHelperId, userId }]
  sheets:    [{
    id, userId, month, operatorId, machine,
    days: {
      "1": { production, useDefaultHelper, extraHelperId, type, rate },
      "2": { ... },
    }
  }]
*/

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD': return action.payload;
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

  useEffect(() => {
    const saved = loadFromStorage(STORAGE_KEYS.PRODUCTION, INITIAL);
    dispatch({ type: 'LOAD', payload: { helpers: saved.helpers || [], operators: saved.operators || [], sheets: saved.sheets || [] } });
  }, []);

  useEffect(() => { saveToStorage(STORAGE_KEYS.PRODUCTION, state); }, [state]);

  const helpers = activeDataKey ? state.helpers.filter(h => h.userId === activeDataKey) : [];
  const operators = activeDataKey ? state.operators.filter(o => o.userId === activeDataKey) : [];
  const sheets = activeDataKey ? state.sheets.filter(s => s.userId === activeDataKey) : [];
  const uid = activeDataKey || currentUser?.name;

  const addHelper = (name) => {
    const h = { id: generateId(), name: name.trim(), userId: uid };
    dispatch({ type: 'ADD_HELPER', payload: h });
    return h;
  };
  const deleteHelper = (id) => dispatch({ type: 'DELETE_HELPER', payload: id });
  const getHelperName = (id) => state.helpers.find(h => h.id === id)?.name || '-';

  const addOperator = (data) => {
    const op = { id: generateId(), name: data.name.trim(), machine: data.machine || 'M1', head: Number(data.head), defaultHelperId: data.defaultHelperId, userId: uid };
    dispatch({ type: 'ADD_OPERATOR', payload: op });
    // Auto-create sheet for current month
    const month = currentMonthKey();
    const sheet = { id: generateId(), userId: uid, month, operatorId: op.id, machine: op.machine, days: {} };
    dispatch({ type: 'ADD_SHEET', payload: sheet });
    return op;
  };
  const deleteOperator = (id) => dispatch({ type: 'DELETE_OPERATOR', payload: id });
  const getOperator = (id) => state.operators.find(o => o.id === id);

  // Ensure sheet exists for operator+month
  const ensureSheet = (operatorId, month) => {
    const existing = state.sheets.find(s => s.userId === uid && s.operatorId === operatorId && s.month === month);
    if (existing) return existing;
    const op = state.operators.find(o => o.id === operatorId);
    const sheet = { id: generateId(), userId: uid, month, operatorId, machine: op?.machine || 'M1', days: {} };
    dispatch({ type: 'ADD_SHEET', payload: sheet });
    return sheet;
  };

  // Add/update a day entry in a sheet
  const addDayEntry = (operatorId, month, day, entry) => {
    let sheet = state.sheets.find(s => s.userId === uid && s.operatorId === operatorId && s.month === month);
    if (!sheet) {
      const op = state.operators.find(o => o.id === operatorId);
      sheet = { id: generateId(), userId: uid, month, operatorId, machine: op?.machine || 'M1', days: {} };
      dispatch({ type: 'ADD_SHEET', payload: sheet });
      // Need to update right away
      const updated = { ...sheet, days: { ...sheet.days, [String(day)]: entry } };
      dispatch({ type: 'UPDATE_SHEET', payload: updated });
      return;
    }
    const updated = { ...sheet, days: { ...sheet.days, [String(day)]: entry } };
    dispatch({ type: 'UPDATE_SHEET', payload: updated });
  };

  // Delete a day entry
  const deleteDayEntry = (sheetId, day) => {
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    const days = { ...sheet.days };
    delete days[String(day)];
    dispatch({ type: 'UPDATE_SHEET', payload: { ...sheet, days } });
  };

  const deleteSheet = (id) => dispatch({ type: 'DELETE_SHEET', payload: id });

  const calcGenIncome = (production, head, type, rate) => {
    const mh = Number(head);
    let effectiveHead = mh;
    if (type === 'alternet') effectiveHead = mh / 2;
    else if (type === 'duble_alternet') effectiveHead = mh / 3;
    return (Number(production) / 1000) * Number(rate) * effectiveHead;
  };

  return (
    <ProductionContext.Provider value={{
      helpers, operators, sheets,
      addHelper, deleteHelper, getHelperName,
      addOperator, deleteOperator, getOperator,
      ensureSheet, addDayEntry, deleteDayEntry, deleteSheet,
      calcGenIncome,
    }}>
      {children}
    </ProductionContext.Provider>
  );
}

export const useProduction = () => useContext(ProductionContext);
