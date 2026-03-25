'use client';

import { useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImportedContact {
  full_name: string;
  phone: string | null;
}

interface Props {
  onImport: (contacts: ImportedContact[]) => void;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const hasContactPicker = typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

/**
 * Parse vCard text into contacts array
 * Handles both BEGIN:VCARD 2.1 and 3.0 formats
 */
function parseVCard(text: string): ImportedContact[] {
  const contacts: ImportedContact[] = [];
  const vcards = text.split(/BEGIN:VCARD/i).slice(1);

  for (const vcard of vcards) {
    let fullName = '';
    let phone = '';

    // Try FN (formatted name) first
    const fnMatch = vcard.match(/^FN[;:](.+)$/im);
    if (fnMatch) {
      fullName = fnMatch[1].trim();
    }

    // Fallback to N (structured name)
    if (!fullName) {
      const nMatch = vcard.match(/^N[;:](.+)$/im);
      if (nMatch) {
        const parts = nMatch[1].split(';').map(p => p.trim()).filter(Boolean);
        fullName = parts.reverse().join(' '); // Family, Given → Given Family
      }
    }

    // Extract phone (TEL)
    const telMatch = vcard.match(/^TEL[;:](.+)$/im);
    if (telMatch) {
      phone = telMatch[1].replace(/[^0-9+]/g, ''); // Keep only digits and +
    }

    if (fullName) {
      contacts.push({ full_name: fullName, phone: phone || null });
    }
  }

  return contacts;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ContactImportSheet({ onImport, onClose }: Props) {
  const [step, setStep] = useState<'choose' | 'preview'>('choose');
  const [contacts, setContacts] = useState<ImportedContact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [error, setError] = useState('');

  // ── Native Contact Picker (Android Chrome) ─────────────────────────────────
  const handleNativePick = async () => {
    if (!hasContactPicker) return;
    setLoading(true);
    setError('');

    try {
      const props = ['name', 'tel'];
      const opts = { multiple: true };
      const picked = await (navigator as any).contacts.select(props, opts);

      const mapped: ImportedContact[] = picked
        .map((c: any) => ({
          full_name: c.name?.[0] || 'Unknown',
          phone: c.tel?.[0]?.replace(/[^0-9+]/g, '') || null,
        }))
        .filter((c: ImportedContact) => c.full_name && c.full_name !== 'Unknown');

      if (mapped.length === 0) {
        setError('No contacts selected or contacts had no name.');
        setLoading(false);
        return;
      }

      setContacts(mapped);
      setSelected(new Set(mapped.map((_, i) => i)));
      setStep('preview');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(`Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── vCard File Upload ──────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const text = await file.text();
      const parsed = parseVCard(text);

      if (parsed.length === 0) {
        setError("No contacts found in the vCard file. Make sure it is a valid .vcf file.");
        setLoading(false);
        return;
      }

      setContacts(parsed);
      setSelected(new Set(parsed.map((_, i) => i)));
      setStep('preview');
    } catch (err: any) {
      setError(`Failed to read file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Preview & Confirm ──────────────────────────────────────────────────────
  const toggleContact = (index: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((_, i) => i)));
    }
  };

  const handleConfirm = () => {
    const selectedContacts = contacts.filter((_, i) => selected.has(i));
    if (selectedContacts.length === 0) {
      setError('Please select at least one contact.');
      return;
    }
    onImport(selectedContacts);
  };

  const goBack = () => {
    setStep('choose');
    setContacts([]);
    setSelected(new Set());
    setError('');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg flex flex-col h-[75vh] sm:h-auto sm:max-h-[80vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
          <h3 className="text-base font-black text-gray-900">
            {step === 'choose' ? '📇 Import Contacts' : '✓ Select Guests'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {step === 'choose' && (
            <div className="space-y-4">
              
              {/* Error display */}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Native Contact Picker */}
              <div>
                <button
                  onClick={handleNativePick}
                  disabled={!hasContactPicker || loading}
                  className={`w-full px-5 py-4 rounded-xl text-left font-bold transition-all border-2 ${
                    hasContactPicker
                      ? 'bg-green-50 border-green-300 hover:border-green-400 hover:bg-green-100'
                      : 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">📱 Pick from Phonebook</span>
                        {hasContactPicker && (
                          <span className="px-2 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded-full uppercase tracking-wide">
                            Available
                          </span>
                        )}
                      </div>
                      <p className={`text-xs ${hasContactPicker ? 'text-green-700' : 'text-gray-500'}`}>
                        {hasContactPicker
                          ? "Opens your device native contact picker"
                          : "Not available on this device • Use vCard upload below"}
                      </p>
                    </div>
                    {hasContactPicker && <span className="text-2xl">→</span>}
                  </div>
                </button>
              </div>

              {/* vCard Upload */}
              <div>
                <label className="block w-full px-5 py-4 rounded-xl text-left font-bold transition-all border-2 bg-violet-50 border-violet-300 hover:border-violet-400 hover:bg-violet-100 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base mb-1">📤 Upload vCard (.vcf)</div>
                      <p className="text-xs text-violet-700">
                        Works on all devices • Export from your contacts app
                      </p>
                    </div>
                    <span className="text-2xl">+</span>
                  </div>
                  <input
                    type="file"
                    accept=".vcf,.vcard,text/vcard,text/x-vcard"
                    onChange={handleFileUpload}
                    disabled={loading}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Export Guide */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowGuide(!showGuide)}
                  className="w-full px-4 py-3 text-left flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <span>💡 How to export contacts</span>
                  <span className="text-lg">{showGuide ? '▼' : '▶'}</span>
                </button>
                
                {showGuide && (
                  <div className="px-4 pb-4 space-y-4 text-xs text-gray-600">
                    
                    {/* iPhone */}
                    <div>
                      <p className="font-bold text-gray-800 mb-1">📱 iPhone:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-2">
                        <li>Open <strong>Contacts</strong> app</li>
                        <li>Tap a contact, then tap <strong>Share Contact</strong></li>
                        <li>Choose how many contacts to export, save to Files</li>
                        <li>Or use iCloud.com → Contacts → Select All → Export vCard</li>
                        <li>Upload the .vcf file here</li>
                      </ol>
                    </div>

                    {/* Android */}
                    <div>
                      <p className="font-bold text-gray-800 mb-1">🤖 Android:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-2">
                        <li>Open <strong>Contacts</strong> app</li>
                        <li>Tap menu (⋮) → <strong>Settings</strong> → <strong>Export</strong></li>
                        <li>Choose export location (Downloads, Drive, etc.)</li>
                        <li>Save as .vcf file</li>
                        <li>Upload the file here</li>
                      </ol>
                      <p className="mt-2 text-amber-700 font-medium">
                        💚 Or use the &quot;Pick from Phonebook&quot; button above (no export needed!)
                      </p>
                    </div>

                    {/* Gmail */}
                    <div>
                      <p className="font-bold text-gray-800 mb-1">💻 Gmail / Google Contacts:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-2">
                        <li>Go to <strong>contacts.google.com</strong></li>
                        <li>Select contacts (or Select All)</li>
                        <li>Click <strong>Export</strong> → Choose <strong>vCard</strong> format</li>
                        <li>Download the .vcf file</li>
                        <li>Upload it here</li>
                      </ol>
                    </div>

                  </div>
                )}
              </div>

              {/* Loading indicator */}
              {loading && (
                <div className="flex items-center justify-center py-6">
                  <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-3 h-full flex flex-col">
              
              {/* Stats & controls */}
              <div className="flex items-center justify-between shrink-0">
                <p className="text-sm font-semibold text-gray-700">
                  {selected.size} of {contacts.length} selected
                </p>
                <button
                  onClick={toggleAll}
                  className="text-sm font-bold text-violet-600 hover:text-violet-700"
                >
                  {selected.size === contacts.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {/* Contact list */}
              <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pb-2">
                {contacts.map((contact, i) => (
                  <label
                    key={i}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                      selected.has(i)
                        ? 'bg-violet-50 border-violet-300'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleContact(i)}
                      className="mt-0.5 w-5 h-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{contact.full_name}</p>
                      {contact.phone && (
                        <p className="text-xs text-gray-500 mt-0.5">{contact.phone}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {/* Info note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-[10px] text-blue-700 shrink-0">
                <strong>ℹ️ Duplicates filtered automatically</strong>
              </div>

            </div>
          )}
        </div>

        {/* Footer actions - ALWAYS VISIBLE */}
        <div className="shrink-0 px-4 py-3 border-t-2 border-gray-300 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          {step === 'choose' ? (
            <button
              onClick={onClose}
              className="w-full px-5 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:border-gray-300 transition-all"
            >
              Cancel
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={goBack}
                className="px-3 py-3.5 bg-white border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all whitespace-nowrap"
              >
                ← Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={selected.size === 0}
                className="flex-1 px-4 py-3.5 bg-violet-600 text-white rounded-xl text-lg font-extrabold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
              >
                Add {selected.size} {selected.size === 1 ? 'Guest' : 'Guests'} ✓
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
