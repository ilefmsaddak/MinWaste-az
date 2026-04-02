import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type FbDecoded = { uid?: string; email?: string; name?: string };

export type DbUserRow = {
  id: string;
  email: string;
  display_name: string;
  phone: string | null;
  city?: string | null;
  password_hash?: string | null;
  role: any;
  points: number;
  trust_score: number;
  is_suspended: boolean;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly safeUserSelect = {
    id: true,
    email: true,
    display_name: true,
    phone: true,
    city: true,
    role: true,
    points: true,
    trust_score: true,
    is_suspended: true,
    created_at: true,
    updated_at: true,
    // ❌ NEVER include password_hash in safeUserSelect
    // password_hash must ONLY be retrieved explicitly when needed for authentication
  } as const;

  async upsertFromFirebase(decoded: FbDecoded): Promise<DbUserRow> {
    const firebaseUid = decoded.uid;
    const email = decoded.email?.toLowerCase();
    
    if (!email) throw new ForbiddenException('Firebase token missing email');
    if (!firebaseUid) throw new ForbiddenException('Firebase token missing uid');

    const displayName = decoded.name?.trim() || email.split('@')[0];

    console.log(`[UsersService] === UPSERT FROM FIREBASE ===`);
    console.log(`[UsersService] Firebase uid reçu: ${firebaseUid}`);
    console.log(`[UsersService] Firebase email reçu: ${email}`);

    // 1. Chercher d'abord par firebase_uid (méthode principale)
    let user = await this.prisma.users.findUnique({
      where: { firebase_uid: firebaseUid },
      select: this.safeUserSelect,
    });

    if (user) {
      console.log(`[UsersService] ✅ Utilisateur trouvé par firebase_uid`);
      console.log(`[UsersService] PostgreSQL user.id: ${user.id}`);
      console.log(`[UsersService] PostgreSQL user.email: ${user.email}`);
      console.log(`[UsersService] PostgreSQL user.points: ${user.points}`);
      console.log(`[UsersService] PostgreSQL user.trust_score: ${user.trust_score}`);
      return user as DbUserRow;
    }

    // 2. Fallback: chercher par email (migration des comptes existants)
    console.log(`[UsersService] ⚠️  Utilisateur non trouvé par firebase_uid, recherche par email...`);
    user = await this.prisma.users.findUnique({
      where: { email },
      select: this.safeUserSelect,
    });

    if (user) {
      // 3. Mettre à jour firebase_uid pour les futures connexions
      console.log(`[UsersService] ✅ Utilisateur trouvé par email, mise à jour firebase_uid...`);
      console.log(`[UsersService] PostgreSQL user.id avant mise à jour: ${user.id}`);
      const updatedUser = await this.prisma.users.update({
        where: { id: user.id },
        data: { firebase_uid: firebaseUid },
        select: this.safeUserSelect,
      });
      console.log(`[UsersService] ✅ Firebase uid mis à jour pour user.id: ${updatedUser.id}`);
      return updatedUser as DbUserRow;
    }

    // 4. Créer nouvel utilisateur avec firebase_uid
    console.log(`[UsersService] ❌ Utilisateur non trouvé, création nouvel utilisateur...`);
    const newUser = await this.prisma.users.create({
      data: {
        firebase_uid: firebaseUid,
        email,
        display_name: displayName,
        role: 'USER',
      },
      select: this.safeUserSelect,
    });

    console.log(`[UsersService] ✅ Nouvel utilisateur créé avec id: ${newUser.id}`);
    return newUser as DbUserRow;
  }

  async updateProfile(
    userId: string,
    input: { displayName?: string; phone?: string; bio?: string; city?: string; governorate?: string; avatarUrl?: string },
  ): Promise<DbUserRow> {
    console.log(`[UsersService] === UPDATE PROFILE ===`);
    console.log(`[UsersService] userId: ${userId}`);
    console.log(`[UsersService] input:`, input);

    // GraphQL envoie souvent `null` pour les champs vides — ne jamais appeler .trim() sur null
    const nextPhone =
      input.phone === undefined
        ? undefined
        : input.phone == null || String(input.phone).trim() === ''
          ? null
          : String(input.phone).trim();

    const trimOrNull = (v: string | null | undefined): string | null => {
      if (v === undefined) return null;
      if (v === null) return null;
      const t = String(v).trim();
      return t === '' ? null : t;
    };

    // Update users table (displayName, phone, city)
    const updatedUser = await this.prisma.users.update({
      where: { id: userId },
      data: {
        ...(input.displayName != null && String(input.displayName).trim() !== ''
          ? { display_name: String(input.displayName).trim() }
          : {}),
        ...(nextPhone !== undefined ? { phone: nextPhone } : {}),
        // Add city update to users table (in addition to user_profiles for denormalization)
        ...(input.city !== undefined ? { city: trimOrNull(input.city as any) } : {}),
      } as any,
      select: this.safeUserSelect as any,
    });

    // Update user_profiles table (bio, city, governorate, avatar_url)
    const profileData: any = {};
    if (input.bio !== undefined) profileData.bio = trimOrNull(input.bio as any);
    if (input.city !== undefined) profileData.city = trimOrNull(input.city as any);
    if (input.governorate !== undefined)
      profileData.governorate = trimOrNull(input.governorate as any);
    if (input.avatarUrl !== undefined)
      profileData.avatar_url = trimOrNull(input.avatarUrl as any);

    if (Object.keys(profileData).length > 0) {
      const existingProfile = await this.prisma.user_profiles.findUnique({
        where: { user_id: userId },
      });

      if (existingProfile) {
        await this.prisma.user_profiles.update({
          where: { user_id: userId },
          data: profileData,
        });
      } else {
        await this.prisma.user_profiles.create({
          data: {
            user_id: userId,
            ...profileData,
          },
        });
      }
    }

    console.log(`[UsersService] ✅ Profile updated successfully`);

    return updatedUser as unknown as DbUserRow;
  }
}
