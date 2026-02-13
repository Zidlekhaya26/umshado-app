import { createServiceClient } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';

type Props = { params: { guestId: string } };

export default async function RSVPPage({ params }: Props) {
  const { guestId } = params;
  const supabase = createServiceClient();

  // Basic validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(guestId)) return notFound();

  const { data: guest } = await supabase.from('couple_guests').select('*').eq('id', guestId).maybeSingle();
  if (!guest) return notFound();

  // Try to fetch couple profile name if available
  let coupleName: string | null = null;
  try {
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', guest.couple_id).maybeSingle();
    if (profile?.full_name) coupleName = profile.full_name;
  } catch (e) {
    // ignore
  }

  // Render a small client-side form for RSVP
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">You're invited</h1>
        <p className="text-sm text-gray-600 mb-4">{coupleName ? `${coupleName} invited you to their wedding.` : `You've been invited.`}</p>
        <p className="text-sm text-gray-700 font-semibold mb-4">{guest.full_name}</p>
        <div id="rsvp-root"></div>

        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            const root = document.getElementById('rsvp-root');
            if(!root) return;
            root.innerHTML = `
              <div style="display:flex;gap:8px;justify-content:center">
                <button id="accept" style="padding:10px 18px;border-radius:8px;background:#10B981;color:white;border:none;">Accept</button>
                <button id="decline" style="padding:10px 18px;border-radius:8px;background:#EF4444;color:white;border:none;">Decline</button>
              </div>
              <p id="msg" style="margin-top:12px;color:#374151;font-size:14px"></p>
            `;
            function update(status){
              fetch('/api/rsvp', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ guestId: '${guestId}', status })})
                .then(r=>r.json())
                .then(j=>{
                  if(j?.success){ document.getElementById('msg').textContent = 'Thanks — your RSVP has been recorded.'; document.getElementById('accept').disabled=true; document.getElementById('decline').disabled=true; }
                  else document.getElementById('msg').textContent = 'Sorry, we could not record your RSVP.';
                }).catch(()=>{ document.getElementById('msg').textContent = 'Network error, please try again.'; });
            }
            document.addEventListener('click', function(e){
              if(e.target && e.target.id === 'accept') update('accepted');
              if(e.target && e.target.id === 'decline') update('declined');
            });
          })();
        ` }} />
      </div>
    </div>
  );
}
