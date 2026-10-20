              </div>
            </div>

            <div className="score-tabs">
              <span className="active">
                All time
              </span>
              <span>Today</span>
            </div>

            <div className="leader-list">
              {allTime.map((s, i) => {
                const p = players.find(
                  (p) =>
                    p.id === s.player_id
                );

                return (
                  <div
                    className={`leader-row ${
                      s.player_id ===
                      player?.id
                        ? "my-row"
                        : ""
                    }`}
                    key={s.id}
                  >
                    <span
                      className={`rank rank-${
                        i + 1
                      }`}
                    >
                      {i === 0 ? (
                        <Crown size={15} />
                      ) : (
                        i + 1
                      )}
                    </span>

                    <span className="leader-name">
                      {p?.name || "Player"}

                      {s.player_id ===
                        player?.id && (
                        <small>YOU</small>
                      )}
                    </span>

                    <b>
                      {money(
                        s.total_score
                      )}
                    </b>
                  </div>
                );
              })}
            </div>

            <div className="today-card">
              <div className="today-title">
                <Clock3 size={15} />
                TODAY'S SCORES
              </div>

              {daily.map((s) => (
                <div
                  className="daily-row"
                  key={s.id}
                >
                  <span>
                    {players.find(
                      (p) =>
                        p.id ===
                        s.player_id
                    )?.name || "Player"}
                  </span>

                  <b>
                    {money(
                      s.daily_score
                    )}
                  </b>
                </div>
              ))}
            </div>

            <div className="rules">
              <b>HOW TO PLAY</b>

              <p>
                The player who controls the
                board chooses the next clue.
                That clue automatically opens
                for everyone.
              </p>

              <p>
                Everyone submits privately.
                Correct answers earn the tile
                value. The first player to
                submit a correct answer controls
                the next clue.
              </p>
            </div>
          </aside>
        </section>
      )}

      <footer className="footer">
        <span>
          DAILY JEOPARDY{" "}
          <span className="gold-text">
            •
          </span>{" "}
          FRIENDS EDITION
        </span>

        <span>BUILT FOR YOUR CREW</span>
      </footer>
    </main>
  );
}

export default App;
