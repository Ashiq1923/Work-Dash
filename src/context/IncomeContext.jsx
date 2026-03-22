import { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { STORAGE_KEYS, generateId } from '../utils/constants';
import { loadFromStorage, saveToStorage } from '../utils/storageUtils';
import { useAuth } from './AuthContext';

const IncomeContext = createContext();

// Calculate effective heads based on type
function getEffectiveHeads(machineHead, type) {
  const mh = Number(machineHead);
  if (type === 'all_head') return mh;
  if (type === 'alternet') return mh / 2;
  if (type === 'duble_alternet') return mh / 3;
  return mh;
}

// Calculate rounds
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

// Enrich components with calculated fields
function enrichComponents(machineHead, components) {
  return components.map(comp => {
    const effectiveHeads = getEffectiveHeads(machineHead, comp.type);
    const rounds = calcRounds(machineHead, comp);
    const total = (Number(comp.stitch) || 0) * rounds;
    return { ...comp, effectiveHeads, rounds, total };
  });
}

const DEFAULT_PARTIES = [];

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD': return { ...state, entries: action.payload };
    case 'ADD': return { ...state, entries: [action.payload, ...state.entries] };
    case 'UPDATE': return { ...state, entries: state.entries.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE': return { ...state, entries: state.entries.filter(e => e.id !== action.payload) };
    default: return state;
  }
}

export function IncomeProvider({ children }) {
  const { currentUser, isAdmin, activeUserId, activeDataKey } = useAuth();
  const [state, dispatch] = useReducer(reducer, { entries: [] });
  const [parties, setParties] = useState([]);

  useEffect(() => {
    const savedParties = loadFromStorage(STORAGE_KEYS.PARTIES, DEFAULT_PARTIES);
    setParties(savedParties);
    const saved = loadFromStorage(STORAGE_KEYS.INCOME, []);
    dispatch({ type: 'LOAD', payload: saved });
  }, []);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PARTIES, parties);
  }, [parties]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.INCOME, state.entries);
  }, [state.entries]);

  // Filtered entries: based on activeDataKey (user name) for data ops
  const entries = activeDataKey
    ? state.entries.filter(e => e.userId === activeDataKey)
    : [];

  // All entries (for admin to check party usage etc)
  const allEntries = state.entries;

  // Party CRUD
  const addParty = (name) => {
    const p = { id: generateId(), name: name.trim() };
    setParties(prev => [...prev, p]);
    return p;
  };
  const deleteParty = (id) => setParties(prev => prev.filter(p => p.id !== id));
  const getPartyName = (id) => parties.find(p => p.id === id)?.name || 'Unknown';

  // Article CRUD - tag with userId
  const addEntry = (entry) => {
    const enriched = {
      ...entry,
      id: generateId(),
      userId: activeDataKey || currentUser?.name,
      status: 'pending',
      components: enrichComponents(entry.machineHead, entry.components),
    };
    dispatch({ type: 'ADD', payload: enriched });
  };
  const updateEntry = (entry) => {
    const enriched = {
      ...entry,
      components: enrichComponents(entry.machineHead, entry.components),
    };
    dispatch({ type: 'UPDATE', payload: enriched });
  };
  const deleteEntry = (id) => dispatch({ type: 'DELETE', payload: id });
  const toggleStatus = (id) => {
    const entry = state.entries.find(e => e.id === id);
    if (entry) {
      dispatch({ type: 'UPDATE', payload: { ...entry, status: entry.status === 'done' ? 'pending' : 'done' } });
    }
  };

  // Can user edit this entry? Admin can edit all, user can edit only own
  const canEditEntry = (entry) => {
    if (isAdmin) return true;
    return entry.userId === currentUser?.id;
  };

  return (
    <IncomeContext.Provider value={{
      entries, allEntries, addEntry, updateEntry, deleteEntry, toggleStatus, canEditEntry,
      parties, addParty, deleteParty, getPartyName,
      getEffectiveHeads, calcRounds, enrichComponents,
    }}>
      {children}
    </IncomeContext.Provider>
  );
}

export const useIncome = () => useContext(IncomeContext);
