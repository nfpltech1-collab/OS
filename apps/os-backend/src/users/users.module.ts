import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { WebhookService } from '../common/services/webhook.service';

import { User } from '../database/entities/user.entity';
import { UserType } from '../database/entities/user-type.entity';
import { Application } from '../database/entities/application.entity';
import { UserAppAccess } from '../database/entities/user-app-access.entity';
import { ClientOrganization } from '../database/entities/client-organization.entity';
import { UserClientOrgMapping } from '../database/entities/user-client-org-mapping.entity';
import { Department } from '../database/entities/department.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserType,
      Application,
      UserAppAccess,
      ClientOrganization,
      UserClientOrgMapping,
      Department,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, InternalApiGuard, WebhookService],
  exports: [UsersService],
})
export class UsersModule {}
