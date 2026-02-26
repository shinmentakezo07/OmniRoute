 import { useState, useEffect } from 'react';
 import { getRemainingCooldown } from '../utils/connectionHelpers';
 
 interface CooldownTimerProps {
   until: number;
 }
 
 export function CooldownTimer({ until }: CooldownTimerProps) {
   const [remaining, setRemaining] = useState('');
 
   useEffect(() => {
     const updateRemaining = () => {
       const time = getRemainingCooldown(until);
       setRemaining(time);
       if (!time) return;
     };
 
     updateRemaining();
     const interval = setInterval(updateRemaining, 1000);
     return () => clearInterval(interval);
   }, [until]);
 
   if (!remaining) return null;
 
   return (
     <span className="text-xs text-warning font-medium">
       {remaining}
     </span>
   );
 }
