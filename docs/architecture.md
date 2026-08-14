# Arquitetura e responsabilidades — Reporting & Analytics

## Propósito

Read models, indicadores, relatórios e análises derivadas. O serviço declara a porta **4760** no ambiente atual.

## Boundary de responsabilidade

| Dentro do boundary | Fora do boundary |
| --- | --- |
| Persistência e regras do domínio de Reporting & Analytics | Regras pertencentes a outros owners |
| Validação de tenant, organização e autorização | Confiança em dados não assinados do cliente |
| Auditoria das mutações relevantes | Alterações diretas no banco de outro módulo |
| Contratos de integração versionados | Recalcular estados oficiais de outro owner |

## Topologia

```mermaid
flowchart LR
  Client[Cliente ou serviço autorizado] --> Boundary[Reporting & Analytics]
  Boundary --> Identity[Identity / JWT]
  Boundary --> Tenant[Tenant & Organization]
  Boundary --> Audit[Audit & Activity]
  Boundary -. eventos .-> Reporting[Reporting & Analytics]
```

## Dependências autorizadas

Eventos/outbox e endpoints de leitura de Billing, Pay, Entitlements e demais owners.

Toda dependência deve utilizar o contrato transversal de comunicação, audience e scope mínimos. Nenhum módulo deve abrir acesso direto ao banco de outro módulo.

## Ownership e dados

Reporting não executa mutações em domínios de origem e aceita consistência eventual documentada. Dados persistidos neste repositório devem possuir tenant/organization quando o domínio for multi-tenant, chaves únicas apropriadas, migrations versionadas e trilha de auditoria para alterações sensíveis.

## Evolução

Mudanças de boundary, ownership, estado ou contrato devem ser registradas em ADR antes da implementação. Mudanças incompatíveis exigem nova versão de contrato e janela de compatibilidade.

## Referências

[1]: https://github.com/operaon/reporting "Repositório Reporting & Analytics"
[2]: https://github.com/operaon/api "API Gateway Operaon"
[3]: https://github.com/operaon/identity "Identity Operaon"
