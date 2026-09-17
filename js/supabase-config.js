'use strict';

const SUPABASE_URL = 'https://pzigegqqogejzgoppbgw.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_fwdp8UKV4rGBJUO5JwNhmQ_w6nOOwXz';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);

const STORAGE_BUCKET = 'item-images';