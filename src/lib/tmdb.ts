/**
 * TMDB API wrapper with mock data fallback
 *
 * If TMDB_API_KEY environment variable is set, uses real TMDB API.
 * Otherwise, falls back to realistic mock data so the UI is fully functional.
 */

export const TMDB_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export interface Movie {
  id: number;
  title: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  media_type?: "movie" | "tv";
  popularity?: number;
  adult?: boolean;
  original_language?: string;
  original_title?: string;
  original_name?: string;
}

export interface MovieDetail extends Movie {
  genres: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  tagline?: string;
  homepage?: string;
  budget?: number;
  revenue?: number;
  production_companies?: { id: number; name: string; logo_path: string | null }[];
  spoken_languages?: { english_name: string; iso_639_1: string; name: string }[];
  imdb_id?: string;
  credits?: {
    cast: { id: number; name: string; character: string; profile_path: string | null }[];
    crew: { id: number; name: string; job: string; department: string }[];
  };
  videos?: {
    results: {
      id: string;
      key: string;
      name: string;
      site: string;
      type: string;
      official: boolean;
    }[];
  };
  similar?: { results: Movie[] };
  recommendations?: { results: Movie[] };
  seasons?: {
    id: number;
    name: string;
    season_number: number;
    episode_count: number;
    poster_path: string | null;
    air_date: string;
  }[];
  created_by?: { id: number; name: string; profile_path: string | null }[];

  // === TAMBAHAN: Untuk logo judul (Fix #4) ===
  images?: {
    logos: Array<{
      file_path: string;
      iso_639_1: string | null;
      vote_average: number;
      vote_count: number;
    }>;
    posters?: Array<any>;
    backdrops?: Array<any>;
  };
}

export interface TMDBResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

const API_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;

export function hasApiKey(): boolean {
  return !!API_KEY;
}

export function getImageUrl(
  path: string | null,
  size: "w185" | "w300" | "w500" | "w780" | "original" = "w500",
): string {
  if (!path) {
    return "/placeholder.svg";
  }
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

async function tmdbFetch<T>(path: string): Promise<T> {
  const url = `${TMDB_BASE}${path}${
    path.includes("?") ? "&" : "?"
  }api_key=${API_KEY}&language=en-US`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`TMDB API error: ${res.status}`);
  }
  return res.json();
}

// =====================================================
// MOCK DATA — Realistic movies/TV for demo without API key
// =====================================================

