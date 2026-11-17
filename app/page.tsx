
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
  created_at: string;
};

export default function Home() {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);

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
              item.name.toLowerCase().includes('goleiro')
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
  const categoryName = (name: string) => name.replace(/^BROTHER\s*/i, '');

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

  const profile = classification.find(p => p.id === profileId);
  const profileResults = profile ? results.filter(r => r.player_id === profile.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : [];
  const leaders = {
    score: [...classification].sort((a, b) => b.score - a.score)[0],
    goals: [...classification].sort((a, b) => b.goals - a.goals)[0],
    assists: [...classification].sort((a, b) => b.assists - a.assists)[0],
    wins: [...classification].sort((a, b) => b.wins - a.wins)[0]
  };

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

      <div className="public-hero"><div className="eyebrow">TEMPORADA • CLASSIFICAÇÃO OFICIAL</div><h1>O ranking dos melhores.</h1>
      <p className="muted">
        Acompanhe cada vitória, gol e assistência em tempo real.
      </p></div>

      <div className="tabs category-switch">
        {rankings.map(r => (
          <button
            key={r.id}
            className={selected === r.id ? 'primary' : ''}
            onClick={() => { setSelected(r.id); setProfileId(null); }}
          >
            {categoryName(r.name)}
          </button>
        ))}
      </div>

      {!loading && !error && classification.length > 0 && (
        <section className="podium-section" aria-label="Pódio dos três primeiros colocados">
          <div className="section-heading"><span className="eyebrow">DESTAQUES</span><h2>🏆 Pódio da categoria</h2></div>
          <div className="podium-grid">
            {[1, 0, 2].map(index => {
              const item = classification[index];
              if (!item) return <div key={index} className="podium-empty" />;
              return <div key={item.id} className={`podium-card podium-${index + 1}`}>
                <div className="podium-medal">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</div>
                <div className="podium-position">{index + 1}º LUGAR</div>
                <button className="player-link podium-name" onClick={() => setProfileId(item.id)}>{item.name}</button>
                <div className="podium-score">{item.score.toLocaleString('pt-BR')}<span> pts</span></div>
                <div className="podium-stats">{item.wins} V · {item.goals} G · {item.assists} A</div>
              </div>;
            })}
          </div>
        </section>
      )}

      <section className="panel leaderboard-panel">
        <div className="line">
          <h2>🏆 {currentRanking ? categoryName(currentRanking.name) : 'Ranking'}</h2>
          <span className="pill">● Atualização a cada 15 s</span>
        </div>

        {loading && <p className="muted">Carregando...</p>}

        {error && <p className="error">{error}</p>}

        {!loading && !error && classification.length === 0 && (
          <p className="muted">
            Nenhum jogador cadastrado neste ranking.
          </p>
        )}

        {!loading && !error && classification.length > 0 && (
          <div className="table-scroll"><table className="ranking-table">
            <thead><tr><th>Pos.</th><th>Jogador</th><th>Vitórias</th><th>Gols</th><th>Assist.</th><th>Pontos</th></tr></thead>
            <tbody>{classification.map((p, i) => (
              <tr key={p.id} className={i < 3 ? 'top-row' : ''}>
                <td><span className="rank-number">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}</span></td>
                <td><button className="player-link" onClick={() => setProfileId(p.id)}>{p.name}</button></td>
                <td>{p.wins}</td><td>{p.goals}</td><td>{p.assists}</td>
                <td className="points-cell">{p.score.toLocaleString('pt-BR')}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      {!loading && !error && classification.length > 0 && (
        <section className="highlights-section" aria-label="Destaques da temporada">
          <div className="section-heading"><span className="eyebrow">ESTATÍSTICAS</span><h2>⭐ Destaques da categoria</h2></div>
          <div className="highlights-grid">
            {([
              ['🏆', 'Maior pontuação', leaders.score?.name, leaders.score?.score],
              ['⚽', 'Artilheiro', leaders.goals?.name, leaders.goals?.goals],
              ['🎯', 'Mais assistências', leaders.assists?.name, leaders.assists?.assists],
              ['🔥', 'Mais vitórias', leaders.wins?.name, leaders.wins?.wins]
            ] as const).map(([icon, label, name, value]) => (
              <div className="highlight-card" key={label}><span className="highlight-icon">{icon}</span>
                <span className="muted small">{label}</span><strong>{name || '—'}</strong>
                <span className="highlight-value">{value?.toLocaleString('pt-BR') ?? '—'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {profile && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setProfileId(null); }}>
          <section className="profile-modal" role="dialog" aria-modal="true" aria-label={`Perfil de ${profile.name}`}>
            <div className="line"><span className="eyebrow">PERFIL DO JOGADOR</span><button aria-label="Fechar perfil" onClick={() => setProfileId(null)}>✕</button></div>
            <h2>{profile.name}</h2>
            <p className="muted">{categoryName(currentRanking?.name || '')} · {classification.findIndex(p => p.id === profile.id) + 1}º lugar</p>
            <div className="profile-total">{profile.score.toLocaleString('pt-BR')} <span>pontos</span></div>
            <div className="profile-stats"><div><strong>{profile.wins}</strong><span>Vitórias</span></div><div><strong>{profile.goals}</strong><span>Gols</span></div><div><strong>{profile.assists}</strong><span>Assistências</span></div></div>
            <h3>Últimos resultados válidos</h3>
            {profileResults.length === 0 ? <p className="muted small">Nenhum lançamento encontrado.</p> : (
              <div className="profile-history">{profileResults.slice(0, 12).map(r => (
                <div key={r.id} className="profile-event"><span>{new Date(r.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span><strong>{r.wins} V · {r.goals} G · {r.assists} A</strong></div>
              ))}</div>
            )}
          </section>
        </div>
      )}

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
