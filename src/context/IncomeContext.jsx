import { createContext, useContext, useReducer, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as db from '../lib/db';

const IncomeContext = createContext();

function getEffectiveHeads(machineHead, type) {
  const mh = Number(machineHead);
  if (type === 'all_head') return mh;
  if (type === 'alternet') return mh / 2;
  if (type === 'duble_alternet') return mh / 3;
  return mh;
}

function calcRounds(machineHead, component) {
  const mh = Number(machineHead);
  const val = Number(component.value) || 0;
  if (component.qtyOrMeter === 'meter') {
    const divisor = mh / 3;
    return divisor > 0 ? val / divisor : 0;
  }
  const effectiveHeads = getEffectiveHeads(mh, component.type);
  return effectiveHeads > 0 ? val / effectiveHeads : 0;
}

function enrichComponents(machineHead, components) {
  return components.map(comp => {
    const effectiveHeads = getEffectiveHeads(machineHead, comp.type);
    const rounds = calcRounds(machineHead, comp);
    const total = (Number(comp.stitch) || 0) * rounds;
    return { ...comp, effectiveHeads, rounds, total };
  });
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET': return { ...state, entries: action.payload };
    case 'ADD': return { ...state, entries: [action.payload, ...state.entries] };
    case 'UPDATE': return { ...state, entries: state.entries.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE': return { ...state, entries: state.entries.filter(e => e.id !== action.payload) };
    default: return state;
  }
}

export function IncomeProvider({ children }) {
  const { currentUser, isAdmin, activeDataKey } = useAuth();
  const [state, dispatch] = useReducer(reducer, { entries: [] });
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const p = await db.fetchParties();
    setParties(p.map(x => ({ id: x.id, name: x.name })));
    if (!activeDataKey) { dispatch({ type: 'SET', payload: [] }); setLoading(false); return; }
    const articles = await db.fetchArticles(activeDataKey);
    // Enrich components
    const enriched = articles.map(a => ({
      ...a,
      components: enrichComponents(a.machineHead, a.components),
    }));
    dispatch({ type: 'SET', payload: enriched });
    setLoading(false);
  }, [activeDataKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const entries = state.entries;

  const addParty = async (name) => {
    const p = await db.insertParty(name.trim());
    const mapped = { id: p.id, name: p.name };
    setParties(prev => [...prev, mapped]);
    return mapped;
  };
  const deleteParty = async (id) => { await db.removeParty(id); setParties(prev => prev.filter(p => p.id !== id)); };
  const getPartyName = (id) => parties.find(p => p.id === id)?.name || 'Unknown';

  const addEntry = async (entry) => {
    const a = await db.insertArticle(activeDataKey, entry);
    // Re-fetch to get components with IDs
    await loadData();
  };

  const updateEntry = async (entry) => {
    await db.updateArticle(entry);
    await loadData();
  };

  const deleteEntry = async (id) => {
    await db.removeArticle(id);
    dispatch({ type: 'DELETE', payload: id });
  };

  const toggleStatus = async (id) => {
    const entry = state.entries.find(e => e.id === id);
    if (entry) {
      const newStatus = entry.status === 'done' ? 'pending' : 'done';
      await db.updateArticle({ ...entry, status: newStatus });
      dispatch({ type: 'UPDATE', payload: { ...entry, status: newStatus } });
    }
  };

  const canEditEntry = () => true; // RLS handles permissions

  return (
    <IncomeContext.Provider value={{
      entries, loading, addEntry, updateEntry, deleteEntry, toggleStatus, canEditEntry,
      parties, addParty, deleteParty, getPartyName,
      getEffectiveHeads, calcRounds, enrichComponents,
    }}>
      {children}
    </IncomeContext.Provider>
  );
}

export const useIncome = () => useContext(IncomeContext);