const MOCK_MOVIES: Movie[] = [
  {
    id: 299534,
    title: "Avengers: Endgame",
    overview:
      "After the devastating events of Avengers: Infinity War, the universe is in ruins. With the help of remaining allies, the Avengers assemble once more in order to reverse Thanos' actions and restore balance to the universe.",
    poster_path: "/ulzhLuWrPK07P1YkdWQLZnQh1JL.jpg",
    backdrop_path: "/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg",
    vote_average: 8.3,
    vote_count: 28700,
    release_date: "2019-04-24",
    genre_ids: [12, 878, 28],
    media_type: "movie",
    popularity: 34.3,
    original_language: "en",
  },
  {
    id: 558,
    title: "Spider-Man 2",
    overview:
      "Peter Parker is going through a major identity crisis. Burned out from being Spider-Man, he decides to shelve his superhero alter ego, which leaves the city suffering in the wake of carnage left by the evil Doc Ock.",
    poster_path: "/15c9CSwgFL9aP00pX3Mq2KGgPe7.jpg",
    backdrop_path: "/utEXl2EDiXBK6f41wCLsvprvMg4.jpg",
    vote_average: 7.3,
    vote_count: 16500,
    release_date: "2004-06-25",
    genre_ids: [28, 12, 878],
    media_type: "movie",
    popularity: 18.7,
    original_language: "en",
  },
  {
    id: 27205,
    title: "Inception",
    overview:
      "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a CEO.",
    poster_path: "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
    backdrop_path: "/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg",
    vote_average: 8.4,
    vote_count: 35000,
    release_date: "2010-07-15",
    genre_ids: [28, 878, 12],
    media_type: "movie",
    popularity: 42.1,
    original_language: "en",
  },
  {
    id: 157336,
    title: "Interstellar",
    overview:
      "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival as Earth faces a catastrophic future.",
    poster_path: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    backdrop_path: "/pbrkL804c8yAv3zBZR4QPEafpAR.jpg",
    vote_average: 8.4,
    vote_count: 33000,
    release_date: "2014-11-05",
    genre_ids: [18, 12, 878],
    media_type: "movie",
    popularity: 38.5,
    original_language: "en",
  },
  {
    id: 603,
    title: "The Matrix",
    overview:
      "Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.",
    poster_path: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    backdrop_path: "/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
    vote_average: 8.2,
    vote_count: 26000,
    release_date: "1999-03-30",
    genre_ids: [28, 878],
    media_type: "movie",
    popularity: 25.8,
    original_language: "en",
  },
  {
    id: 155,
    title: "The Dark Knight",
    overview:
      "Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets.",
    poster_path: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    backdrop_path: "/nMKdUUepR0i5zn0y1T4CsSB5chy.jpg",
    vote_average: 8.5,
    vote_count: 31000,
    release_date: "2008-07-16",
    genre_ids: [18, 28, 80, 53],
    media_type: "movie",
    popularity: 36.2,
    original_language: "en",
  },
  {
    id: 19995,
    title: "Avatar",
    overview:
      "In the 22nd century, a paraplegic Marine is dispatched to the moon Pandora on a unique mission, but becomes torn between following his orders and protecting the world he feels is his home.",
    poster_path: "/jRXYjXNq0Cs2TcJjLkki24MLp7u.jpg",
    backdrop_path: "/Yc9q6QuWrMp9nuDm5R8ExNqbEq.jpg",
    vote_average: 7.6,
    vote_count: 14000,
    release_date: "2009-12-15",
    genre_ids: [28, 12, 14, 878],
    media_type: "movie",
    popularity: 32.1,
    original_language: "en",
  },
  {
    id: 24428,
    title: "The Avengers",
    overview:
      "When an unexpected enemy emerges and threatens global safety and security, Nick Fury, director of the international peacekeeping agency known as S.H.I.E.L.D., finds himself in need of a team to pull the world back from the brink of disaster.",
    poster_path: "/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg",
    backdrop_path: "/9BBTo63ANSmhC4e6r62OJFuK2GL.jpg",
    vote_average: 7.7,
    vote_count: 28000,
    release_date: "2012-05-04",
    genre_ids: [878, 28, 12],
    media_type: "movie",
    popularity: 30.4,
    original_language: "en",
  },
  {
    id: 1726,
    title: "Iron Man",
    overview:
      "After being held captive in an Afghan cave, billionaire engineer Tony Stark creates a unique weaponized suit of armor to fight evil.",
    poster_path: "/78lPtwv72eTNqFW9COBYI0dWDJa.jpg",
    backdrop_path: "/ZQixhAzz1Q9JV2nHFLqYffvO0a.jpg",
    vote_average: 7.6,
    vote_count: 24000,
    release_date: "2008-04-30",
    genre_ids: [28, 878, 12],
    media_type: "movie",
    popularity: 22.6,
    original_language: "en",
  },
  {
    id: 286217,
    title: "The Martian",
    overview:
      "During a manned mission to Mars, Astronaut Mark Watney is presumed dead after a fierce storm and left behind by his crew. But Watney has survived and finds himself stranded and alone on the hostile planet.",
    poster_path: "/5BHuvQ6p9kfc091Z8RiFNhCwL4b.jpg",
    backdrop_path: "/sy3e2e4JwdAtd2oZGA2uUilZe8j.jpg",
    vote_average: 7.7,
    vote_count: 17000,
    release_date: "2015-09-30",
    genre_ids: [18, 12, 878],
    media_type: "movie",
    popularity: 28.9,
    original_language: "en",
  },
  {
    id: 11,
    title: "Star Wars",
    overview:
      "Princess Leia is captured and held hostage by the evil Imperial forces. Luke Skywalker and Han Solo work together to rescue her and bring peace to the galaxy.",
    poster_path: "/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg",
    backdrop_path: "/zqkmTXzjkAgXmEWLRsY4UpTWCr0.jpg",
    vote_average: 8.2,
    vote_count: 19000,
    release_date: "1977-05-25",
    genre_ids: [12, 28, 878],
    media_type: "movie",
    popularity: 21.4,
    original_language: "en",
  },
  {
    id: 76341,
    title: "Mad Max: Fury Road",
    overview:
      "An apocalyptic story set in the furthest reaches of our planet, in a stark desert landscape where humanity is broken, and most everyone is crazed fighting for the needs of life.",
    poster_path: "/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg",
    backdrop_path: "/gqrnQA6Xppdl8vIb2eJc58VC1tW.jpg",
    vote_average: 7.6,
    vote_count: 18000,
    release_date: "2015-05-15",
    genre_ids: [28, 12, 878],
    media_type: "movie",
    popularity: 26.7,
    original_language: "en",
  },
];

