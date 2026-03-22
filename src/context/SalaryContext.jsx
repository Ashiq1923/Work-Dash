import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as db from '../lib/db';

const SalaryContext = createContext();

export function SalaryProvider({ children }) {
  const { activeDataKey } = useAuth();
  const [overrides, setOverrides] = useState({});

  const loadData = useCallback(async () => {
    if (!activeDataKey) { setOverrides({}); return; }
    const data = await db.fetchSalaryOverrides(activeDataKey);
    setOverrides(data);
  }, [activeDataKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const setOverride = async (operatorId, month, day, data) => {
    const key = `${activeDataKey}_${operatorId}_${month}_${day}`;
    setOverrides(prev => ({ ...prev, [key]: data }));
    await db.upsertSalaryOverride(activeDataKey, operatorId, month, day, data);
  };

  const deleteOverride = async (operatorId, month, day) => {
    const key = `${activeDataKey}_${operatorId}_${month}_${day}`;
    setOverrides(prev => { const n = { ...prev }; delete n[key]; return n; });
    await db.removeSalaryOverride(activeDataKey, operatorId, month, day);
  };

  const getOverride = (operatorId, month, day) => {
    const key = `${activeDataKey}_${operatorId}_${month}_${day}`;
    return overrides[key] || null;
  };

  return (
    <SalaryContext.Provider value={{ setOverride, deleteOverride, getOverride }}>
      {children}
    </SalaryContext.Provider>
  );
}

export const useSalary = () => useContext(SalaryContext);
