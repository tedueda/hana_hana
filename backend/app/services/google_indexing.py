"""
Google Indexing API service for automatic blog indexing
"""
import os
import logging
from typing import Optional
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

class GoogleIndexingService:
    """Service to notify Google about new/updated URLs"""
    
    def __init__(self):
        self.credentials = None
        self.service = None
        self._initialize()
    
    def _initialize(self):
        """Initialize Google Indexing API credentials"""
        try:
            # Path to service account JSON file
            service_account_file = os.getenv(
                'GOOGLE_SERVICE_ACCOUNT_FILE',
                '/app/google-service-account.json'
            )
            
            if not os.path.exists(service_account_file):
                logger.warning(f"Google service account file not found: {service_account_file}")
                return
            
            self.credentials = service_account.Credentials.from_service_account_file(
                service_account_file,
                scopes=['https://www.googleapis.com/auth/indexing']
            )
            
            self.service = build('indexing', 'v3', credentials=self.credentials)
            logger.info("Google Indexing API initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Google Indexing API: {e}")
    
    def notify_url_updated(self, url: str) -> bool:
        """
        Notify Google that a URL has been updated or created
        
        Args:
            url: Full URL to notify (e.g., https://carat-community.com/blog/article-slug)
        
        Returns:
            True if successful, False otherwise
        """
        if not self.service:
            logger.warning("Google Indexing API not initialized, skipping notification")
            return False
        
        try:
            body = {
                'url': url,
                'type': 'URL_UPDATED'
            }
            
            response = self.service.urlNotifications().publish(body=body).execute()
            logger.info(f"Successfully notified Google about URL: {url}")
            logger.debug(f"Response: {response}")
            return True
            
        except HttpError as e:
            logger.error(f"HTTP error notifying Google about {url}: {e}")
            return False
        except Exception as e:
            logger.error(f"Error notifying Google about {url}: {e}")
            return False
    
    def notify_url_deleted(self, url: str) -> bool:
        """
        Notify Google that a URL has been deleted
        
        Args:
            url: Full URL to notify
        
        Returns:
            True if successful, False otherwise
        """
        if not self.service:
            logger.warning("Google Indexing API not initialized, skipping notification")
            return False
        
        try:
            body = {
                'url': url,
                'type': 'URL_DELETED'
            }
            
            response = self.service.urlNotifications().publish(body=body).execute()
            logger.info(f"Successfully notified Google about deleted URL: {url}")
            logger.debug(f"Response: {response}")
            return True
            
        except HttpError as e:
            logger.error(f"HTTP error notifying Google about deleted {url}: {e}")
            return False
        except Exception as e:
            logger.error(f"Error notifying Google about deleted {url}: {e}")
            return False


# Global instance
_indexing_service: Optional[GoogleIndexingService] = None


def get_indexing_service() -> GoogleIndexingService:
    """Get or create the global indexing service instance"""
    global _indexing_service
    if _indexing_service is None:
        _indexing_service = GoogleIndexingService()
    return _indexing_service
