```mermaid
flowchart LR
  %% Phase 3 - System Overview
  U[User] --> FE[Frontend (Auth + Upload)]
  FE --> AUTH[NextAuth]
  FE --> BE[Backend (Limits + Security)]
  BE --> STR[Stripe Webhook Stub]
```

```mermaid
flowchart LR
  %% Phase 3 - Data Flow
  U[User] -->|Sign in| FE
  FE -->|/api/auth| AUTH
  U[User] -->|Upload| FE
  FE -->|POST /upload-vault| BE
  BE -->|Limit + Validate| BE
  BE -->|Process| BE
```

```mermaid
sequenceDiagram
  %% Phase 3 - Auth + Upload
  participant U as User
  participant FE as Frontend
  participant AUTH as NextAuth
  participant BE as Backend
  U->>FE: Sign in
  FE->>AUTH: Auth request
  AUTH-->>FE: Session
  U->>FE: Upload vault
  FE->>BE: POST /upload-vault
  BE-->>FE: {vault_id}
```