const MOCK_TV: Movie[] = [
  {
    id: 1399,
    name: "Game of Thrones",
    title: "Game of Thrones",
    overview:
      "Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war.",
    poster_path: "/1XS1oqL89opfnbLl8WnZY5O1tJv.jpg",
    backdrop_path: "/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg",
    vote_average: 8.4,
    vote_count: 22000,
    first_air_date: "2011-04-17",
    genre_ids: [18, 10765],
    media_type: "tv",
    popularity: 40.2,
    original_language: "en",
  },
  {
    id: 1396,
    name: "Breaking Bad",
    title: "Breaking Bad",
    overview:
      "When Walter White, a chemistry teacher, is diagnosed with Stage III cancer, he turns to a life of crime, producing and selling methamphetamine with a former student.",
    poster_path: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
    backdrop_path: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
    vote_average: 8.9,
    vote_count: 14000,
    first_air_date: "2008-01-20",
    genre_ids: [18, 80],
    media_type: "tv",
    popularity: 35.8,
    original_language: "en",
  },
  {
    id: 94605,
    name: "Arcane",
    title: "Arcane",
    overview:
      "Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war between magic technologies and clashing convictions.",
    poster_path: "/abf8tHznhSvl9BAElD2cQeRr7do.jpg",
    backdrop_path: "/q8eejQcg1bAqImEV8jh8RtBD4uH.jpg",
    vote_average: 8.7,
    vote_count: 3200,
    first_air_date: "2021-11-06",
    genre_ids: [16, 10765, 18],
    media_type: "tv",
    popularity: 45.3,
    original_language: "en",
  },
  {
    id: 60625,
    name: "Rick and Morty",
    title: "Rick and Morty",
    overview:
      "Rick is a mentally-unbalanced but scientifically-gifted old man who has recently reconnected with his family. He spends most of his time involving his young grandson Morty in dangerous, outlandish adventures.",
    poster_path: "/gdIrmf2DdY5mgN6ycVP0XlzKzbE.jpg",
    backdrop_path: "/eV3XnUul4UfIivz3kxgeIozeo50.jpg",
    vote_average: 8.6,
    vote_count: 8500,
    first_air_date: "2013-12-02",
    genre_ids: [16, 35, 10759],
    media_type: "tv",
    popularity: 31.2,
    original_language: "en",
  },
  {
    id: 71912,
    name: "The Witcher",
    title: "The Witcher",
    overview:
      "Geralt of Rivia, a mutated monster-hunter for hire, journeys toward his destiny in a turbulent world where people often prove more wicked than beasts.",
    poster_path: "/cZ0d3rtvXPVvuiX22sP79K3Hmjz.jpg",
    backdrop_path: "/7HtvmsLrhFqJlScjsTvNJZdNLOR.jpg",
    vote_average: 8.1,
    vote_count: 6800,
    first_air_date: "2019-12-20",
    genre_ids: [10765, 18, 10759],
    media_type: "tv",
    popularity: 33.7,
    original_language: "en",
  },
  {
    id: 82856,
    name: "The Mandalorian",
    title: "The Mandalorian",
    overview:
      "After the fall of the Galactic Empire, lawlessness has spread throughout the galaxy. A lone gunfighter makes his way through the outer reaches, earning his keep as a bounty hunter.",
    poster_path: "/sWgBv7LV2PRoQgkxwlibdGXKz1S.jpg",
    backdrop_path: "/o7qi2v4nWjUuU8rtqLgH4qOzGzn.jpg",
    vote_average: 8.4,
    vote_count: 12000,
    first_air_date: "2019-11-12",
    genre_ids: [10765, 10759, 18],
    media_type: "tv",
    popularity: 29.4,
    original_language: "en",
  },
  {
    id: 60059,
    name: "Better Call Saul",
    title: "Better Call Saul",
    overview:
      "Six years before Saul Goodman meets Walter White, we meet him when the man who will become Saul Goodman is known as Jimmy McGill, a small-time lawyer.",
    poster_path: "/fC2HDm5t0kHl7mTm7jxMR31bbtv.jpg",
    backdrop_path: "/cvuC7gQ8tSCM3DwhCJ5N9XjmaTk.jpg",
    vote_average: 8.5,
    vote_count: 4200,
    first_air_date: "2015-02-08",
    genre_ids: [18, 80],
    media_type: "tv",
    popularity: 25.1,
    original_language: "en",
  },
  {
    id: 1398,
    name: "The Flash",
    title: "The Flash",
    overview:
      "After a particle accelerator causes a freak storm, CSI Investigator Barry Allen is struck by lightning and falls into a coma.",
    poster_path: "/2Jy1eCGTm4FGxYjvW7xqYjSQyYB.jpg",
    backdrop_path: "/n9SmA5dvTuJjg5JD5oZpkCRBhJa.jpg",
    vote_average: 7.7,
    vote_count: 5500,
    first_air_date: "2014-10-07",
    genre_ids: [18, 10765, 10759],
    media_type: "tv",
    popularity: 24.8,
    original_language: "en",
  },
];

