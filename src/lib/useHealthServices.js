import { useEffect, useState } from 'react';
import { loadHivServices } from './health';

// One fetch per visit, shared by every listing opened.
let pending = null;

export function useHealthServices() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!pending) pending = loadHivServices().catch(() => { pending = null; return null; });
    pending.then((payload) => { if (alive) setData(payload); });
    return () => { alive = false; };
  }, []);
  return data;
}
