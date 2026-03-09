import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserType } from './database/entities/user-type.entity';
import { User } from './database/entities/user.entity';
import { Department } from './database/entities/department.entity';
import { Application } from './database/entities/application.entity';
import { UserAppAccess } from './database/entities/user-app-access.entity';
import { ClientOrganization } from './database/entities/client-organization.entity';
import { UserClientOrgMapping } from './database/entities/user-client-org-mapping.entity';
import { SsoToken } from './database/entities/sso-token.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AppsModule } from './apps/apps.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME'),
        entities: [
          UserType,
          User,
          Department,
          Application,
          UserAppAccess,
          ClientOrganization,
          UserClientOrgMapping,
          SsoToken,
        ],
        synchronize: true, // development only — switch to migrations before deploy
        logging: true,
      }),
    }),
    AuthModule,
    UsersModule,
    AppsModule,
  ],
})
export class AppModule {}
