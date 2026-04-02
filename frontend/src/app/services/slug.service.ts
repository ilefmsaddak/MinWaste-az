import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SlugService {
  /**
   * Generate a URL-safe slug from annonce title and ID
   * Format: "my-item-title-abc123xyz"
   */
  generateSlug(title: string, id: string): string {
    const titleSlug = this.titleToSlug(title);
    const idHash = this.simpleHash(id);
    return `${titleSlug}-${idHash}`;
  }

  /**
   * Extract the ID from a slug by searching through a list of annonces
   * This is needed because we can't reverse the hash
   */
  extractIdFromSlug(slug: string, annonces: any[]): string | null {
    for (const annonce of annonces) {
      if (this.generateSlug(annonce.title, annonce.id) === slug) {
        return annonce.id;
      }
    }
    return null;
  }

  /**
   * Convert title to URL-safe slug (lowercase, hyphens, alphanumeric only)
   */
  private titleToSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove non-alphanumeric characters (except hyphens and spaces)
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .substring(0, 50); // Limit length
  }

  /**
   * Generate a simple hash of the ID (not cryptographic, just for obfuscation)
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }
}
