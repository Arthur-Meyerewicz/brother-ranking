        >
          Cadastrar jogador
        </button>
      </section>

      <section className="panel">
        <h2>⚙️ Gerenciar jogadores</h2>
        <p className="muted small">
          Categoria: {currentRanking?.name || 'Nenhuma'}. Alterações de nome
          preservam os resultados. Jogadores inativos não podem receber novos lançamentos.
        </p>
        <label>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
          />{' '}Mostrar jogadores inativos
        </label>
        {players.filter(p => p.ranking_id === ranking && (showInactive || p.active))
          .map(p => (
            <div className="history line" key={p.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === p.id ? (
                  <input
                    value={editingName}
                    maxLength={100}
                    onChange={e => setEditingName(e.target.value)}
                    aria-label={`Novo nome de ${p.name}`}
                  />
                ) : (
                  <strong>{p.name}</strong>
                )}
                <div className="muted small">
                  {p.active ? 'Ativo' : 'Inativo'}
                </div>
              </div>
              <div className="line" style={{ flexWrap: 'wrap' }}>
                {editingId === p.id ? (
                  <>
                    <button disabled={busy || !editingName.trim()} onClick={() => renamePlayer(p)}>
                      Salvar nome
                    </button>
                    <button disabled={busy} onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button disabled={busy || editingId !== null} onClick={() => startEditing(p)}>
                    Editar nome
                  </button>
                )}
                <button
                  className={p.active ? 'danger' : ''}
                  disabled={busy || editingId !== null}
                  onClick={() => togglePlayer(p)}
                >
                  {p.active ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            </div>
          ))}
      </section>

      <section className="panel">
        <h2>📋 Últimos lançamentos</h2>

        {results.length === 0 && (
          <p className="muted">
            Nenhum lançamento encontrado.
          </p>
        )}

        {results.map(result => {
          const playerName =
            players.find(p => p.id === result.player_id)?.name ||
            'Jogador';

          const rankingName =
            rankings.find(r => r.id === result.ranking_id)?.name ||
            'Ranking';

          const reversed = Boolean(result.reversed_at);

          return (
            <div className="history line" key={result.id}>
              <div>
                <strong>{playerName}</strong>

                <div className="muted small">
                  {rankingName}
                </div>

                <div className="muted small">
                  {new Date(result.created_at).toLocaleString('pt-BR')}
                  {' · '}
                  {result.wins} V /
                  {' '}{result.goals} G /
                  {' '}{result.assists} A
                </div>

                {reversed && (
                  <div className="muted small">
                    Estornado em{' '}
                    {new Date(result.reversed_at!).toLocaleString('pt-BR')}
                  </div>
                )}
              </div>

              <button
                className={reversed ? '' : 'danger'}
                disabled={busy || reversed}
                onClick={() => undo(result.id)}
              >
                {reversed ? 'Estornado' : 'Estornar'}
              </button>
            </div>
          );
        })}
      </section>
    </main>
  );
}
```
