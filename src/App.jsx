import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Trophy,
  Users,
  LogIn,
  Plus,
  CheckCircle2,
  Clock3,
  Crown,
  RotateCcw,
} from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const todayKey = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
  }).format(new Date());

const money = (n) =>
  "$" + Number(n || 0).toLocaleString("en-US");

function App() {
  const [mode, setMode] = useState("home");
  const [name, setName] = useState(
    localStorage.getItem("dj_name") || ""
  );
  const [roomCode, setRoomCode] = useState(
    new URLSearchParams(location.search).get("room") || ""
  );

  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null);
  const [players, setPlayers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [scores, setScores] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [host, setHost] = useState(false);
  const [manualCorrect, setManualCorrect] = useState({});
  const [daily, setDaily] = useState([]);
  const [allTime, setAllTime] = useState([]);
  const [revealedAnswer, setRevealedAnswer] = useState("");

  const refreshRoom = useCallback(async (code) => {
    if (!supabase || !code) return;

    const { data: r, error: re } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code.toUpperCase())
      .maybeSingle();

    if (re) {
      setNotice(re.message);
      return;
    }

    if (!r) {
      setNotice("Room not found. Check the code or create a new room.");
      return;
    }

    setRoom(r);

    const [p, q, s, sub] = await Promise.all([
      supabase
        .from("players")
        .select("*")
        .eq("room_id", r.id)
        .order("created_at"),

      supabase
        .from("questions")
        .select(
          "id,room_id,category,value,prompt,board_order,day_key,status"
        )
        .eq("room_id", r.id)
        .order("board_order"),

      supabase
        .from("scores")
        .select("*")
        .eq("room_id", r.id)
        .order("total_score", { ascending: false }),

      supabase
        .from("submissions")
        .select("*")
        .eq("room_id", r.id),
    ]);

    const errors = [p.error, q.error, s.error, sub.error].filter(
      Boolean
    );

    if (errors.length) {
      setNotice(errors.map((x) => x.message).join(" "));
      return;
    }

    setPlayers(p.data || []);
    setQuestions(q.data || []);
    setScores(s.data || []);
    setSubmissions(sub.data || []);

    setDaily(
      (s.data || [])
        .slice()
        .sort(
          (a, b) =>
            (b.daily_score || 0) - (a.daily_score || 0)
        )
    );

    setAllTime(
      (s.data || [])
        .slice()
        .sort(
          (a, b) =>
            (b.total_score || 0) - (a.total_score || 0)
        )
    );
  }, []);

  /*
   * REALTIME
   *
   * Most importantly, we now listen for changes to the room.
   * When the controlling player selects a clue, Supabase changes
   * active_question_id. Every browser then refreshes the same room.
   */
  useEffect(() => {
    if (!room?.id || !supabase) return;

    const channel = supabase
      .channel("room-" + room.id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${room.id}`,
        },
        () => refreshRoom(room.code)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "questions",
          filter: `room_id=eq.${room.id}`,
        },
        () => refreshRoom(room.code)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scores",
          filter: `room_id=eq.${room.id}`,
        },
        () => refreshRoom(room.code)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "submissions",
          filter: `room_id=eq.${room.id}`,
        },
        () => refreshRoom(room.code)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        () => refreshRoom(room.code)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, room?.code, refreshRoom]);

  /*
   * The selected question is NO LONGER local.
   * Everyone uses room.active_question_id.
   */
  const selectedQuestion = useMemo(
    () =>
      questions.find(
        (q) => q.id === room?.active_question_id
      ) || null,
    [questions, room?.active_question_id]
  );

  const selectedSubs = useMemo(
    () =>
      selectedQuestion
        ? submissions.filter(
            (s) => s.question_id === selectedQuestion.id
          )
        : [],
    [submissions, selectedQuestion]
  );

  const allSubmitted =
    players.length > 0 &&
    selectedQuestion &&
    selectedSubs.length >= players.length;

  const alreadyAnswered = selectedSubs.some(
    (s) => s.player_id === player?.id
  );

  const isHost =
    host || room?.host_player_id === player?.id;

  const hasControl =
    Boolean(player?.id) &&
    room?.controlling_player_id === player.id;

  const controllingPlayer = players.find(
    (p) => p.id === room?.controlling_player_id
  );

  const boardCategories = useMemo(
    () => [...new Set(questions.map((q) => q.category))],
    [questions]
  );

  useEffect(() => {
    if (
      !supabase ||
      !selectedQuestion?.id ||
      room?.game_phase !== "revealed"
    ) {
      if (room?.game_phase !== "revealed") {
        setRevealedAnswer("");
      }
      return;
    }

    let cancelled = false;

    async function loadRevealedAnswer() {
      const { data, error } = await supabase
        .from("answer_keys")
        .select("answer")
        .eq("question_id", selectedQuestion.id)
        .single();

      if (!cancelled && !error) {
        setRevealedAnswer(data?.answer || "");
      }
    }

    loadRevealedAnswer();

    return () => {
      cancelled = true;
    };
  }, [
    room?.game_phase,
    selectedQuestion?.id,
  ]);

  /*
   * CREATE ROOM
   */
  async function createRoom() {
    if (!supabase) {
      setNotice(
        "Add your Supabase URL and anon key first."
      );
      return;
    }

    if (!name.trim()) {
      setNotice("Enter your player name first.");
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      const code = Math.random()
        .toString(36)
        .slice(2, 7)
        .toUpperCase();

      const { data: r, error } = await supabase
        .from("rooms")
        .insert({
          code,
          title: "FRIENDS TRIVIA",
          day_key: todayKey(),
          status: "lobby",
          game_phase: "selecting",
        })
        .select()
        .single();

      if (error) throw error;

      const { data: p, error: pe } = await supabase
        .from("players")
        .insert({
          room_id: r.id,
          name: name.trim(),
          is_host: true,
        })
        .select()
        .single();

      if (pe) throw pe;

      /*
       * Host begins the game with control of the board.
       */
      const { error: he } = await supabase
        .from("rooms")
        .update({
          host_player_id: p.id,
          controlling_player_id: p.id,
          active_question_id: null,
          game_phase: "selecting",
        })
        .eq("id", r.id);

      if (he) throw he;

      const { error: boardError } = await supabase.rpc(
        "generate_daily_board",
        {
          p_room_id: r.id,
        }
      );

      if (boardError) throw boardError;

      const { error: se } = await supabase
        .from("scores")
        .insert({
          room_id: r.id,
          player_id: p.id,
          daily_score: 0,
          total_score: 0,
        });

      if (se) throw se;

      localStorage.setItem("dj_name", name.trim());

      setRoomCode(code);
      setPlayer(p);
      setHost(true);
      setMode("game");

      history.replaceState(
        null,
        "",
        "?room=" + code
      );

      await refreshRoom(code);

      setNotice(
        "Room created! You control the board. Share the room code with your friends."
      );
    } catch (e) {
      setNotice(
        e.message || "Couldn't create the room."
      );
    } finally {
      setBusy(false);
    }
  }

  /*
   * JOIN ROOM
   */
  async function joinRoom() {
    if (!supabase) {
      setNotice(
        "Add your Supabase URL and anon key first."
      );
      return;
    }

    if (!name.trim() || !roomCode.trim()) {
      setNotice("Enter your name and room code.");
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      const { data: r, error: re } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", roomCode.trim().toUpperCase())
        .single();

      if (re) throw re;

      const { data: existing } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", r.id)
        .ilike("name", name.trim())
        .maybeSingle();

      let p = existing;

      if (!p) {
        const { data, error } = await supabase
          .from("players")
          .insert({
            room_id: r.id,
            name: name.trim(),
          })
          .select()
          .single();

        if (error) throw error;

        p = data;

        const { error: se } = await supabase
          .from("scores")
          .insert({
            room_id: r.id,
            player_id: p.id,
            daily_score: 0,
            total_score: 0,
          });

        if (se) throw se;
      }

      setRoom(r);
      setPlayer(p);
      setHost(Boolean(p.is_host));
      setMode("game");

      localStorage.setItem("dj_name", name.trim());

      history.replaceState(
        null,
        "",
        "?room=" + r.code
      );

      await refreshRoom(r.code);
    } catch (e) {
      setNotice(
        e.message || "Couldn't join the room."
      );
    } finally {
      setBusy(false);
    }
  }

  /*
   * SHARED CLUE SELECTION
   */
  async function chooseQuestion(question) {
    if (
      !question ||
      !player ||
      !room ||
      busy ||
      !hasControl
    )
      return;

    if (room.game_phase !== "selecting") return;
    if (question.status !== "open") return;

    setBusy(true);
    setNotice("");
    setAnswer("");
    setManualCorrect({});

    try {
      const { error } = await supabase.rpc(
        "select_jeopardy_question",
        {
          p_room_id: room.id,
          p_player_id: player.id,
          p_question_id: question.id,
        }
      );

      if (error) throw error;

      await refreshRoom(room.code);
    } catch (e) {
      setNotice(
        e.message || "Couldn't select that question."
      );
    } finally {
      setBusy(false);
    }
  }

  /*
   * SUBMIT ANSWER
   */
  async function submitAnswer() {
    if (
      !selectedQuestion ||
      !player ||
      !answer.trim() ||
      alreadyAnswered
    )
      return;

    setBusy(true);
    setNotice("");

    try {
      const { data: key, error: ke } = await supabase
        .from("answer_keys")
        .select("answer,accepted_answers")
        .eq("question_id", selectedQuestion.id)
        .single();

      if (ke) throw ke;

      const accepted = [
        key.answer,
        ...(key.accepted_answers || []),
      ].map(norm);

      const correct = accepted.includes(norm(answer));

      const { error } = await supabase
        .from("submissions")
        .insert({
          room_id: room.id,
          question_id: selectedQuestion.id,
          player_id: player.id,
          answer: answer.trim(),
          is_correct: correct,
          points_awarded: 0,
          submitted_at: new Date().toISOString(),
        });

      if (error) throw error;

      setAnswer("");
      setNotice(
        "Answer locked in. Waiting for everyone else…"
      );

      await refreshRoom(room.code);
    } catch (e) {
      setNotice(
        e.message || "Couldn't submit your answer."
      );
    } finally {
      setBusy(false);
    }
  }

  /*
   * REVEAL + SCORE + TRANSFER BOARD CONTROL
   */
  async function revealAnswers() {
    if (
      !isHost ||
      !selectedQuestion ||
      !allSubmitted ||
      busy
    )
      return;

    setBusy(true);
    setNotice("");

    try {
      const freshQuestionResult = await supabase
        .from("questions")
        .select("status")
        .eq("id", selectedQuestion.id)
        .single();

      if (freshQuestionResult.error) {
        throw freshQuestionResult.error;
      }

      if (
        freshQuestionResult.data?.status === "revealed"
      ) {
        await refreshRoom(room.code);
        return;
      }

      const { data: key, error: keyError } = await supabase
        .from("answer_keys")
        .select("answer")
        .eq("question_id", selectedQuestion.id)
        .single();

      if (keyError) throw keyError;

      const subs = submissions.filter(
        (s) => s.question_id === selectedQuestion.id
      );

      for (const sub of subs) {
        const isCorrect =
          manualCorrect[sub.player_id] ??
          sub.is_correct;

        const award = isCorrect
          ? selectedQuestion.value
          : 0;

        const { error: ue } = await supabase
          .from("submissions")
          .update({
            is_correct: isCorrect,
            points_awarded: award,
          })
          .eq("id", sub.id);

        if (ue) throw ue;
      }

      const { data: finalSubs, error: finalSubError } =
        await supabase
          .from("submissions")
          .select("*")
          .eq("room_id", room.id)
          .eq("question_id", selectedQuestion.id)
          .order("submitted_at", { ascending: true });

      if (finalSubError) throw finalSubError;

      for (const sub of finalSubs || []) {
        const award = sub.is_correct
          ? selectedQuestion.value
          : 0;

        if (!award) continue;

        const score = scores.find(
          (s) => s.player_id === sub.player_id
        );

        if (!score) continue;

        const { error: se } = await supabase
          .from("scores")
          .update({
            daily_score:
              (score.daily_score || 0) + award,
            total_score:
              (score.total_score || 0) + award,
          })
          .eq("id", score.id);

        if (se) throw se;
      }

      const firstCorrect = (finalSubs || []).find(
        (s) => s.is_correct
      );

      const nextController =
        firstCorrect?.player_id ||
        room.controlling_player_id;

      const { error: questionError } = await supabase
        .from("questions")
        .update({ status: "revealed" })
        .eq("id", selectedQuestion.id);

      if (questionError) throw questionError;

      const { error: roomError } = await supabase
        .from("rooms")
        .update({
          controlling_player_id: nextController,
          game_phase: "revealed",
        })
        .eq("id", room.id);

      if (roomError) throw roomError;

      setRevealedAnswer(key.answer);
      setAnswer("");
      setManualCorrect({});

      await refreshRoom(room.code);
    } catch (e) {
      setNotice(
        e.message || "Couldn't reveal the answers."
      );
    } finally {
      setBusy(false);
    }
  }

  async function continueAfterReveal() {
    if (
      !isHost ||
      !room ||
      room.game_phase !== "revealed" ||
      busy
    )
      return;

    setBusy(true);
    setNotice("");

    try {
      const { error } = await supabase
        .from("rooms")
        .update({
          active_question_id: null,
          game_phase: "selecting",
        })
        .eq("id", room.id);

      if (error) throw error;

      setRevealedAnswer("");
      await refreshRoom(room.code);
    } catch (e) {
      setNotice(
        e.message || "Couldn't continue to the board."
      );
    } finally {
      setBusy(false);
    }
  }

  /*
   * NEW DAILY GAME
   */
  async function startNewDay() {
    if (!isHost || busy) return;

    const ok = confirm(
      "Start a new game? A completely new 25-question board will be generated. Today's scores will reset, but all-time scores will stay."
    );

    if (!ok) return;

    setBusy(true);
    setNotice("");

    try {
      const { error } = await supabase.rpc(
        "generate_daily_board",
        {
          p_room_id: room.id,
        }
      );

      if (error) throw error;

      setAnswer("");
      setManualCorrect({});
      setNotice(
        "New board generated! The host controls the board."
      );

      await refreshRoom(room.code);
    } catch (e) {
      setNotice(
        e.message || "Couldn't generate the new board."
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    const url = `${location.origin}${location.pathname}?room=${room.code}`;

    try {
      await navigator.clipboard.writeText(url);
      setNotice(
        "Invite link copied to clipboard."
      );
    } catch {
      setNotice(
        "Share this room code: " + room.code
      );
    }
  }

  if (!supabase) {
    return (
      <div className="setup-page">
        <div className="setup-card">
          <div className="brand-mark">J!</div>
          <p className="eyebrow">
            YOUR FRIEND GROUP'S DAILY TRIVIA
          </p>
          <h1>Daily Jeopardy</h1>
          <p className="muted">
            Supabase configuration is missing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">J!</div>

          <div>
            <div className="brand-title">
              DAILY JEOPARDY
            </div>
            <div className="brand-sub">
              FRIENDS EDITION
            </div>
          </div>
        </div>

        <div className="top-actions">
          {room && (
            <>
              <span className="room-pill">
                <span className="live-dot"></span>
                ROOM {room.code}
              </span>

              <button
                className="button ghost"
                onClick={copyInvite}
              >
                Share invite
              </button>
            </>
          )}
        </div>
      </header>

      {mode === "home" ? (
        <section className="home-layout">
          <div className="hero-copy">
            <p className="eyebrow">
              THE DAILY SHOWDOWN
            </p>

            <h1>
              Think fast.
              <br />
              <span>Score big.</span>
            </h1>

            <p className="hero-description">
              A private trivia league for your crew.
              Control the board, choose the clue,
              lock in your answer, and climb the
              leaderboard.
            </p>

            <div className="feature-row">
              <span>
                <CheckCircle2 size={16} /> Private
                answers
              </span>

              <span>
                <Users size={16} /> 2–3 players
              </span>

              <span>
                <Trophy size={16} /> Running scores
              </span>
            </div>
          </div>

          <div className="join-card">
            <div className="card-heading">
              <div className="heading-icon">
                <Users size={20} />
              </div>

              <div>
                <h2>Join the game</h2>
                <p>
                  Enter your name and a room code
                </p>
              </div>
            </div>

            <label>Your player name</label>

            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                localStorage.setItem(
                  "dj_name",
                  e.target.value
                );
              }}
              placeholder="e.g. Alex"
              maxLength={24}
            />

            <label>Room code</label>

            <input
              className="code-input"
              value={roomCode}
              onChange={(e) =>
                setRoomCode(
                  e.target.value.toUpperCase()
                )
              }
              placeholder="ABCDE"
              maxLength={5}
            />

            <button
              className="button primary full"
              onClick={joinRoom}
              disabled={busy}
            >
              <LogIn size={17} />
              {busy
                ? "Joining…"
                : "Join friends"}
            </button>

            <div className="or-divider">
              <span>OR HOST A NEW GAME</span>
            </div>

            <button
              className="button secondary full"
              onClick={createRoom}
              disabled={busy}
            >
              <Plus size={17} />
              {busy
                ? "Creating…"
                : "Create a room"}
            </button>

            <p className="small muted center">
              The host shares a link. Everyone joins
              from their own device.
            </p>
          </div>
        </section>
      ) : (
        <section className="game-layout">
          <div className="game-main">
            <div className="game-heading">
              <div>
                <p className="eyebrow">
                  ROOM {room?.code} ·{" "}
                  {room?.day_key || todayKey()}
                </p>

                <h1>
                  {room?.title ||
                    "FRIENDS TRIVIA"}
                </h1>
              </div>

              <div className="player-count">
                <Users size={16} />
                {players.length} player
                {players.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="player-strip">
              {players.map((p) => (
                <div
                  className={`player-chip ${
                    p.id === player?.id
                      ? "self"
                      : ""
                  }`}
                  key={p.id}
                >
                  <span className="avatar">
                    {p.name
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>

                  <span>
                    {p.name}
                    {p.id === player?.id
                      ? " (you)"
                      : ""}
                  </span>

                  {p.is_host && (
                    <Crown
                      size={13}
                      className="crown"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* BOARD CONTROL BANNER */}
            <div
              className="notice"
              style={{
                marginBottom: "16px",
                textAlign: "center",
                fontWeight: 800,
              }}
            >
              {room?.game_phase === "answering"
                ? "CLUE IN PLAY — EVERYONE ANSWER!"
                : room?.game_phase === "revealed"
                ? "ANSWER REVEALED"
                : hasControl
                ? "YOU CONTROL THE BOARD — PICK THE NEXT CLUE"
                : controllingPlayer
                ? `${controllingPlayer.name.toUpperCase()} CONTROLS THE BOARD`
                : "WAITING FOR BOARD CONTROL"}
            </div>

            <div className="board-wrap">
              <div className="board">
                {boardCategories.map((cat) => (
                  <div
                    className="category"
                    key={cat}
                  >
                    {cat}
                  </div>
                ))}

                {[100, 200, 300, 400, 500].map(
                  (val) =>
                    boardCategories.map((cat) => {
                      const q = questions.find(
                        (x) =>
                          x.category === cat &&
                          x.value === val
                      );

                      const isDone =
                        q?.status === "revealed";

                      const isActive =
                        q?.id ===
                        room?.active_question_id;

                      /*
                       * Only the controlling player can
                       * click an open clue, and only while
                       * the room is in selecting mode.
                       */
                      const canChoose =
                        Boolean(q) &&
                        !isDone &&
                        hasControl &&
                        room?.game_phase ===
                          "selecting" &&
                        !busy;

                      return (
                        <button
                          key={`${cat}-${val}`}
                          className={`tile ${
                            isDone ? "done" : ""
                          } ${
                            isActive
                              ? "chosen"
                              : ""
                          }`}
                          disabled={!canChoose}
                          onClick={() =>
                            chooseQuestion(q)
                          }
                        >
                          {q ? (
                            isDone ? (
                              <CheckCircle2
                                size={20}
                              />
                            ) : (
                              money(val)
                            )
                          ) : (
                            "—"
                          )}
                        </button>
                      );
                    })
                )}
              </div>
            </div>

            {/* SAME ACTIVE QUESTION FOR EVERY PLAYER */}
            {selectedQuestion && (
              <div className="question-card">
                <div className="question-top">
                  <span className="question-category">
                    {selectedQuestion.category}
                  </span>

                  <span className="question-value">
                    {money(
                      selectedQuestion.value
                    )}
                  </span>
                </div>

                <h2>
                  {selectedQuestion.prompt}
                </h2>

                <div className="submit-status">
                  <Clock3 size={16} />
                  {selectedSubs.length} of{" "}
                  {players.length} answers
                  submitted
                </div>

                {alreadyAnswered ? (
                  <div className="submitted-lock">
                    <CheckCircle2 size={19} />

                    <div>
                      <b>Answer submitted</b>
                      <span>
                        Your answer is locked.
                        Waiting for the other
                        players…
                      </span>
                    </div>
                  </div>
                ) : (
                  <form
                    className="answer-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitAnswer();
                    }}
                  >
                    <input
                      value={answer}
                      onChange={(e) =>
                        setAnswer(e.target.value)
                      }
                      placeholder="Type your answer…"
                      autoComplete="off"
                    />

                    <button
                      className="button primary"
                      disabled={
                        busy || !answer.trim()
                      }
                    >
                      {busy
                        ? "Sending…"
                        : "Submit answer"}
                    </button>
                  </form>
                )}

                {isHost && allSubmitted && (
                  <div className="host-review">
                    <div>
                      <b>All answers are in.</b>
                      <p>
                        Review any close answers
                        before revealing.
                      </p>
                    </div>

                    {selectedSubs.map((s) => (
                      <label
                        className="review-row"
                        key={s.id}
                      >
                        <span>
                          <b>
                            {players.find(
                              (p) =>
                                p.id ===
                                s.player_id
                            )?.name ||
                              "Player"}
                          </b>

                          <small>
                            {s.answer}
                          </small>
                        </span>

                        <select
                          value={String(
                            manualCorrect[
                              s.player_id
                            ] ??
                              s.is_correct
                          )}
                          onChange={(e) =>
                            setManualCorrect(
                              (v) => ({
                                ...v,
                                [s.player_id]:
                                  e.target
                                    .value ===
                                  "true",
                              })
                            )
                          }
                        >
                          <option value="true">
                            Correct
                          </option>

                          <option value="false">
                            Incorrect
                          </option>
                        </select>
                      </label>
                    ))}

                    <button
                      className="button gold full"
                      onClick={revealAnswers}
                      disabled={busy}
                    >
                      <Trophy size={17} />
                      {busy
                        ? "Revealing…"
                        : "Reveal answer & award points"}
                    </button>
                  </div>
                )}

                {!isHost && allSubmitted && (
                  <div className="submitted-lock">
                    <Clock3 size={19} />

                    <div>
                      <b>
                        Everyone is locked in
                      </b>
                      <span>
                        Waiting for the host to
                        reveal and score the
                        answers…
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isHost && (
              <div className="host-tools">
                <button
                  className="button ghost"
                  onClick={startNewDay}
                  disabled={busy}
                >
                  <RotateCcw size={15} />
                  Start new daily game
                </button>

                <span className="small muted">
                  Resets daily scores; all-time
                  totals stay.
                </span>
              </div>
            )}

            {notice && (
              <div className="notice">
                {notice}
              </div>
            )}
          </div>

          <aside className="leaderboard">
            <div className="leaderboard-title">
              <Trophy size={19} />

              <div>
                <h2>Leaderboard</h2>
                <p>THE RACE TO THE TOP</p>
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

      {mode === "game" &&
        room?.game_phase === "revealed" &&
        selectedQuestion && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(2, 10, 35, 0.92)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                width: "min(760px, 100%)",
                maxHeight: "90vh",
                overflowY: "auto",
                background:
                  "linear-gradient(180deg, #102d72 0%, #081b4d 100%)",
                border: "2px solid #f6c945",
                borderRadius: "18px",
                boxShadow:
                  "0 30px 90px rgba(0,0,0,.55)",
                padding: "32px",
                color: "white",
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  marginBottom: "28px",
                }}
              >
                <div
                  className="eyebrow"
                  style={{
                    color: "#f6c945",
                    marginBottom: "10px",
                  }}
                >
                  CORRECT ANSWER
                </div>

                <div
                  style={{
                    fontSize: "clamp(30px, 5vw, 52px)",
                    fontWeight: 900,
                    lineHeight: 1.05,
                    marginBottom: "10px",
                  }}
                >
                  {revealedAnswer || "Loading…"}
                </div>

                <div
                  style={{
                    opacity: 0.72,
                    fontSize: "14px",
                  }}
                >
                  {selectedQuestion.category} ·{" "}
                  {money(selectedQuestion.value)}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  marginBottom: "24px",
                }}
              >
                {selectedSubs
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(a.submitted_at) -
                      new Date(b.submitted_at)
                  )
                  .map((sub) => {
                    const answerPlayer = players.find(
                      (p) => p.id === sub.player_id
                    );

                    return (
                      <div
                        key={sub.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(100px, 1fr) minmax(120px, 2fr) auto",
                          gap: "14px",
                          alignItems: "center",
                          background:
                            "rgba(255,255,255,.07)",
                          border: "1px solid rgba(255,255,255,.12)",
                          borderRadius: "10px",
                          padding: "14px 16px",
                        }}
                      >
                        <b>
                          {answerPlayer?.name ||
                            "Player"}
                        </b>

                        <span
                          style={{
                            opacity: 0.9,
                            overflowWrap: "anywhere",
                          }}
                        >
                          “{sub.answer}”
                        </span>

                        <b
                          style={{
                            color: sub.is_correct
                              ? "#6ee7a8"
                              : "#ff8a8a",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {sub.is_correct
                            ? `✓ +${money(
                                sub.points_awarded ||
                                  selectedQuestion.value
                              )}`
                            : "✕ $0"}
                        </b>
                      </div>
                    );
                  })}
              </div>

              <div
                style={{
                  textAlign: "center",
                  padding: "16px",
                  background: "rgba(0,0,0,.18)",
                  borderRadius: "10px",
                  marginBottom: "20px",
                }}
              >
                {controllingPlayer ? (
                  <>
                    <Crown
                      size={18}
                      style={{
                        verticalAlign: "middle",
                        marginRight: "8px",
                        color: "#f6c945",
                      }}
                    />
                    <b>{controllingPlayer.name}</b>{" "}
                    controls the board next.
                  </>
                ) : (
                  "Board control remains unchanged."
                )}
              </div>

              {isHost ? (
                <button
                  className="button gold full"
                  onClick={continueAfterReveal}
                  disabled={busy}
                >
                  {busy
                    ? "Continuing…"
                    : "Continue to board"}
                </button>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    opacity: 0.75,
                    fontWeight: 700,
                  }}
                >
                  Waiting for the host to continue…
                </div>
              )}
            </div>
          </div>
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