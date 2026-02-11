'use client';

import { useState } from 'react';
import { getUserOrRedirect, upsertVendor } from '@/lib/onboarding';
import { useRouter } from 'next/navigation';
import { LOCKED_CATEGORIES } from '@/lib/marketplaceCategories';
import { UmshadoIcon } from '@/components/ui/UmshadoLogo';
import ProfileCompletionIndicator from '@/components/ProfileCompletionIndicator';

export default function VendorOnboarding() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    businessName: '',
    category: '',
    city: '',
    country: '',
    businessDescription: ''
  });

  const categories = [...LOCKED_CATEGORIES];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      console.log('=== FORM SUBMIT START ===');
      const user = await getUserOrRedirect();
      console.log('User:', user?.id);
      
      if (!user) {
        alert('You must be signed in to save your vendor profile. Redirecting to sign in.');
        setIsSubmitting(false);
        router.push('/auth/sign-in');
        return;
      }

      console.log('Calling upsertVendor...');
      const locationParts = [formData.city, formData.country].filter(Boolean);
      const res = await upsertVendor(user.id, {
        business_name: formData.businessName || null,
        category: formData.category || null,
        location: locationParts.length > 0 ? locationParts.join(', ') : null,
        description: formData.businessDescription || null
      });

      console.log('upsertVendor response:', res);

      if (!res.success) {
        console.error('FAILED:', res.error);
        alert('Failed to save vendor profile: ' + (res.error || 'unknown'));
        setIsSubmitting(false);
        return;
      }

      console.log('SUCCESS! Navigating in 500ms...');
      // Wait a moment for database replication, then navigate
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Navigating to /vendor/services');
      window.location.href = '/vendor/services';
    } catch (err) {
      console.error('EXCEPTION:', err);
      alert('An error occurred while saving your profile: ' + err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-first container wrapper */}
      <div className="w-full max-w-screen-xl mx-auto min-h-screen flex flex-col px-4">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <div className="flex items-center gap-3">
            <UmshadoIcon size={32} />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Join uMshado</h1>
              <p className="text-sm text-gray-600 mt-0.5">Grow your wedding business with us</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 px-4 py-5 space-y-5 overflow-y-auto">
          {/* Business Name */}
          <div>
            <label htmlFor="businessName" className="block text-sm font-semibold text-gray-700 mb-2">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="businessName"
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              required
              placeholder="Enter your business name"
              className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Vendor Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-2">
              Vendor Category <span className="text-red-500">*</span>
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className={`w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base bg-white appearance-none ${formData.category ? 'text-gray-900' : 'text-gray-400'}`}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
              backgroundPosition: 'right 0.75rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em',
              paddingRight: '2.5rem'
            }}
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
                </option>
              ))}
            </select>
          </div>

          {/* City */}
          <div>
            <label htmlFor="city" className="block text-sm font-semibold text-gray-700 mb-2">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              required
              placeholder="e.g. Johannesburg"
              className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Country */}
          <div>
            <label htmlFor="country" className="block text-sm font-semibold text-gray-700 mb-2">
              Country <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              required
              placeholder="e.g. South Africa"
              className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Business Description */}
          <div>
            <label htmlFor="businessDescription" className="block text-sm font-semibold text-gray-700 mb-2">
              Business Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="businessDescription"
              name="businessDescription"
              value={formData.businessDescription}
              onChange={handleChange}
              required
              rows={5}
              placeholder="Tell couples about your services, experience, and what makes your business special"
              className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base text-gray-900 placeholder:text-gray-400 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Highlight your expertise in African weddings and cultural traditions
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-purple-600 text-white py-3.5 px-4 rounded-xl font-semibold text-base hover:bg-purple-700 active:scale-95 transition-all shadow-lg shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </form>

        {/* Footer Note */}
        <div className="px-4 pb-6">
          <p className="text-xs text-gray-500 text-center">
            By continuing, you agree to provide accurate information about your business
          </p>
        </div>
      </div>
    </div>
  );
}
      <ProfileCompletionIndicator />
      {/* ...existing onboarding form and content... */}
