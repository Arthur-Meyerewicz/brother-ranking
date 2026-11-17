# BROTHER Ranking - atualizacao V3

Substitua somente estes quatro arquivos no repositorio:

- app/page.tsx
- app/admin/page.tsx
- app/login/page.tsx
- app/style.css

Novidades:
- Nomes de categorias sem o prefixo BROTHER (apenas na interface; banco preservado).
- Podio com estatisticas e classificacao tabular completa.
- Perfil individual clicavel com totais e ultimos 12 resultados validos.
- Destaques automaticos por pontos, gols, assistencias e vitorias.
- Previa de pontuacao atual e nova no formulario administrativo.

A classificacao publica continua atualizando a cada 15 segundos.
Nao altere IDs de categorias nem dados existentes no Supabase.
O painel exige a funcao admin_results_history() ja criada anteriormente.

ATENCAO: a previa administrativa utiliza os resultados carregados pela funcao de historico. Caso o volume exceda o limite de retorno do Supabase (geralmente 1000 registros), os totais podem ficar incompletos. Nesse caso, sera necessario criar uma consulta agregada no banco antes de utilizar a previa como conferencia definitiva.

Validacao realizada: sintaxe TSX verificada com TypeScript. Build Next.js completo nao foi concluido neste ambiente por indisponibilidade da instalacao de dependencias. Verifique o deploy na Vercel antes de lancar resultados reais.
