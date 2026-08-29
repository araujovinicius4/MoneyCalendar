# Money Calendar — evolução de produto e backend

## O que existe hoje

O projeto é uma SPA React + TypeScript + Vite sem dependências de UI e com roteamento próprio. O domínio financeiro está separado da camada visual e possui uma boa cobertura de testes. Hoje os dados ficam exclusivamente no `localStorage` do navegador.

Principais capacidades atuais:
- calendário anual, mensal e diário;
- importação de CSV do Nubank;
- reconciliação de importações e histórico com reversão de lote;
- movimentações manuais, edição e exclusão;
- reclassificação financeira;
- indicadores bancários e financeiros;
- faturamento, receitas, gastos e investimentos;
- índice de acumulação e detalhamento dos cálculos;
- percentual/meta operacional de investimento;
- estados vazios e onboarding de primeiro uso.

## Alterações desta versão

- `/` agora é a landing page do produto;
- `/login` oferece a experiência inicial de autenticação;
- `/calendario/:ano/:mes?/:dia?` continua sendo a aplicação financeira;
- o roteamento público foi colocado acima do calendário para preservar o roteador existente;
- o login atual cria apenas uma sessão de interface em `sessionStorage` e não persiste senha.

> A sessão local é deliberadamente apenas um protótipo. Não deve ser considerada autenticação de produção.

## Backend recomendado

A melhor evolução é manter `domain/` puro e substituir gradualmente `infrastructure/storage/` por um client HTTP. Assim, cálculos e telas não precisam ser reescritos.

### Contrato mínimo de autenticação

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh` (se houver refresh token)
- `GET /auth/me`

Preferir cookie `HttpOnly`, `Secure` e `SameSite` para sessão quando o frontend e o backend permitirem. Evitar tokens de longa duração no `localStorage`.

### Recursos de domínio sugeridos

- `GET /money-calendar/movements?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /money-calendar/movements`
- `PATCH /money-calendar/movements/:id`
- `DELETE /money-calendar/movements/:id`
- `POST /money-calendar/imports`
- `GET /money-calendar/imports`
- `POST /money-calendar/imports/:id/reverse`
- `GET /money-calendar/settings`
- `PATCH /money-calendar/settings`

### Modelo mínimo

**User**: id, email, name, createdAt, updatedAt.

**Movement**: id, userId, date, valueInCents, bankingType, financialClassification, source, originalData, createdAt, updatedAt.

**ImportBatch**: id, userId, fileName, importedAt, status, counts e metadados necessários para reversão.

**MoneyCalendarSettings**: userId, investmentPercentage, onboardingDismissed.

## Integração com o backend do Centramento Digital

Antes de implementar a integração real, precisamos conhecer o contrato já existente do backend: stack, método de autenticação, estrutura de usuários/tenants, padrão de endpoints, banco e estratégia de autorização.

A recomendação é criar uma interface de repositório no frontend, por exemplo `MovementRepository`, com duas implementações temporárias:
1. `LocalMovementRepository` — usa o comportamento atual;
2. `ApiMovementRepository` — usa o backend do Centramento Digital.

Isso permite migrar sem interromper a aplicação e facilita testar a API antes de retirar o armazenamento local.

## Próxima etapa ideal

1. levantar a API/stack do Centramento Digital;
2. implementar autenticação real e proteção das rotas do calendário;
3. criar o client HTTP e tratamento global de sessão/erros;
4. migrar movimentos e configurações para o backend;
5. migrar importações e reversão;
6. adicionar testes de contrato/API e estratégia de migração dos dados já salvos localmente.
