 /**
  * Standardized Error Handler
  * 
  * Replaces silent error handling (empty catch blocks) with structured logging.
  * Provides consistent error tracking across the application.
  */
 
// Conditionally import logger only on server to avoid node: protocol issues
const createLogger = typeof window === 'undefined'
  ? require('./structuredLogger').createLogger
  : () => ({
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    });
 
 const logger = createLogger('ErrorHandler');
 
 export interface ErrorContext {
   component: string;
   action: string;
   metadata?: Record<string, any>;
 }
 
 /**
  * Handle and log an error with context
  */
 export function handleError(error: unknown, context: ErrorContext): void {
   const errorMessage = error instanceof Error ? error.message : String(error);
   const errorStack = error instanceof Error ? error.stack : undefined;
   
   logger.error(context.component, `${context.action} failed`, {
     error: errorMessage,
     stack: errorStack,
     ...context.metadata,
   });
 }
 
 /**
  * Wrap a promise with error handling and fallback value
  */
 export function handleAsyncError<T>(
   promise: Promise<T>,
   context: ErrorContext,
   fallback: T
 ): Promise<T> {
   return promise.catch((error) => {
     handleError(error, context);
     return fallback;
   });
 }
 
 /**
  * Safe localStorage operations with error handling
  */
 export function safeLocalStorage(
   operation: () => void,
   context: ErrorContext
 ): void {
   try {
     operation();
   } catch (error) {
     handleError(error, {
       ...context,
       action: `localStorage ${context.action}`,
     });
   }
 }
 
 /**
  * Safe JSON parse with error handling
  */
 export function safeJsonParse<T>(
   json: string,
   context: ErrorContext,
   fallback: T
 ): T {
   try {
     return JSON.parse(json);
   } catch (error) {
     handleError(error, {
       ...context,
       action: `JSON parse ${context.action}`,
     });
     return fallback;
   }
 }
 
 /**
  * Safe fetch with error handling
  */
 export async function safeFetch(
   url: string,
   options: RequestInit | undefined,
   context: ErrorContext
 ): Promise<Response | null> {
   try {
     return await fetch(url, options);
   } catch (error) {
     handleError(error, {
       ...context,
       metadata: { url, ...context.metadata },
     });
     return null;
   }
 }
