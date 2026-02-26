 import { useState, useCallback } from 'react';
 import { createLogger } from '@/shared/utils/structuredLogger';
 
 const logger = createLogger('useProviderNode');
 
 export function useProviderNode(providerId: string) {
   const [providerNode, setProviderNode] = useState<any>(null);
 
   const updateNode = useCallback(async (formData: any) => {
     try {
       const res = await fetch(`/api/provider-nodes/${providerId}`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(formData),
       });
 
       const data = await res.json();
 
       if (res.ok) {
         setProviderNode(data.node);
         return { success: true, node: data.node };
       } else {
         const errorMsg = data.error || 'Failed to update provider node';
         logger.warn('updateNode', 'Failed to update provider node', {
           providerId,
           error: errorMsg,
         });
         return { success: false, error: errorMsg };
       }
     } catch (error) {
       const errorMsg = error instanceof Error ? error.message : 'Failed to update provider node';
       logger.error('updateNode', 'Error updating provider node', {
         providerId,
         error: errorMsg,
       });
       return { success: false, error: errorMsg };
     }
   }, [providerId]);
 
   return {
     providerNode,
     setProviderNode,
     updateNode,
   };
 }
