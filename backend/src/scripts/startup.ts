import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EcologyService } from '../ecology/ecology.service';
import { GamificationService } from '../gamification/gamification.service';

async function bootstrap() {
  console.log('🚀 Starting MinWaste Backend...');
  
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:4200', 'http://localhost:3000'],
    credentials: true,
  });

  // Initialize ecology and gamification systems
  try {
    const ecologyService = app.get(EcologyService);
    const gamificationService = app.get(GamificationService);

    console.log('🌱 Initializing ecology factors...');
    await ecologyService.initializeEcologyFactors();

    console.log('🏆 Initializing badges...');
    await gamificationService.initializeBadges();

    console.log('✅ Systems initialized successfully!');
  } catch (error) {
    console.warn('⚠️  System initialization failed (may already be initialized):', error.message);
  }

  await app.listen(4000);
  console.log('🎉 MinWaste Backend running on http://localhost:4000');
  console.log('📊 GraphQL Playground: http://localhost:4000/graphql');
}

bootstrap().catch(console.error);