import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import { UserType } from './database/entities/user-type.entity';
import { User } from './database/entities/user.entity';
import { Department } from './database/entities/department.entity';
import { Application } from './database/entities/application.entity';
import { UserAppAccess } from './database/entities/user-app-access.entity';
import { ClientOrganization } from './database/entities/client-organization.entity';
import { SsoToken } from './database/entities/sso-token.entity';
import { DepartmentDefaultApp } from './database/entities/department-default-app.entity';
import { AuditLog } from './database/entities/audit-log.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AppsModule } from './apps/apps.module';
import { AuditLogModule } from './audit-logs/audit-log.module';
import { OrganizationsModule } from './organizations/organizations.module';

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
          SsoToken,
          DepartmentDefaultApp,
          AuditLog,
        ],
        synchronize: false,
        logging: true,
      }),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,  // 1 minute window
        limit: 10,   // 10 requests per window (default for non-auth routes)
      },
    ]),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    AppsModule,
    AuditLogModule,
    OrganizationsModule,
  ],
  providers: [
    // Apply throttler globally; auth endpoints override with stricter limits
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
