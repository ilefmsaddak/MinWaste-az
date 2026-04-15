import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Score de fraude basé sur le contenu textuel.
 * Si le score dépasse 20, l'annonce est considérée comme frauduleuse/inappropriée.
 */
export class FraudDetectionService {
  private static readonly HATE_WORDS = [
    'haine', 'racisme', 'violence', 'tuer', 'insulte', 
    'discriminer', 'mépris', 'harceler', 'menace'
  ];

  private static readonly FRAUD_WORDS = [
    'argent facile', 'gagner vite', 'arnaque', 'gratuitement mais payez', 
    'virement rapide', 'cash', 'bitcoin', 'crypto', 'urgent argent',
    'win money', 'click here', 'cliquez ici'
  ];

  private static readonly SUSPICIOUS_PATTERNS = [
    /\d{10,}/, // Trop de chiffres (numéros de téléphone masqués)
    /[A-Z]{5,}/, // Trop de majuscules
    /http[s]?:\/\/[^\s]+/, // Liens externes suspects
  ];

  /**
   * Calcule le score de fraude (0 à 100).
   * @param title Titre de l'annonce
   * @param description Description de l'annonce
   */
  static calculateScore(title: string, description: string): number {
    let score = 0;
    const fullText = `${title} ${description}`.toLowerCase();

    // 1. Détection des mots de haine (+30 par occurrence, max 60)
    let hateCount = 0;
    this.HATE_WORDS.forEach(word => {
      if (fullText.includes(word)) hateCount++;
    });
    score += Math.min(hateCount * 30, 60);

    // 2. Détection des mots de fraude (+20 par occurrence, max 40)
    let fraudCount = 0;
    this.FRAUD_WORDS.forEach(word => {
      if (fullText.includes(word)) fraudCount++;
    });
    score += Math.min(fraudCount * 20, 40);

    // 3. Patterns suspects (+15 par pattern)
    this.SUSPICIOUS_PATTERNS.forEach(pattern => {
      if (pattern.test(fullText)) score += 15;
    });

    // 4. Titre en majuscules (+20)
    if (title.length > 5 && title === title.toUpperCase()) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  /**
   * Valide le contenu et lance une exception si le score est trop élevé.
   */
  static validate(title: string, description: string, userId?: string, prisma?: any): number {
    const score = this.calculateScore(title, description);
    
    // LOG POUR DEBUG
    console.log(`[FraudDetection] User: ${userId}, Title: "${title}", Score: ${score}`);

    if (score >= 20) {
      console.log(`[FraudDetection] !!! BLOCKING !!! Item with score: ${score}`);
      
      // Affectation asynchrone des pénalités si prisma est fourni
      if (userId && prisma) {
        this.applyPenalties(userId, score, prisma).catch(err => 
          console.error(`[FraudDetection] Error applying penalties:`, err)
        );
      }

      throw new BadRequestException({
        message: `Annonce frauduleuse détectée (${score}/100). Votre score de confiance a été impacté. Veuillez supprimer les mots suspects.`,
        error: 'Fraud Detection Error',
        statusCode: 400,
        fraudScore: score
      });
    }

    return score;
  }

  /**
   * Applique des pénalités au trust_score de l'utilisateur.
   */
  private static async applyPenalties(userId: string, fraudScore: number, prisma: any) {
    const trustPenalty = Math.floor(fraudScore / 4); 
    console.log(`[FraudDetection] Penalizing user ${userId}: -${trustPenalty} trust`);

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { trust_score: true }
    });

    if (!user) return;

    const newTrust = Math.max(0, user.trust_score - trustPenalty);

    await prisma.users.update({
      where: { id: userId },
      data: {
        trust_score: newTrust
      }
    });
  }
}
