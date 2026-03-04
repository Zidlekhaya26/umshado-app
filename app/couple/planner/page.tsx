'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useCurrency } from '@/app/providers/CurrencyProvider';
import { useSearchParams, useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { UmshadoIcon } from '@/components/ui/UmshadoLogo';
import { supabase } from '@/lib/supabaseClient';
import { generateWhatsappInviteLink } from '@/lib/invite';
import { normalizeInternationalPhone } from '@/lib/whatsapp';
import WhatsAppIcon from '@/components/WhatsAppIcon';
import { useToast } from '@/components/ui/ToastProvider';
import SeatingPlanner from '@/components/SeatingPlanner';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { pickContacts } from '@/lib/contactsBridge';

// ─── DB row types ────────────────────────────────────────

interface DbTask {
  id: string;
  couple_id: string;
  title: string;
  due_date: string | null;
  is_done: boolean;
  created_at: string;
}

interface DbBudgetItem {
  id: string;
  couple_id: string;
  title: string;
  amount: number;
  amount_paid: number;
  category: string | null;
  status: 'planned' | 'partial' | 'paid';
  created_at: string;
}

interface DbGuest {
  id: string;
  couple_id: string;
  full_name: string;
  phone: string | null;
  rsvp_token?: string | null;
  rsvp_status: 'pending' | 'accepted' | 'declined';
  invited_via: 'manual' | 'import' | 'whatsapp';
  plus_one: boolean;
  side: 'groom' | 'bride' | 'both';
  created_at: string;
}

// ─── Empty State ─────────────────────────────────────────

function EmptyState({ icon, title, description, actionLabel, onAction }: {
  icon: string; title: string; description: string; actionLabel: string; onAction: () => void;
}) {
  return (
    <div style={{ background:'#fff', borderRadius:20, border:'2px dashed rgba(184,151,62,0.3)', padding:'32px 20px', textAlign:'center' }}>
      <div style={{ width:56, height:56, background:'rgba(184,151,62,0.1)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:24 }}>{icon}</div>
      <h3 style={{ margin:'0 0 4px', fontSize:15, fontWeight:700, color:'#3d2510', fontFamily:'Georgia,serif' }}>{title}</h3>
      <p style={{ margin:'0 0 18px', fontSize:13, color:'#9a7c58', lineHeight:1.6 }}>{description}</p>
      <button onClick={onAction} style={{ padding:'10px 22px', borderRadius:20, background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 4px 12px rgba(184,151,62,0.3)' }}>{actionLabel}</button>
    </div>
  );
}

// ─── Main Content ────────────────────────────────────────

function CouplePlannerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlTab = searchParams.get('tab') || 'tasks';

  const [activeTab, setActiveTab] = useState<'tasks' | 'budget' | 'guests'>(urlTab as 'tasks' | 'budget' | 'guests');
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const vcardInputRef = useRef<HTMLInputElement | null>(null);
  const [importInProgress, setImportInProgress] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportRows, setPendingImportRows] = useState<any[] | null>(null);
  const toastCtx = useToast();

  // Data
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [budgetItems, setBudgetItems] = useState<DbBudgetItem[]>([]);
  const [guests, setGuests] = useState<DbGuest[]>([]);
  const [seatingAssignments, setSeatingAssignments] = useState<Record<string, { tableId: string; seatIndex: number }>>({});
  const [coupleName, setCoupleName] = useState<string | null>(null);
  const [coupleDate, setCoupleDate] = useState<string | null>(null);
  const [coupleVenue, setCoupleVenue] = useState<string | null>(null);

  // Task form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');

  // Budget form (add + edit)
  const [newBudgetTitle, setNewBudgetTitle] = useState('');
  const [newBudgetAmount, setNewBudgetAmount] = useState('');
  const [newBudgetCategory, setNewBudgetCategory] = useState('');
  const [editingBudgetItem, setEditingBudgetItem] = useState<DbBudgetItem | null>(null);
  const [editBudgetTitle, setEditBudgetTitle] = useState('');
  const [editBudgetAmount, setEditBudgetAmount] = useState('');
  const [editBudgetCategory, setEditBudgetCategory] = useState('');
  const [editBudgetAmountPaid, setEditBudgetAmountPaid] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentItem, setPaymentItem] = useState<DbBudgetItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  // Guest form (add + edit)
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [newGuestPlusOne, setNewGuestPlusOne] = useState(false);
  const [newGuestSide, setNewGuestSide] = useState<'groom' | 'bride' | 'both'>('both');
  const [editingGuest, setEditingGuest] = useState<DbGuest | null>(null);
  const [editGuestName, setEditGuestName] = useState('');
  const [editGuestPhone, setEditGuestPhone] = useState('');
  const [editGuestPlusOne, setEditGuestPlusOne] = useState(false);
  const [editGuestSide, setEditGuestSide] = useState<'groom' | 'bride' | 'both'>('both');

  const loadData = useCallback(async (uid: string) => {
    const [t, b, g] = await Promise.all([
      supabase.from('couple_tasks').select('*').eq('couple_id', uid).order('created_at'),
      supabase.from('couple_budget_items').select('*').eq('couple_id', uid).order('created_at'),
      supabase.from('couple_guests').select('*').eq('couple_id', uid).order('created_at'),
    ]);
    if (t.data) setTasks(t.data);
    if (b.data) setBudgetItems(b.data.map(item => ({ ...item, amount_paid: item.amount_paid ?? 0 })));
    if (g.data) setGuests(g.data.map(guest => ({ ...guest, side: guest.side ?? 'both' })));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/sign-in'); return; }
      setUserId(user.id);
      await loadData(user.id);
      // fetch couple profile name
      try {
        // Try to fetch extended profile fields (may not exist on older schemas)
        const { data: profile, error } = await supabase.from('profiles').select('full_name, wedding_date, wedding_venue').eq('id', user.id).maybeSingle();
        if (!error && profile) {
          setCoupleName((profile as any)?.full_name ?? null);
          setCoupleDate((profile as any)?.wedding_date ?? null);
          setCoupleVenue((profile as any)?.wedding_venue ?? null);
        } else {
          // Fallback to just full_name if extended columns don't exist
          const { data: p2 } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
          setCoupleName((p2 as any)?.full_name ?? null);
        }
      } catch (e) {
        setCoupleName(null);
      }
      setLoaded(true);
    })();
  }, [router, loadData]);

  // Detect restored seating payload (set by admin UI) and dispatch to planner
  useEffect(() => {
    if (!loaded) return;
    try {
      const raw = localStorage.getItem('restored_seating_payload');
      if (!raw) return;
      const payload = JSON.parse(raw);
      // place payload into sessionStorage for in-page consumers
      try { sessionStorage.setItem('active_seating_payload', JSON.stringify(payload)); } catch (e) {}
      // dispatch a global DOM event so any planner component can pick it up
      try {
        const ev = new CustomEvent('umshado:restoreSeating', { detail: payload });
        window.dispatchEvent(ev);
      } catch (e) {
        // ignore
      }
      // remove the one-time restore key
      localStorage.removeItem('restored_seating_payload');
      toastCtx.show('Loaded seating arrangement from Saved Seatings. Open the seating planner to view it.', 'default');
    } catch (e) {
      // ignore parse errors
      console.error('Failed to load restored seating payload', e);
    }
  }, [loaded]);

  const applySeatingPayload = (payload: any) => {
    try {
      const map: Record<string, { tableId: string; seatIndex: number }> = {};
      if (Array.isArray(payload?.tables)) {
        payload.tables.forEach((t: any) => {
          if (!Array.isArray(t.seats)) return;
          t.seats.forEach((guestId: string, idx: number) => {
            if (guestId) map[String(guestId)] = { tableId: String(t.id ?? t.name ?? ''), seatIndex: idx };
          });
        });
      }
      setSeatingAssignments(map);
      toastCtx.show('Seating applied in planner (client-side).', 'default');
    } catch (e) {
      console.error('Failed to apply seating payload', e);
    }
  };

  // Realtime updates for guest list (auto-adjust)
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`guests-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'couple_guests', filter: `couple_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as DbGuest;
          if (!row?.id) return;
          setGuests(prev => {
            const exists = prev.some(g => g.id === row.id);
            if (!exists) return [row, ...prev];
            return prev.map(g => (g.id === row.id ? { ...g, ...row } : g));
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => { if (urlTab !== activeTab) setActiveTab(urlTab as 'tasks' | 'budget' | 'guests'); }, [urlTab]);

  const handleTabChange = (tab: 'tasks' | 'budget' | 'guests') => { setActiveTab(tab); router.push(`/couple/planner?tab=${tab}`); };

  // ── Task actions ───────────────────────────────────────
  const toggleTask = async (task: DbTask) => {
    const { error } = await supabase.from('couple_tasks').update({ is_done: !task.is_done }).eq('id', task.id);
    if (!error) setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: !t.is_done } : t));
  };
  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('couple_tasks').delete().eq('id', id);
    if (!error) setTasks(prev => prev.filter(t => t.id !== id));
  };
  const addTask = async () => {
    if (!newTaskTitle.trim() || !userId) return;
    const { data, error } = await supabase.from('couple_tasks').insert({ couple_id: userId, title: newTaskTitle.trim(), due_date: newTaskDate || null }).select().single();
    if (!error && data) setTasks(prev => [...prev, data]);
    setNewTaskTitle(''); setNewTaskDate(''); setShowTaskModal(false);
  };

  // ── Budget actions ─────────────────────────────────────

  const computeBudgetStatus = (amount: number, amountPaid: number): 'planned' | 'partial' | 'paid' => {
    if (amountPaid <= 0) return 'planned';
    if (amountPaid >= amount) return 'paid';
    return 'partial';
  };

  const addBudgetItem = async () => {
    if (!newBudgetTitle.trim() || !newBudgetAmount || !userId) return;
    const amount = parseFloat(newBudgetAmount);
    const base = { couple_id: userId, title: newBudgetTitle.trim(), amount, category: newBudgetCategory.trim() || null, status: 'planned' as const };
    // Try with amount_paid; fall back without it if column doesn't exist yet
    let result = await supabase.from('couple_budget_items').insert({ ...base, amount_paid: 0 }).select().single();
    if (result.error && result.error.message?.includes('amount_paid')) {
      result = await supabase.from('couple_budget_items').insert(base).select().single();
    }
    if (!result.error && result.data) setBudgetItems(prev => [...prev, { ...result.data, amount_paid: result.data.amount_paid ?? 0 }]);
    setNewBudgetTitle(''); setNewBudgetAmount(''); setNewBudgetCategory(''); setShowBudgetModal(false);
  };

  const startEditBudget = (item: DbBudgetItem) => {
    setEditingBudgetItem(item);
    setEditBudgetTitle(item.title);
    setEditBudgetAmount(String(item.amount));
    setEditBudgetCategory(item.category || '');
    setEditBudgetAmountPaid(String(item.amount_paid || 0));
  };

  const saveEditBudget = async () => {
    if (!editingBudgetItem || !editBudgetTitle.trim() || !editBudgetAmount) return;
    const amount = parseFloat(editBudgetAmount);
    const amountPaid = parseFloat(editBudgetAmountPaid) || 0;
    const status = computeBudgetStatus(amount, amountPaid);
    const base = { title: editBudgetTitle.trim(), amount, category: editBudgetCategory.trim() || null };
    // Try with amount_paid + partial status; fall back without them
    const statusForDb = status === 'partial' ? 'planned' : status; // 'partial' may not be in CHECK yet
    let result = await supabase.from('couple_budget_items').update({ ...base, amount_paid: amountPaid, status }).eq('id', editingBudgetItem.id);
    if (result.error && (result.error.message?.includes('amount_paid') || result.error.message?.includes('partial'))) {
      result = await supabase.from('couple_budget_items').update({ ...base, status: statusForDb }).eq('id', editingBudgetItem.id);
    }
    if (!result.error) {
      setBudgetItems(prev => prev.map(b => b.id === editingBudgetItem.id ? { ...b, ...base, amount_paid: amountPaid, status } : b));
    }
    setEditingBudgetItem(null);
  };

  const openPaymentModal = (item: DbBudgetItem) => {
    setPaymentItem(item);
    setPaymentAmount('');
    setShowPaymentModal(true);
  };

  const recordPayment = async () => {
    if (!paymentItem || !paymentAmount) return;
    const addedPayment = parseFloat(paymentAmount);
    if (addedPayment <= 0) return;
    const newPaid = (paymentItem.amount_paid || 0) + addedPayment;
    const status = computeBudgetStatus(paymentItem.amount, newPaid);
    const statusForDb = status === 'partial' ? 'planned' : status;
    let result = await supabase.from('couple_budget_items').update({ amount_paid: newPaid, status }).eq('id', paymentItem.id);
    if (result.error && (result.error.message?.includes('amount_paid') || result.error.message?.includes('partial'))) {
      // Column doesn't exist yet — just update status
      result = await supabase.from('couple_budget_items').update({ status: statusForDb }).eq('id', paymentItem.id);
      toastCtx.show('Payment recorded locally but your database needs the amount_paid column. Run migration 005 or the ALTER statements.', 'default');
    }
    if (!result.error) {
      setBudgetItems(prev => prev.map(b => b.id === paymentItem.id ? { ...b, amount_paid: newPaid, status } : b));
    }
    setShowPaymentModal(false);
    setPaymentItem(null);
    setPaymentAmount('');
  };

  const deleteBudgetItem = async (id: string) => {
    const { error } = await supabase.from('couple_budget_items').delete().eq('id', id);
    if (!error) setBudgetItems(prev => prev.filter(b => b.id !== id));
  };

  // ── Guest actions ──────────────────────────────────────
  const addGuest = async () => {
    if (!newGuestName.trim() || !userId) return;
    // Validate phone includes country code if provided
    let phoneToSave: string | null = null;
    if (newGuestPhone.trim()) {
      const norm = normalizeInternationalPhone(newGuestPhone.trim());
      if (!norm) {
        toastCtx.show('Please include an international country code (e.g. +27 or +263) in the phone number.', 'error');
        return;
      }
      phoneToSave = norm;
    }

    const base = { couple_id: userId, full_name: newGuestName.trim(), phone: phoneToSave, plus_one: newGuestPlusOne, rsvp_status: 'pending' as const, invited_via: 'manual' as const };
    // Try with side column; fall back without it if column doesn't exist yet
    let result = await supabase.from('couple_guests').insert({ ...base, side: newGuestSide }).select().single();
    if (result.error && result.error.message?.includes('side')) {
      result = await supabase.from('couple_guests').insert(base).select().single();
    }
    if (!result.error && result.data) setGuests(prev => [...prev, { ...result.data, side: result.data.side ?? 'both' }]);
    setNewGuestName(''); setNewGuestPhone(''); setNewGuestPlusOne(false); setNewGuestSide('both'); setShowGuestModal(false);
  };

  // Import contacts (Contacts Picker API if available, fallback to vCard file)
  const parseVCard = (text: string) => {
    const entries: { full_name: string; phone: string | null }[] = [];
    const blocks = text.split(/END:VCARD/i);
    for (const b of blocks) {
      const fnMatch = b.match(/FN:(.+)/i);
      const telMatch = b.match(/TEL[^:]*:(.+)/i);
      if (fnMatch) {
        entries.push({ full_name: fnMatch[1].trim(), phone: telMatch ? telMatch[1].trim() : null });
      }
    }
    return entries;
  };

  const handleVCardFile = async (file?: File) => {
    if (!file) return;
    const txt = await file.text();
    const contacts = parseVCard(txt);
    await importContactList(contacts);
    if (vcardInputRef.current) vcardInputRef.current.value = '';
  };

  const importContactList = async (contacts: { full_name: string; phone: string | null }[]) => {
    if (!userId || contacts.length === 0) return toastCtx.show('No contacts to import or not signed in.', 'error');

    const normalizePhone = (p?: string | null) => {
      if (!p) return null;
      const digits = p.replace(/\D/g, '');
      if (!digits) return null;
      // compare last 9 digits for local/intl variations
      return digits.length > 9 ? digits.slice(-9) : digits;
    };

    const existingPhones = new Set(guests.map(g => normalizePhone(g.phone)));
    const existingNames = new Set(guests.map(g => (g.full_name || '').toLowerCase().trim()));

    const filtered = contacts.filter(c => {
      const name = (c.full_name || '').toLowerCase().trim();
      const phoneNorm = normalizePhone(c.phone);
      if (phoneNorm && existingPhones.has(phoneNorm)) return false;
      if (name && existingNames.has(name)) return false;
      return true;
    });

    if (filtered.length === 0) {
      return toastCtx.show('No new contacts to import (duplicates filtered).', 'default');
    }

    const rows = filtered.map(c => ({
      couple_id: userId,
      full_name: c.full_name,
      phone: c.phone || null,
      plus_one: false,
      rsvp_status: 'pending' as const,
      invited_via: 'import' as const
    }));

    // show confirmation modal instead of window.confirm
    setPendingImportRows(rows);
    setShowImportConfirm(true);
  };

  const performImport = async () => {
    if (!pendingImportRows || !userId) return;
    setShowImportConfirm(false);
    setImportInProgress(true);
    try {
      const result = await supabase.from('couple_guests').insert(pendingImportRows).select();
      if (!result.error && result.data) {
        setGuests(prev => [...result.data.map((g: any) => ({ ...g, side: g.side ?? 'both' })), ...prev]);
        toastCtx.show(`Imported ${result.data.length} contacts.`, 'success');
      } else {
        console.error('Import error', result.error);
        toastCtx.show('Failed to import contacts.', 'error');
      }
    } catch (e) {
      console.error(e);
      toastCtx.show('Failed to import contacts.', 'error');
    } finally {
      setImportInProgress(false);
      setPendingImportRows(null);
    }
  };

  const importContacts = async () => {
    if (!userId) return toastCtx.show('Please sign in first.', 'error');
    // Prefer platform picker (web or native bridge), otherwise fallback to vCard upload
    try {
      const mapped = await pickContacts();
      if (mapped && mapped.length > 0) {
        await importContactList(mapped);
        return;
      }
    } catch (e) {
      console.error('pickContacts failed', e);
    }

    // Fallback: trigger vCard upload
    if (vcardInputRef.current) vcardInputRef.current.click();
    else toastCtx.show('Contact picker not available. Please upload a vCard (.vcf) file.', 'default');
  };

  const startEditGuest = (guest: DbGuest) => {
    setEditingGuest(guest);
    setEditGuestName(guest.full_name);
    setEditGuestPhone(guest.phone || '');
    setEditGuestPlusOne(guest.plus_one);
    setEditGuestSide(guest.side || 'both');
  };

  const saveEditGuest = async () => {
    if (!editingGuest || !editGuestName.trim()) return;
    // Validate phone includes country code if provided
    let phoneToSave: string | null = null;
    if (editGuestPhone.trim()) {
      const norm = normalizeInternationalPhone(editGuestPhone.trim());
      if (!norm) {
        toastCtx.show('Please include an international country code (e.g. +27 or +263) in the phone number.', 'error');
        return;
      }
      phoneToSave = norm;
    }
    const base = { full_name: editGuestName.trim(), phone: phoneToSave, plus_one: editGuestPlusOne };
    let result = await supabase.from('couple_guests').update({ ...base, side: editGuestSide }).eq('id', editingGuest.id);
    if (result.error && result.error.message?.includes('side')) {
      result = await supabase.from('couple_guests').update(base).eq('id', editingGuest.id);
    }
    if (!result.error) {
      setGuests(prev => prev.map(g => g.id === editingGuest.id ? { ...g, ...base, side: editGuestSide } : g));
    }
    setEditingGuest(null);
  };

  const cycleGuestStatus = async (guest: DbGuest) => {
    const order: DbGuest['rsvp_status'][] = ['pending', 'accepted', 'declined'];
    const ns = order[(order.indexOf(guest.rsvp_status) + 1) % order.length];
    const { error } = await supabase.from('couple_guests').update({ rsvp_status: ns }).eq('id', guest.id);
    if (!error) setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, rsvp_status: ns } : g));
  };
  const deleteGuest = async (id: string) => {
    const { error } = await supabase.from('couple_guests').delete().eq('id', id);
    if (!error) setGuests(prev => prev.filter(g => g.id !== id));
  };

  const inviteViaWhatsapp = async (guest: DbGuest) => {
    let phone = guest.phone;
    if (!phone) {
      const p = window.prompt('Enter guest phone number (include country code, e.g. +27831234567)');
      if (!p) return;
      const norm = normalizeInternationalPhone(p.trim());
      if (!norm) {
        toastCtx.show('Phone must include an international country code (e.g. +27).', 'error');
        return;
      }
      phone = norm;
      try {
        const result = await supabase.from('couple_guests').update({ phone }).eq('id', guest.id).select('id, phone, rsvp_token').single();
        if (!result.error && result.data) {
          setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, phone: result.data.phone, rsvp_token: result.data.rsvp_token } : g));
        }
      } catch (e) {
        console.error('Failed to save phone for guest', e);
      }
    }

    // ensure rsvp_token exists
    let token: string | null = (guest as any).rsvp_token ?? null;
    if (!token) {
      token = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : String(Date.now());
      try {
        const save = await supabase.from('couple_guests').update({ rsvp_token: token }).eq('id', guest.id).select('rsvp_token').single();
        if (!save.error && save.data?.rsvp_token) token = save.data.rsvp_token;
        setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, rsvp_token: token } : g));
      } catch (e) {
        console.error('Failed to save rsvp token', e);
      }
    }

    if (!phone) return;

    const url = generateWhatsappInviteLink({ phone, guestId: guest.id, coupleName, guestName: guest.full_name, token, coupleDate, coupleVenue });
    window.open(url, '_blank', 'noopener');
  };

  // ── Computed ───────────────────────────────────────────
  const totalBudget = budgetItems.reduce((s, b) => s + Number(b.amount), 0);
  const totalPaid = budgetItems.reduce((s, b) => s + Number(b.amount_paid || 0), 0);
  const totalOutstanding = totalBudget - totalPaid;

  const { format } = useCurrency();

  const totalGuestCount = guests.reduce((s, g) => s + (g.plus_one ? 2 : 1), 0);
  const acceptedGuests = guests.filter(g => g.rsvp_status === 'accepted').length;
  const pendingGuests = guests.filter(g => g.rsvp_status === 'pending').length;
  const declinedGuests = guests.filter(g => g.rsvp_status === 'declined').length;

  // Side counts (including +1s)
  const groomGuests = guests.filter(g => g.side === 'groom').reduce((s, g) => s + (g.plus_one ? 2 : 1), 0);
  const brideGuests = guests.filter(g => g.side === 'bride').reduce((s, g) => s + (g.plus_one ? 2 : 1), 0);
  const bothGuests = guests.filter(g => g.side === 'both').reduce((s, g) => s + (g.plus_one ? 2 : 1), 0);

  const statusLabel = (s: DbGuest['rsvp_status']) => s === 'pending' ? 'Pending' : s === 'accepted' ? 'Accepted' : 'Declined';
  const statusColor = (s: DbGuest['rsvp_status']) => s === 'accepted' ? 'bg-green-100 text-green-700 hover:bg-green-200' : s === 'pending' ? 'bg-amber-50 text-amber-800 hover:bg-amber-100' : 'bg-red-100 text-red-700 hover:bg-red-200';
  const sideLabel = (s: string) => s === 'groom' ? '🤵 Groom' : s === 'bride' ? '👰 Bride' : '💑 Both';
  const sideColor = (s: string) => s === 'groom' ? 'text-amber-700' : s === 'bride' ? 'text-rose-600' : 'text-stone-500';

  const budgetStatusLabel = (item: DbBudgetItem) => {
    if (item.status === 'paid' || item.amount_paid >= item.amount) return '✓ Fully Paid';
    if (item.status === 'partial' || (item.amount_paid > 0 && item.amount_paid < item.amount)) return `Partial — ${format(Number(item.amount_paid))} of ${format(Number(item.amount))}`;
    return 'Planned';
  };
  const budgetStatusColor = (item: DbBudgetItem) => {
    if (item.status === 'paid' || item.amount_paid >= item.amount) return 'bg-green-100 text-green-700';
    if (item.status === 'partial' || (item.amount_paid > 0 && item.amount_paid < item.amount)) return 'bg-orange-100 text-orange-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  if (!loaded) return <div style={{ minHeight:'100svh', background:'#faf7f2', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid rgba(184,151,62,0.15)', borderTopColor:'#b8973e', animation:'spin 0.8s linear infinite' }} /><style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style></div>;

  return (
    <div style={{ minHeight:'100svh', background:'#faf7f2' }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ maxWidth:900, margin:'0 auto', minHeight:'100svh', display:'flex', flexDirection:'column', paddingBottom:'calc(80px + env(safe-area-inset-bottom))' }}>
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#b8973e,#8a6010)', padding:'22px 20px 18px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-40, right:-40, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,0.06)', pointerEvents:'none' }} />
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <UmshadoIcon size={28} />
            <div>
              <p style={{ margin:0, fontSize:10, color:'rgba(255,255,255,0.55)', letterSpacing:2.5, textTransform:'uppercase' }}>uMshado</p>
              <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:'#fff', fontFamily:'Georgia,serif', lineHeight:1.1 }}>Wedding Planner</h1>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ background:'#fff', borderBottom:'1px solid rgba(184,151,62,0.15)', padding:'12px 16px' }}>
          <div style={{ display:'flex', gap:8 }}>
            {(['tasks', 'budget', 'guests'] as const).map(tab => (
              <button key={tab} onClick={() => handleTabChange(tab)}
                style={{ flex:1, padding:'9px 4px', borderRadius:12, fontSize:13, fontWeight:700, border:'none', cursor:'pointer', transition:'all 0.15s', background: activeTab === tab ? 'linear-gradient(135deg,#b8973e,#8a6010)' : 'rgba(184,151,62,0.07)', color: activeTab === tab ? '#fff' : '#7a5c30', boxShadow: activeTab === tab ? '0 3px 10px rgba(184,151,62,0.25)' : 'none', textTransform:'capitalize' }}>
                {tab === 'tasks' ? '✓ Tasks' : tab === 'budget' ? '💰 Budget' : '👥 Guests'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
          {/* ════════════ TASKS ════════════ */}
          {activeTab === 'tasks' && (
            <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <p style={{ margin:0, fontSize:13, color:'#9a7c58', fontWeight:500 }}>{tasks.length > 0 ? `${tasks.filter(t => t.is_done).length} of ${tasks.length} completed` : 'No tasks yet'}</p>
                <button onClick={() => setShowTaskModal(true)} style={{ padding:'8px 18px', borderRadius:20, background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 3px 10px rgba(184,151,62,0.25)' }}>+ Add Task</button>
              </div>
              {tasks.length === 0 ? (
                <EmptyState icon="📋" title="No tasks yet" description="Add your first wedding planning task to get started." actionLabel="+ Add Task" onAction={() => setShowTaskModal(true)} />
              ) : (
                <div style={{ background:'#fff', borderRadius:20, border:'1.5px solid rgba(184,151,62,0.15)', overflow:'hidden' }}>
                  {tasks.map((task, i) => (
                    <div key={task.id} style={{ padding:'14px 16px', borderBottom: i < tasks.length - 1 ? '1px solid rgba(184,151,62,0.1)' : 'none' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                        <button onClick={() => toggleTask(task)} style={{ width:22, height:22, borderRadius:6, border:`2px solid ${task.is_done ? '#3d9e6a' : 'rgba(184,151,62,0.4)'}`, background: task.is_done ? '#3d9e6a' : 'transparent', flexShrink:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', marginTop:1, transition:'all 0.15s' }}>
                          {task.is_done && <svg width="11" height="11" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                        </button>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ margin:0, fontSize:14, fontWeight:600, color: task.is_done ? '#bbb' : '#3d2510', textDecoration: task.is_done ? 'line-through' : 'none' }}>{task.title}</p>
                          <p style={{ margin:'3px 0 0', fontSize:11, color:'#9a7c58' }}>{task.due_date ? new Date(task.due_date).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : 'No due date'}</p>
                        </div>
                        <button onClick={() => deleteTask(task.id)} style={{ padding:6, color:'#ccc', cursor:'pointer', background:'none', border:'none', flexShrink:0 }} aria-label="Delete task">
                          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════ BUDGET ════════════ */}
          {activeTab === 'budget' && (
            <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>
              {budgetItems.length === 0 ? (
                <EmptyState icon="💰" title="No budget items" description="Add budget items to start tracking your wedding spending." actionLabel="+ Add Item" onAction={() => setShowBudgetModal(true)} />
              ) : (
                <>
                  {/* Summary Card */}
                  <div style={{ background:'linear-gradient(135deg,#b8973e,#8a6010)', borderRadius:20, padding:'20px', color:'#fff', boxShadow:'0 4px 20px rgba(184,151,62,0.3)' }}>
                    <p style={{ margin:'0 0 4px', fontSize:12, opacity:0.75, letterSpacing:1, textTransform:'uppercase' }}>Total Budget</p>
                    <p style={{ margin:'0 0 16px', fontSize:32, fontWeight:700, fontFamily:'Georgia,serif' }}>{format(totalBudget)}</p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.2)' }}>
                      <div><p style={{ margin:'0 0 2px', fontSize:10, opacity:0.7 }}>Paid</p><p style={{ margin:0, fontSize:16, fontWeight:700 }}>{format(totalPaid)}</p></div>
                      <div><p style={{ margin:'0 0 2px', fontSize:10, opacity:0.7 }}>Outstanding</p><p style={{ margin:0, fontSize:16, fontWeight:700 }}>{format(totalOutstanding)}</p></div>
                      <div><p style={{ margin:'0 0 2px', fontSize:10, opacity:0.7 }}>Progress</p><p style={{ margin:0, fontSize:16, fontWeight:700 }}>{totalBudget > 0 ? Math.round((totalPaid / totalBudget) * 100) : 0}%</p></div>
                    </div>
                    <div style={{ marginTop:12, height:6, background:'rgba(255,255,255,0.2)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', background:'#fff', borderRadius:3, transition:'width 0.5s', width:`${totalBudget > 0 ? Math.min((totalPaid / totalBudget) * 100, 100) : 0}%` }} />
                    </div>
                  </div>

                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#3d2510' }}>Budget Items</p>
                    <button onClick={() => setShowBudgetModal(true)} style={{ padding:'8px 18px', borderRadius:20, background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 3px 10px rgba(184,151,62,0.25)' }}>+ Add Item</button>
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {budgetItems.map(item => (
                      <div key={item.id} style={{ background:'#fff', borderRadius:16, border:'1.5px solid rgba(184,151,62,0.15)', padding:'14px 16px' }}>
                        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#3d2510' }}>{item.title}</p>
                            {item.category && <p style={{ margin:'2px 0 0', fontSize:11, color:'#9a7c58' }}>{item.category}</p>}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, marginLeft:8 }}>
                            <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#3d2510' }}>{format(Number(item.amount))}</p>
                            <button onClick={() => startEditBudget(item)} style={{ padding:5, color:'#ccc', cursor:'pointer', background:'none', border:'none' }} aria-label="Edit item">
                              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => deleteBudgetItem(item.id)} style={{ padding:5, color:'#ccc', cursor:'pointer', background:'none', border:'none' }} aria-label="Delete item">
                              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>
                        {item.amount > 0 && (
                          <div style={{ marginBottom:8, height:5, background:'rgba(184,151,62,0.12)', borderRadius:3, overflow:'hidden' }}>
                            <div style={{ height:'100%', borderRadius:3, transition:'width 0.3s', background: item.amount_paid >= item.amount ? '#3d9e6a' : item.amount_paid > 0 ? '#e8a820' : 'rgba(184,151,62,0.3)', width:`${Math.min((Number(item.amount_paid || 0) / Number(item.amount)) * 100, 100)}%` }} />
                          </div>
                        )}
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${budgetStatusColor(item)}`}>{budgetStatusLabel(item)}</span>
                          {item.status !== 'paid' && item.amount_paid < item.amount && (
                            <button onClick={() => openPaymentModal(item)} style={{ padding:'4px 12px', borderRadius:20, background:'rgba(184,151,62,0.1)', color:'#8a6010', fontSize:11, fontWeight:700, border:'1px solid rgba(184,151,62,0.3)', cursor:'pointer' }}>+ Record Payment</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════════════ GUESTS ════════════ */}
          {activeTab === 'guests' && (
            <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>
              <SeatingPlanner guests={guests} onApply={applySeatingPayload} />
              {guests.length === 0 ? (
                <EmptyState icon="👥" title="No guests yet" description="Start building your guest list for the big day." actionLabel="+ Add Guest" onAction={() => setShowGuestModal(true)} />
              ) : (
                <>
                  {/* Summary Card */}
                  <div style={{ background:'linear-gradient(135deg,#b8973e,#8a6010)', borderRadius:20, padding:'20px', color:'#fff', boxShadow:'0 4px 20px rgba(184,151,62,0.3)' }}>
                    <p style={{ margin:'0 0 4px', fontSize:12, color:'rgba(255,255,255,0.92)', letterSpacing:1, textTransform:'uppercase' }}>Total Guests</p>
                    <p style={{ margin:'0 0 16px', fontSize:32, fontWeight:700, fontFamily:'Georgia,serif', color:'#fff' }}>{totalGuestCount}</p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.2)' }}>
                      <div><p style={{ margin:'0 0 2px', fontSize:10, color:'rgba(255,255,255,0.9)' }}>Accepted</p><p style={{ margin:0, fontSize:16, fontWeight:700, color:'#fff' }}>{acceptedGuests}</p></div>
                      <div><p style={{ margin:'0 0 2px', fontSize:10, color:'rgba(255,255,255,0.9)' }}>Pending</p><p style={{ margin:0, fontSize:16, fontWeight:700, color:'#fff' }}>{pendingGuests}</p></div>
                      <div><p style={{ margin:'0 0 2px', fontSize:10, color:'rgba(255,255,255,0.9)' }}>Declined</p><p style={{ margin:0, fontSize:16, fontWeight:700, color:'#fff' }}>{declinedGuests}</p></div>
                    </div>
                  </div>

                  {/* Side breakdown */}
                  <div style={{ background:'#fff', borderRadius:16, border:'1.5px solid rgba(184,151,62,0.15)', padding:'14px 16px' }}>
                    <p style={{ margin:'0 0 12px', fontSize:13, fontWeight:700, color:'#3d2510' }}>Guest Breakdown</p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                      <div style={{ textAlign:'center', padding:'10px 8px', background:'rgba(184,151,62,0.07)', borderRadius:12, border:'1px solid rgba(184,151,62,0.15)' }}>
                        <p style={{ margin:'0 0 3px', fontSize:22, fontWeight:700, color:'#8a6010' }}>{groomGuests}</p>
                        <p style={{ margin:0, fontSize:11, fontWeight:600, color:'#7a5c30' }}>🤵 Groom</p>
                      </div>
                      <div style={{ textAlign:'center', padding:'10px 8px', background:'rgba(220,80,100,0.06)', borderRadius:12, border:'1px solid rgba(220,80,100,0.12)' }}>
                        <p style={{ margin:'0 0 3px', fontSize:22, fontWeight:700, color:'#b83050' }}>{brideGuests}</p>
                        <p style={{ margin:0, fontSize:11, fontWeight:600, color:'#b83050' }}>👰 Bride</p>
                      </div>
                      <div style={{ textAlign:'center', padding:'10px 8px', background:'rgba(90,70,50,0.06)', borderRadius:12, border:'1px solid rgba(90,70,50,0.12)' }}>
                        <p style={{ margin:'0 0 3px', fontSize:22, fontWeight:700, color:'#5a4030' }}>{bothGuests}</p>
                        <p style={{ margin:0, fontSize:11, fontWeight:600, color:'#5a4030' }}>💑 Both</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                    <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#3d2510' }}>Guest List</p>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      {guests.filter(g => g.rsvp_status === 'pending' && g.phone).length > 0 && (
                        <button
                          onClick={() => {
                            const pending = guests.filter(g => g.rsvp_status === 'pending' && g.phone);
                            if (!window.confirm('Send WhatsApp invites to ' + pending.length + ' pending guest' + (pending.length > 1 ? 's' : '') + ' with a phone number?')) return;
                            pending.forEach((g, i) => { setTimeout(() => inviteViaWhatsapp(g), i * 800); });
                          }}
                          style={{ padding:'8px 14px', borderRadius:20, background:'#25D366', color:'#fff', fontSize:12, fontWeight:700, border:'none', cursor:'pointer' }}
                        >
                          Invite All ({guests.filter(g => g.rsvp_status === 'pending' && g.phone).length})
                        </button>
                      )}
                      <button onClick={() => setShowGuestModal(true)} style={{ padding:'8px 18px', borderRadius:20, background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 3px 10px rgba(184,151,62,0.25)' }}>+ Add Guest</button>
                      <button onClick={importContacts} disabled={importInProgress} style={{ padding:'8px 14px', borderRadius:20, background:'#fff', color: importInProgress ? '#ccc' : '#7a5c30', fontSize:12, fontWeight:600, border:'1.5px solid rgba(184,151,62,0.25)', cursor: importInProgress ? 'default' : 'pointer' }}>{importInProgress ? 'Importing…' : 'Import'}</button>
                    </div>
                  </div>

                  <div style={{ background:'#fff', borderRadius:16, border:'1.5px solid rgba(184,151,62,0.15)', overflow:'hidden' }}>
                    {guests.map((guest, i) => (
                      <div key={guest.id} style={{ padding:'14px 16px', borderBottom: i < guests.length - 1 ? '1px solid rgba(184,151,62,0.1)' : 'none' }}>
                        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ margin:0, fontSize:14, fontWeight:600, color:'#3d2510' }}>{guest.full_name}</p>
                            {guest.phone && <p style={{ margin:'2px 0 0', fontSize:11, color:'#9a7c58' }}>{guest.phone}</p>}
                            {seatingAssignments[guest.id] && (
                              <p style={{ margin:'2px 0 0', fontSize:11, color:'#9a7c58' }}>💺 <span style={{ fontWeight:700, color:'#3d2510' }}>{seatingAssignments[guest.id].tableId}</span></p>
                            )}
                            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, flexWrap:'wrap' }}>
                              <span className={`text-xs font-semibold ${sideColor(guest.side)}`}>{sideLabel(guest.side)}</span>
                              {guest.plus_one && <span style={{ fontSize:10, background:'rgba(184,151,62,0.1)', color:'#8a6010', padding:'1px 7px', borderRadius:20, fontWeight:600 }}>+1</span>}
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                            <button onClick={() => cycleGuestStatus(guest)} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${statusColor(guest.rsvp_status)}`}>{statusLabel(guest.rsvp_status)}</button>
                            <button onClick={() => startEditGuest(guest)} style={{ padding:5, color:'#ccc', cursor:'pointer', background:'none', border:'none' }} aria-label="Edit guest">
                              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => inviteViaWhatsapp(guest)} style={{ padding:5, color:'#25D366', cursor:'pointer', background:'none', border:'none' }} aria-label="Invite via WhatsApp">
                              <WhatsAppIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteGuest(guest.id)} style={{ padding:5, color:'#ccc', cursor:'pointer', background:'none', border:'none' }} aria-label="Delete guest">
                              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ════════════ MODALS ════════════ */}

      {/* Add Task Modal */}
      {showTaskModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:24, boxShadow:'0 16px 48px rgba(0,0,0,0.18)', width:'100%', maxWidth:400, padding:24 }}>
            <h3 style={{ margin:'0 0 18px', fontSize:17, fontWeight:700, color:'#3d2510', fontFamily:'Georgia,serif' }}>Add New Task</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>TASK TITLE</label><input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="e.g., Book hair & makeup artist" style={{ width:'100%', padding:'10px 14px', border:'1.5px solid rgba(184,151,62,0.3)', borderRadius:12, fontSize:14, outline:'none', background:'#faf7f2', color:'#3d2510', boxSizing:'border-box' }} /></div>
              <div><label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>DUE DATE (OPTIONAL)</label><input type="date" value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)} style={{ width:'100%', padding:'10px 14px', border:'1.5px solid rgba(184,151,62,0.3)', borderRadius:12, fontSize:14, outline:'none', background:'#faf7f2', color:'#3d2510', boxSizing:'border-box' }} /></div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowTaskModal(false)} style={{ flex:1, padding:'12px', borderRadius:14, background:'#f5f0e8', color:'#7a5c30', fontSize:14, fontWeight:700, border:'none', cursor:'pointer' }}>Cancel</button>
              <button onClick={addTask} style={{ flex:1, padding:'12px', borderRadius:14, background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 4px 14px rgba(184,151,62,0.3)' }}>Add Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Budget Modal */}
      {showBudgetModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:24, boxShadow:'0 16px 48px rgba(0,0,0,0.18)', width:'100%', maxWidth:400, padding:24 }}>
            <h3 style={{ margin:'0 0 18px', fontSize:17, fontWeight:700, color:'#3d2510', fontFamily:'Georgia,serif' }}>Add Budget Item</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>ITEM NAME</label><input type="text" value={newBudgetTitle} onChange={e => setNewBudgetTitle(e.target.value)} placeholder="e.g., Catering deposit" style={{ width:'100%', padding:'10px 14px', border:'1.5px solid rgba(184,151,62,0.3)', borderRadius:12, fontSize:14, outline:'none', background:'#faf7f2', color:'#3d2510', boxSizing:'border-box' }} /></div>
              <div><label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>TOTAL AMOUNT</label><input type="number" value={newBudgetAmount} onChange={e => setNewBudgetAmount(e.target.value)} placeholder="e.g., 15000" style={{ width:'100%', padding:'10px 14px', border:'1.5px solid rgba(184,151,62,0.3)', borderRadius:12, fontSize:14, outline:'none', background:'#faf7f2', color:'#3d2510', boxSizing:'border-box' }} /></div>
              <div><label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>CATEGORY (OPTIONAL)</label><input type="text" value={newBudgetCategory} onChange={e => setNewBudgetCategory(e.target.value)} placeholder="e.g., Venue, Catering, Décor" style={{ width:'100%', padding:'10px 14px', border:'1.5px solid rgba(184,151,62,0.3)', borderRadius:12, fontSize:14, outline:'none', background:'#faf7f2', color:'#3d2510', boxSizing:'border-box' }} /></div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowBudgetModal(false)} style={{ flex:1, padding:'12px', borderRadius:14, background:'#f5f0e8', color:'#7a5c30', fontSize:14, fontWeight:700, border:'none', cursor:'pointer' }}>Cancel</button>
              <button onClick={addBudgetItem} style={{ flex:1, padding:'12px', borderRadius:14, background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 4px 14px rgba(184,151,62,0.3)' }}>Add Item</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Budget Modal */}
      {editingBudgetItem && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:24, boxShadow:'0 16px 48px rgba(0,0,0,0.18)', width:'100%', maxWidth:400, padding:24 }}>
            <h3 style={{ margin:'0 0 18px', fontSize:17, fontWeight:700, color:'#3d2510', fontFamily:'Georgia,serif' }}>Edit Budget Item</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>ITEM NAME</label><input type="text" value={editBudgetTitle} onChange={e => setEditBudgetTitle(e.target.value)} style={{ width:'100%', padding:'10px 14px', border:'1.5px solid rgba(184,151,62,0.3)', borderRadius:12, fontSize:14, outline:'none', background:'#faf7f2', color:'#3d2510', boxSizing:'border-box' }} /></div>
              <div><label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>TOTAL AMOUNT</label><input type="number" value={editBudgetAmount} onChange={e => setEditBudgetAmount(e.target.value)} style={{ width:'100%', padding:'10px 14px', border:'1.5px solid rgba(184,151,62,0.3)', borderRadius:12, fontSize:14, outline:'none', background:'#faf7f2', color:'#3d2510', boxSizing:'border-box' }} /></div>
              <div><label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>AMOUNT PAID</label><input type="number" value={editBudgetAmountPaid} onChange={e => setEditBudgetAmountPaid(e.target.value)} style={{ width:'100%', padding:'10px 14px', border:'1.5px solid rgba(184,151,62,0.3)', borderRadius:12, fontSize:14, outline:'none', background:'#faf7f2', color:'#3d2510', boxSizing:'border-box' }} /></div>
              <div><label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>CATEGORY (OPTIONAL)</label><input type="text" value={editBudgetCategory} onChange={e => setEditBudgetCategory(e.target.value)} style={{ width:'100%', padding:'10px 14px', border:'1.5px solid rgba(184,151,62,0.3)', borderRadius:12, fontSize:14, outline:'none', background:'#faf7f2', color:'#3d2510', boxSizing:'border-box' }} /></div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setEditingBudgetItem(null)} style={{ flex:1, padding:'12px', borderRadius:14, background:'#f5f0e8', color:'#7a5c30', fontSize:14, fontWeight:700, border:'none', cursor:'pointer' }}>Cancel</button>
              <button onClick={saveEditBudget} style={{ flex:1, padding:'12px', borderRadius:14, background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 4px 14px rgba(184,151,62,0.3)' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && paymentItem && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:24, boxShadow:'0 16px 48px rgba(0,0,0,0.18)', width:'100%', maxWidth:400, padding:24 }}>
            <h3 style={{ margin:'0 0 4px', fontSize:17, fontWeight:700, color:'#3d2510', fontFamily:'Georgia,serif' }}>Record Payment</h3>
            <p style={{ margin:'0 0 18px', fontSize:13, color:'#9a7c58' }}>{paymentItem.title} — Outstanding: {format(Number(paymentItem.amount) - Number(paymentItem.amount_paid || 0))}</p>
            <div><label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>PAYMENT AMOUNT</label><input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="e.g., 5000" style={{ width:'100%', padding:'10px 14px', border:'1.5px solid rgba(184,151,62,0.3)', borderRadius:12, fontSize:14, outline:'none', background:'#faf7f2', color:'#3d2510', boxSizing:'border-box' }} autoFocus /></div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => { setShowPaymentModal(false); setPaymentItem(null); }} style={{ flex:1, padding:'12px', borderRadius:14, background:'#f5f0e8', color:'#7a5c30', fontSize:14, fontWeight:700, border:'none', cursor:'pointer' }}>Cancel</button>
              <button onClick={recordPayment} style={{ flex:1, padding:'12px', borderRadius:14, background:'linear-gradient(135deg,#3d9e6a,#2d7a52)', color:'#fff', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 4px 14px rgba(61,158,106,0.3)' }}>Record Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Guest Modal */}
      {showGuestModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:24, boxShadow:'0 16px 48px rgba(0,0,0,0.18)', width:'100%', maxWidth:400, padding:24 }}>
            <h3 style={{ margin:'0 0 18px', fontSize:17, fontWeight:700, color:'#3d2510', fontFamily:'Georgia,serif' }}>Add New Guest</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>GUEST NAME</label><input type="text" value={newGuestName} onChange={e => setNewGuestName(e.target.value)} placeholder="e.g., Mthabisi" style={{ width:'100%', padding:'10px 14px', border:'1.5px solid rgba(184,151,62,0.3)', borderRadius:12, fontSize:14, outline:'none', background:'#faf7f2', color:'#3d2510', boxSizing:'border-box' }} /></div>
              <div><label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>PHONE (OPTIONAL)</label><input type="tel" value={newGuestPhone} onChange={e => setNewGuestPhone(e.target.value)} placeholder="e.g., +27831234567" style={{ width:'100%', padding:'10px 14px', border:'1.5px solid rgba(184,151,62,0.3)', borderRadius:12, fontSize:14, outline:'none', background:'#faf7f2', color:'#3d2510', boxSizing:'border-box' }} /></div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>SIDE</label>
                <div style={{ display:'flex', gap:8 }}>
                  {(['groom', 'bride', 'both'] as const).map(side => (
                    <button key={side} onClick={() => setNewGuestSide(side)}
                      style={{ flex:1, padding:'9px 4px', borderRadius:12, fontSize:12, fontWeight:700, border:`1.5px solid ${newGuestSide === side ? '#b8973e' : 'rgba(184,151,62,0.2)'}`, background: newGuestSide === side ? 'linear-gradient(135deg,#b8973e,#8a6010)' : '#faf7f2', color: newGuestSide === side ? '#fff' : '#7a5c30', cursor:'pointer', transition:'all 0.15s' }}>
                      {side === 'groom' ? '🤵 Groom' : side === 'bride' ? '👰 Bride' : '💑 Both'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}><input type="checkbox" id="plusOne" checked={newGuestPlusOne} onChange={e => setNewGuestPlusOne(e.target.checked)} style={{ width:18, height:18, accentColor:'#b8973e', cursor:'pointer' }} /><label htmlFor="plusOne" style={{ fontSize:13, fontWeight:600, color:'#5c3d28', cursor:'pointer' }}>Allow +1</label></div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowGuestModal(false)} style={{ flex:1, padding:'12px', borderRadius:14, background:'#f5f0e8', color:'#7a5c30', fontSize:14, fontWeight:700, border:'none', cursor:'pointer' }}>Cancel</button>
              <button onClick={addGuest} style={{ flex:1, padding:'12px', borderRadius:14, background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 4px 14px rgba(184,151,62,0.3)' }}>Add Guest</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Guest Modal */}
      {editingGuest && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:24, boxShadow:'0 16px 48px rgba(0,0,0,0.18)', width:'100%', maxWidth:400, padding:24 }}>
            <h3 style={{ margin:'0 0 18px', fontSize:17, fontWeight:700, color:'#3d2510', fontFamily:'Georgia,serif' }}>Edit Guest</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>GUEST NAME</label><input type="text" value={editGuestName} onChange={e => setEditGuestName(e.target.value)} style={{ width:'100%', padding:'10px 14px', border:'1.5px solid rgba(184,151,62,0.3)', borderRadius:12, fontSize:14, outline:'none', background:'#faf7f2', color:'#3d2510', boxSizing:'border-box' }} /></div>
              <div><label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>PHONE (OPTIONAL)</label><input type="tel" value={editGuestPhone} onChange={e => setEditGuestPhone(e.target.value)} placeholder="e.g., +27831234567" style={{ width:'100%', padding:'10px 14px', border:'1.5px solid rgba(184,151,62,0.3)', borderRadius:12, fontSize:14, outline:'none', background:'#faf7f2', color:'#3d2510', boxSizing:'border-box' }} /></div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5c3d28', marginBottom:6, letterSpacing:0.5 }}>SIDE</label>
                <div style={{ display:'flex', gap:8 }}>
                  {(['groom', 'bride', 'both'] as const).map(side => (
                    <button key={side} onClick={() => setEditGuestSide(side)}
                      style={{ flex:1, padding:'9px 4px', borderRadius:12, fontSize:12, fontWeight:700, border:`1.5px solid ${editGuestSide === side ? '#b8973e' : 'rgba(184,151,62,0.2)'}`, background: editGuestSide === side ? 'linear-gradient(135deg,#b8973e,#8a6010)' : '#faf7f2', color: editGuestSide === side ? '#fff' : '#7a5c30', cursor:'pointer', transition:'all 0.15s' }}>
                      {side === 'groom' ? '🤵 Groom' : side === 'bride' ? '👰 Bride' : '💑 Both'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}><input type="checkbox" id="editPlusOne" checked={editGuestPlusOne} onChange={e => setEditGuestPlusOne(e.target.checked)} style={{ width:18, height:18, accentColor:'#b8973e', cursor:'pointer' }} /><label htmlFor="editPlusOne" style={{ fontSize:13, fontWeight:600, color:'#5c3d28', cursor:'pointer' }}>Allow +1</label></div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setEditingGuest(null)} style={{ flex:1, padding:'12px', borderRadius:14, background:'#f5f0e8', color:'#7a5c30', fontSize:14, fontWeight:700, border:'none', cursor:'pointer' }}>Cancel</button>
              <button onClick={saveEditGuest} style={{ flex:1, padding:'12px', borderRadius:14, background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 4px 14px rgba(184,151,62,0.3)' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Confirmation Modal */}
      <ConfirmModal
        open={showImportConfirm}
        title="Import Contacts"
        message={`Import ${pendingImportRows?.length ?? 0} contacts to your guest list? They will be added as pending.`}
        confirmLabel={importInProgress ? 'Importing…' : 'Import'}
        cancelLabel="Cancel"
        onConfirm={performImport}
        onClose={() => { setShowImportConfirm(false); setPendingImportRows(null); }}
      />

      <input ref={vcardInputRef} type="file" accept=".vcf,text/vcard" onChange={e => handleVCardFile(e.target.files?.[0])} className="hidden" />
      <BottomNav />
    </div>
  );
}

export default function CouplePlanner() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100svh', background:'#faf7f2', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid rgba(184,151,62,0.15)', borderTopColor:'#b8973e', animation:'spin 0.8s linear infinite' }} /></div>}>
      <CouplePlannerContent />
    </Suspense>
  );
}
