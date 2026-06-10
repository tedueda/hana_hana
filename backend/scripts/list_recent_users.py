#!/usr/bin/env python3
"""
List users registered in the last 2 weeks.
"""
import sys
import os
from datetime import datetime, timedelta

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models import User, Referral, MatchingProfile
from sqlalchemy import and_

def list_recent_users():
    db = SessionLocal()
    try:
        # Calculate date 2 weeks ago
        two_weeks_ago = datetime.utcnow() - timedelta(days=14)
        
        # Query users created in the last 2 weeks
        users = db.query(User).filter(
            and_(
                User.created_at >= two_weeks_ago,
                User.deleted_at.is_(None)
            )
        ).order_by(User.created_at.desc()).all()
        
        print(f"\n{'='*100}")
        print(f"Users registered in the last 2 weeks (since {two_weeks_ago.strftime('%Y-%m-%d %H:%M:%S')} UTC)")
        print(f"Total: {len(users)} users")
        print(f"{'='*100}\n")
        
        if not users:
            print("No users found.")
            return
        
        # Print header
        print(f"{'ID':<6} {'Email':<30} {'Display Name':<20} {'Status':<12} {'Membership':<15} {'Ref Code':<10} {'Created At':<20}")
        print(f"{'-'*6} {'-'*30} {'-'*20} {'-'*12} {'-'*15} {'-'*10} {'-'*20}")
        
        for user in users:
            # Get referral info
            referral = db.query(Referral).filter(Referral.user_id == user.id).first()
            ref_code = ""
            if referral:
                if referral.founder_code:
                    ref_code = f"F:{referral.founder_code}"
                elif referral.ambassador_code:
                    ref_code = f"A:{referral.ambassador_code}"
            
            # Format created_at
            created_str = user.created_at.strftime('%Y-%m-%d %H:%M:%S') if user.created_at else "N/A"
            
            print(f"{user.id:<6} {user.email[:28]:<30} {(user.display_name or '')[:18]:<20} "
                  f"{(user.subscription_status or 'N/A'):<12} {(user.membership_type or 'N/A'):<15} "
                  f"{ref_code:<10} {created_str:<20}")
        
        print(f"\n{'='*100}")
        
        # Summary by membership type
        print("\nSummary by Membership Type:")
        membership_counts = {}
        for user in users:
            mtype = user.membership_type or "unknown"
            membership_counts[mtype] = membership_counts.get(mtype, 0) + 1
        
        for mtype, count in sorted(membership_counts.items()):
            print(f"  {mtype}: {count}")
        
        # Summary by subscription status
        print("\nSummary by Subscription Status:")
        status_counts = {}
        for user in users:
            status = user.subscription_status or "unknown"
            status_counts[status] = status_counts.get(status, 0) + 1
        
        for status, count in sorted(status_counts.items()):
            print(f"  {status}: {count}")
        
        # Summary by referral
        print("\nSummary by Referral:")
        founder_count = 0
        ambassador_count = 0
        no_ref_count = 0
        
        for user in users:
            referral = db.query(Referral).filter(Referral.user_id == user.id).first()
            if referral:
                if referral.founder_code:
                    founder_count += 1
                elif referral.ambassador_code:
                    ambassador_count += 1
                else:
                    no_ref_count += 1
            else:
                no_ref_count += 1
        
        print(f"  Founder referrals (Ca01-Ca10): {founder_count}")
        print(f"  Ambassador referrals (Pa01-Pa10): {ambassador_count}")
        print(f"  No referral: {no_ref_count}")
        
        print(f"\n{'='*100}\n")
        
    finally:
        db.close()

if __name__ == "__main__":
    list_recent_users()
