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

/*
  Reject questions that don't work well for
  open-answer Jeopardy-style gameplay.
*/
function isBadQuestion(question) {
  const text =
    question.question?.text?.trim() || "";

  if (!text) return true;

  const lower = text.toLowerCase();

  const badPatterns = [
    /which of (the )?following/i,
    /select (the )?(correct|best)/i,
    /true\s*(or|\/)\s*false/i,
    /^(true|false)\??$/i,
    /\b[a-d][\)\.:]\s+/i,
    /\b[1-4][\)\.:]\s+/i,
    /all of the above/i,
    /none of the above/i,
    /which statement/i,
    /which option/i,
  ];

  if (
    badPatterns.some((pattern) =>
      pattern.test(text)
    )
  ) {
    return true;
  }

  /*
    Extremely short prompts tend to make
    poor trivia clues.
  */
  if (text.length < 12) {
    return true;
  }

  /*
    Yes/no questions aren't a good fit.
  */
  if (
    lower.startsWith("is it true") ||
    lower.startsWith("is the") ||
    lower.startsWith("is a ") ||
    lower.startsWith("are the")
  ) {
    return true;
  }

  return false;
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
  const tags = (question.tags || []).map(
    (tag) =>
      String(tag)
        .toLowerCase()
        .replace(/_/g, " ")
  );

  const prompt =
    question.question?.text || "";

  const apiCategory =
    String(question.category || "")
      .toLowerCase();

  const text = [
    prompt,
    ...tags,
  ]
    .join(" ")
    .toLowerCase();

  const has = (...words) =>
    words.some((word) =>
      text.includes(word)
    );

  /*
    SPORTS
  */

  if (
    has(
      "nfl",
      "american football",
      "super bowl"
    )
  ) {
    return "NFL";
  }

  if (has("nba", "basketball")) {
    return "NBA";
  }

  if (has("mlb", "baseball")) {
    return "MLB";
  }

  if (
    has(
      "nhl",
      "ice hockey",
      "hockey"
    )
  ) {
    return "NHL";
  }

  if (
    has(
      "soccer",
      "premier league",
      "fifa",
      "uefa",
      "world cup"
    )
  ) {
    return "SOCCER";
  }

  if (
    has(
      "wwe",
      "wrestling",
      "professional wrestling"
    )
  ) {
    return "WRESTLING";
  }

  if (
    has(
      "olympics",
      "olympic games"
    )
  ) {
    return "OLYMPICS";
  }

  /*
    VIDEO GAMES
  */

  if (
    has(
      "pokemon",
      "pokémon"
    )
  ) {
    return "POKÉMON";
  }

  if (
    has(
      "video game",
      "video games",
      "gaming",
      "playstation",
      "xbox",
      "nintendo",
      "sega",
      "steam"
    )
  ) {
    return "VIDEO GAMES";
  }

  /*
    COMICS / ANIMATION
  */

  if (has("anime", "manga")) {
    return "ANIME";
  }

  if (
    has(
      "marvel",
      "avengers",
      "spider-man",
      "spiderman",
      "x-men"
    )
  ) {
    return "MARVEL";
  }

  if (
    has(
      "dc comics",
      "batman",
      "superman",
      "wonder woman",
      "justice league"
    )
  ) {
    return "DC COMICS";
  }

  if (
    has(
      "cartoon",
      "cartoons",
      "animation",
      "animated"
    )
  ) {
    return "CARTOONS";
  }

  /*
    MUSIC
  */

  if (
    has(
      "hip hop",
      "hip-hop",
      "rapper",
      "rap music"
    )
  ) {
    return "HIP-HOP";
  }

  if (
    has(
      "rock music",
      "rock band",
      "heavy metal"
    )
  ) {
    return "ROCK MUSIC";
  }

  if (
    has(
      "country music",
      "country singer"
    )
  ) {
    return "COUNTRY MUSIC";
  }

  if (
    apiCategory === "music" ||
    has(
      "music",
      "musician",
      "singer",
      "album",
      "song",
      "band"
    )
  ) {
    return "MUSIC";
  }

  /*
    MOVIES / TELEVISION
  */

  if (
    has(
      "sitcom",
      "situation comedy"
    )
  ) {
    return "SITCOMS";
  }

  if (
    has(
      "horror movie",
      "horror film"
    )
  ) {
    return "HORROR MOVIES";
  }

  if (
    has(
      "disney",
      "pixar"
    )
  ) {
    return "DISNEY & PIXAR";
  }

  if (
    has(
      "star wars"
    )
  ) {
    return "STAR WARS";
  }

  if (
    has(
      "harry potter"
    )
  ) {
    return "HARRY POTTER";
  }

  if (
    has(
      "movie",
      "movies",
      "film",
      "cinema",
      "academy award",
      "oscar"
    )
  ) {
    return "MOVIES";
  }

  if (
    has(
      "television",
      "tv show",
      "tv series",
      "television series"
    )
  ) {
    return "TV SHOWS";
  }

  /*
    CELEBRITIES
  */

  if (
    has(
      "celebrity",
      "actor",
      "actress"
    )
  ) {
    return "CELEBRITIES";
  }

  /*
    FOOD
  */

  if (
    apiCategory === "food_and_drink" ||
    has(
      "food",
      "restaurant",
      "cuisine",
      "drink",
      "cocktail",
      "cooking"
    )
  ) {
    return "FOOD & DRINK";
  }

  /*
    CARS / TECHNOLOGY
  */

  if (
    has(
      "automobile",
      "automotive",
      "car manufacturer",
      "car company",
      "vehicle manufacturer"
    )
  ) {
    return "CARS";
  }

  if (
    has(
      "computer",
      "technology",
      "internet",
      "software",
      "smartphone"
    )
  ) {
    return "TECH & INTERNET";
  }

  /*
    SCIENCE

    This prevents science-related people and
    concepts from accidentally becoming
    POP CULTURE.
  */

  if (
    apiCategory === "science" ||
    has(
      "physics",
      "chemistry",
      "biology",
      "astronomy",
      "scientist",
      "planet",
      "space"
    )
  ) {
    return "SCIENCE";
  }

  /*
    BOOKS / LITERATURE
  */

  if (
    apiCategory ===
      "arts_and_literature" ||
    has(
      "novel",
      "author",
      "book",
      "literature",
      "poet"
    )
  ) {
    return "BOOKS & LITERATURE";
  }

  /*
    Society & Culture is NOT automatically
    called Pop Culture anymore.

    This is what caused people like Galileo,
    John Calvin and Mencius to end up under
    POP CULTURE previously.
  */

  if (
    apiCategory ===
    "society_and_culture"
  ) {
    if (
      has(
        "fashion",
        "celebrity",
        "social media",
        "internet culture",
        "pop culture"
      )
    ) {
      return "POP CULTURE";
    }

    return "CULTURE & SOCIETY";
  }

  /*
    Broad API fallbacks.
  */

  if (
    apiCategory ===
    "film_and_tv"
  ) {
    return "MOVIES & TV";
  }

  if (
    apiCategory ===
    "sport_and_leisure"
  ) {
    return "SPORTS";
  }

  if (
    apiCategory ===
    "general_knowledge"
  ) {
    return "RANDOM KNOWLEDGE";
  }

  return "RANDOM KNOWLEDGE";
}

