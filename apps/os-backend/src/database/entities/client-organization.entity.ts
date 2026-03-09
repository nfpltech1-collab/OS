import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { UserClientOrgMapping } from './user-client-org-mapping.entity';

@Entity('client_organizations')
export class ClientOrganization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  country: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => UserClientOrgMapping, (mapping) => mapping.organization)
  userMappings: UserClientOrgMapping[];
}
