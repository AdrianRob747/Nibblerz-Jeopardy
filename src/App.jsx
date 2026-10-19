import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Trophy, Users, RefreshCw, LogIn, Plus, CheckCircle2, Clock3, Crown, RotateCcw } from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const SAMPLE_CATEGORIES = ["SPORTS", "HISTORY", "POP CULTURE", "SCIENCE", "GEOGRAPHY"];
const SAMPLE_QUESTIONS = [
  { category: "SPORTS", value: 100, prompt: "Which country won the 2022 FIFA Men's World Cup?", answer: "Argentina", accepted: ["argentina"] },
  { category: "SPORTS", value: 200, prompt: "How many points is a touchdown worth before the extra point?", answer: "6", accepted: ["six", "6 points"] },
  { category: "HISTORY", value: 100, prompt: "In what year did the Berlin Wall fall?", answer: "1989", accepted: ["1989"] },
  { category: "HISTORY", value: 200, prompt: "Who was the first President of the United States?", answer: "George Washington", accepted: ["george washington", "washington"] },
  { category: "POP CULTURE", value: 100, prompt: "What is the name of the fictional kingdom in Frozen?", answer: "Arendelle", accepted: ["arendelle"] },
  { category: "POP CULTURE", value: 200, prompt: "Which artist released the album 1989?", answer: "Taylor Swift", accepted: ["taylor swift"] },
  { category: "SCIENCE", value: 100, prompt: "What planet is known as the Red Planet?", answer: "Mars", accepted: ["mars"] },
  { category: "SCIENCE", value: 200, prompt: "What is the chemical symbol for gold?", answer: "Au", accepted: ["au"] },
  { category: "GEOGRAPHY", value: 100, prompt: "What is the capital of Japan?", answer: "Tokyo", accepted: ["tokyo"] },
  { category: "GEOGRAPHY", value: 200, prompt: "Which is the largest ocean on Earth?", answer: "Pacific Ocean", accepted: ["pacific ocean", "the pacific", "pacific"] }
];

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
const money = (n) => "$" + Number(n || 0).toLocaleString("en-US");