export default async function handler(
  req,
  res
) {
  try {
    /*
      Four guaranteed categories per run.

      The fifth is a rotating bonus category.

      No History or Geography API category.
    */

    const categories = [
      "film_and_tv",
      "music",
      "sport_and_leisure",
      "society_and_culture",
    ];

    const bonusCategories = [
      "film_and_tv",
      "music",
      "sport_and_leisure",
      "society_and_culture",
      "food_and_drink",
      "general_knowledge",
      "science",
      "arts_and_literature",
    ];

    const BATCHES = 5;

    let totalReceived = 0;
    let totalImported = 0;

    let duplicateIdsSkipped = 0;
    let duplicateTextSkipped = 0;
    let badFormatSkipped = 0;

    const batchResults = [];

    /*
      Load existing questions once.

      This is much better than downloading the
      whole bank separately for every batch.
    */

    const {
      data: existingRows,
      error: existingError,
    } = await supabase
      .from("question_bank")
      .select(
        "external_id, question"
      );

    if (existingError) {
      throw existingError;
    }

    const existingIds = new Set(
      (existingRows || [])
        .map(
          (row) => row.external_id
        )
        .filter(Boolean)
    );

    const existingText = new Set(
      (existingRows || [])
        .map((row) =>
          normalizeText(row.question)
        )
        .filter(Boolean)
    );

    for (
      let batch = 1;
      batch <= BATCHES;
      batch++
    ) {
      let apiCategory;

      if (batch <= 4) {
        apiCategory =
          categories[batch - 1];
      } else {
        apiCategory =
          bonusCategories[
            Math.floor(
              Math.random() *
                bonusCategories.length
            )
          ];
      }

      const params =
        new URLSearchParams({
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

      totalReceived +=
        questions.length;

      let batchImported = 0;
      let batchBad = 0;
      let batchDuplicates = 0;

      /*
        Prevent duplicates within this
        particular API response too.
      */

      const localIds = new Set();
      const localText = new Set();

      for (
        const question of questions
      ) {
        const questionText =
          question.question?.text?.trim();

        const answer =
          question.correctAnswer?.trim();

        if (
          !question.id ||
          !questionText ||
          !answer
        ) {
          batchBad++;
          badFormatSkipped++;
          continue;
        }

        /*
          Reject multiple choice, T/F,
          yes/no and other bad formats.
        */

        if (
          isBadQuestion(question)
        ) {
          batchBad++;
          badFormatSkipped++;
          continue;
        }

        const normalized =
          normalizeText(questionText);

        /*
          Duplicate API ID.
        */

        if (
          existingIds.has(
            question.id
          ) ||
          localIds.has(
            question.id
          )
        ) {
          duplicateIdsSkipped++;
          batchDuplicates++;
          continue;
        }

        /*
          Duplicate question wording.
        */

        if (
          existingText.has(
            normalized
          ) ||
          localText.has(
            normalized
          )
        ) {
          duplicateTextSkipped++;
          batchDuplicates++;
          continue;
        }

        const row = {
          external_id:
            question.id,

          category:
            chooseCategory(
              question
            ),

          difficulty:
            difficultyToNumber(
              question.difficulty
            ),

          question:
            questionText,

          answer,

          accepted_answers: "",

          source_url:
            "https://the-trivia-api.com/",

          source_name:
            "The Trivia API",

          tags:
            question.tags || [],

          active: true,
        };

        const { error } =
          await supabase
            .from("question_bank")
            .insert(row);

        if (error) {
          if (
            error.code ===
              "23505" ||
            error.message
              ?.toLowerCase()
              .includes(
                "duplicate"
              )
          ) {
            duplicateTextSkipped++;
            batchDuplicates++;
            continue;
          }

          console.error(
            "Insert error:",
            error
          );

          batchBad++;
          continue;
        }

        /*
          Immediately add the new question
          to our in-memory protection sets.

          This prevents another batch in the
          SAME importer run from adding it.
        */

        existingIds.add(
          question.id
        );

        existingText.add(
          normalized
        );

        localIds.add(
          question.id
        );

        localText.add(
          normalized
        );

        batchImported++;
        totalImported++;
      }

      batchResults.push({
        batch,
        category:
          apiCategory,
        received:
          questions.length,
        imported:
          batchImported,
        duplicatesSkipped:
          batchDuplicates,
        badFormatSkipped:
          batchBad,
      });
    }

    /*
      Exact clean bank total.
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

    const remainingUntil5000 =
      Math.max(
        0,
        5000 -
          (totalQuestionBank || 0)
      );

    return res
      .status(200)
      .json({
        success: true,

        batchesAttempted:
          BATCHES,

        received:
          totalReceived,

        imported:
          totalImported,

        duplicateIdsSkipped,

        duplicateTextSkipped,

        badFormatSkipped,

        totalQuestionBank,

        remainingUntil5000,

        batchResults,

        message:
          `Imported ${totalImported} ` +
          `new clean questions. ` +
          `Rejected ${badFormatSkipped} ` +
          `bad-format questions. ` +
          `Bank now has ` +
          `${totalQuestionBank} questions.`,
      });
  } catch (error) {
    console.error(error);

    return res
      .status(500)
      .json({
        success: false,

        error:
          error?.message ||
          "Unknown importer error",
      });
  }
}