const ALL_MOCK = [...MOCK_MOVIES, ...MOCK_TV];

function mockList(
  type: "movie" | "tv" | "trending" | "popular" | "top_rated" | "all",
  page = 1,
): TMDBResponse<Movie> {
  let results: Movie[];
  switch (type) {
    case "trending":
      results = [...ALL_MOCK].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      break;
    case "popular":
      results = [...ALL_MOCK].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
      break;
    case "top_rated":
      results = [...ALL_MOCK].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      break;
    case "movie":
      results = MOCK_MOVIES;
      break;
    case "tv":
      results = MOCK_TV;
      break;
    default:
      results = ALL_MOCK;
  }
  return {
    page,
    results,
    total_pages: 1,
    total_results: results.length,
  };
}

function mockSearch(query: string): TMDBResponse<Movie> {
  const q = query.toLowerCase();
  const results = ALL_MOCK.filter(
    (m) =>
      m.title?.toLowerCase().includes(q) ||
      m.name?.toLowerCase().includes(q) ||
      m.overview?.toLowerCase().includes(q),
  );
  return {
    page: 1,
    results,
    total_pages: 1,
    total_results: results.length,
  };
}

function mockDetail(id: number, type: MediaType): MovieDetail {
  const base = ALL_MOCK.find((m) => m.id === id) || ALL_MOCK[0];
  const genresMap: Record<number, string> = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    18: "Drama",
    14: "Fantasy",
    27: "Horror",
    878: "Science Fiction",
    53: "Thriller",
    10765: "Sci-Fi & Fantasy",
    10759: "Action & Adventure",
  };
  return {
    ...base,
    title: type === "movie" ? base.title || base.name || "Unknown" : base.title || base.name || "Unknown",
    name: type === "tv" ? base.name || base.title : base.name,
    genres: (base.genre_ids || []).map((id) => ({ id, name: genresMap[id] || "Unknown" })),
    runtime: type === "movie" ? 142 : undefined,
    episode_run_time: type === "tv" ? [45] : undefined,
    number_of_seasons: type === "tv" ? 3 : undefined,
    number_of_episodes: type === "tv" ? 30 : undefined,
    status: "Released",
    tagline: type === "movie" ? "A new era begins." : "The epic continues.",
    imdb_id: type === "movie" ? "tt4154796" : undefined,
    credits: {
      cast: [
        { id: 1, name: "Robert Downey Jr.", character: "Tony Stark", profile_path: "/5qHNjhtjMD4YWH3UP0rm4tKwxCL.jpg" },
        { id: 2, name: "Chris Evans", character: "Steve Rogers", profile_path: "/3bOGNsHlrswhyW79uvIHH1V43JI.jpg" },
        { id: 3, name: "Scarlett Johansson", character: "Natasha Romanoff", profile_path: "/6N3wyiZk0vBc9LUPkPvMFRt1Knj.jpg" },
      ],
      crew: [
        { id: 100, name: "Anthony Russo", job: "Director", department: "Directing" },
        { id: 101, name: "Joe Russo", job: "Director", department: "Directing" },
      ],
    },
    videos: {
      results: [
        {
          id: "1",
          key: "TcMBFSGVi1c",
          name: "Official Trailer",
          site: "YouTube",
          type: "Trailer",
          official: true,
        },
      ],
    },
    similar: { results: ALL_MOCK.slice(0, 6) },
    recommendations: { results: ALL_MOCK.slice(3, 9) },
    seasons: type === "tv"
      ? [1, 2, 3].map((n) => ({
          id: n * 1000 + id,
          name: `Season ${n}`,
          season_number: n,
          episode_count: 10,
          poster_path: base.poster_path,
          air_date: "2020-01-01",
        }))
      : undefined,
    created_by: type === "tv" ? [{ id: 200, name: "Creator Name", profile_path: null }] : undefined,

    // === TAMBAHAN: Mock logos untuk testing tanpa API key ===
    images: {
      logos: [
        {
          file_path: "/sF5Ung9pxmP7vufj4Q7jYpYqHfP.png",
          iso_639_1: "en",
          vote_average: 5.5,
          vote_count: 1,
        },
      ],
      posters: [],
      backdrops: [],
    },
  };
}

