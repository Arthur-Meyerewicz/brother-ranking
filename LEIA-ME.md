# BROTHER Ranking — pacote revisado

Substituir no repositório GitHub apenas estes quatro arquivos:

- `app/page.tsx` — ranking público com pódio e atualização a cada 15 segundos
- `app/admin/page.tsx` — categoria global, lançamentos, jogadores, histórico e CSV
- `app/login/page.tsx` — login com verificação administrativa
- `app/style.css` — tema visual responsivo e checkbox corrigido

Os arquivos `lib/supabase.ts`, `package.json` e outros incluídos neste ZIP servem para testar localmente. Não é necessário substituí-los no GitHub.

O histórico exige a função Supabase `admin_results_history` previamente configurada.

Nenhuma chave privada foi incluída. Preserve as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY configuradas na Vercel.

Antes de publicar, revise as diferenças no GitHub e confirme que a Vercel concluiu o build.
