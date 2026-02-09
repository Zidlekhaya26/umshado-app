# Marketplace Testing Checklist

## Setup Instructions

### 1. Apply Marketplace SQL
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/marketplace.sql`
3. Run the SQL to create the `marketplace_vendors` view
4. Verify: Run `SELECT * FROM marketplace_vendors LIMIT 5;`

### 2. Start Development Server
```bash
npm run dev
```

### 3. Navigate to Marketplace
Open: http://localhost:3000/marketplace

---

## Test Cases

### ✅ Basic Display
- [ ] Page loads without errors
- [ ] Vendors display with business names
- [ ] Categories show correctly
- [ ] Locations display (city, country)
- [ ] "X vendors available" count is accurate

### ✅ Pricing Display
- [ ] Vendors with packages show "From R..." pricing
- [ ] Vendors without packages show "Contact for pricing"
- [ ] Prices are formatted correctly (e.g., R5,000)

### ✅ Services Display
- [ ] Service chips display under each vendor (up to 4)
- [ ] "+X more" badge shows when vendor has > 4 services
- [ ] Service names are readable and properly styled

### ✅ Search Functionality
- [ ] Search by vendor name works
- [ ] Search by category works
- [ ] Search by location works
- [ ] Search is case-insensitive
- [ ] Results update in real-time as you type

### ✅ Category Filter
- [ ] Category dropdown populates with actual categories
- [ ] Selecting a category filters vendors
- [ ] "All Categories" shows all vendors
- [ ] Filter persists when combined with search

### ✅ Service Filter
- [ ] Service chips display below sort dropdown
- [ ] Clicking a service chip activates filter (purple background)
- [ ] Multiple services can be selected
- [ ] Clicking again deselects the service
- [ ] Vendors with ANY selected service are shown

### ✅ Sort Options
- [ ] "Recommended" (default) - uses scoring algorithm
- [ ] "Lowest Price" - shows vendors with lowest prices first
- [ ] "Highest Price" - shows vendors with highest prices first
- [ ] "Newest" - sorts by newest/updated vendors
- [ ] Vendors without prices appear at end for price sorts

### ✅ Ranking Algorithm (Recommended Sort)
**Setup:** Create a couple account and set preferences in `/couple/onboarding`

- [ ] Vendors matching couple's category rank higher
- [ ] Vendors with more matching services rank higher
- [ ] Vendors with 2-3 packages get profile completeness boost
- [ ] Vendors with pricing info get slight boost
- [ ] Recently updated vendors get boost (< 30 days)

### ✅ Combined Filters
- [ ] Search + Category filter work together
- [ ] Search + Service filter work together
- [ ] Category + Service filter work together
- [ ] All 3 filters work together
- [ ] Sorting applies to filtered results

### ✅ Vendor Profile Link
- [ ] Clicking vendor card navigates to `/marketplace/vendor/[id]`
- [ ] "View Profile" button is visible
- [ ] Link includes correct vendor ID

### ✅ Responsive Design
- [ ] Layout looks good on mobile (default)
- [ ] Cards are readable and properly spaced
- [ ] Filters don't overflow or break layout
- [ ] Service chips scroll horizontally if needed

---

## Sample Test Data

To thoroughly test, ensure you have:
- ✅ At least 3 vendors with different categories
- ✅ At least 1 vendor with packages (for pricing)
- ✅ At least 1 vendor without packages
- ✅ At least 2 vendors with services selected
- ✅ Multiple service types across vendors

---

## Expected Behavior

### No Vendors
If no vendors exist yet:
- Shows "0 vendors available"
- Empty state (no error)

### Vendor Without Data
- Name: Shows "Unnamed Vendor" if business_name is null
- Category: Shows "Other" if category is null
- Location: Shows "Location not set" if city/country are null
- Services: No chips displayed
- Price: Shows "Contact for pricing"

### Authenticated vs Unauthenticated
- ✅ Marketplace requires authentication (RLS)
- ❌ Unauthenticated users should get permission error

---

## Troubleshooting

### "No vendors available" but vendors exist
- Check if `marketplace_vendors` view exists: `SELECT * FROM marketplace_vendors;`
- Verify RLS policies allow SELECT for authenticated users
- Check browser console for Supabase errors

### Services not showing
- Verify `vendor_services` has data: `SELECT * FROM vendor_services LIMIT 5;`
- Check that services are linked via `service_id` (not custom services)
- Verify `services` table has service names

### Pricing not showing
- Verify `vendor_packages` has data: `SELECT * FROM vendor_packages WHERE base_price > 0;`
- Check that `base_price` is set on packages
- View should compute `min_from_price` from packages

### Filters not working
- Clear browser cache and reload
- Check for JavaScript errors in console
- Verify state updates are triggering re-renders

---

## Success Criteria

✅ All vendors from database display correctly  
✅ Real pricing shows from vendor_packages  
✅ Real services show from vendor_services  
✅ All 4 filters work independently and combined  
✅ "Recommended" sort ranks intelligently based on couple preferences  
✅ No mock/hardcoded data remains  
✅ Page is responsive and performant  

---

## Next Steps After Testing

1. ✅ Verify vendor profile page (`/marketplace/vendor/[id]`) shows full details
2. 🔄 Implement reviews/ratings (future)
3. 🔄 Add vendor images (future)
4. 🔄 Add availability calendar integration (future)