function App() {
  const [configOk, setConfigOk] = useState(Boolean(supabase));
  const [mode, setMode] = useState("home");
  const [name, setName] = useState(localStorage.getItem("dj_name") || "");
  const [roomCode, setRoomCode] = useState(new URLSearchParams(location.search).get("room") || "");
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null);
  const [players, setPlayers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [scores, setScores] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [host, setHost] = useState(false);
  const [manualCorrect, setManualCorrect] = useState({});
  const [daily, setDaily] = useState([]);
  const [allTime, setAllTime] = useState([]);

  const refreshRoom = useCallback(async (code) => {
    if (!supabase || !code) return;
    const { data: r, error: re } = await supabase.from("rooms").select("*").eq("code", code.toUpperCase()).maybeSingle();
    if (re) { setNotice(re.message); return; }
    if (!r) { setNotice("Room not found. Check the code or create a new room."); return; }
    setRoom(r);
    const [p, q, s, sub] = await Promise.all([
      supabase.from("players").select("*").eq("room_id", r.id).order("created_at"),
      supabase.from("questions").select("id,room_id,category,value,prompt,board_order,day_key,status").eq("room_id", r.id).order("board_order"),
      supabase.from("scores").select("*").eq("room_id", r.id).order("total_score", { ascending: false }),
      supabase.from("submissions").select("*").eq("room_id", r.id)
    ]);
    if (p.error || q.error || s.error || sub.error) { setNotice([p.error,q.error,s.error,sub.error].filter(Boolean).map(x=>x.message).join(" ")); return; }
    setPlayers(p.data || []); setQuestions(q.data || []); setScores(s.data || []); setSubmissions(sub.data || []);
    setDaily((s.data || []).slice().sort((a,b)=>(b.daily_score||0)-(a.daily_score||0)));
    setAllTime((s.data || []).slice().sort((a,b)=>(b.total_score||0)-(a.total_score||0)));
  }, []);

  useEffect(() => {
    if (!room?.id || !supabase) return;
    const channel = supabase.channel("room-" + room.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` }, () => refreshRoom(room.code))
      .on("postgres_changes", { event: "*", schema: "public", table: "questions", filter: `room_id=eq.${room.id}` }, () => refreshRoom(room.code))
      .on("postgres_changes", { event: "*", schema: "public", table: "scores", filter: `room_id=eq.${room.id}` }, () => refreshRoom(room.code))
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `room_id=eq.${room.id}` }, () => refreshRoom(room.code))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` }, () => refreshRoom(room.code))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [room?.id, room?.code, refreshRoom]);

  const mySubmissions = useMemo(() => submissions.filter(s => s.player_id === player?.id), [submissions, player]);
  const selectedQuestion = questions.find(q => q.id === selected);
  const selectedSubs = submissions.filter(s => s.question_id === selected);
  const allSubmitted = players.length > 0 && selectedSubs.length >= players.length;
  const alreadyAnswered = selectedSubs.some(s => s.player_id === player?.id);
  const isHost = host || room?.host_player_id === player?.id;
  const boardCategories = useMemo(() => {
    const found = [...new Set(questions.map(q => q.category))];
    return found.length ? found : SAMPLE_CATEGORIES;
  }, [questions]);

  async function createRoom() {
    if (!supabase) { setNotice("Add your Supabase URL and anon key to .env first. See README.md."); return; }
    if (!name.trim()) { setNotice("Enter your player name first."); return; }
    setBusy(true); setNotice("");
    try {
      const code = Math.random().toString(36).slice(2, 7).toUpperCase();
      const { data: r, error } = await supabase.from("rooms").insert({ code, title: "FRIENDS TRIVIA", day_key: todayKey(), status: "lobby" }).select().single();
      if (error) throw error;
      const { data: p, error: pe } = await supabase.from("players").insert({ room_id: r.id, name: name.trim(), is_host: true }).select().single();
      if (pe) throw pe;
      const { error: he } = await supabase.from("rooms").update({ host_player_id: p.id }).eq("id", r.id);
      if (he) throw he;
      const qRows = SAMPLE_QUESTIONS.map((q, i) => ({ room_id: r.id, category: q.category, value: q.value, prompt: q.prompt, board_order: i, day_key: todayKey(), status: "open" }));
      const { data: inserted, error: qe } = await supabase.from("questions").insert(qRows).select();
      if (qe) throw qe;
      const keyRows = (inserted || []).map((q, i) => ({ question_id: q.id, answer: SAMPLE_QUESTIONS[i].answer, accepted_answers: SAMPLE_QUESTIONS[i].accepted }));
      const { error: ke } = await supabase.from("answer_keys").insert(keyRows);
      if (ke) throw ke;
      const { error: se } = await supabase.from("scores").insert({ room_id: r.id, player_id: p.id, daily_score: 0, total_score: 0 });
      if (se) throw se;
      setRoomCode(code); setRoom(r); setPlayer(p); setHost(true); setMode("game");
      history.replaceState(null, "", "?room=" + code);
      await refreshRoom(code);
      setNotice("Room created! Share the room code with your friends.");
    } catch (e) { setNotice(e.message || "Couldn't create the room."); }
    finally { setBusy(false); }
  }

  async function joinRoom() {
    if (!supabase) { setNotice("Add your Supabase URL and anon key to .env first. See README.md."); return; }
    if (!name.trim() || !roomCode.trim()) { setNotice("Enter your name and room code."); return; }
    setBusy(true); setNotice("");
    try {
      const { data: r, error: re } = await supabase.from("rooms").select("*").eq("code", roomCode.trim().toUpperCase()).single();
      if (re) throw re;
      const { data: existing } = await supabase.from("players").select("*").eq("room_id", r.id).ilike("name", name.trim()).maybeSingle();
      let p = existing;
      if (!p) {
        const { data, error } = await supabase.from("players").insert({ room_id: r.id, name: name.trim() }).select().single();
        if (error) throw error;
        p = data;
        const { error: se } = await supabase.from("scores").insert({ room_id: r.id, player_id: p.id, daily_score: 0, total_score: 0 });
        if (se) throw se;
      }
      setRoom(r); setPlayer(p); setHost(Boolean(p.is_host)); setMode("game");
      localStorage.setItem("dj_name", name.trim());
      history.replaceState(null, "", "?room=" + r.code);
      await refreshRoom(r.code);
    } catch (e) { setNotice(e.message || "Couldn't join the room."); }
    finally { setBusy(false); }
  }

  async function submitAnswer() {
    if (!selectedQuestion || !player || !answer.trim() || alreadyAnswered) return;
    setBusy(true); setNotice("");
    try {
      const { data: key, error: ke } = await supabase.from("answer_keys").select("answer,accepted_answers").eq("question_id", selectedQuestion.id).single();
      if (ke) throw ke;
      const accepted = [key.answer, ...(key.accepted_answers || [])].map(norm);
      const correct = accepted.includes(norm(answer));
      const { error } = await supabase.from("submissions").insert({
        room_id: room.id, question_id: selectedQuestion.id, player_id: player.id,
        answer: answer.trim(), is_correct: correct, points_awarded: 0, submitted_at: new Date().toISOString()
      });
      if (error) throw error;
      setAnswer("");
      setNotice("Answer locked in. Waiting for everyone else…");
      await refreshRoom(room.code);
    } catch (e) { setNotice(e.message || "Couldn't submit your answer."); }
    finally { setBusy(false); }
  }

  async function revealAnswers() {
    if (!isHost || !selectedQuestion || !allSubmitted) return;
    setBusy(true); setNotice("");
    try {
      const { data: key, error: ke } = await supabase.from("answer_keys").select("answer").eq("question_id", selectedQuestion.id).single();
      if (ke) throw ke;
      const subs = submissions.filter(s => s.question_id === selectedQuestion.id);
      for (const sub of subs) {
        const isCorrect = manualCorrect[sub.player_id] ?? sub.is_correct;
        const award = isCorrect ? selectedQuestion.value : 0;
        const { error: ue } = await supabase.from("submissions").update({ is_correct: isCorrect, points_awarded: award }).eq("id", sub.id);
        if (ue) throw ue;
        const score = scores.find(s => s.player_id === sub.player_id);
        if (score) {
          const { error: se } = await supabase.from("scores").update({
            daily_score: (score.daily_score || 0) + award,
            total_score: (score.total_score || 0) + award
          }).eq("id", score.id);
          if (se) throw se;
        }
      }
      const { error: qe } = await supabase.from("questions").update({ status: "revealed" }).eq("id", selectedQuestion.id);
      if (qe) throw qe;
      setNotice("Answer revealed and scores updated!");
      await refreshRoom(room.code);
    } catch (e) { setNotice(e.message || "Couldn't reveal answers."); }
    finally { setBusy(false); }
  }

  async function startNewDay() {
    if (!isHost) return;
    setBusy(true);
    try {
      const { error: re } = await supabase.from("rooms").update({ day_key: todayKey(), status: "playing" }).eq("id", room.id);
      if (re) throw re;
      const { error: se } = await supabase.from("scores").update({ daily_score: 0 }).eq("room_id", room.id);
      if (se) throw se;
      const { error: qe } = await supabase.from("questions").update({ status: "open", day_key: todayKey() }).eq("room_id", room.id);
      if (qe) throw qe;
      await supabase.from("submissions").delete().eq("room_id", room.id);
      setSelected(null); setNotice("New daily game started. All-time scores are preserved.");
      await refreshRoom(room.code);
    } catch (e) { setNotice(e.message || "Couldn't start a new day."); }
    finally { setBusy(false); }
  }

  async function resetQuestion() {
    if (!isHost || !selectedQuestion) return;
    const ok = confirm("Reset this question for everyone? Existing submissions and awards for this question will be removed from the room's current daily score only if you reset the daily game. For a clean replay, use Start new day.");
    if (!ok) return;
    setSelected(null);
  }

  async function copyInvite() {
    const url = `${location.origin}${location.pathname}?room=${room.code}`;
    try { await navigator.clipboard.writeText(url); setNotice("Invite link copied to clipboard."); }
    catch { setNotice("Share this room code: " + room.code); }
  }

  if (!supabase) return <div className="setup-page"><div className="setup-card"><div className="brand-mark">J!</div><p className="eyebrow">YOUR FRIEND GROUP'S DAILY TRIVIA</p><h1>Daily Jeopardy</h1><p className="muted">Your classic blue-and-gold trivia board is ready to configure.</p><div className="setup-steps"><b>One-time setup required</b><ol><li>Create a free Supabase project.</li><li>Run the SQL in <code>supabase/schema.sql</code>.</li><li>Copy your project URL and anon key into a <code>.env</code> file.</li><li>Run <code>npm install</code> then <code>npm run dev</code>.</li></ol></div><p className="muted small">Full deployment instructions are in README.md. The backend is required for shared rooms, live updates, and persistent scores.</p></div></div>;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">J!</div><div><div className="brand-title">DAILY JEOPARDY</div><div className="brand-sub">FRIENDS EDITION</div></div></div>
      <div className="top-actions">{room && <><span className="room-pill"><span className="live-dot"></span> ROOM {room.code}</span><button className="button ghost" onClick={copyInvite}>Share invite</button></>}</div>
    </header>

    {mode === "home" ? <section className="home-layout">
      <div className="hero-copy"><p className="eyebrow">THE DAILY SHOWDOWN</p><h1>Think fast.<br/><span>Score big.</span></h1><p className="hero-description">A private trivia league for your crew. Pick a dollar value, lock in your answer, and climb the all-time leaderboard.</p>
        <div className="feature-row"><span><CheckCircle2 size={16}/> Private answers</span><span><Users size={16}/> 2–3 players</span><span><Trophy size={16}/> Running scores</span></div>
      </div>
      <div className="join-card"><div className="card-heading"><div className="heading-icon"><Users size={20}/></div><div><h2>Join the game</h2><p>Enter your name and a room code</p></div></div>
        <label>Your player name</label><input value={name} onChange={e=>{setName(e.target.value);localStorage.setItem("dj_name",e.target.value)}} placeholder="e.g. Alex" maxLength={24}/>
        <label>Room code</label><input className="code-input" value={roomCode} onChange={e=>setRoomCode(e.target.value.toUpperCase())} placeholder="ABCDE" maxLength={5}/>
        <button className="button primary full" onClick={joinRoom} disabled={busy}><LogIn size={17}/>{busy?"Joining…":"Join friends"}</button>
        <div className="or-divider"><span>OR HOST A NEW GAME</span></div>
        <button className="button secondary full" onClick={createRoom} disabled={busy}><Plus size={17}/>{busy?"Creating…":"Create a room"}</button>
        <p className="small muted center">The host shares a link. Everyone joins from their own device.</p>
      </div>
    </section> : <section className="game-layout">
      <div className="game-main">
        <div className="game-heading"><div><p className="eyebrow">ROOM {room?.code} · {room?.day_key || todayKey()}</p><h1>{room?.title || "FRIENDS TRIVIA"}</h1></div><div className="player-count"><Users size={16}/>{players.length} player{players.length===1?"":"s"}</div></div>
        <div className="player-strip">{players.map(p=><div className={`player-chip ${p.id===player?.id?"self":""}`} key={p.id}><span className="avatar">{p.name.slice(0,1).toUpperCase()}</span><span>{p.name}{p.id===player?.id?" (you)":""}</span>{p.is_host&&<Crown size={13} className="crown"/>}</div>)}</div>
        <div className="board-wrap"><div className="board">
          {boardCategories.map((cat,ci)=><div className="category" key={cat}>{cat}</div>)}
          {[100,200,300,400,500].map(val=>boardCategories.map((cat,ci)=>{
            const q=questions.find(x=>x.category===cat && x.value===val);
            const fallback = SAMPLE_QUESTIONS.find(x=>x.category===cat && x.value===val);
            const isDone = q?.status==="revealed";
            const isChosen = selected===q?.id;
            return <button key={`${cat}-${val}`} className={`tile ${isDone?"done":""} ${isChosen?"chosen":""}`} disabled={!q||isDone} onClick={()=>{setSelected(q.id);setAnswer("");setNotice("");setManualCorrect({})}}>
              {q ? (isDone ? <CheckCircle2 size={20}/> : money(val)) : "—"}
            </button>;
          }))}
        </div></div>
        {selectedQuestion && <div className="question-card">
          <div className="question-top"><span className="question-category">{selectedQuestion.category}</span><span className="question-value">{money(selectedQuestion.value)}</span></div>
          <h2>{selectedQuestion.prompt}</h2>
          {selectedQuestion.status === "revealed" ? <div className="reveal-panel"><p className="eyebrow">CORRECT ANSWER</p><h3>{/* answer is fetched only on reveal */}<AnswerReveal questionId={selectedQuestion.id}/></h3><div className="answer-results">{selectedSubs.map(s=><div className="answer-result" key={s.id}><span>{players.find(p=>p.id===s.player_id)?.name || "Player"}</span><span className={s.is_correct?"correct":"incorrect"}>{s.is_correct?"Correct":"Incorrect"} · {money(s.points_awarded)}</span></div>)}</div></div> :
          <><div className="submit-status"><Clock3 size={16}/>{selectedSubs.length} of {players.length} answers submitted</div>
          {alreadyAnswered ? <div className="submitted-lock"><CheckCircle2 size={19}/><div><b>Answer submitted</b><span>Your answer is locked. Waiting for the other players…</span></div></div> :
            <form className="answer-form" onSubmit={e=>{e.preventDefault();submitAnswer()}}><input value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Type your answer…" autoComplete="off"/><button className="button primary" disabled={busy||!answer.trim()}>{busy?"Sending…":"Submit answer"}</button></form>}
          {isHost && allSubmitted && <div className="host-review"><div><b>All answers are in.</b><p>Review any close answers before revealing.</p></div>{selectedSubs.map(s=><label className="review-row" key={s.id}><span><b>{players.find(p=>p.id===s.player_id)?.name}</b><small>{s.answer}</small></span><select value={String(manualCorrect[s.player_id] ?? s.is_correct)} onChange={e=>setManualCorrect(v=>({...v,[s.player_id]:e.target.value==="true"}))}><option value="true">Correct</option><option value="false">Incorrect</option></select></label>)}<button className="button gold full" onClick={revealAnswers} disabled={busy}><Trophy size={17}/>{busy?"Revealing…":"Reveal answer & award points"}</button></div>}
          </>}
        </div>}
        {isHost && <div className="host-tools"><button className="button ghost" onClick={startNewDay} disabled={busy}><RotateCcw size={15}/> Start new daily game</button><span className="small muted">Resets daily scores; all-time totals stay.</span></div>}
        {notice && <div className="notice">{notice}</div>}
      </div>
      <aside className="leaderboard">
        <div className="leaderboard-title"><Trophy size={19}/><div><h2>Leaderboard</h2><p>THE RACE TO THE TOP</p></div></div>
        <div className="score-tabs"><span className="active">All time</span><span>Today</span></div>
        <div className="leader-list">{allTime.map((s,i)=>{const p=players.find(p=>p.id===s.player_id);return <div className={`leader-row ${s.player_id===player?.id?"my-row":""}`} key={s.id}><span className={`rank rank-${i+1}`}>{i===0?<Crown size={15}/>:i+1}</span><span className="leader-name">{p?.name||"Player"}{s.player_id===player?.id&&<small>YOU</small>}</span><b>{money(s.total_score)}</b></div>})}{!allTime.length&&<p className="muted small">Scores appear here after the first correct answer.</p>}</div>
        <div className="today-card"><div className="today-title"><Clock3 size={15}/> TODAY'S SCORES</div>{daily.map(s=><div className="daily-row" key={s.id}><span>{players.find(p=>p.id===s.player_id)?.name||"Player"}</span><b>{money(s.daily_score)}</b></div>)}</div>
        <div className="rules"><b>HOW TO PLAY</b><p>Choose a dollar amount. Everyone submits privately. When all players are in, the host reviews and reveals the answer.</p><p>Correct answers earn the tile value. No penalty for incorrect answers.</p></div>
      </aside>
    </section>}
    <footer className="footer"><span>DAILY JEOPARDY <span className="gold-text">•</span> FRIENDS EDITION</span><span>BUILT FOR YOUR CREW</span></footer>
  </main>;
}

function AnswerReveal({ questionId }) {
  const [answer, setAnswer] = useState("");
  useEffect(() => {
    let active = true;
    if (supabase) supabase.from("answer_keys").select("answer").eq("question_id", questionId).single().then(({data})=>{if(active)setAnswer(data?.answer||"");});
    return () => { active = false; };
  }, [questionId]);
  return answer || "Answer revealed";
}

export default App;
