'use client';
import React from 'react';
import Image from 'next/image';

interface Props { images: string[]; vendorName?: string | null }

export default function PortfolioGallery({ images, vendorName }: Props) {
  if (!images || images.length === 0) return <div className="text-sm text-gray-500 italic">No portfolio images</div>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {images.map((url, i) => (
        <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
          <Image src={url} alt={`${vendorName || 'Portfolio'} ${i + 1}`} fill className="object-cover" />
        </div>
      ))}
    </div>
  );
}
