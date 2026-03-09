import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('sso_tokens')
export class SsoToken {
  // token_id is the UUID embedded in the JWT — used as PK directly
  @PrimaryColumn('uuid')
  token_id: string;

  @Column()
  user_id: string;

  @Column()
  app_slug: string;

  @Column({ default: false })
  used: boolean;

  @Column()
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
