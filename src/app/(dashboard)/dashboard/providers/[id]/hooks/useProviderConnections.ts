 import { useState, useCallback } from 'react';
 import { createLogger } from '@/shared/utils/structuredLogger';
 
 const logger = createLogger('useProviderConnections');
 
 export function useProviderConnections(providerId: string, isCompatible: boolean) {
   const [connections, setConnections] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [providerNode, setProviderNode] = useState<any>(null);
 
   const fetchConnections = useCallback(async () => {
     try {
       const [connectionsRes, nodesRes] = await Promise.all([
         fetch('/api/providers', { cache: 'no-store' }),
         fetch('/api/provider-nodes', { cache: 'no-store' }),
       ]);
 
       const connectionsData = await connectionsRes.json();
       const nodesData = await nodesRes.json();
 
       if (connectionsRes.ok) {
         const filtered = (connectionsData.connections || []).filter(
           (c: any) => c.provider === providerId
         );
         setConnections(filtered);
       }
 
       if (nodesRes.ok) {
         let node = (nodesData.nodes || []).find((entry: any) => entry.id === providerId) || null;
 
         // Newly created compatible nodes can be briefly unavailable on one worker.
         // Retry a few times before showing "Provider not found".
         if (!node && isCompatible) {
           for (let attempt = 0; attempt < 3; attempt += 1) {
             await new Promise((resolve) => setTimeout(resolve, 150));
             const retryRes = await fetch('/api/provider-nodes', { cache: 'no-store' });
             if (!retryRes.ok) continue;
             const retryData = await retryRes.json();
             node = (retryData.nodes || []).find((entry: any) => entry.id === providerId) || null;
             if (node) break;
           }
         }
 
         setProviderNode(node);
       }
     } catch (error) {
       logger.error('fetchConnections', 'Failed to fetch connections', {
         providerId,
         error: error instanceof Error ? error.message : String(error),
       });
     } finally {
       setLoading(false);
     }
   }, [providerId, isCompatible]);
 
   return {
     connections,
     setConnections,
     loading,
     providerNode,
     setProviderNode,
     fetchConnections,
   };
 }
