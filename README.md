# Syjury — Sistema SaaS de Gestão Financeira e Contratos (SPA)

🔗 **Acesse a aplicação online:** [[https://syjury.vercel.app/](https://syjury.vercel.app/)]

## Propósito da Aplicação
O **Syjury** é uma Single Page Application (SPA) voltada para autônomos e pequenos gestores financeiros que precisam controlar contratos de crédito, cálculo de juros, parcelas em aberto, amortizações e histórico de pagamentos em tempo real, substituindo planilhas manuais por um painel centralizado e seguro.

## Framework Utilizado e Justificativa
- **Frontend:** React 18 + Vite + Tailwind CSS + Lucide React
- **Backend / Banco de Dados:** Supabase (PostgreSQL, Auth e Row Level Security)
- **Deploy:** Vercel

**Justificativa da escolha:** O React foi escolhido pela sua arquitetura orientada a componentes reutilizáveis, atualização reativa da interface sem recarregamento de página (Virtual DOM) e facilidade de gerenciamento de estados complexos (como cálculos financeiros dinâmicos, filtros de status de parcelas, modais de baixa e controle de acesso por assinatura/período de teste).

## Requisitos Atendidos e Funcionalidades
- **Navegação SPA Dinâmica:** Alternância instantânea entre painel de indicadores, carteira de clientes, gestão de contratos, histórico financeiro e configurações de plano sem reload do navegador.
- **Componentização:** Separação modular entre layouts, cards de métricas, modais interativos de cadastro/baixa, tabelas de parcelas e componentes de controle de acesso (soft/hard paywall).
- **Manipulação de Dados e Reatividade:** Uso intensivo de hooks (`useState`, `useEffect`, `useMemo`) para recalcular saldos devedores, valores mínimos de quitação, juros acumulados e indicadores gerais instantaneamente após cada ação do usuário.
- **Autenticação e Segurança:** Fluxo completo de cadastro com confirmação de e-mail, período de avaliação gratuita (3 dias), validação de cupons administrativos e isolamento de dados por usuário via RLS (Row Level Security).

## Estrutura do Projeto
```text
src/
├── components/   # Componentes reutilizáveis (cards, modais, barras de navegação, paywalls)
├── pages/        # Telas principais da SPA (Dashboard, Contratos, Clientes, Planos)
├── services/     # Conexão e queries com o cliente Supabase
├── utils/        # Regras de cálculo financeiro, formatação de moeda e datas
└── App.jsx       # Gerenciamento de rotas, sessão e estado global