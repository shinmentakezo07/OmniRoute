 import { useState, useEffect } from 'react';
 import { Modal, Input, Button, Badge } from '@/shared/components';
 import { useTranslations } from 'next-intl';
 import { createLogger } from '@/shared/utils/structuredLogger';
 
 const logger = createLogger('AddApiKeyModal');
 
 interface AddApiKeyModalProps {
   isOpen: boolean;
   provider: string;
   providerName: string;
   isCompatible: boolean;
   onSave: (data: any) => Promise<string | null>;
   onClose: () => void;
 }
 
 export function AddApiKeyModal({
   isOpen,
   provider,
   providerName,
   isCompatible,
   onSave,
   onClose,
 }: AddApiKeyModalProps) {
   const t = useTranslations('providers');
   const [formData, setFormData] = useState({
     name: '',
     apiKey: '',
     priority: 1,
   });
   const [validating, setValidating] = useState(false);
   const [validationResult, setValidationResult] = useState<string | null>(null);
   const [saving, setSaving] = useState(false);
   const [saveError, setSaveError] = useState<string | null>(null);
 
   useEffect(() => {
     if (isOpen) {
       setFormData({ name: '', apiKey: '', priority: 1 });
       setValidationResult(null);
       setSaveError(null);
     }
   }, [isOpen]);
 
   const handleValidate = async () => {
     setValidating(true);
     setValidationResult(null);
     try {
       const res = await fetch(`/api/providers/${provider}/test`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ apiKey: formData.apiKey }),
       });
       const data = await res.json();
       setValidationResult(data.valid ? 'success' : 'error');
       if (!data.valid) {
         setSaveError(data.error || t('invalidApiKey'));
       }
     } catch (error) {
       logger.error('handleValidate', 'Validation failed', {
         provider,
         error: error instanceof Error ? error.message : String(error),
       });
       setValidationResult('error');
       setSaveError(t('validationFailed'));
     } finally {
       setValidating(false);
     }
   };
 
   const handleSubmit = async () => {
     setSaving(true);
     setSaveError(null);
     const error = await onSave(formData);
     setSaving(false);
     if (error) {
       setSaveError(error);
     } else {
       onClose();
     }
   };
 
   return (
     <Modal isOpen={isOpen} onClose={onClose} title={t('addConnection')}>
       <div className="space-y-4">
         <Input
           label={t('connectionName')}
           value={formData.name}
           onChange={(e) => setFormData({ ...formData, name: e.target.value })}
           placeholder={t('connectionNamePlaceholder')}
         />
         <Input
           label={t('apiKey')}
           type="password"
           value={formData.apiKey}
           onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
           placeholder={t('apiKeyPlaceholder')}
         />
         {!isCompatible && (
           <Input
             label={t('priority')}
             type="number"
             value={formData.priority}
             onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
             min={1}
           />
         )}
         <div className="flex gap-2">
           <Button
             onClick={handleValidate}
             disabled={!formData.apiKey || validating}
             variant="secondary"
           >
             {validating ? t('validating') : t('validate')}
           </Button>
           {validationResult && (
             <Badge variant={validationResult === 'success' ? 'success' : 'error'}>
               {validationResult === 'success' ? t('valid') : t('invalid')}
             </Badge>
           )}
         </div>
         {saveError && (
           <div className="text-sm text-error">{saveError}</div>
         )}
         <div className="flex gap-2">
           <Button
             onClick={handleSubmit}
             fullWidth
             disabled={!formData.name.trim() || !formData.apiKey.trim() || saving}
           >
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
