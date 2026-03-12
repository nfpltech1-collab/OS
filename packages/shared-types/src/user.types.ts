export type UserType = 'employee' | 'client';

export type UserStatus = 'active' | 'disabled' | 'deleted';

export interface OsUserPublic {
  id: string;
  email: string;
  name: string;
  user_type: UserType;
  org_id: string | null;
}
