import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

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
  const tags = (question.tags || []).map((tag) =>
    String(tag).toLowerCase()
  );

  const questionText = question.question?.text || "";

  const text = [
    questionText,
    question.category || "",
    ...tags,
  ]
    .join(" ")
    .toLowerCase();

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
    text.includes("nhl") ||
    text.includes("ice hockey")
  ) {
    return "NHL";
  }

  if (
    text.includes("soccer") ||
    text.includes("premier league") ||
    text.includes("fifa") ||
    text.includes("football club")
  ) {
    return "SOCCER";
  }

  if (
    text.includes("wrestling") ||
    text.includes("wwe")
  ) {
    return "WRESTLING";
  }

  // GAMING / COMICS / ANIMATION

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
    text.includes("pokemon") ||
    text.includes("pokémon")
  ) {
    return "POKÉMON";
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

  // MUSIC

  if (
    text.includes("hip hop") ||
    text.includes("hip-hop") ||
    text.includes("rapper") ||
    text.includes("rap music")
  ) {
    return "HIP-HOP";
  }

  if (
    text.includes("rock music") ||
    text.includes("rock band")
  ) {
    return "ROCK MUSIC";
  }

  if (
    text.includes("music") ||
    text.includes("singer") ||
    text.includes("album") ||
    text.includes("song") ||
    text.includes("musician")
  ) {
    return "MUSIC";
  }

  // MOVIES / TV

  if (text.includes("sitcom")) {
    return "SITCOMS";
  }

  if (text.includes("horror")) {
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

  // OTHER FUN CATEGORIES

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

  // FALLBACK CATEGORY

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

  return (
    fallback[question.category] ||
    "RANDOM KNOWLEDGE"
  );
}

export default async function handler(req, res) {
  try {
    /*
      Weighted toward what we actually want in Nibblerz.

      Entertainment, music and sports appear more often.
      History and geography are intentionally excluded.
    */
    const categories = [
      "film_and_tv",
      "film_and_tv",
      "film_and_tv",

      "music",
      "music",
      "music",

      "sport_and_leisure",
      "sport_and_leisure",
      "sport_and_leisure",

      "society_and_culture",
      "society_and_culture",

      "food_and_drink",

      "general_knowledge",

      "science",

      "arts_and_literature",
    ];

    /*
      Each run does 5 batches of up to 50 questions.

      Maximum attempted per run = 250.

      Because external_id is unique, questions already in
      Supabase are automatically skipped.
    */
    const BATCHES = 5;

    let received = 0;
    let imported = 0;
    let duplicatesSkipped = 0;

    const batchResults = [];

    for (let batch = 1; batch <= BATCHES; batch++) {
      const apiCategory =
        categories[
          Math.floor(Math.random() * categories.length)
        ];

      const params = new URLSearchParams({
        limit: "50",
        categories: apiCategory,
      });

      const response = await fetch(
        `${API_URL}?${params.toString()}`
      );

      if (!response.ok) {
        batchResults.push({
          batch,
          category: apiCategory,
          error: `Trivia API status ${response.status}`,
        });

        continue;
      }

      const questions = await response.json();

      received += questions.length;

      const rows = questions
        .map((question) => {
          const questionText =
            question.question?.text?.trim();

          const answer =
            question.correctAnswer?.trim();

          if (!questionText || !answer) {
            return null;
          }

          return {
            external_id: question.id,

            category:
              chooseCategory(question),

            difficulty:
              difficultyToNumber(
                question.difficulty
              ),

            question: questionText,

            answer,

            accepted_answers: "",

            source_url:
              "https://the-trivia-api.com/",

            source_name:
              "The Trivia API",

            tags: question.tags || [],

            active: true,
          };
        })
        .filter(Boolean);

      if (rows.length === 0) {
        batchResults.push({
          batch,
          category: apiCategory,
          received: questions.length,
          imported: 0,
        });

        continue;
      }

      const { data, error } = await supabase
        .from("question_bank")
        .upsert(rows, {
          onConflict: "external_id",
          ignoreDuplicates: true,
        })
        .select("id");

      if (error) {
        batchResults.push({
          batch,
          category: apiCategory,
          error: error.message,
        });

        continue;
      }

      const batchImported =
        data?.length || 0;

      const batchDuplicates =
        rows.length - batchImported;

      imported += batchImported;

      duplicatesSkipped +=
        batchDuplicates;

      batchResults.push({
        batch,
        category: apiCategory,
        received: questions.length,
        imported: batchImported,
        duplicatesSkipped:
          batchDuplicates,
      });
    }

    /*
      Get the current total bank size.
    */
    const {
      count: totalQuestionBank,
      error: countError,
    } = await supabase
      .from("question_bank")
      .select("*", {
        count: "exact",
        head: true,
      });

    if (countError) {
      console.error(
        "Count error:",
        countError
      );
    }

    return res.status(200).json({
      success: true,

      batchesAttempted: BATCHES,

      received,

      imported,

      duplicatesSkipped,

      totalQuestionBank:
        totalQuestionBank ?? "unknown",

      batchResults,

      message:
        `Imported ${imported} new unique questions. ` +
        `Your bank now contains approximately ` +
        `${totalQuestionBank ?? "unknown"} questions.`,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,

      error:
        error?.message ||
        "Unknown importer error",
    });
  }
}
