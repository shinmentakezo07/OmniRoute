 /**
  * Connection Helper Utilities
  * 
  * Extracted from page.tsx to improve testability and reusability.
  */
 
 export const ERROR_TYPE_LABELS: Record<string, { label: string; variant: string }> = {
   token_expired: { label: 'Token expired', variant: 'warning' },
   token_refresh_failed: { label: 'Refresh failed', variant: 'error' },
   invalid_credentials: { label: 'Invalid credentials', variant: 'error' },
   upstream_rate_limited: { label: 'Rate limited', variant: 'warning' },
   upstream_error: { label: 'Upstream error', variant: 'error' },
 };
 
 /**
  * Infer error type from connection state
  */
 export function inferErrorType(connection: any, isCooldown: boolean): string {
   if (isCooldown) return 'upstream_rate_limited';
   if (connection.lastErrorType) return connection.lastErrorType;
 
   const msg = connection.lastError?.toLowerCase() || '';
 
   // Rate limit patterns
   if (msg.includes('rate limit') || msg.includes('429')) {
     return 'upstream_rate_limited';
   }
 
   // Token expiry patterns
   if (
     msg.includes('token expired') ||
     msg.includes('token has expired') ||
     msg.includes('expired token')
   ) {
     return 'token_expired';
   }
 
   // Refresh failure patterns
   if (
     msg.includes('refresh failed') ||
     msg.includes('failed to refresh') ||
     msg.includes('refresh token')
   ) {
     return 'token_refresh_failed';
   }
 
   // Invalid credentials patterns
   if (
     msg.includes('invalid') ||
     msg.includes('unauthorized') ||
     msg.includes('401') ||
     msg.includes('403')
   ) {
     return 'invalid_credentials';
   }
 
   return 'upstream_error';
 }
 
 /**
  * Get status presentation for connection
  */
 export function getStatusPresentation(
   connection: any,
   effectiveStatus: string,
   isCooldown: boolean
 ) {
   if (connection.isActive === false) {
     return {
       statusVariant: 'default' as const,
       statusLabel: 'Inactive',
       showError: false,
       errorType: null,
       errorLabel: null,
       errorVariant: null,
     };
   }
 
   if (effectiveStatus === 'valid') {
     return {
       statusVariant: 'success' as const,
       statusLabel: 'Valid',
       showError: false,
       errorType: null,
       errorLabel: null,
       errorVariant: null,
     };
   }
 
   if (effectiveStatus === 'invalid' || effectiveStatus === 'error') {
     const errorType = inferErrorType(connection, isCooldown);
     const errorInfo = ERROR_TYPE_LABELS[errorType] || ERROR_TYPE_LABELS.upstream_error;
 
     return {
       statusVariant: 'error' as const,
       statusLabel: 'Invalid',
       showError: true,
       errorType,
       errorLabel: errorInfo.label,
       errorVariant: errorInfo.variant as 'warning' | 'error',
     };
   }
 
   return {
     statusVariant: 'default' as const,
     statusLabel: 'Unknown',
     showError: false,
     errorType: null,
     errorLabel: null,
     errorVariant: null,
   };
 }
 
 /**
  * Check if connection is in cooldown
  */
 export function isConnectionInCooldown(connection: any): boolean {
   if (!connection.rateLimitedUntil) return false;
   return Date.now() < connection.rateLimitedUntil;
 }
 
 /**
  * Calculate remaining cooldown time
  */
 export function getRemainingCooldown(until: number): string {
   const diff = until - Date.now();
   if (diff <= 0) return '';
 
   const seconds = Math.floor(diff / 1000);
   const minutes = Math.floor(seconds / 60);
   const hours = Math.floor(minutes / 60);
 
   if (hours > 0) {
     return `${hours}h ${minutes % 60}m`;
   } else if (minutes > 0) {
     return `${minutes}m ${seconds % 60}s`;
   } else {
     return `${seconds}s`;
   }
 }
