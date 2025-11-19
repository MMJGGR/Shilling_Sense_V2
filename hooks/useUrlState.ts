
import { useState, useEffect, useCallback } from 'react';

function useUrlState<T extends string>(key: string, initialValue: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    const params = new URLSearchParams(window.location.search);
    const paramValue = params.get(key);
    return (paramValue as T) || initialValue;
  });

  const updateState = useCallback((newValue: T) => {
    setState(newValue);
    const params = new URLSearchParams(window.location.search);
    if (newValue === initialValue) {
      params.delete(key);
    } else {
      params.set(key, newValue);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [key, initialValue]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const paramValue = params.get(key);
      setState((paramValue as T) || initialValue);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [key, initialValue]);

  return [state, updateState];
}

export default useUrlState;
