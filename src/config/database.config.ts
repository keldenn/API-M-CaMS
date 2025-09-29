import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'];
  
  for (const envVar of requiredEnvVars) {
    if (!configService.get(envVar)) {
      throw new Error(`${envVar} environment variable is required`);
    }
  }

  return {
    type: 'mysql',
    host: configService.get<string>('DB_HOST')!,
    port: configService.get<number>('DB_PORT')!,
    username: configService.get<string>('DB_USERNAME')!,
    password: configService.get<string>('DB_PASSWORD')!,
    database: configService.get<string>('DB_DATABASE')!,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false, // Disable automatic schema synchronization
    migrations: [], // Disable migrations
    migrationsRun: false, // Don't run migrations automatically
    logging: configService.get<boolean>('DB_LOGGING') || false,
    timezone: configService.get<string>('DB_TIMEZONE') || '+06:00',
    extra: {
      insecureAuth: configService.get<boolean>('DB_INSECURE_AUTH') !== false,
    },
  };
};

