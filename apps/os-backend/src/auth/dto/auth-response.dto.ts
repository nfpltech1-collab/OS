import { AppAccess } from '@nagarkot/shared-types';

export class AuthResponseDto {
  user: {
    id: string;
    email: string;
    name: string;
    user_type: string;
    org_id: string | null;
  };
  allowed_apps: AppAccess[];
}
