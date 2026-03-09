
```
OS
├─ apps
│  ├─ os-backend
│  │  ├─ .prettierrc
│  │  ├─ eslint.config.mjs
│  │  ├─ nest-cli.json
│  │  ├─ package.json
│  │  ├─ README.md
│  │  ├─ src
│  │  │  ├─ app.controller.spec.ts
│  │  │  ├─ app.controller.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ app.service.ts
│  │  │  ├─ auth
│  │  │  │  ├─ auth.controller.ts
│  │  │  │  ├─ auth.module.ts
│  │  │  │  ├─ auth.service.ts
│  │  │  │  ├─ dto
│  │  │  │  │  ├─ auth-response.dto.ts
│  │  │  │  │  └─ login.dto.ts
│  │  │  │  ├─ jwt-auth.guard.ts
│  │  │  │  ├─ jwt.strategy.ts
│  │  │  │  └─ sso-token.service.ts
│  │  │  ├─ database
│  │  │  │  ├─ entities
│  │  │  │  │  ├─ application.entity.ts
│  │  │  │  │  ├─ client-organization.entity.ts
│  │  │  │  │  ├─ sso-token.entity.ts
│  │  │  │  │  ├─ user-app-access.entity.ts
│  │  │  │  │  ├─ user-client-org-mapping.entity.ts
│  │  │  │  │  ├─ user-type.entity.ts
│  │  │  │  │  └─ user.entity.ts
│  │  │  │  └─ seed.ts
│  │  │  └─ main.ts
│  │  ├─ test
│  │  │  ├─ app.e2e-spec.ts
│  │  │  └─ jest-e2e.json
│  │  ├─ tsconfig.build.json
│  │  └─ tsconfig.json
│  └─ os-frontend
│     ├─ eslint.config.mjs
│     ├─ next-env.d.ts
│     ├─ next.config.ts
│     ├─ package.json
│     ├─ postcss.config.mjs
│     ├─ public
│     │  ├─ file.svg
│     │  ├─ globe.svg
│     │  ├─ next.svg
│     │  ├─ vercel.svg
│     │  └─ window.svg
│     ├─ README.md
│     ├─ src
│     │  └─ app
│     │     ├─ favicon.ico
│     │     ├─ globals.css
│     │     ├─ layout.tsx
│     │     └─ page.tsx
│     └─ tsconfig.json
├─ package-lock.json
├─ package.json
├─ packages
│  └─ shared-types
│     ├─ package.json
│     └─ src
│        ├─ app.types.ts
│        ├─ index.ts
│        ├─ sso.types.ts
│        └─ user.types.ts
└─ README.md

```