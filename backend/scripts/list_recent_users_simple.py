#!/usr/bin/env python3
"""
List users registered in the last 2 weeks - Simple version using psycopg2.
"""
import os
from datetime import datetime, timedelta

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("Error: psycopg2 not installed. Install with: pip install psycopg2-binary")
    exit(1)

def list_recent_users():
    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL environment variable not set")
        exit(1)
    
    # Connect to database
    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
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
            r.status as referral_status
        FROM users u
        LEFT JOIN referrals r ON u.id = r.user_id
        WHERE u.created_at >= %s
          AND u.deleted_at IS NULL
        ORDER BY u.created_at DESC
        """
        
        cur.execute(query, (two_weeks_ago,))
        users = cur.fetchall()
        
        print(f"\n{'='*120}")
        print(f"Users registered in the last 2 weeks (since {two_weeks_ago.strftime('%Y-%m-%d %H:%M:%S')} UTC)")
        print(f"Total: {len(users)} users")
        print(f"{'='*120}\n")
        
        if not users:
            print("No users found.")
            return
        
        # Print header
        print(f"{'ID':<6} {'Email':<35} {'Display Name':<20} {'Sub Status':<12} {'Membership':<15} {'Ref':<12} {'Created At':<20}")
        print(f"{'-'*6} {'-'*35} {'-'*20} {'-'*12} {'-'*15} {'-'*12} {'-'*20}")
        
        for user in users:
            # Get referral info
            ref_code = ""
            if user['founder_code']:
                ref_code = f"F:{user['founder_code']}"
            elif user['ambassador_code']:
                ref_code = f"A:{user['ambassador_code']}"
            else:
                ref_code = "None"
            
            # Format created_at
            created_str = user['created_at'].strftime('%Y-%m-%d %H:%M') if user['created_at'] else "N/A"
            
            email = user['email'][:33] if user['email'] else "N/A"
            display_name = (user['display_name'] or "")[:18]
            sub_status = (user['subscription_status'] or "N/A")[:10]
            membership = (user['membership_type'] or "N/A")[:13]
            
            print(f"{user['id']:<6} {email:<35} {display_name:<20} {sub_status:<12} {membership:<15} {ref_code:<12} {created_str:<20}")
        
        print(f"\n{'='*120}")
        
        # Summary by membership type
        print("\nSummary by Membership Type:")
        membership_counts = {}
        for user in users:
            mtype = user['membership_type'] or "unknown"
            membership_counts[mtype] = membership_counts.get(mtype, 0) + 1
        
        for mtype, count in sorted(membership_counts.items()):
            print(f"  {mtype}: {count}")
        
        # Summary by subscription status
        print("\nSummary by Subscription Status:")
        status_counts = {}
        for user in users:
            status = user['subscription_status'] or "unknown"
            status_counts[status] = status_counts.get(status, 0) + 1
        
        for status, count in sorted(status_counts.items()):
            print(f"  {status}: {count}")
        
        # Summary by email verification
        print("\nSummary by Email Verification:")
        verified_count = sum(1 for u in users if u['email_verified'])
        unverified_count = len(users) - verified_count
        print(f"  Verified: {verified_count}")
        print(f"  Unverified: {unverified_count}")
        
        # Summary by referral
        print("\nSummary by Referral:")
        founder_count = sum(1 for u in users if u['founder_code'])
        ambassador_count = sum(1 for u in users if u['ambassador_code'])
        no_ref_count = len(users) - founder_count - ambassador_count
        
        print(f"  Founder referrals (Ca01-Ca10): {founder_count}")
        print(f"  Ambassador referrals (Pa01-Pa10): {ambassador_count}")
        print(f"  No referral: {no_ref_count}")
        
        # Founder referral breakdown
        if founder_count > 0:
            print("\n  Founder Referral Breakdown:")
            founder_codes = {}
            for u in users:
                if u['founder_code']:
                    code = u['founder_code']
                    founder_codes[code] = founder_codes.get(code, 0) + 1
            for code, count in sorted(founder_codes.items()):
                print(f"    {code}: {count}")
        
        # Ambassador referral breakdown
        if ambassador_count > 0:
            print("\n  Ambassador Referral Breakdown:")
            ambassador_codes = {}
            for u in users:
                if u['ambassador_code']:
                    code = u['ambassador_code']
                    ambassador_codes[code] = ambassador_codes.get(code, 0) + 1
            for code, count in sorted(ambassador_codes.items()):
                paid_count = sum(1 for u in users if u['ambassador_code'] == code and u['referral_status'] == 'paid')
                print(f"    {code}: {count} (paid: {paid_count})")
        
        print(f"\n{'='*120}\n")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

if __name__ == "__main__":
    list_recent_users()
