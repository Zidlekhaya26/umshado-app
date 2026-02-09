Run the SQL migration in `migrations/001_profiles_couples_vendors.sql` using the Supabase SQL editor.

Steps:
1. Open your Supabase project dashboard.
2. Go to the "SQL" editor (Query editor).
3. Create a new query and paste the contents of `migrations/001_profiles_couples_vendors.sql`.
4. Run the query. This will create `profiles`, `couples`, and `vendors` tables and a trigger to auto-create `profiles` rows.

Notes:
- The migration creates a trigger on `auth.users` to insert a default `profiles` row with `role = 'couple'` for every newly created auth user.
- Vendor onboarding will update the `profiles.role` to `vendor` when the vendor completes onboarding.
- If you prefer to run via psql, connect to your Supabase database and run the SQL file.
