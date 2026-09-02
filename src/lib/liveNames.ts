import { useEffect, useState } from 'react';
import { namesOfAllah, type AdminName } from '@/api/client';

/** Slice 6 — admin-managed Names of Allah merged over the bundled/pack set. */
export function useAdminNames(): AdminName[] {
  const [names, setNames] = useState<AdminName[]>([]);
  useEffect(() => {
    let on = true;
    namesOfAllah()
      .then((n) => {
        if (on && n) setNames(n);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);
  return names;
}
