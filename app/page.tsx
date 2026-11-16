
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '../lib/supabase';

type Ranking = {
  id: string;
  name: string;
  win_points: number;
  goal_points: number;
  assist_points: number;
};

type Player = {
  id: string;
  ranking_id: string;
  name: string;
  active: boolean;
};

type Result = {
  id: string;
  ranking_id: string;
  player_id: string;
  wins: number;
  goals: number;
  assists: number;
  reversed_at: string | null;
};

export default function Home() {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!configured) {
      setError('Supabase não configurado.');
      setLoading(false);
      return;
    }

    async function load() {
      const [r, p, e] = await Promise.all([
        supabase.from('rankings').select('*'),
        supabase.from('players').select('*').eq('active', true),
        supabase.from('results')
          .select('*')
          .is('reversed_at', null)
      ]);

      if (r.error || p.error || e.error) {
        setError(
          r.error?.message ||
          p.error?.message ||
          e.error?.message ||
          'Erro ao carregar ranking.'
        );
        setLoading(false);
        return;
      }

      const data = (r.data || []) as Ranking[];

      setRankings(data);
      setPlayers((p.data || []) as Player[]);
      setResults((e.data || []) as Result[]);

      setSelected(current =>
        data.some(item => item.id === current)
          ? current
          : data.find(item =>
              item.name === 'BROTHER Goleiros'
            )?.id || data[0]?.id || ''
      );

      setError('');
      setLoading(false);
    }

    load();

    // Atualiza periodicamente, mesmo sem Realtime habilitado.
    const interval = setInterval(load, 15000);

    return () => clearInterval(interval);
  }, []);

  const currentRanking = rankings.find(r => r.id === selected);

  const classification = useMemo(() => {
    return players
      .filter(p => p.ranking_id === selected)
      .map(player => {
        const totals = results
          .filter(r => r.player_id === player.id)
          .reduce(
            (acc, r) => ({
              wins: acc.wins + r.wins,
              goals: acc.goals + r.goals,
              assists: acc.assists + r.assists
            }),
            { wins: 0, goals: 0, assists: 0 }
          );

        const score =
          totals.wins * (currentRanking?.win_points ?? 0) +
          totals.goals * (currentRanking?.goal_points ?? 0) +
          totals.assists * (currentRanking?.assist_points ?? 0);

        return { ...player, ...totals, score };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.wins - a.wins ||
          a.name.localeCompare(b.name)
      );
  }, [players, results, selected, currentRanking]);

  return (
    <main className="wrap">
      <header className="header">
        <div className="logo">
          ⚽ BROTHER <span>Ranking</span>
        </div>
        <Link className="btn" href="/login">
          Área administrativa
        </Link>
      </header>

      <h1>Classificação geral</h1>
      <p className="muted">
        Acompanhe os resultados atualizados dos nossos jogadores.
      </p>

      <div className="tabs">
        {rankings.map(r => (
          <button
            key={r.id}
            className={selected === r.id ? 'primary' : ''}
            onClick={() => setSelected(r.id)}
          >
            {r.name}
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="line">
          <h2>🏆 {currentRanking?.name || 'Ranking'}</h2>
          <span className="pill">Atualização automática</span>
        </div>

        {loading && <p className="muted">Carregando...</p>}

        {error && <p className="error">{error}</p>}

        {!loading && !error && classification.length === 0 && (
          <p className="muted">
            Nenhum jogador cadastrado neste ranking.
          </p>
        )}

        {classification.map((p, i) => (
          <div className="ranking" key={p.id}>
            <div className="place">{i + 1}º</div>

            <div className="grow">
              <strong>{p.name}</strong>
              <div className="muted small">
                {p.wins} vitórias · {p.goals} gols ·{' '}
                {p.assists} assistências
              </div>
            </div>

            <div className="score">
              {p.score.toLocaleString('pt-BR')}
              <span className="small muted"> pts</span>
            </div>
          </div>
        ))}
      </section>

      <p className="muted small">
        Critérios: {currentRanking
          ? `${currentRanking.win_points} por vitória ·
             ${currentRanking.goal_points} por gol ·
             ${currentRanking.assist_points} por assistência`
          : 'definidos por categoria'}.
      </p>
    </main>
  );
}
