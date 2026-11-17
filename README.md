# BROTHER Ranking

**Plataforma de classificação e gestão de resultados de futebol amador.**

O BROTHER Ranking centraliza os resultados das peladas e transforma vitórias, gols e assistências em uma classificação pública, atualizada automaticamente. O projeto combina uma página de consulta para os jogadores com um painel administrativo de acesso restrito para registrar resultados, gerenciar participantes e publicar o destaque fotográfico da semana.

## Visão geral

- **Ranking público:** classificação de goleiros e jogadores de linha, com pódio, tabela de desempenho e indicadores individuais.
- **Categorias de participação:** filtros para **Geral**, **Mensalistas** e **Avulsos**. Jogadores ainda não categorizados permanecem como **Não classificados** e podem aparecer na classificação geral.
- **Perfil do jogador:** pontuação acumulada, vitórias, gols, assistências e histórico de resultados válidos.
- **Comparação de desempenho:** consulta comparativa entre jogadores da mesma categoria.
- **Painel administrativo:** lançamento de resultados, cadastro e gerenciamento de jogadores, edição de nomes, classificação por participação, ativação e desativação.
- **Histórico auditável:** consulta de lançamentos, filtros, identificação dos responsáveis, exportação CSV e estorno sem exclusão do registro original.
- **Destaque da semana:** publicação de uma foto com título, descrição e data da pelada. A imagem anterior deixa de ser exibida quando um novo destaque é publicado.
- **Editor de banner:** enquadramento por arraste, controle de zoom e geração de imagem recortada antes do envio.

## Regras de pontuação

A pontuação é calculada a partir dos resultados válidos registrados no sistema:

| Estatística | Pontos por unidade |
| --- | ---: |
| Vitória | 3 |
| Gol | 1 |
| Assistência | 0,5 |

**Fórmula:** `Pontos = (Vitórias × 3) + (Gols × 1) + (Assistências × 0,5)`.

As regras são armazenadas por categoria na tabela `rankings`. Registros estornados não integram a pontuação acumulada. A classificação de participação (mensalista ou avulso) serve para filtrar a tabela, sem alterar a fórmula de pontos.

## Experiência pública

A página inicial apresenta a classificação por categoria, o pódio dos três primeiros colocados, destaques estatísticos e a tabela completa. O visitante pode alternar entre **Goleiros** e **Jogadores de Linha**, aplicar filtros de participação e consultar o perfil individual dos jogadores. A interface utiliza um tema esportivo escuro e layouts responsivos para computadores e dispositivos móveis.

A página consulta periodicamente os dados para refletir novos lançamentos sem exigir que o visitante faça login.

## Painel administrativo

O acesso administrativo exige autenticação e confirmação de autorização no banco de dados. As funcionalidades são organizadas em quatro áreas:

| Área | Funcionalidades |
| --- | --- |
| **Resultados** | Seleção de jogador, lançamento de vitórias/gols/assistências, prévia de pontuação e confirmação antes de salvar |
| **Jogadores** | Cadastro, classificação de participação, alteração de nome, ativação e desativação |
| **Histórico** | Filtros por categoria, jogador, situação e período; exportação CSV; estorno auditável |
| **Destaque da semana** | Upload de foto, título, descrição, data e edição do enquadramento do banner |

Os jogadores inativos mantêm seu histórico, mas não ficam disponíveis para novos lançamentos enquanto estiverem desativados.

### Editor de imagem do banner

O administrador seleciona uma foto JPG, PNG ou WebP (até **8 MB**), arrasta para escolher a região visível e ajusta o zoom. Na publicação, o navegador gera uma versão recortada em **1600 × 650 pixels**, em JPEG, e envia o arquivo para o Supabase Storage. A página pública utiliza a foto vinculada ao destaque vigente.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Aplicação web | Next.js (App Router), React e TypeScript |
| Interface | CSS responsivo |
| Banco de dados | PostgreSQL, por meio do Supabase |
| Autenticação | Supabase Auth |
| Arquivos de imagem | Supabase Storage |
| Hospedagem | Vercel |
| Versionamento | Git e GitHub |

