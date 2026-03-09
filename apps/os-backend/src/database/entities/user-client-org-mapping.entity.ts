import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { ClientOrganization } from './client-organization.entity';

@Entity('user_client_org_mapping')
@Unique(['user', 'organization'])
export class UserClientOrgMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.clientOrgMappings)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => ClientOrganization, (org) => org.userMappings, { eager: true })
  @JoinColumn({ name: 'org_id' })
  organization: ClientOrganization;
}
