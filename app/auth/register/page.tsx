import { redirect } from 'next/navigation';

const BETA = process.env.NEXT_PUBLIC_BETA_INVITE_ONLY === 'true';

export default function RegisterRedirect() {
  redirect(BETA ? '/request-access' : '/auth/sign-up');
}
