import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pzfuthyzfxkjnpldczrm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6ZnV0aHl6Znhram5wbGRjenJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjYzNjgsImV4cCI6MjA5NDQwMjM2OH0.QQ8XWuyiiAZm_FglGIpK1kT7eZhRGfMT5RpRS88h9vs';
// Note: If sb_publishable key is needed for a specific library, it's stored here
export const supabasePublishableKey = 'sb_publishable_RrgZ-a9XXkYQkUayn-BRGw_tVJPrx-l';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
