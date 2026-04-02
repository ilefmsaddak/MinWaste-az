import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/**
 * Service pour hasher et vérifier les mots de passe de manière sécurisée
 * Utilise bcrypt avec un salt factor de 10
 */
@Injectable()
export class PasswordHashService {
  private readonly rounds = 10; // Cost factor for bcrypt

  /**
   * Hache un mot de passe en clair avec bcrypt 
   * @param plainPassword Mot de passe en clair à hasher
   * @returns Hash du mot de passe (string sécurisée)
   * @throws Erreur si hachage échoue
   */
  async hashPassword(plainPassword: string): Promise<string> {
    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new Error('Invalid password: must be a non-empty string');
    }

    try {
      const hash = await bcrypt.hash(plainPassword, this.rounds);
      console.log('[PasswordHashService] ✅ Password hashed successfully (hash length:', hash.length, ')');
      return hash;
    } catch (error: any) {
      console.error('[PasswordHashService] ❌ Password hashing failed:', error?.message);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Vérifie un mot de passe en clair contre un hash stocké
   * Comparaison sécurisée avec bcrypt.compare() (timing-safe)
   * @param plainPassword Mot de passe en clair fourni par l'utilisateur
   * @param hashedPassword Hash stocké dans la base de données
   * @returns true si le mot de passe correspond, false sinon
   */
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    if (!plainPassword || !hashedPassword) {
      console.warn('[PasswordHashService] ⚠️ Missing plainPassword or hashedPassword');
      return false;
    }

    try {
      const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
      return isMatch;
    } catch (error: any) {
      console.error('[PasswordHashService] ❌ Password verification failed:', error?.message);
      return false;
    }
  }
}
