
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
  tipo_participacao: 'mensalista' | 'avulso' | null;
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
  const [participationFilter, setParticipationFilter] = useState<'geral' | 'mensalista' | 'avulso'>('geral');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);

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

  const scopedResults = results;
  const currentRanking = rankings.find(r => r.id === selected);
  const categoryName = (name: string) => name.replace(/^BROTHER\s*/i, '');

  const fullClassification = useMemo(() => {
    return players
      .filter(p => p.ranking_id === selected)
      .map(player => {
        const totals = scopedResults
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
          b.goals - a.goals ||
          b.assists - a.assists ||
          a.name.localeCompare(b.name)
      );
  }, [players, scopedResults, selected, currentRanking]);

  // A classificação filtrada mantém a pontuação original e recalcula as posições.
  const classification = useMemo(() =>
    fullClassification.filter(p =>
      participationFilter === 'geral' || p.tipo_participacao === participationFilter
    ), [fullClassification, participationFilter]);

  const profile = fullClassification.find(p => p.id === profileId);

  const comparedA = classification.find(p => p.id === compareA);
  const comparedB = classification.find(p => p.id === compareB);
  const profileResults = profile ? scopedResults.filter(r => r.player_id === profile.id)
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
          <span className="brand-mark">⚽</span> BROTHER <span>RANKING</span>
        </div>
        <Link className="btn" href="/login">
          Área administrativa
        </Link>
      </header>

      <div className="public-hero"><div className="hero-glow" aria-hidden="true" /><div className="eyebrow">A ARENA DOS MELHORES</div><h1>Cada jogo conta. Cada ponto importa.</h1>
      <p className="muted">
        Vitórias, gols e assistências em uma classificação feita para quem vive a pelada.
      </p></div>

      <div className="tabs category-switch">
        {rankings.map(r => (
          <button
            key={r.id}
            className={selected === r.id ? 'primary' : ''}
            onClick={() => { setSelected(r.id); setProfileId(null); setCompareA(''); setCompareB(''); setCompareOpen(false); }}
          >
            {categoryName(r.name)}
          </button>
        ))}
      </div>

      <section className='participation-filter' aria-label="Filtrar por tipo de participação">
        <div className="participation-filter-heading">
          <div>
            <div className="eyebrow">TIPO DE PARTICIPAÇÃO</div>
            <h2>Escolha a classificação</h2>
          </div>
          <span className="muted small">{classification.length} jogador(es)</span>
        </div>
        <div className="participation-filter-options" role="group" aria-label="Classificação">
          {([
            ['geral', 'Geral'],
            ['mensalista', 'Mensalistas'],
            ['avulso', 'Avulsos']
          ] as const).map(([value, label]) => (
            <button key={value} type="button"
              className={participationFilter === value ? 'selected' : ''}
              aria-pressed={participationFilter === value}
              onClick={() => { setParticipationFilter(value); setProfileId(null); setCompareA(''); setCompareB(''); setCompareOpen(false); }}>
              {label}
            </button>
          ))}
        </div>
        <p className="muted small participation-filter-description">
          {participationFilter === 'geral'
            ? 'Todos os jogadores ativos, incluindo os ainda não classificados.'
            : participationFilter === 'mensalista'
              ? 'Somente jogadores cadastrados como mensalistas.'
              : 'Somente jogadores cadastrados como avulsos.'}
        </p>
      </section>

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


      <section className="panel leaderboard-panel">
        <div className="line">
          <h2>🏆 {currentRanking ? categoryName(currentRanking.name) : 'Ranking'} · {participationFilter === 'geral' ? 'Geral' : participationFilter === 'mensalista' ? 'Mensalistas' : 'Avulsos'}</h2>
          <span className="pill"><span className="live-dot" /> Atualização a cada 15 s</span>
        </div>

        {loading && <p className="muted">Carregando...</p>}

        {error && <p className="error">{error}</p>}

        {!loading && !error && classification.length === 0 && (
          <p className="muted">
            Nenhum jogador encontrado para esta classificação.
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


      {!loading && !error && classification.length > 1 && (
        <section className="comparison-section panel" aria-label="Comparar jogadores">
          <div className="line"><div><div className="eyebrow">FRENTE A FRENTE</div><h2>⚔️ Comparar jogadores</h2></div><button type="button" onClick={() => setCompareOpen(!compareOpen)} aria-expanded={compareOpen}>{compareOpen ? 'Fechar comparação' : 'Comparar jogadores'}</button></div>
          {compareOpen && <><p className="muted small">Selecione dois jogadores da categoria para comparar seus números.</p>
            <div className="compare-selectors"><div><label htmlFor="compare-a">Primeiro jogador</label><select id="compare-a" value={compareA} onChange={e => setCompareA(e.target.value)}><option value="">Selecione</option>{classification.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div><label htmlFor="compare-b">Segundo jogador</label><select id="compare-b" value={compareB} onChange={e => setCompareB(e.target.value)}><option value="">Selecione</option>{classification.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div>
            {compareA && compareB && compareA === compareB && <p className="error">Selecione jogadores diferentes.</p>}
            {comparedA && comparedB && comparedA.id !== comparedB.id && <div className="compare-board"><div className="compare-players"><strong>{comparedA.name}</strong><span>VS</span><strong>{comparedB.name}</strong></div>{([['Pontos','score'],['Vitórias','wins'],['Gols','goals'],['Assistências','assists']] as const).map(([label,key]) => <div className="compare-stat" key={key}><strong className={comparedA[key] > comparedB[key] ? 'compare-winner' : ''}>{comparedA[key].toLocaleString('pt-BR')}</strong><span>{label}</span><strong className={comparedB[key] > comparedA[key] ? 'compare-winner' : ''}>{comparedB[key].toLocaleString('pt-BR')}</strong></div>)}</div>}
          </>}
        </section>
      )}

      {profile && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setProfileId(null); }}>
          <section className="profile-modal" role="dialog" aria-modal="true" aria-label={`Perfil de ${profile.name}`}>
            <div className="line"><span className="eyebrow">PERFIL DO JOGADOR</span><button aria-label="Fechar perfil" onClick={() => setProfileId(null)}>✕</button></div>
            <div className="profile-identity"><div className="profile-avatar" aria-hidden="true">{profile.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</div><div><h2>{profile.name}</h2><span className="muted small">{profile.tipo_participacao === 'mensalista' ? 'Mensalista' : profile.tipo_participacao === 'avulso' ? 'Avulso' : 'Não classificado'} · Ficha de desempenho</span></div></div>
            <p className="muted">{categoryName(currentRanking?.name || '')} · {participationFilter === 'geral' ? 'Geral' : participationFilter === 'mensalista' ? 'Mensalistas' : 'Avulsos'} · {classification.findIndex(p => p.id === profile.id) + 1}º lugar</p>
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