## Organização da aplicação

```text
app/
  page.tsx           # Ranking público
  admin/page.tsx     # Painel administrativo
  login/page.tsx     # Autenticação
  globals.css        # Estilos, se este for o caminho usado no projeto
lib/
  supabase.ts        # Cliente Supabase
```

> A árvore acima resume os principais arquivos; consulte o repositório para a estrutura completa e os caminhos exatos dos estilos.

## Modelo de dados

As principais entidades utilizadas pela aplicação são:

| Tabela | Finalidade |
| --- | --- |
| `rankings` | Categorias e pesos de pontuação |
| `players` | Jogadores, categoria, situação e tipo de participação |
| `results` | Lançamentos de vitórias, gols e assistências, com dados de auditoria e estorno |
| `administrators` | Usuários autorizados a administrar a plataforma |
| `weekly_highlight` | Metadados do destaque fotográfico exibido na página inicial |

As fotos são armazenadas no bucket `weekly-highlights` do Supabase Storage. O registro `weekly_highlight` aponta para a imagem atualmente publicada.

### Integridade e auditoria

O histórico de resultados mantém as informações de criação e, quando aplicável, de estorno. O estorno é registrado por campos próprios (`reversed_at` e `reversed_by`) em vez de apagar o lançamento. As operações de registro e estorno utilizam as funções SQL `add_result` e `reverse_result`.

## Segurança

A aplicação combina autenticação do Supabase com **Row Level Security (RLS)** e verificações de autorização no banco. A consulta pública não concede, por si só, permissão para alterar jogadores ou resultados. As operações administrativas dependem das políticas e funções configuradas no Supabase.

**Boas práticas:**

- Nunca publicar chaves secretas, `service_role`, senhas ou arquivos `.env.local` no GitHub.
- Usar no navegador apenas a chave pública apropriada do Supabase, mantendo as políticas RLS habilitadas.
- Restringir a inclusão de administradores e revisar periodicamente suas permissões.
- Manter backups do banco e verificar as políticas do bucket de imagens antes de publicar alterações.

## Configuração e execução local

**Pré-requisitos:** Node.js compatível com a versão de Next.js utilizada no repositório, acesso ao projeto Supabase e dependências declaradas em `package.json`.

1. Clone o repositório e instale as dependências com `npm install`.
2. Configure as variáveis de ambiente esperadas por `lib/supabase.ts` em um arquivo `.env.local`, por exemplo:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
   ```

3. Verifique se as tabelas, políticas RLS, funções SQL e o bucket de armazenamento já estão configurados no Supabase. **Não execute scripts de criação ou migração indiscriminadamente sobre um banco em produção.**
4. Execute `npm run dev` e acesse `http://localhost:3000`.
5. Para validar a compilação de produção, execute `npm run build`.

As variáveis acima são exemplos: confirme os nomes efetivamente utilizados no cliente Supabase do projeto.

## Publicação

O deploy é realizado pela **Vercel**, integrada ao repositório GitHub. As variáveis de ambiente públicas necessárias devem ser cadastradas nas configurações do projeto na Vercel. Alterações enviadas à branch configurada para produção podem disparar um novo deploy, conforme as configurações da integração.

**Aplicação:** https://brother-ranking.vercel.app

## Evolução do projeto

O desenvolvimento passou da classificação básica para uma plataforma com gestão de jogadores, filtros por participação, histórico administrativo, recursos de comparação e uma identidade visual esportiva. As melhorias mais recentes incluem o **destaque fotográfico semanal** e o **editor de enquadramento do banner**, que permite ajustar a foto antes da publicação.

## Manutenção

Antes de atualizar a aplicação em produção, recomenda-se validar o login administrativo, o cadastro de jogadores, o lançamento e estorno de resultados, os filtros do ranking e a publicação do banner. Mudanças no esquema do Supabase devem ser documentadas e aplicadas por migrações controladas, preservando os dados históricos.

---

**BROTHER Ranking** — Cada jogo conta. Cada ponto importa.
