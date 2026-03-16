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
import { useToast } from '@/components/ui/ToastProvider';
import SeatingPlanner from '@/components/SeatingPlanner';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { pickContacts } from '@/lib/contactsBridge';
import ContactImportSheet, { ImportedContact } from '@/components/ContactImportSheet';

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
    <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
      <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">{icon}</span>
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600 mb-5">{description}</p>
      <button onClick={onAction} className="px-5 py-2.5 bg-purple-600 text-white rounded-full text-sm font-semibold hover:bg-purple-700 transition-colors shadow-md">
        {actionLabel}
      </button>
    </div>
  );
}

// ─── Main Content ────────────────────────────────────────

function CouplePlannerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlTab = searchParams.get('tab') || 'tasks';

  const [activeTab, setActiveTab] = useState<'tasks' | 'budget' | 'guests' | 'seating'>(urlTab as 'tasks' | 'budget' | 'guests' | 'seating');
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showContactImport, setShowContactImport] = useState(false);
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
    console.log('[Planner] Applying seating payload:', payload);
    try {
      const map: Record<string, { tableId: string; seatIndex: number }> = {};
      
      if (!payload || typeof payload !== 'object') {
        console.warn('[Planner] Invalid payload - not an object:', payload);
        toastCtx.show('Invalid seating data', 'error');
        return;
      }

      if (!Array.isArray(payload.tables)) {
        console.warn('[Planner] Payload missing tables array');
        toastCtx.show('Seating data has no tables', 'error');
        return;
      }

      let assignedCount = 0;
      payload.tables.forEach((t: any, tableIndex: number) => {
        if (!t || typeof t !== 'object') {
          console.warn(`[Planner] Invalid table at index ${tableIndex}:`, t);
          return;
        }

        if (!Array.isArray(t.seats)) {
          console.warn(`[Planner] Table ${t.id || t.name || tableIndex} has no seats array`);
          return;
        }

        const tableId = String(t.id || t.name || `table-${tableIndex + 1}`);
        
        t.seats.forEach((guestId: any, idx: number) => {
          if (guestId && typeof guestId === 'string' && guestId.trim() !== '') {
            map[guestId.trim()] = { tableId, seatIndex: idx };
            assignedCount++;
          }
        });
      });

      console.log(`[Planner] Mapped ${assignedCount} guest assignments across ${payload.tables.length} tables`);
      setSeatingAssignments(map);
      toastCtx.show(`Seating applied: ${assignedCount} guests at ${payload.tables.length} tables`, 'default');
    } catch (e: any) {
      console.error('[Planner] Failed to apply seating payload:', e);
      toastCtx.show(`Failed to apply seating: ${e.message}`, 'error');
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

  useEffect(() => { if (urlTab !== activeTab) setActiveTab(urlTab as 'tasks' | 'budget' | 'guests' | 'seating'); }, [urlTab]);

  const handleTabChange = (tab: 'tasks' | 'budget' | 'guests' | 'seating') => { setActiveTab(tab); router.push(`/couple/planner?tab=${tab}`); };

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

  // ── Contact import (via ContactImportSheet) ────────────
  const handleContactImport = async (contacts: ImportedContact[]) => {
    if (!userId || contacts.length === 0) return;
    setShowContactImport(false);
    setImportInProgress(true);

    try {
      const normalizePhone = (p?: string | null) => {
        if (!p) return null;
        const digits = p.replace(/\D/g, '');
        if (!digits) return null;
        return digits.length > 9 ? digits.slice(-9) : digits;
      };

      const existingPhones = new Set(guests.map(g => normalizePhone(g.phone)));
      const existingNames = new Set(guests.map(g => g.full_name.toLowerCase().trim()));

      const rows = contacts
        .filter(c => {
          const normPhone = normalizePhone(c.phone);
          if (normPhone && existingPhones.has(normPhone)) return false;
          const normName = c.full_name.toLowerCase().trim();
          if (existingNames.has(normName)) return false;
          return true;
        })
        .map(c => ({
          couple_id: userId,
          full_name: c.full_name,
          phone: c.phone || null,
          plus_one: false,
          rsvp_status: 'pending' as const,
          invited_via: 'import' as const,
          side: 'both' as const,
        }));

      if (rows.length === 0) {
        toastCtx.show('All contacts are already in your guest list.', 'default');
        setImportInProgress(false);
        return;
      }

      const { data, error } = await supabase.from('couple_guests').insert(rows).select();
      if (!error && data) {
        setGuests(prev => [...prev, ...data.map(d => ({ ...d, side: d.side ?? 'both' }))]);
        toastCtx.show(`Imported ${data.length} guest${data.length === 1 ? '' : 's'}.`, 'success');
      } else {
        toastCtx.show('Failed to import contacts.', 'error');
      }
    } finally {
      setImportInProgress(false);
    }
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
  const statusColor = (s: DbGuest['rsvp_status']) => s === 'accepted' ? 'bg-green-100 text-green-700 hover:bg-green-200' : s === 'pending' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-red-100 text-red-700 hover:bg-red-200';
  const sideLabel = (s: string) => s === 'groom' ? '🤵 Groom' : s === 'bride' ? '👰 Bride' : '💑 Both';
  const sideColor = (s: string) => s === 'groom' ? 'text-blue-600' : s === 'bride' ? 'text-pink-600' : 'text-purple-600';

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

  if (!loaded) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-none md:max-w-[900px] md:mx-auto min-h-svh flex flex-col pb-[calc(env(safe-area-inset-bottom)+80px)] px-4">
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <div className="flex items-center gap-3">
            <UmshadoIcon size={28} />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Planner</h1>
              <p className="text-sm text-gray-600 mt-0.5">Tasks, budget, and guests in one place</p>
            </div>
          </div>
        </div>

        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex gap-2">
            {(['tasks', 'budget', 'guests', 'seating'] as const).map(tab => (
              <button key={tab} onClick={() => handleTabChange(tab)} className={`flex-1 px-4 py-2 rounded-full text-sm font-semibold transition-all capitalize ${activeTab === tab ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {tab === 'seating' ? 'Seats' : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ════════════ TASKS ════════════ */}
          {activeTab === 'tasks' && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">{tasks.length > 0 ? `${tasks.filter(t => t.is_done).length} of ${tasks.length} completed` : 'No tasks yet'}</p>
                <button onClick={() => setShowTaskModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-full text-sm font-semibold hover:bg-purple-700 transition-colors shadow-md">+ Add Task</button>
              </div>
              {tasks.length === 0 ? (
                <EmptyState icon="📋" title="No tasks yet" description="Add your first wedding planning task to get started." actionLabel="+ Add Task" onAction={() => setShowTaskModal(true)} />
              ) : (
                <div className="bg-white rounded-xl border-2 border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {tasks.map(task => (
                    <div key={task.id} className="px-4 py-3.5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={task.is_done} onChange={() => toggleTask(task)} className="mt-0.5 w-5 h-5 rounded border-2 border-gray-300 text-purple-600 focus:ring-2 focus:ring-purple-500 cursor-pointer" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${task.is_done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{task.due_date ? new Date(task.due_date).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' }) : 'No date set'}</p>
                        </div>
                        <button onClick={() => deleteTask(task.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" aria-label="Delete task">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
            <div className="p-4 space-y-4">
              {budgetItems.length === 0 ? (
                <EmptyState icon="💰" title="No budget items" description="Add budget items to start tracking your wedding spending." actionLabel="+ Add Item" onAction={() => setShowBudgetModal(true)} />
              ) : (
                <>
                  {/* Summary Card */}
                  <div className="bg-white rounded-xl p-5 shadow-lg border-2 border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">💰</span>
                      <p className="text-sm font-semibold text-gray-600">Total Budget</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{format(totalBudget)}</p>
                    <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-200">
                      <div><p className="text-xs font-medium text-gray-500">Paid</p><p className="text-lg font-bold text-green-600">{format(totalPaid)}</p></div>
                      <div><p className="text-xs font-medium text-gray-500">Outstanding</p><p className="text-lg font-bold text-orange-600">{format(totalOutstanding)}</p></div>
                      <div><p className="text-xs font-medium text-gray-500">Progress</p><p className="text-lg font-bold text-purple-600">{totalBudget > 0 ? Math.round((totalPaid / totalBudget) * 100) : 0}%</p></div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500" style={{ width: `${totalBudget > 0 ? Math.min((totalPaid / totalBudget) * 100, 100) : 0}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Budget Items</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowBudgetModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-full text-sm font-semibold hover:bg-purple-700 transition-colors shadow-md">+ Add Item</button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {budgetItems.map(item => (
                      <div key={item.id} className="bg-white rounded-xl border-2 border-gray-200 p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900">{item.title}</p>
                            {item.category && <p className="text-xs text-gray-500 mt-0.5">🏪 {item.category}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            <p className="text-sm font-semibold text-gray-700">{format(Number(item.amount))}</p>
                            <button onClick={() => startEditBudget(item)} className="text-gray-400 hover:text-purple-600 transition-colors p-1" aria-label="Edit item">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => deleteBudgetItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" aria-label="Delete item">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>

                        {/* Payment progress bar */}
                        {item.amount > 0 && (
                          <div className="mb-2">
                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-300 ${item.amount_paid >= item.amount ? 'bg-green-500' : item.amount_paid > 0 ? 'bg-orange-400' : 'bg-gray-300'}`} style={{ width: `${Math.min((Number(item.amount_paid || 0) / Number(item.amount)) * 100, 100)}%` }} />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${budgetStatusColor(item)}`}>
                            {budgetStatusLabel(item)}
                          </span>
                          {item.status !== 'paid' && item.amount_paid < item.amount && (
                            <button onClick={() => openPaymentModal(item)} className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors">
                              + Record Payment
                            </button>
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
            <div className="p-4 space-y-4">
              {guests.length === 0 ? (
                <EmptyState icon="👥" title="No guests yet" description="Start building your guest list for the big day." actionLabel="+ Add Guest" onAction={() => setShowGuestModal(true)} />
              ) : (
                <>
                  {/* Summary Card */}
                  <div className="bg-white rounded-xl p-5 shadow-lg border-2 border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">👥</span>
                      <p className="text-sm font-semibold text-gray-600">Total Guests</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{totalGuestCount}</p>
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-200">
                      <div><p className="text-xs font-medium text-gray-500">Accepted</p><p className="text-lg font-bold text-green-600">{acceptedGuests}</p></div>
                      <div><p className="text-xs font-medium text-gray-500">Pending</p><p className="text-lg font-bold text-amber-600">{pendingGuests}</p></div>
                      <div><p className="text-xs font-medium text-gray-500">Declined</p><p className="text-lg font-bold text-gray-400">{declinedGuests}</p></div>
                    </div>
                  </div>

                  {/* Side breakdown card */}
                  <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
                    <p className="text-sm font-bold text-gray-900 mb-3">Guest Breakdown</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">{groomGuests}</p>
                        <p className="text-xs font-semibold text-blue-700 mt-1">🤵 Groom</p>
                      </div>
                      <div className="text-center p-3 bg-pink-50 rounded-lg">
                        <p className="text-2xl font-bold text-pink-600">{brideGuests}</p>
                        <p className="text-xs font-semibold text-pink-700 mt-1">👰 Bride</p>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <p className="text-2xl font-bold text-purple-600">{bothGuests}</p>
                        <p className="text-xs font-semibold text-purple-700 mt-1">💑 Both</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-sm font-semibold text-gray-900">Guest List</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {guests.filter(g => g.rsvp_status === 'pending' && g.phone).length > 0 && (
                        <button
                          onClick={() => {
                            const pending = guests.filter(g => g.rsvp_status === 'pending' && g.phone);
                            if (!window.confirm('Send WhatsApp invites to ' + pending.length + ' pending guest' + (pending.length > 1 ? 's' : '') + ' with a phone number?')) return;
                            pending.forEach((g, i) => { setTimeout(() => inviteViaWhatsapp(g), i * 800); });
                          }}
                          className="px-3 py-2 bg-green-500 text-white rounded-full text-sm font-semibold hover:bg-green-600 transition-colors"
                        >
                          Invite All ({guests.filter(g => g.rsvp_status === 'pending' && g.phone).length})
                        </button>
                      )}
                      <button onClick={() => setShowGuestModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-full text-sm font-semibold hover:bg-purple-700 transition-colors shadow-md">+ Add Guest</button>
                      <button onClick={() => setShowContactImport(true)} disabled={importInProgress} className={`px-3 py-2 ${importInProgress ? 'bg-gray-100 text-gray-400 border border-gray-100' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'} rounded-full text-sm font-semibold transition-colors`}>{importInProgress ? 'Importing…' : 'Import Guests'}</button>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border-2 border-gray-200 divide-y divide-gray-100 overflow-hidden">
                    {guests.map(guest => (
                      <div key={guest.id} className="px-4 py-3.5 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{guest.full_name}</p>
                            {guest.phone && <p className="text-xs text-gray-500 mt-1">{guest.phone}</p>}
                            {seatingAssignments[guest.id] && (
                              <p className="text-xs text-gray-500 mt-1">Table: <span className="font-semibold text-gray-900">{seatingAssignments[guest.id].tableId}</span></p>
                            )}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`text-xs font-semibold ${sideColor(guest.side)}`}>{sideLabel(guest.side)}</span>
                              {guest.plus_one && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">+1</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => cycleGuestStatus(guest)} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${statusColor(guest.rsvp_status)}`}>{statusLabel(guest.rsvp_status)}</button>
                            <button onClick={() => startEditGuest(guest)} className="text-gray-400 hover:text-purple-600 transition-colors p-1" aria-label="Edit guest">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button 
                              onClick={() => inviteViaWhatsapp(guest)} 
                              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${guest.phone ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                              disabled={!guest.phone}
                              aria-label="Invite via WhatsApp" 
                              title={guest.phone ? "Send WhatsApp invitation" : "No phone number"}
                            >
                              Invite
                            </button>
                            <button onClick={() => deleteGuest(guest.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" aria-label="Delete guest">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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

          {/* ════════════ SEATING ════════════ */}
          {activeTab === 'seating' && userId && (
            <div className="p-4">
              <SeatingPlanner guests={guests} userId={userId} />
            </div>
          )}
        </div>
      </div>

      {/* ════════════ MODALS ════════════ */}

      {/* Add Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Task</h3>
            <div className="space-y-3">
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Task Title</label><input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="e.g., Book hair & makeup artist" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Due Date (Optional)</label><input type="date" value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)} className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowTaskModal(false)} className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors">Cancel</button>
              <button onClick={addTask} className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200">Add Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Budget Item</h3>
            <div className="space-y-3">
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Item Name</label><input type="text" value={newBudgetTitle} onChange={e => setNewBudgetTitle(e.target.value)} placeholder="e.g., Catering deposit" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Total Amount (R)</label><input type="number" value={newBudgetAmount} onChange={e => setNewBudgetAmount(e.target.value)} placeholder="e.g., 15000" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Vendor Name (Optional)</label><input type="text" value={newBudgetCategory} onChange={e => setNewBudgetCategory(e.target.value)} placeholder="e.g., The Venue, Elegant Catering" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowBudgetModal(false)} className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors">Cancel</button>
              <button onClick={addBudgetItem} className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200">Add Item</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Budget Modal */}
      {editingBudgetItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Budget Item</h3>
            <div className="space-y-3">
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Item Name</label><input type="text" value={editBudgetTitle} onChange={e => setEditBudgetTitle(e.target.value)} className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Total Amount (R)</label><input type="number" value={editBudgetAmount} onChange={e => setEditBudgetAmount(e.target.value)} className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount Paid (R)</label><input type="number" value={editBudgetAmountPaid} onChange={e => setEditBudgetAmountPaid(e.target.value)} className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Vendor Name (Optional)</label><input type="text" value={editBudgetCategory} onChange={e => setEditBudgetCategory(e.target.value)} placeholder="e.g., The Venue, Elegant Catering" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingBudgetItem(null)} className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors">Cancel</button>
              <button onClick={saveEditBudget} className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && paymentItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Record Payment</h3>
            <p className="text-sm text-gray-600 mb-4">{paymentItem.title} — Outstanding: {format(Number(paymentItem.amount) - Number(paymentItem.amount_paid || 0))}</p>
            <div className="space-y-3">
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Payment Amount</label><input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="e.g., 5000" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900" autoFocus /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowPaymentModal(false); setPaymentItem(null); }} className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors">Cancel</button>
              <button onClick={recordPayment} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-lg shadow-green-200">Record Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Guest Modal */}
      {showGuestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Guest</h3>
            <div className="space-y-3">
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Guest Name</label><input type="text" value={newGuestName} onChange={e => setNewGuestName(e.target.value)} placeholder="e.g., Mthabisi" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone (optional)</label><input type="tel" value={newGuestPhone} onChange={e => setNewGuestPhone(e.target.value)} placeholder="e.g., +27831234567" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900" /></div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Side</label>
                <div className="flex gap-2">
                  {(['groom', 'bride', 'both'] as const).map(side => (
                    <button key={side} onClick={() => setNewGuestSide(side)} className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${newGuestSide === side ? (side === 'groom' ? 'bg-blue-600 text-white' : side === 'bride' ? 'bg-pink-600 text-white' : 'bg-purple-600 text-white') : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {side === 'groom' ? '🤵 Groom' : side === 'bride' ? '👰 Bride' : '💑 Both'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2"><input type="checkbox" id="plusOne" checked={newGuestPlusOne} onChange={e => setNewGuestPlusOne(e.target.checked)} className="w-5 h-5 rounded border-2 border-gray-300 text-purple-600 focus:ring-2 focus:ring-purple-500" /><label htmlFor="plusOne" className="text-sm font-semibold text-gray-700">Allow +1</label></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowGuestModal(false)} className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors">Cancel</button>
              <button onClick={addGuest} className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200">Add Guest</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Guest Modal */}
      {editingGuest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Guest</h3>
            <div className="space-y-3">
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Guest Name</label><input type="text" value={editGuestName} onChange={e => setEditGuestName(e.target.value)} className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone (optional)</label><input type="tel" value={editGuestPhone} onChange={e => setEditGuestPhone(e.target.value)} placeholder="e.g., +27831234567" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900" /></div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Side</label>
                <div className="flex gap-2">
                  {(['groom', 'bride', 'both'] as const).map(side => (
                    <button key={side} onClick={() => setEditGuestSide(side)} className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${editGuestSide === side ? (side === 'groom' ? 'bg-blue-600 text-white' : side === 'bride' ? 'bg-pink-600 text-white' : 'bg-purple-600 text-white') : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {side === 'groom' ? '🤵 Groom' : side === 'bride' ? '👰 Bride' : '💑 Both'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2"><input type="checkbox" id="editPlusOne" checked={editGuestPlusOne} onChange={e => setEditGuestPlusOne(e.target.checked)} className="w-5 h-5 rounded border-2 border-gray-300 text-purple-600 focus:ring-2 focus:ring-purple-500" /><label htmlFor="editPlusOne" className="text-sm font-semibold text-gray-700">Allow +1</label></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingGuest(null)} className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors">Cancel</button>
              <button onClick={saveEditGuest} className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200">Save Changes</button>
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

      {/* Contact Import Sheet */}
      {showContactImport && (
        <ContactImportSheet
          onImport={handleContactImport}
          onClose={() => setShowContactImport(false)}
        />
      )}

      <input ref={vcardInputRef} type="file" accept=".vcf,text/vcard" onChange={e => handleVCardFile(e.target.files?.[0])} className="hidden" />
      <BottomNav />
    </div>
  );
}

export default function CouplePlanner() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <CouplePlannerContent />
    </Suspense>
  );
}
