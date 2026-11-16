# BROTHER Ranking

Site Next.js com Supabase: ranking público, autenticação por e-mail/senha, administradores autorizados, registro de vitórias/gols/assistências, pontuação automática, histórico e estorno auditável.

## Instalação

1. Crie um projeto no Supabase e execute `supabase/schema.sql` no SQL Editor.
2. Em Authentication > Users, crie o usuário administrador com e-mail e senha (não habilite cadastro público).
3. Copie o UUID desse usuário e execute no SQL Editor:
   `insert into public.admins(user_id) values ('UUID_DO_USUARIO');`
4. Copie `.env.example` para `.env.local` e preencha a URL e a chave **publishable/anon** do projeto. Nunca coloque `service_role` no frontend.
5. Execute `npm install` e `npm run dev`. Abra http://localhost:3000.
6. Para publicar, conecte o repositório à Vercel e configure as mesmas variáveis de ambiente.
7. No Supabase, habilite Realtime nas tabelas `entries` e `players` para atualização instantânea entre dispositivos. Sem Realtime, atualizar a página busca os novos resultados.

## Importante

- Base histórica dos goleiros foi importada com a hipótese de **uma assistência para Arthur e uma para Décio**, ainda não verificada. Confirme antes de publicar.
- **Não** importamos as 11 vitórias e 2 gols adicionais de Arthur nem as 3 vitórias de Isaac, para evitar contagem duplicada. Registre-os no painel após confirmar a base.
- Ranking de jogadores de linha está inicialmente vazio; a fórmula 3/1/0,5 é provisória até confirmação.
- O histórico guarda o identificador do usuário que fez cada lançamento; estornos criam uma entrada negativa sem apagar o lançamento original.
- O painel é protegido por autenticação e as políticas RLS + funções SQL verificam autorização no banco. Não basta esconder os botões no navegador.
- Faça backup regular do banco e revise as configurações de segurança e acesso antes de uso em produção.
