 import { useState, useEffect } from 'react';
 import { Modal, Input, Button, Badge } from '@/shared/components';
 import { useTranslations } from 'next-intl';
 import { createLogger } from '@/shared/utils/structuredLogger';
 import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from '@/shared/constants/providers';
 import { ERROR_TYPE_LABELS } from '../utils/connectionHelpers';
 
 const logger = createLogger('EditConnectionModal');
 
 interface EditConnectionModalProps {
   isOpen: boolean;
   connection: any;
   onSave: (updates: any) => Promise<void>;
   onClose: () => void;
 }
 
 export function EditConnectionModal({ isOpen, connection, onSave, onClose }: EditConnectionModalProps) {
   const t = useTranslations('providers');
   const [formData, setFormData] = useState({
     name: '',
     priority: 1,
     apiKey: '',
     healthCheckInterval: 60,
   });
   const [testing, setTesting] = useState(false);
   const [testResult, setTestResult] = useState<any>(null);
   const [validating, setValidating] = useState(false);
   const [validationResult, setValidationResult] = useState<string | null>(null);
   const [saving, setSaving] = useState(false);
 
   useEffect(() => {
     if (connection) {
       setFormData({
         name: connection.name || '',
         priority: connection.priority || 1,
         apiKey: '',
         healthCheckInterval: connection.healthCheckInterval ?? 60,
       });
       setTestResult(null);
       setValidationResult(null);
     }
   }, [connection]);
 
   const handleTest = async () => {
     if (!connection?.provider) return;
     setTesting(true);
     setTestResult(null);
     try {
       const res = await fetch(`/api/providers/${connection.id}/test`, { method: 'POST' });
       const data = await res.json();
       setTestResult({
         valid: !!data.valid,
         diagnosis: data.diagnosis || null,
         message: data.error || null,
       });
     } catch (error) {
       logger.error('handleTest', 'Connection test failed', {
         connectionId: connection.id,
         error: error instanceof Error ? error.message : String(error),
       });
       setTestResult({
         valid: false,
         diagnosis: { type: 'network_error' },
         message: t('testFailed'),
       });
     } finally {
       setTesting(false);
     }
   };
 
   const handleValidate = async () => {
     if (!connection?.provider || !formData.apiKey) return;
     setValidating(true);
     setValidationResult(null);
     try {
       const res = await fetch('/api/providers/validate', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ provider: connection.provider, apiKey: formData.apiKey }),
       });
       const data = await res.json();
       setValidationResult(data.valid ? 'success' : 'failed');
     } catch (error) {
       logger.error('handleValidate', 'Validation failed', {
         provider: connection.provider,
         error: error instanceof Error ? error.message : String(error),
       });
       setValidationResult('failed');
     } finally {
       setValidating(false);
     }
   };
 
   const handleSubmit = async () => {
     setSaving(true);
     try {
       const updates: any = {
         name: formData.name,
         priority: formData.priority,
         healthCheckInterval: formData.healthCheckInterval,
       };
 
       const isOAuth = connection.authType === 'oauth';
       if (!isOAuth && formData.apiKey) {
         updates.apiKey = formData.apiKey;
         let isValid = validationResult === 'success';
         if (!isValid) {
           await handleValidate();
           isValid = validationResult === 'success';
         }
         if (isValid) {
           updates.testStatus = 'active';
           updates.lastError = null;
           updates.lastErrorAt = null;
           updates.lastErrorType = null;
           updates.lastErrorSource = null;
           updates.errorCode = null;
           updates.rateLimitedUntil = null;
         }
       }
       await onSave(updates);
     } finally {
       setSaving(false);
     }
   };
 
   if (!connection) return null;
 
   const isOAuth = connection.authType === 'oauth';
   const isCompatible =
     isOpenAICompatibleProvider(connection.provider) ||
     isAnthropicCompatibleProvider(connection.provider);
   const testErrorMeta =
     !testResult?.valid && testResult?.diagnosis?.type
       ? ERROR_TYPE_LABELS[testResult.diagnosis.type] || null
       : null;
 
   return (
     <Modal isOpen={isOpen} title={t('editConnection')} onClose={onClose}>
       <div className="flex flex-col gap-4">
         <Input
           label={t('connectionName')}
           value={formData.name}
           onChange={(e) => setFormData({ ...formData, name: e.target.value })}
           placeholder={isOAuth ? t('accountName') : t('connectionNamePlaceholder')}
         />
         {isOAuth && connection.email && (
           <div className="bg-sidebar/50 p-3 rounded-lg">
             <p className="text-sm text-text-muted mb-1">{t('email')}</p>
             <p className="font-medium">{connection.email}</p>
           </div>
         )}
         {isOAuth && (
           <Input
             label={t('healthCheckInterval')}
             type="number"
             value={formData.healthCheckInterval}
             onChange={(e) =>
               setFormData({
                 ...formData,
                 healthCheckInterval: Math.max(0, Number.parseInt(e.target.value) || 0),
               })
             }
             min={0}
           />
         )}
         {!isOAuth && (
           <>
             <Input
               label={t('priority')}
               type="number"
               value={formData.priority}
               onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
               min={1}
             />
             <div className="flex gap-2">
               <Input
                 label={t('newApiKey')}
                 type="password"
                 value={formData.apiKey}
                 onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                 placeholder={t('leaveBlankToKeep')}
                 className="flex-1"
               />
               <div className="pt-6">
                 <Button
                   onClick={handleValidate}
                   disabled={!formData.apiKey || validating}
                   variant="secondary"
                 >
                   {validating ? t('validating') : t('validate')}
                 </Button>
               </div>
             </div>
             {validationResult && (
               <Badge variant={validationResult === 'success' ? 'success' : 'error'}>
                 {validationResult === 'success' ? t('valid') : t('invalid')}
               </Badge>
             )}
           </>
         )}
         <div className="flex gap-2">
           <Button onClick={handleTest} disabled={testing} variant="secondary">
             {testing ? t('testing') : t('testConnection')}
           </Button>
           {testResult && (
             <Badge variant={testResult.valid ? 'success' : 'error'}>
               {testResult.valid ? t('valid') : testErrorMeta?.label || t('invalid')}
             </Badge>
           )}
         </div>
         <div className="flex gap-2">
           <Button onClick={handleSubmit} fullWidth disabled={!formData.name.trim() || saving}>
             {saving ? t('saving') : t('save')}
           </Button>
           <Button onClick={onClose} variant="ghost" fullWidth>
             {t('cancel')}
           </Button>
         </div>
       </div>
     </Modal>
   );
 }
