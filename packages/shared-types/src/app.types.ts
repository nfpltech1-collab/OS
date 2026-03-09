export type AppSlug = 'superfreight' | 'tez' | 'trainings' | 'shakti';

export interface AppAccess {
  slug: AppSlug;
  name: string;
  url: string;
  icon_url: string | null;
}
