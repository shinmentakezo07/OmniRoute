 import { useState, useCallback } from 'react';
 import { createLogger } from '@/shared/utils/structuredLogger';
 
 const logger = createLogger('useModelAliases');
 
 export function useModelAliases() {
   const [modelAliases, setModelAliases] = useState<Record<string, any>>({});
 
   const fetchAliases = useCallback(async () => {
     try {
       const res = await fetch('/api/models/alias');
       const data = await res.json();
       if (res.ok) {
         setModelAliases(data.aliases || {});
       }
     } catch (error) {
       logger.error('fetchAliases', 'Failed to fetch model aliases', {
         error: error instanceof Error ? error.message : String(error),
       });
     }
   }, []);
 
   const setAlias = useCallback(async (modelId: string, alias: string, providerAlias: string) => {
     const fullModel = `${providerAlias}/${modelId}`;
     try {
       const res = await fetch('/api/models/alias', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ model: fullModel, alias }),
       });
 
       if (res.ok) {
         await fetchAliases();
         return null;
       } else {
         const data = await res.json().catch(() => ({}));
         const errorMsg = data.error || 'Failed to set alias';
         logger.warn('setAlias', 'Failed to set model alias', { modelId, alias, error: errorMsg });
         return errorMsg;
       }
     } catch (error) {
       const errorMsg = error instanceof Error ? error.message : 'Failed to set alias';
       logger.error('setAlias', 'Error setting model alias', { modelId, alias, error: errorMsg });
       return errorMsg;
     }
   }, [fetchAliases]);
 
   const deleteAlias = useCallback(async (alias: string) => {
     try {
       const res = await fetch(`/api/models/alias?alias=${encodeURIComponent(alias)}`, {
         method: 'DELETE',
       });
 
       if (res.ok) {
         await fetchAliases();
         return null;
       } else {
         const data = await res.json().catch(() => ({}));
         const errorMsg = data.error || 'Failed to delete alias';
         logger.warn('deleteAlias', 'Failed to delete model alias', { alias, error: errorMsg });
         return errorMsg;
       }
     } catch (error) {
       const errorMsg = error instanceof Error ? error.message : 'Failed to delete alias';
       logger.error('deleteAlias', 'Error deleting model alias', { alias, error: errorMsg });
       return errorMsg;
     }
   }, [fetchAliases]);
 
   return {
     modelAliases,
     setModelAliases,
     fetchAliases,
     setAlias,
     deleteAlias,
   };
 }
