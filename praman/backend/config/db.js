const path = require('path');
const dotenv = require('dotenv');

// Ensure environment variables are loaded regardless of import location
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const { createClient } = require('@supabase/supabase-js');

let supabaseUrl = process.env.SUPABASE_URL || 'https://your-supabase-project.supabase.co';
if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = 'https://your-supabase-project.supabase.co';
}
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your_supabase_anon_key';

// Initialize Supabase Client
const supabase = createClient(supabaseUrl, supabaseKey);

const connectDB = async () => {
  console.log(`[PRAMAN] Initialized Supabase PostgreSQL Client (${supabaseUrl})`);
  return supabase;
};

const disconnectDB = async () => {
  // Supabase client uses stateless HTTP REST queries
  return true;
};

module.exports = { supabase, connectDB, disconnectDB };
