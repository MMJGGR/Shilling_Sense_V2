import { useState, useEffect } from 'react';
import { merchantService } from '../services/merchantService';

export const useMerchantName = (rawName: string) => {
    const [enrichedName, setEnrichedName] = useState(merchantService.getEnrichedName(rawName));

    useEffect(() => {
        // Initial check
        setEnrichedName(merchantService.getEnrichedName(rawName));

        // Subscribe to updates
        const unsubscribe = merchantService.subscribe((updatedRawName, updatedEnrichedName) => {
            if (updatedRawName === rawName) {
                setEnrichedName(updatedEnrichedName);
            }
        });

        return () => unsubscribe();
    }, [rawName]);

    return enrichedName;
};
