import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany,
} from 'typeorm';
import { User } from './user.entity';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string; // e.g. 'operations', 'sales', 'finance', 'hr'

  @Column()
  name: string; // e.g. 'Operations'

  @Column('simple-array', { nullable: true })
  default_app_slugs: string[]; // e.g. ['superfreight', 'tez']

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => User, (user) => user.department)
  users: User[];
}
