import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oyrsckfjwdxpjfufifid.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95cnNja2Zqd2R4cGpmdWZpZmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzg5NjgsImV4cCI6MjA2ODk1NDk2OH0.AfLD37x4xiRj-wQYaKTdA3PfPNLhmRRxDhLfqNVnFYA';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,      // ✅ Session tarayıcıda kalıcı olacak
    autoRefreshToken: true,    // ✅ Token süresi dolunca otomatik yenilenecek
    detectSessionInUrl: true,  // ✅ OAuth gibi işlemleri destekler
  },
});
