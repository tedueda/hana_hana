/**
 * List users registered in the last 2 weeks
 * Run this in the browser console while logged in as admin
 */

async function listRecentUsers() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('❌ Not logged in. Please log in as admin first.');
    return;
  }

  console.log('📊 Fetching users registered in the last 2 weeks...\n');

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  let allUsers = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;

  // Fetch all pages
  while (hasMore) {
    try {
      const response = await fetch(`/api/admin/users?page=${page}&page_size=${pageSize}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`❌ Failed to fetch page ${page}: ${response.status}`);
        break;
      }

      const data = await response.json();
      allUsers = allUsers.concat(data.items);

      console.log(`✓ Fetched page ${page}: ${data.items.length} users`);

      if (data.items.length < pageSize || allUsers.length >= data.total) {
        hasMore = false;
      } else {
        page++;
      }
    } catch (error) {
      console.error(`❌ Error fetching page ${page}:`, error);
      break;
    }
  }

  // Filter users created in the last 2 weeks
  const recentUsers = allUsers.filter(user => {
    const createdAt = new Date(user.created_at);
    return createdAt >= twoWeeksAgo;
  });

  console.log(`\n${'='.repeat(120)}`);
  console.log(`Users registered in the last 2 weeks (since ${twoWeeksAgo.toISOString()})`);
  console.log(`Total: ${recentUsers.length} users`);
  console.log(`${'='.repeat(120)}\n`);

  if (recentUsers.length === 0) {
    console.log('No users found.');
    return;
  }

  // Print table
  console.table(recentUsers.map(user => ({
    ID: user.id,
    Email: user.email,
    'Display Name': user.display_name || '',
    'Sub Status': user.subscription_status || 'N/A',
    Membership: user.membership_type || 'N/A',
    'Email Verified': user.account_status === 'email_verified' || user.account_status === 'active' ? 'Yes' : 'No',
    'KYC Status': user.kyc_status || 'N/A',
    'Ref Code': user.referred_by_founder_code || 'None',
    'Created At': new Date(user.created_at).toLocaleString()
  })));

  // Summary statistics
  console.log(`\n${'='.repeat(120)}`);
  console.log('\n📈 Summary Statistics:\n');

  // By membership type
  const membershipCounts = {};
  recentUsers.forEach(user => {
    const type = user.membership_type || 'unknown';
    membershipCounts[type] = (membershipCounts[type] || 0) + 1;
  });
  console.log('By Membership Type:');
  Object.entries(membershipCounts).sort().forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // By subscription status
  const statusCounts = {};
  recentUsers.forEach(user => {
    const status = user.subscription_status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  console.log('\nBy Subscription Status:');
  Object.entries(statusCounts).sort().forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  // By email verification
  const emailVerified = recentUsers.filter(u => 
    u.account_status === 'email_verified' || u.account_status === 'active'
  ).length;
  console.log('\nBy Email Verification:');
  console.log(`  Verified: ${emailVerified}`);
  console.log(`  Unverified: ${recentUsers.length - emailVerified}`);

  // By referral
  const founderRefs = recentUsers.filter(u => u.referred_by_founder_code).length;
  console.log('\nBy Referral:');
  console.log(`  Founder referrals: ${founderRefs}`);
  console.log(`  No referral: ${recentUsers.length - founderRefs}`);

  console.log(`\n${'='.repeat(120)}\n`);

  // Export data
  console.log('💾 To export as CSV, copy the following:\n');
  const csv = [
    ['ID', 'Email', 'Display Name', 'Subscription Status', 'Membership Type', 'Email Verified', 'KYC Status', 'Ref Code', 'Created At'].join(','),
    ...recentUsers.map(user => [
      user.id,
      `"${user.email}"`,
      `"${user.display_name || ''}"`,
      user.subscription_status || 'N/A',
      user.membership_type || 'N/A',
      user.account_status === 'email_verified' || user.account_status === 'active' ? 'Yes' : 'No',
      user.kyc_status || 'N/A',
      user.referred_by_founder_code || 'None',
      new Date(user.created_at).toISOString()
    ].join(','))
  ].join('\n');

  console.log(csv);
}

// Run the function
listRecentUsers();
