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
