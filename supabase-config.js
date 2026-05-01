/* ===================================================
   Supabase Configuration
   ===================================================

   Isi nilai di bawah dari Supabase Project Settings > API.
   Jangan gunakan service_role key di frontend.
*/

const SUPABASE_CONFIG = {
  url: 'https://xthbdxloffpwrurjgkef.supabase.co',
  anonKey: 'sb_publishable_a3V6s24dLZxQ4pDMkQGzLw_Rm5Nhnze',
  storageBucket: 'donasi-assets',
};

function isSupabaseConfigured() {
  return Boolean(
    window.supabase &&
    SUPABASE_CONFIG.url &&
    SUPABASE_CONFIG.anonKey &&
    !SUPABASE_CONFIG.url.includes('YOUR-PROJECT') &&
    !SUPABASE_CONFIG.anonKey.includes('YOUR-SUPABASE')
  );
}

function createSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  return window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
}
