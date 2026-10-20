import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const API_URL = "https://the-trivia-api.com/v2/questions";

function difficultyToNumber(difficulty) {
  if (difficulty === "easy") {
    return Math.random() < 0.5 ? 1 : 2;
  }

  if (difficulty === "medium") {
    return Math.random() < 0.5 ? 3 : 4;
  }

  return 5;
}

function chooseCategory(question) {
  const tags = (question.tags || []).map((tag) => tag.toLowerCase());
  const text = `${question.question?.text || ""} ${tags.join(" ")}`.toLowerCase();

  // SPORTS
  if (
    text.includes("nfl") ||
    text.includes("american football") ||
    text.includes("super bowl")
  ) {
    return "NFL";
  }

  if (
    text.includes("nba") ||
    text.includes("basketball")
  ) {
    return "NBA";
  }

  if (
    text.includes("mlb") ||
    text.includes("baseball")
  ) {
    return "MLB";
  }

  if (
    text.includes("soccer") ||
    text.includes("football club") ||
    text.includes("premier league") ||
    text.includes("fifa")
  ) {
    return "SOCCER";
  }

  // ENTERTAINMENT
  if (
    text.includes("video game") ||
    text.includes("gaming") ||
    text.includes("playstation") ||
    text.includes("xbox") ||
    text.includes("nintendo")
  ) {
    return "VIDEO GAMES";
  }

  if (
    text.includes("anime") ||
    text.includes("manga")
  ) {
    return "ANIME";
  }

  if (
    text.includes("cartoon") ||
    text.includes("animation") ||
    text.includes("animated")
  ) {
    return "CARTOONS";
  }

  if (
    text.includes("marvel") ||
    text.includes("avengers") ||
    text.includes("spider-man") ||
    text.includes("x-men")
  ) {
    return "MARVEL";
  }

  if (
    text.includes("dc comics") ||
    text.includes("batman") ||
    text.includes("superman")
  ) {
    return "DC COMICS";
  }

  if (
    text.includes("hip hop") ||
    text.includes("hip-hop") ||
    text.includes("rapper") ||
    text.includes("rap ")
  ) {
    return "HIP-HOP";
  }

  if (
    text.includes("music") ||
    text.includes("singer") ||
    text.includes("album") ||
    text.includes("song")
  ) {
    return "MUSIC";
  }

  if (
    text.includes("sitcom")
  ) {
    return "SITCOMS";
  }

  if (
    text.includes("horror")
  ) {
    return "HORROR";
  }

  if (
    text.includes("movie") ||
    text.includes("film") ||
    text.includes("cinema")
  ) {
    return "MOVIES";
  }

  if (
    text.includes("television") ||
    text.includes("tv show") ||
    text.includes("tv series")
  ) {
    return "TV SHOWS";
  }

  if (
    text.includes("celebrity") ||
    text.includes("actor") ||
    text.includes("actress")
  ) {
    return "CELEBRITIES";
  }

  if (
    text.includes("car") ||
    text.includes("automobile") ||
    text.includes("vehicle")
  ) {
    return "CARS";
  }

  if (
    text.includes("computer") ||
    text.includes("technology") ||
    text.includes("internet")
  ) {
    return "TECH & INTERNET";
  }

  if (
    text.includes("food") ||
    text.includes("restaurant") ||
    text.includes("drink")
  ) {
    return "FOOD & DRINK";
  }

  // FALLBACK BASED ON API CATEGORY
  const category = question.category;

  const fallback = {
    film_and_tv: "MOVIES & TV",
    music: "MUSIC",
    sport_and_leisure: "SPORTS",
    society_and_culture: "POP CULTURE",
    food_and_drink: "FOOD & DRINK",
    science: "SCIENCE",
    arts_and_literature: "ARTS & BOOKS",
    general_knowledge: "RANDOM KNOWLEDGE",
  };

  return fallback[category] || "RANDOM KNOWLEDGE";
}

async function getQuestions(category) {
  const params = new URLSearchParams({
    limit: "50",
    categories: category,
  });

  const response = await fetch(`${API_URL}?${params}`);

  if (!response.ok) {
    throw new Error(
      `Trivia API returned ${response.status}`
    );
  }

  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const categories = [
      "film_and_tv",
      "music",
      "sport_and_leisure",
      "society_and_culture",
      "food_and_drink",
      "general_knowledge",
      "science",
      "arts_and_literature",
    ];

    let imported = 0;
    let duplicates = 0;
    let attempted = 0;

    for (const apiCategory of categories) {
      const questions = await getQuestions(apiCategory);

      for (const question of questions) {
        attempted++;

        const questionText = question.question?.text?.trim();
        const answer = question.correctAnswer?.trim();

        if (!questionText || !answer) {
          continue;
        }

        const row = {
          external_id: question.id,
          category: chooseCategory(question),
          difficulty: difficultyToNumber(question.difficulty),
          question: questionText,
          answer: answer,
          accepted_answers: "",
          source_url: "https://the-trivia-api.com/",
          source_name: "The Trivia API",
          tags: question.tags || [],
          active: true,
        };

        const { error } = await supabase
          .from("question_bank")
          .insert(row);

        if (error) {
          if (
            error.code === "23505" ||
            error.message?.toLowerCase().includes("duplicate")
          ) {
            duplicates++;
            continue;
          }

          console.error("Insert error:", error);
          continue;
        }

        imported++;
      }
    }

    return res.status(200).json({
      success: true,
      attempted,
      imported,
      duplicates,
      message: `Imported ${imported} new unique questions. ${duplicates} duplicates were safely skipped.`,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