// =====================================================
// Public API
// =====================================================

export async function getTrending(
  window: "day" | "week" = "week",
): Promise<TMDBResponse<Movie>> {
  if (API_KEY) {
    return tmdbFetch(`/trending/all/${window}`);
  }
  return mockList("trending");
}

export async function getPopularMovies(page = 1): Promise<TMDBResponse<Movie>> {
  if (API_KEY) {
    return tmdbFetch(`/movie/popular?page=${page}`);
  }
  return mockList("movie", page);
}

export async function getPopularTV(page = 1): Promise<TMDBResponse<Movie>> {
  if (API_KEY) {
    return tmdbFetch(`/tv/popular?page=${page}`);
  }
  return mockList("tv", page);
}

export async function getTopRated(page = 1): Promise<TMDBResponse<Movie>> {
  if (API_KEY) {
    return tmdbFetch(`/movie/top_rated?page=${page}`);
  }
  return mockList("top_rated", page);
}

// === UPDATED: Tambah images & include_image_language ===
export async function getMovieDetail(id: number): Promise<MovieDetail> {
  if (API_KEY) {
    return tmdbFetch(
      `/movie/${id}?append_to_response=credits,videos,similar,recommendations,images&include_image_language=en,null`,
    );
  }
  return mockDetail(id, "movie");
}

// === UPDATED: Tambah images & include_image_language ===
export async function getTVDetail(id: number): Promise<MovieDetail> {
  if (API_KEY) {
    return tmdbFetch(
      `/tv/${id}?append_to_response=credits,videos,similar,recommendations,images&include_image_language=en,null`,
    );
  }
  return mockDetail(id, "tv");
}

export async function searchMulti(query: string): Promise<TMDBResponse<Movie>> {
  if (API_KEY) {
    return tmdbFetch(
      `/search/multi?query=${encodeURIComponent(query)}&include_adult=false`,
    );
  }
  return mockSearch(query);
}

export async function getDetail(
  id: number,
  type: MediaType,
): Promise<MovieDetail> {
  return type === "movie" ? getMovieDetail(id) : getTVDetail(id);
}
