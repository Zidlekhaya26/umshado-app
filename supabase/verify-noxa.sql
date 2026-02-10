-- Locate vendor rows matching “Noxa” (case-insensitive)
select id, business_name, user_id, verified
from vendors
where business_name ilike '%noxa%';

-- Option A (recommended): update by id after confirming from the SELECT above
-- begin;
-- update vendors
-- set verified = true
-- where id = '<VENDOR_ID_FROM_SELECT>';
-- commit;

-- Option B (direct, if you want to match by name):
-- begin;
-- update vendors
-- set verified = true
-- where business_name ilike '%noxa%';
-- commit;

-- Confirm change
-- select id, business_name, verified from vendors where business_name ilike '%noxa%';
