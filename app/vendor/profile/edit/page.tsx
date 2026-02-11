import Link from 'next/link';

export default function VendorProfileEditHub() {
  const modeQuery = '?mode=edit';
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-screen-xl mx-auto min-h-screen flex flex-col pb-24 px-4">
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">Edit Profile</h1>
          <p className="text-sm text-gray-600 mt-1.5">Choose a section to edit your vendor profile</p>
        </div>

        <div className="flex-1 px-4 py-6 space-y-4">
          <Link href={`/vendor/services${modeQuery}`} className="block w-full px-4 py-4 bg-white border-2 border-gray-200 rounded-xl font-semibold text-left hover:bg-gray-50 transition-colors">Services</Link>
          <Link href={`/vendor/packages${modeQuery}`} className="block w-full px-4 py-4 bg-white border-2 border-gray-200 rounded-xl font-semibold text-left hover:bg-gray-50 transition-colors">Packages & Pricing</Link>
          <Link href={`/vendor/media${modeQuery}`} className="block w-full px-4 py-4 bg-white border-2 border-gray-200 rounded-xl font-semibold text-left hover:bg-gray-50 transition-colors">Media & Contact</Link>
          <Link href={`/vendor/review${modeQuery}`} className="block w-full px-4 py-4 bg-white border-2 border-gray-200 rounded-xl font-semibold text-left hover:bg-gray-50 transition-colors">Preview / Review</Link>
        </div>
      </div>
    </div>
  );
}
