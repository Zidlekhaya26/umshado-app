'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SupabaseTestPage() {
  const [sessionStatus, setSessionStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const checkSession = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        setSessionStatus(`Error: ${error.message}`);
      } else if (data.session) {
        setSessionStatus(`Session active! User: ${data.session.user.email}`);
      } else {
        setSessionStatus('No active session found');
      }
    } catch (err) {
      setSessionStatus(`Exception: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6 bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Supabase Connection Test</h1>
        
        <div className="space-y-4">
          <button
            onClick={checkSession}
            disabled={loading}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Checking...' : 'Check Session'}
          </button>

          {sessionStatus && (
            <div className={`p-4 rounded-xl border-2 ${
              sessionStatus.includes('Error') || sessionStatus.includes('Exception')
                ? 'bg-red-50 border-red-200 text-red-800'
                : sessionStatus.includes('No active session')
                ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              <p className="text-sm font-semibold">Status:</p>
              <p className="text-sm mt-1">{sessionStatus}</p>
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-600">
              <strong>Supabase URL:</strong>
              <br />
              {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set'}
            </p>
            <p className="text-xs text-gray-600 mt-2">
              <strong>Anon Key:</strong>
              <br />
              {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
                ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` 
                : 'Not set'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
