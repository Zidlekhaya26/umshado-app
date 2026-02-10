"use client";

import { useState } from "react";
import { getUserOrRedirect, upsertCouple } from '@/lib/onboarding';
import { useRouter } from "next/navigation";
import { UmshadoIcon } from '@/components/ui/UmshadoLogo';

export default function CoupleOnboarding() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    weddingDate: "",
    partnerName: "",
    weddingLocation: "",
    country: "",
    culturalPreferences: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const user = await getUserOrRedirect();
      if (!user) {
        alert('You must be signed in to continue. Redirecting to sign in.');
        router.push('/auth/sign-in');
        return;
      }

      const res = await upsertCouple(user.id, {
        partner_name: formData.partnerName || null,
        wedding_date: formData.weddingDate || null,
        location: formData.weddingLocation || null,
        country: formData.country || null,
        cultural_preferences: formData.culturalPreferences || null
      });

      if (!res.success) {
        console.error('Failed to save couple information:', res.error);
        alert('Failed to save couple information: ' + (res.error || 'unknown'));
        return;
      }

      router.push('/couple/dashboard');
    } catch (err) {
      console.error('Error saving couple onboarding:', err);
      alert('An error occurred while saving your information');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-md mx-auto min-h-[100dvh] bg-white shadow-lg flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-5">
        <div className="flex items-center gap-3">
          <UmshadoIcon size={32} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Welcome to uMshado</h1>
            <p className="text-sm text-gray-600 mt-0.5">Let&apos;s plan your dream wedding</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 px-4 pt-6 pb-32 space-y-5 overflow-y-auto">
        {/* Wedding Date */}
        <div className="w-full max-w-full">
          <label htmlFor="weddingDate" className="block text-sm font-semibold text-gray-700 mb-2">
            Wedding Date <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="relative w-full max-w-full rounded-xl border-2 border-gray-300 bg-white overflow-hidden">
            <input
              type="date"
              id="weddingDate"
              name="weddingDate"
              value={formData.weddingDate}
              onChange={handleChange}
              required
              placeholder="Select date"
              className="w-full h-12 pl-4 pr-10 bg-transparent appearance-none focus:outline-none text-base placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Partner's Name */}
        <div>
          <label htmlFor="partnerName" className="block text-sm font-semibold text-gray-700 mb-2">
            Partner&apos;s Name <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            id="partnerName"
            name="partnerName"
            value={formData.partnerName}
            onChange={handleChange}
            required
            placeholder="Enter your partner's name"
            className="w-full max-w-full px-4 h-12 pr-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base placeholder:text-gray-400"
          />
        </div>

        {/* Wedding Location */}
        <div>
          <label htmlFor="weddingLocation" className="block text-sm font-semibold text-gray-700 mb-2">
            Wedding Location <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            id="weddingLocation"
            name="weddingLocation"
            value={formData.weddingLocation}
            onChange={handleChange}
            required
            placeholder="City or venue"
            className="w-full max-w-full px-4 h-12 pr-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base placeholder:text-gray-400"
          />
        </div>

        {/* Country */}
        <div>
          <label htmlFor="country" className="block text-sm font-semibold text-gray-700 mb-2">
            Country <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            id="country"
            name="country"
            value={formData.country}
            onChange={handleChange}
            required
            placeholder="e.g. South Africa"
            className="w-full max-w-full px-4 h-12 pr-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base placeholder:text-gray-400"
          />
        </div>

        {/* Cultural Preferences */}
        <div>
          <label htmlFor="culturalPreferences" className="block text-sm font-semibold text-gray-700 mb-2">
            Cultural Preferences <span className="text-gray-400 text-xs">(Optional)</span>
          </label>
          <textarea
            id="culturalPreferences"
            name="culturalPreferences"
            value={formData.culturalPreferences}
            onChange={handleChange}
            rows={4}
            placeholder="Tell us about any cultural or traditional elements you'd like to include"
            className="w-full max-w-full px-4 py-3.5 min-h-[96px] border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base placeholder:text-gray-400 resize-none"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full bg-purple-600 text-white py-3.5 px-4 rounded-xl font-semibold text-base hover:bg-purple-700 active:scale-95 transition-all shadow-lg shadow-purple-200"
          >
            Continue
          </button>
        </div>
      </form>

      {/* Footer Note */}
      <div className="px-4 pb-6">
        <p className="text-xs text-gray-500 text-center">
          Your information helps us personalize your wedding planning experience
        </p>
      </div>
      </div>
    </div>
  );
}
