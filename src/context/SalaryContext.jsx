import { createContext, useContext, useReducer, useEffect } from 'react';
import { STORAGE_KEYS } from '../utils/constants';
import { loadFromStorage, saveToStorage } from '../utils/storageUtils';
import { useAuth } from './AuthContext';

/*
  Salary overrides — when production is edited in Salary section,
  the override is stored here (doesn't affect Production section).
  Shape: { "userId_operatorId_month_day": { production, description } }
*/

const SalaryContext = createContext();

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD': return action.payload;
    case 'SET_OVERRIDE': {
      const { key, data } = action.payload;
      return { ...state, [key]: data };
    }
    case 'DELETE_OVERRIDE': {
      const s = { ...state };
      delete s[action.payload];
      return s;
    }
    default: return state;
  }
}

export function SalaryProvider({ children }) {
  const { activeDataKey } = useAuth();
  const [state, dispatch] = useReducer(reducer, {});

  useEffect(() => {
    const saved = loadFromStorage(STORAGE_KEYS.SALARY, {});
    dispatch({ type: 'LOAD', payload: saved });
  }, []);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SALARY, state);
  }, [state]);

  const makeKey = (operatorId, month, day) => `${activeDataKey}_${operatorId}_${month}_${day}`;

  const setOverride = (operatorId, month, day, data) => {
    const key = makeKey(operatorId, month, day);
    dispatch({ type: 'SET_OVERRIDE', payload: { key, data } });
  };

  const deleteOverride = (operatorId, month, day) => {
    const key = makeKey(operatorId, month, day);
    dispatch({ type: 'DELETE_OVERRIDE', payload: key });
  };

  const getOverride = (operatorId, month, day) => {
    const key = makeKey(operatorId, month, day);
    return state[key] || null;
  };

  return (
    <SalaryContext.Provider value={{ setOverride, deleteOverride, getOverride }}>
      {children}
    </SalaryContext.Provider>
  );
}

export const useSalary = () => useContext(SalaryContext);
