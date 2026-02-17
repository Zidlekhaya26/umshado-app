const base='https://umshado-app.vercel.app';
const guestId='guest-123';
const token='tok-abc';
const coupleName='Aisha & Thabo';
const guestName='John Doe';
const phone='+27831234567';

const rsvp = `${base}/rsvp/${guestId}${token ? `?t=${encodeURIComponent(token)}` : ''}`;
const greeting = guestName ? `Hi ${guestName},\n\n` : '';
const host = coupleName ? coupleName : 'You';
const message = `${greeting}${host} invite you to their wedding 💍\nPlease RSVP here:\n${rsvp}`.trim();
const wa = (function formatWhatsapp(raw){
  if(!raw) return null;
  const s = String(raw).trim();
  const digits = s.replace(/[^\d+]/g, '');
  const cleaned = digits.replace(/^\+/, '');
  const finalDigits = cleaned.replace(/\D/g, '');
  if(!finalDigits) return null;
  return `https://wa.me/${finalDigits}`;
})(phone);

console.log('message:\n', message);
console.log('\nencoded:\n', encodeURIComponent(message));
console.log('\nwa link:\n', wa + '?text=' + encodeURIComponent(message));
