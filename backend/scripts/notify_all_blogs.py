#!/usr/bin/env python3
"""
Script to notify Google Indexing API about all published blog posts
Run this once to index all existing blog posts
"""
import os
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models import BlogPost
from app.services.google_indexing import GoogleIndexingService
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def notify_all_published_blogs():
    """Notify Google Indexing API about all published blog posts"""
    db = SessionLocal()
    indexing_service = GoogleIndexingService()
    
    try:
        # Get all published blog posts
        published_blogs = db.query(BlogPost).filter(
            BlogPost.status == "published"
        ).all()
        
        logger.info(f"Found {len(published_blogs)} published blog posts")
        
        success_count = 0
        error_count = 0
        
        for blog in published_blogs:
            blog_url = f"https://carat-community.com/blog/{blog.slug}"
            try:
                result = indexing_service.notify_url_updated(blog_url)
                if result:
                    logger.info(f"✅ Notified: {blog_url}")
                    success_count += 1
                else:
                    logger.warning(f"⚠️  Failed: {blog_url}")
                    error_count += 1
            except Exception as e:
                logger.error(f"❌ Error notifying {blog_url}: {e}")
                error_count += 1
        
        logger.info(f"\n{'='*60}")
        logger.info(f"Summary:")
        logger.info(f"  Total blogs: {len(published_blogs)}")
        logger.info(f"  Successfully notified: {success_count}")
        logger.info(f"  Errors: {error_count}")
        logger.info(f"{'='*60}")
        
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("Starting Google Indexing API notification for all blogs...")
    notify_all_published_blogs()
    logger.info("Done!")
