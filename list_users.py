#!/usr/bin/env python3
"""
Direct database query to list users registered in the last 2 weeks
"""
import psycopg2
from datetime import datetime, timedelta
import os

# Get DATABASE_URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "")

if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable not set")
    print("Usage: DATABASE_URL='postgresql://...' python3 list_users.py")
    print("\nOr set it in your shell:")
    print("  export DATABASE_URL='postgresql://user:password@host:port/database'")
    exit(1)

try:
    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    
    cur = conn.cursor()
    
    # Calculate date 2 weeks ago
    two_weeks_ago = datetime.utcnow() - timedelta(days=14)
    
    # Query users created in the last 2 weeks
    query = """
    SELECT 
        u.id,
        u.email,
        u.display_name,
        u.subscription_status,
        u.membership_type,
        u.is_founder_free_member,
        u.created_at,
        u.email_verified,
        u.kyc_status,
        r.founder_code,
        r.ambassador_code,
        r.status as referral_status,
        r.paid_at
    FROM users u
    LEFT JOIN referrals r ON u.id = r.user_id
    WHERE u.created_at >= %s
      AND u.deleted_at IS NULL
    ORDER BY u.created_at DESC
    """
    
    cur.execute(query, (two_weeks_ago,))
    users = cur.fetchall()
    
    print(f"\n{'='*140}")
    print(f"Users registered in the last 2 weeks (since {two_weeks_ago.strftime('%Y-%m-%d %H:%M:%S')} UTC)")
    print(f"Total: {len(users)} users")
    print(f"{'='*140}\n")
    
    if not users:
        print("No users found.")
        exit(0)
    
    # Print header
    print(f"{'ID':<6} {'Email':<35} {'Display Name':<20} {'Sub Status':<12} {'Membership':<15} {'Email Ver':<10} {'KYC':<12} {'Ref':<12} {'Created At':<20}")
    print(f"{'-'*6} {'-'*35} {'-'*20} {'-'*12} {'-'*15} {'-'*10} {'-'*12} {'-'*12} {'-'*20}")
    
    for user in users:
        user_id, email, display_name, sub_status, membership, is_founder_free, created_at, email_verified, kyc_status, founder_code, ambassador_code, ref_status, paid_at = user
        
        # Get referral info
        ref_code = ""
        if founder_code:
            ref_code = f"F:{founder_code}"
        elif ambassador_code:
            ref_code = f"A:{ambassador_code}"
            if ref_status == 'paid':
                ref_code += "✓"
        else:
            ref_code = "None"
        
        # Format created_at
        created_str = created_at.strftime('%Y-%m-%d %H:%M') if created_at else "N/A"
        
        email_str = (email or "")[:33]
        display_name_str = (display_name or "")[:18]
        sub_status_str = (sub_status or "N/A")[:10]
        membership_str = (membership or "N/A")[:13]
        email_ver_str = "Yes" if email_verified else "No"
        kyc_str = (kyc_status or "N/A")[:10]
        
        print(f"{user_id:<6} {email_str:<35} {display_name_str:<20} {sub_status_str:<12} {membership_str:<15} {email_ver_str:<10} {kyc_str:<12} {ref_code:<12} {created_str:<20}")
    
    print(f"\n{'='*140}")
    
    # Summary by membership type
    print("\n📊 Summary by Membership Type:")
    membership_counts = {}
    for user in users:
        mtype = user[4] or "unknown"
        membership_counts[mtype] = membership_counts.get(mtype, 0) + 1
    
    for mtype, count in sorted(membership_counts.items()):
        print(f"  {mtype}: {count}")
    
    # Summary by subscription status
    print("\n📊 Summary by Subscription Status:")
    status_counts = {}
    for user in users:
        status = user[3] or "unknown"
        status_counts[status] = status_counts.get(status, 0) + 1
    
    for status, count in sorted(status_counts.items()):
        print(f"  {status}: {count}")
    
    # Summary by email verification
    print("\n📊 Summary by Email Verification:")
    verified_count = sum(1 for u in users if u[7])
    unverified_count = len(users) - verified_count
    print(f"  Verified: {verified_count}")
    print(f"  Unverified: {unverified_count}")
    
    # Summary by referral
    print("\n📊 Summary by Referral:")
    founder_count = sum(1 for u in users if u[9])
    ambassador_count = sum(1 for u in users if u[10])
    no_ref_count = len(users) - founder_count - ambassador_count
    
    print(f"  Founder referrals (Ca01-Ca10): {founder_count}")
    print(f"  Ambassador referrals (Pa01-Pa10): {ambassador_count}")
    print(f"  No referral: {no_ref_count}")
    
    # Founder referral breakdown
    if founder_count > 0:
        print("\n  📋 Founder Referral Breakdown:")
        founder_codes = {}
        for u in users:
            if u[9]:
                code = u[9]
                founder_codes[code] = founder_codes.get(code, 0) + 1
        for code, count in sorted(founder_codes.items()):
            print(f"    {code}: {count}")
    
    # Ambassador referral breakdown
    if ambassador_count > 0:
        print("\n  📋 Ambassador Referral Breakdown:")
        ambassador_codes = {}
        for u in users:
            if u[10]:
                code = u[10]
                status = u[11]
                if code not in ambassador_codes:
                    ambassador_codes[code] = {'total': 0, 'paid': 0}
                ambassador_codes[code]['total'] += 1
                if status == 'paid':
                    ambassador_codes[code]['paid'] += 1
        
        for code, counts in sorted(ambassador_codes.items()):
            print(f"    {code}: {counts['total']} (paid: {counts['paid']})")
    
    print(f"\n{'='*140}\n")
    
    # CSV Export
    print("💾 CSV Export (copy below):\n")
    print("ID,Email,Display Name,Subscription Status,Membership Type,Email Verified,KYC Status,Ref Code,Created At")
    for user in users:
        user_id, email, display_name, sub_status, membership, is_founder_free, created_at, email_verified, kyc_status, founder_code, ambassador_code, ref_status, paid_at = user
        
        ref_code = ""
        if founder_code:
            ref_code = f"F:{founder_code}"
        elif ambassador_code:
            ref_code = f"A:{ambassador_code}"
        else:
            ref_code = "None"
        
        created_str = created_at.strftime('%Y-%m-%d %H:%M:%S') if created_at else "N/A"
        email_ver = "Yes" if email_verified else "No"
        
        print(f'{user_id},"{email}","{display_name or ""}",{sub_status or "N/A"},{membership or "N/A"},{email_ver},{kyc_status or "N/A"},{ref_code},{created_str}')
    
    cur.close()
    conn.close()
    
    print(f"\n{'='*140}\n")

except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
