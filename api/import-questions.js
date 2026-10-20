import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const API_URL = "https://the-trivia-api.com/v2/questions";

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

  const q = question.question?.text || "";

  const text = [
    q,
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

  // GAMING

  if (
    text.includes("pokemon") ||
    text.includes("pokémon")
  ) {
    return "POKÉMON";
  }

  if (
    text.includes("video game") ||
    text.includes("gaming") ||
    text.includes("playstation") ||
    text.includes("xbox") ||
    text.includes("nintendo")
  ) {
    return "VIDEO GAMES";
  }

  // ANIMATION / COMICS

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

  // API CATEGORY FALLBACKS

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
      Heavily weighted toward entertainment,
      sports, music and pop culture.

      History and geography are intentionally
      not requested.
    */
    const categories = [
      "film_and_tv",
      "film_and_tv",
      "film_and_tv",
      "film_and_tv",

      "music",
      "music",
      "music",
      "music",

      "sport_and_leisure",
      "sport_and_leisure",
      "sport_and_leisure",

      "society_and_culture",
      "society_and_culture",
      "society_and_culture",

      "food_and_drink",

      "general_knowledge",

      "science",

      "arts_and_literature",
    ];

    /*
      Five API requests per run.
      Up to 250 questions received.
    */
    const BATCHES = 5;

    let totalReceived = 0;
    let totalImported = 0;
    let duplicateIdsSkipped = 0;
    let duplicateTextSkipped = 0;

    const batchResults = [];

    for (
      let batch = 1;
      batch <= BATCHES;
      batch++
    ) {
      const apiCategory =
        categories[
          Math.floor(
            Math.random() *
              categories.length
          )
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
          error:
            `Trivia API returned ` +
            `${response.status}`,
        });

        continue;
      }

      const questions =
        await response.json();

      totalReceived += questions.length;

      /*
        First remove duplicates that occurred
        inside this API response itself.
      */
      const batchSeenIds = new Set();
      const batchSeenText = new Set();

      const candidates = [];

      for (const question of questions) {
        const questionText =
          question.question?.text?.trim();

        const answer =
          question.correctAnswer?.trim();

        if (
          !question.id ||
          !questionText ||
          !answer
        ) {
          continue;
        }

        const normalized =
          normalizeText(questionText);

        if (
          batchSeenIds.has(question.id)
        ) {
          duplicateIdsSkipped++;
          continue;
        }

        if (
          batchSeenText.has(normalized)
        ) {
          duplicateTextSkipped++;
          continue;
        }

        batchSeenIds.add(question.id);
        batchSeenText.add(normalized);

        candidates.push({
          original: question,
          normalized,
        });
      }

      if (candidates.length === 0) {
        batchResults.push({
          batch,
          category: apiCategory,
          received: questions.length,
          imported: 0,
          reason:
            "No usable candidates",
        });

        continue;
      }

      /*
        Check which API IDs already exist.
      */
      const candidateIds =
        candidates.map(
          (item) => item.original.id
        );

      const {
        data: existingIdRows,
        error: idCheckError,
      } = await supabase
        .from("question_bank")
        .select("external_id")
        .in("external_id", candidateIds);

      if (idCheckError) {
        throw idCheckError;
      }

      const existingIds = new Set(
        (existingIdRows || [])
          .map((row) => row.external_id)
          .filter(Boolean)
      );

      const afterIdCheck =
        candidates.filter((item) => {
          if (
            existingIds.has(
              item.original.id
            )
          ) {
            duplicateIdsSkipped++;
            return false;
          }

          return true;
        });

      /*
        We also need to protect against the
        same question having a different API ID.

        Fetch the current question text from
        the database and compare normalized
        versions locally.
      */
      const {
        data: existingQuestions,
        error: questionCheckError,
      } = await supabase
        .from("question_bank")
        .select("question");

      if (questionCheckError) {
        throw questionCheckError;
      }

      const existingNormalized =
        new Set(
          (existingQuestions || [])
            .map((row) =>
              normalizeText(row.question)
            )
            .filter(Boolean)
        );

      const finalCandidates =
        afterIdCheck.filter((item) => {
          if (
            existingNormalized.has(
              item.normalized
            )
          ) {
            duplicateTextSkipped++;
            return false;
          }

          return true;
        });

      const rows =
        finalCandidates.map(
          ({ original }) => ({
            external_id: original.id,

            category:
              chooseCategory(original),

            difficulty:
              difficultyToNumber(
                original.difficulty
              ),

            question:
              original.question.text.trim(),

            answer:
              original.correctAnswer.trim(),

            accepted_answers: "",

            source_url:
              "https://the-trivia-api.com/",

            source_name:
              "The Trivia API",

            tags:
              original.tags || [],

            active: true,
          })
        );

      if (rows.length === 0) {
        batchResults.push({
          batch,
          category: apiCategory,
          received: questions.length,
          imported: 0,
          reason:
            "All questions already existed",
        });

        continue;
      }

      /*
        Insert individually.

        Normally this would be less efficient,
        but we're dealing with small batches.

        Most importantly: one unexpected
        duplicate can NEVER kill the rest of
        the batch.
      */
      let batchImported = 0;
      let batchRejected = 0;

      for (const row of rows) {
        const { error } =
          await supabase
            .from("question_bank")
            .insert(row);

        if (error) {
          if (
            error.code === "23505" ||
            error.message
              ?.toLowerCase()
              .includes("duplicate")
          ) {
            duplicateTextSkipped++;
            batchRejected++;
            continue;
          }

          console.error(
            "Question insert error:",
            error
          );

          batchRejected++;
          continue;
        }

        batchImported++;
        totalImported++;
      }

      batchResults.push({
        batch,
        category: apiCategory,
        received: questions.length,
        candidates: rows.length,
        imported: batchImported,
        rejected: batchRejected,
      });
    }

    /*
      Get exact current bank size.
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
      throw countError;
    }

    return res.status(200).json({
      success: true,

      batchesAttempted: BATCHES,

      received: totalReceived,

      imported: totalImported,

      duplicateIdsSkipped,

      duplicateTextSkipped,

      totalQuestionBank,

      remainingUntil5000:
        Math.max(
          0,
          5000 -
            (totalQuestionBank || 0)
        ),

      batchResults,

      message:
        `Imported ${totalImported} new ` +
        `unique questions. Bank now has ` +
        `${totalQuestionBank} questions. ` +
        `${Math.max(
          0,
          5000 -
            (totalQuestionBank || 0)
        )} remaining until 5,000.`,
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
