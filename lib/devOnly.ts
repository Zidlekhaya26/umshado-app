/**
 * True only in local development (NODE_ENV !== 'production').
 *
 * Use this to gate dev/debug routes and pages. In production builds,
 * Next.js/webpack inlines this as `false` and dead-code-eliminates any
 * dev-only branches at compile time.
 *
 * Usage in API routes:
 *   if (!isDevOnly) return NextResponse.json({ error: 'Not found' }, { status: 404 });
 *
 * Usage in pages:
 *   if (!isDevOnly) notFound();
 */
export const isDevOnly: boolean = process.env.NODE_ENV !== 'production';
