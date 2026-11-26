import { useCallback, useEffect, useState } from 'react';
import { FitnessData, parseFitnessData } from './fitness';

const FITNESS_KEY = 'farai_fitness_v1';

function read(): FitnessData {
  try {
    return parseFitnessData(localStorage.getItem(FITNESS_KEY));
  } catch {
    return parseFitnessData(null);
  }
}

/** Fitness data in React state, saved to localStorage on every change. */
export function useFitnessData(): { data: FitnessData; update: (fn: (d: FitnessData) => FitnessData) => void; saveFailed: boolean } {
  const [data, setData] = useState<FitnessData>(read);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(FITNESS_KEY, JSON.stringify(data));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true); // storage full or blocked: the page still works, it just will not survive a reload
    }
  }, [data]);

  // Another tab logged something: follow it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === FITNESS_KEY) setData(parseFitnessData(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((fn: (d: FitnessData) => FitnessData) => setData((d) => fn(d)), []);
  return { data, update, saveFailed };
}
