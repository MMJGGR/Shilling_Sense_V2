import { useState, useEffect, Dispatch, SetStateAction } from 'react';

// FIX: Updated function signature to use Dispatch and SetStateAction types imported from React, resolving the 'React' namespace error.
function useLocalStorage<T,>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };
  
  // This useEffect is not strictly necessary if you only want to set the value,
  // but it's good practice to keep the state in sync if the local storage is
  // changed by another tab. However, for simplicity here we'll assume this app
  // is the only one modifying its own local storage.

  return [storedValue, setValue];
}

export default useLocalStorage;