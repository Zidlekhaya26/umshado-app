"use client";

import Link from "next/link";
import { useState } from "react";
import { shareLink } from "../lib/share";
import ShareActions from "./ui/ShareActions";

type Props = {
  vendor: any;
  preview?: boolean;
};

export default function PublicVendorCTAs({ vendor, preview }: Props) {
  const [open, setOpen] = useState(false);

  const url = `${process.env.NEXT_PUBLIC_BASE_URL}/v/${vendor.id}`;

  const handleShare = async () => {
    const res = await shareLink({ title: vendor.business_name, text: vendor.tagline ?? undefined, url });
    if (!res.ok) setOpen(true);
  };

  return (
    <div className="flex gap-2">
      <button onClick={handleShare} className="rounded border px-3 py-2">
        Share profile
      </button>
      {preview ? (
        <Link href={`/v/${vendor.id}?preview=1`} className="rounded bg-sky-600 px-3 py-2 text-white">
          Preview
        </Link>
      ) : (
        <Link href={`/vendor/${vendor.id}/edit`} className="rounded border px-3 py-2">
          Manage
        </Link>
      )}
      <ShareActions payload={{ title: vendor.business_name, text: vendor.tagline ?? undefined, url }} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
