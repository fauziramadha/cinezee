/**
 * src/i18n/messages.ts
 *
 * Dictionary translasi untuk CineStream.
 * Support: 9 bahasa
 * - English (en), Indonesia (id), Español (es), Français (fr)
 * - Deutsch (de), Português (pt), 日本語 (ja), 한국어 (ko), 中文 (zh)
 */

export type Language = "en" | "id" | "es" | "fr" | "de" | "pt" | "ja" | "ko" | "zh";

export const SUPPORTED_LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "id", name: "Indonesia", flag: "🇮🇩" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
];

export type TranslationKeys = keyof typeof translations.en;

// ============================================================
// TRANSLATIONS — 9 Languages
// ============================================================
export const translations = {
  // =====================================================
  // ENGLISH
  // =====================================================
  en: {
    nav_home: "Home", nav_movies: "Movies", nav_tv_shows: "TV Shows", nav_new: "New", nav_my_list: "My List",
    search_placeholder: "Search...", search_title: "Search Movies & TV Shows", search_no_results: "No results found", search_results_for: "Search results for",
    login: "Login", logout: "Logout", register: "Register", login_with_google: "Continue with Google", login_with_email: "Continue with Email",
    email: "Email", password: "Password", name: "Name", confirm_password: "Confirm Password", forgot_password: "Forgot password?", no_account: "Don't have an account?", have_account: "Already have an account?",
    profile: "My Profile", watchlist: "Watchlist", history: "Watch History", language: "Language",
    admin_section: "Admin", admin_dashboard: "Dashboard", admin_providers: "Provider Management", admin_messages: "Messages", admin_users: "Users", admin_analytics: "Analytics", admin_logs: "Logs",
    play_now: "Play Now", add_to_watchlist: "Add to Watchlist", remove_from_watchlist: "Remove from Watchlist", rate: "Rate this", share: "Share",
    overview: "Overview", cast: "Top Cast", seasons: "Seasons", episodes: "Episodes", similar: "More Like This", runtime: "Runtime", release_date: "Release Date", genres: "Genres", status: "Status", no_overview: "No overview available",
    now_playing: "Now Playing", loading_stream: "Loading stream...", loading_from: "Loading from", playback_error: "Playback Error", try_next_server: "Try Next Server", retry: "Retry", server: "Server", server_of: "of",
    trending_now: "Trending Now", popular_movies: "Popular Movies", popular_tv: "Popular TV Shows", top_rated: "Top Rated", upcoming: "Coming Soon", new_releases: "New Releases", recommended: "Recommended for You",
    watchlist_empty: "Your watchlist is empty", watchlist_empty_desc: "Add movies and shows to watch later", browse_movies: "Browse Movies",
    history_empty: "No watch history yet", history_empty_desc: "Movies you watch will appear here", continue_watching: "Continue Watching",
    comments: "Comments", write_comment: "Write a comment...", post_comment: "Post", reply: "Reply", delete: "Delete", no_comments: "No comments yet. Be the first!", comments_count: "Comments",
    rate_this: "Rate this", your_rating: "Your Rating", delete_rating: "Delete Rating",
    messages: "Messages", mark_all_read: "Mark all read", no_messages: "No messages",
    loading: "Loading...", error: "Something went wrong", retry_button: "Retry", close: "Close", cancel: "Cancel", save: "Save", delete_confirm: "Are you sure?", yes: "Yes", no: "No", back: "Back", next: "Next", previous: "Previous", view_all: "View All", see_more: "See More",
  },

  // =====================================================
  // INDONESIA
  // =====================================================
  id: {
    nav_home: "Beranda", nav_movies: "Film", nav_tv_shows: "Acara TV", nav_new: "Baru", nav_my_list: "Daftar Saya",
    search_placeholder: "Cari...", search_title: "Cari Film & Acara TV", search_no_results: "Tidak ada hasil ditemukan", search_results_for: "Hasil pencarian untuk",
    login: "Masuk", logout: "Keluar", register: "Daftar", login_with_google: "Lanjut dengan Google", login_with_email: "Lanjut dengan Email",
    email: "Email", password: "Kata Sandi", name: "Nama", confirm_password: "Konfirmasi Kata Sandi", forgot_password: "Lupa kata sandi?", no_account: "Belum punya akun?", have_account: "Sudah punya akun?",
    profile: "Profil Saya", watchlist: "Daftar Tonton", history: "Riwayat Tonton", language: "Bahasa",
    admin_section: "Admin", admin_dashboard: "Dasbor", admin_providers: "Manajemen Provider", admin_messages: "Pesan", admin_users: "Pengguna", admin_analytics: "Analitik", admin_logs: "Log",
    play_now: "Mainkan Sekarang", add_to_watchlist: "Tambah ke Daftar Tonton", remove_from_watchlist: "Hapus dari Daftar Tonton", rate: "Beri Rating", share: "Bagikan",
    overview: "Ringkasan", cast: "Pemeran Utama", seasons: "Musim", episodes: "Episode", similar: "Serupa dengan Ini", runtime: "Durasi", release_date: "Tanggal Rilis", genres: "Genre", status: "Status", no_overview: "Ringkasan tidak tersedia",
    now_playing: "Sedang Diputar", loading_stream: "Memuat stream...", loading_from: "Memuat dari", playback_error: "Error Pemutaran", try_next_server: "Coba Server Lain", retry: "Coba Lagi", server: "Server", server_of: "dari",
    trending_now: "Trending Sekarang", popular_movies: "Film Populer", popular_tv: "Acara TV Populer", top_rated: "Rating Tertinggi", upcoming: "Segera Hadir", new_releases: "Rilis Terbaru", recommended: "Rekomendasi untuk Anda",
    watchlist_empty: "Daftar tonton Anda kosong", watchlist_empty_desc: "Tambahkan film dan acara untuk ditonton nanti", browse_movies: "Jelajahi Film",
    history_empty: "Belum ada riwayat tonton", history_empty_desc: "Film yang Anda tonton akan muncul di sini", continue_watching: "Lanjutkan Menonton",
    comments: "Komentar", write_comment: "Tulis komentar...", post_comment: "Kirim", reply: "Balas", delete: "Hapus", no_comments: "Belum ada komentar. Jadi yang pertama!", comments_count: "Komentar",
    rate_this: "Beri Rating", your_rating: "Rating Anda", delete_rating: "Hapus Rating",
    messages: "Pesan", mark_all_read: "Tandai semua dibaca", no_messages: "Tidak ada pesan",
    loading: "Memuat...", error: "Terjadi kesalahan", retry_button: "Coba Lagi", close: "Tutup", cancel: "Batal", save: "Simpan", delete_confirm: "Apakah Anda yakin?", yes: "Ya", no: "Tidak", back: "Kembali", next: "Berikutnya", previous: "Sebelumnya", view_all: "Lihat Semua", see_more: "Lihat Lebih",
  },

  // =====================================================
  // ESPAÑOL
  // =====================================================
  es: {
    nav_home: "Inicio", nav_movies: "Películas", nav_tv_shows: "Programas de TV", nav_new: "Nuevo", nav_my_list: "Mi Lista",
    search_placeholder: "Buscar...", search_title: "Buscar Películas y Programas de TV", search_no_results: "No se encontraron resultados", search_results_for: "Resultados de búsqueda para",
    login: "Iniciar sesión", logout: "Cerrar sesión", register: "Registrarse", login_with_google: "Continuar con Google", login_with_email: "Continuar con Email",
    email: "Correo electrónico", password: "Contraseña", name: "Nombre", confirm_password: "Confirmar Contraseña", forgot_password: "¿Olvidaste tu contraseña?", no_account: "¿No tienes una cuenta?", have_account: "¿Ya tienes una cuenta?",
    profile: "Mi Perfil", watchlist: "Lista de Visualización", history: "Historial", language: "Idioma",
    admin_section: "Admin", admin_dashboard: "Panel", admin_providers: "Gestión de Proveedores", admin_messages: "Mensajes", admin_users: "Usuarios", admin_analytics: "Analíticas", admin_logs: "Registros",
    play_now: "Reproducir Ahora", add_to_watchlist: "Añadir a Lista", remove_from_watchlist: "Quitar de Lista", rate: "Calificar", share: "Compartir",
    overview: "Sinopsis", cast: "Reparto Principal", seasons: "Temporadas", episodes: "Episodios", similar: "Más Como Esto", runtime: "Duración", release_date: "Fecha de Estreno", genres: "Géneros", status: "Estado", no_overview: "Sinopsis no disponible",
    now_playing: "Reproduciendo", loading_stream: "Cargando stream...", loading_from: "Cargando desde", playback_error: "Error de Reproducción", try_next_server: "Probar Siguiente Servidor", retry: "Reintentar", server: "Servidor", server_of: "de",
    trending_now: "Tendencias Ahora", popular_movies: "Películas Populares", popular_tv: "Programas Populares", top_rated: "Mejor Calificadas", upcoming: "Próximamente", new_releases: "Nuevos Lanzamientos", recommended: "Recomendado para Ti",
    watchlist_empty: "Tu lista está vacía", watchlist_empty_desc: "Añade películas y programas para ver después", browse_movies: "Explorar Películas",
    history_empty: "Sin historial todavía", history_empty_desc: "Las películas que veas aparecerán aquí", continue_watching: "Continuar Viendo",
    comments: "Comentarios", write_comment: "Escribe un comentario...", post_comment: "Publicar", reply: "Responder", delete: "Eliminar", no_comments: "Sin comentarios aún. ¡Sé el primero!", comments_count: "Comentarios",
    rate_this: "Calificar", your_rating: "Tu Calificación", delete_rating: "Eliminar Calificación",
    messages: "Mensajes", mark_all_read: "Marcar todo leído", no_messages: "Sin mensajes",
    loading: "Cargando...", error: "Algo salió mal", retry_button: "Reintentar", close: "Cerrar", cancel: "Cancelar", save: "Guardar", delete_confirm: "¿Estás seguro?", yes: "Sí", no: "No", back: "Atrás", next: "Siguiente", previous: "Anterior", view_all: "Ver Todo", see_more: "Ver Más",
  },

  // =====================================================
  // FRANÇAIS
  // =====================================================
  fr: {
    nav_home: "Accueil", nav_movies: "Films", nav_tv_shows: "Séries TV", nav_new: "Nouveau", nav_my_list: "Ma Liste",
    search_placeholder: "Rechercher...", search_title: "Rechercher Films & Séries TV", search_no_results: "Aucun résultat trouvé", search_results_for: "Résultats de recherche pour",
    login: "Connexion", logout: "Déconnexion", register: "Inscription", login_with_google: "Continuer avec Google", login_with_email: "Continuer avec Email",
    email: "Email", password: "Mot de passe", name: "Nom", confirm_password: "Confirmer le mot de passe", forgot_password: "Mot de passe oublié ?", no_account: "Pas de compte ?", have_account: "Déjà un compte ?",
    profile: "Mon Profil", watchlist: "Liste de visionnage", history: "Historique", language: "Langue",
    admin_section: "Admin", admin_dashboard: "Tableau de bord", admin_providers: "Gestion des Fournisseurs", admin_messages: "Messages", admin_users: "Utilisateurs", admin_analytics: "Analytique", admin_logs: "Journaux",
    play_now: "Lire Maintenant", add_to_watchlist: "Ajouter à la Liste", remove_from_watchlist: "Retirer de la Liste", rate: "Noter", share: "Partager",
    overview: "Synopsis", cast: "Casting Principal", seasons: "Saisons", episodes: "Épisodes", similar: "Similaires", runtime: "Durée", release_date: "Date de Sortie", genres: "Genres", status: "Statut", no_overview: "Synopsis non disponible",
    now_playing: "Lecture en cours", loading_stream: "Chargement du stream...", loading_from: "Chargement depuis", playback_error: "Erreur de Lecture", try_next_server: "Essayer un autre serveur", retry: "Réessayer", server: "Serveur", server_of: "sur",
    trending_now: "Tendances", popular_movies: "Films Populaires", popular_tv: "Séries Populaires", top_rated: "Mieux Notés", upcoming: "À Venir", new_releases: "Nouvelles Sorties", recommended: "Recommandé pour Vous",
    watchlist_empty: "Votre liste est vide", watchlist_empty_desc: "Ajoutez des films et séries à regarder plus tard", browse_movies: "Parcourir les Films",
    history_empty: "Aucun historique", history_empty_desc: "Les films que vous regardez apparaîtront ici", continue_watching: "Continuer à Regarder",
    comments: "Commentaires", write_comment: "Écrire un commentaire...", post_comment: "Publier", reply: "Répondre", delete: "Supprimer", no_comments: "Aucun commentaire. Soyez le premier !", comments_count: "Commentaires",
    rate_this: "Noter", your_rating: "Votre Note", delete_rating: "Supprimer la Note",
    messages: "Messages", mark_all_read: "Tout marquer comme lu", no_messages: "Aucun message",
    loading: "Chargement...", error: "Une erreur s'est produite", retry_button: "Réessayer", close: "Fermer", cancel: "Annuler", save: "Enregistrer", delete_confirm: "Êtes-vous sûr ?", yes: "Oui", no: "Non", back: "Retour", next: "Suivant", previous: "Précédent", view_all: "Voir Tout", see_more: "Voir Plus",
  },

  // =====================================================
  // DEUTSCH
  // =====================================================
  de: {
    nav_home: "Startseite", nav_movies: "Filme", nav_tv_shows: "Serien", nav_new: "Neu", nav_my_list: "Meine Liste",
    search_placeholder: "Suchen...", search_title: "Filme & Serien suchen", search_no_results: "Keine Ergebnisse gefunden", search_results_for: "Suchergebnisse für",
    login: "Anmelden", logout: "Abmelden", register: "Registrieren", login_with_google: "Mit Google fortfahren", login_with_email: "Mit E-Mail fortfahren",
    email: "E-Mail", password: "Passwort", name: "Name", confirm_password: "Passwort bestätigen", forgot_password: "Passwort vergessen?", no_account: "Kein Konto?", have_account: "Schon ein Konto?",
    profile: "Mein Profil", watchlist: "Watchlist", history: "Verlauf", language: "Sprache",
    admin_section: "Admin", admin_dashboard: "Dashboard", admin_providers: "Anbieterverwaltung", admin_messages: "Nachrichten", admin_users: "Benutzer", admin_analytics: "Analytik", admin_logs: "Protokolle",
    play_now: "Jetzt Abspielen", add_to_watchlist: "Zur Watchlist hinzufügen", remove_from_watchlist: "Aus Watchlist entfernen", rate: "Bewerten", share: "Teilen",
    overview: "Übersicht", cast: "Hauptbesetzung", seasons: "Staffeln", episodes: "Episoden", similar: "Ähnliches", runtime: "Laufzeit", release_date: "Veröffentlichungsdatum", genres: "Genres", status: "Status", no_overview: "Keine Übersicht verfügbar",
    now_playing: "Läuft jetzt", loading_stream: "Stream wird geladen...", loading_from: "Laden von", playback_error: "Wiedergabefehler", try_next_server: "Nächsten Server versuchen", retry: "Erneut versuchen", server: "Server", server_of: "von",
    trending_now: "Aktuell im Trend", popular_movies: "Beliebte Filme", popular_tv: "Beliebte Serien", top_rated: "Top Bewertet", upcoming: "Demnächst", new_releases: "Neuerscheinungen", recommended: "Für dich empfohlen",
    watchlist_empty: "Deine Watchlist ist leer", watchlist_empty_desc: "Füge Filme und Serien hinzu, um sie später zu sehen", browse_movies: "Filme durchsuchen",
    history_empty: "Noch kein Verlauf", history_empty_desc: "Filme, die du ansiehst, erscheinen hier", continue_watching: "Weitersehen",
    comments: "Kommentare", write_comment: "Kommentar schreiben...", post_comment: "Posten", reply: "Antworten", delete: "Löschen", no_comments: "Noch keine Kommentare. Sei der Erste!", comments_count: "Kommentare",
    rate_this: "Bewerten", your_rating: "Deine Bewertung", delete_rating: "Bewertung löschen",
    messages: "Nachrichten", mark_all_read: "Alle als gelesen markieren", no_messages: "Keine Nachrichten",
    loading: "Laden...", error: "Etwas ist schiefgelaufen", retry_button: "Erneut versuchen", close: "Schließen", cancel: "Abbrechen", save: "Speichern", delete_confirm: "Bist du sicher?", yes: "Ja", no: "Nein", back: "Zurück", next: "Weiter", previous: "Zurück", view_all: "Alle ansehen", see_more: "Mehr ansehen",
  },

  // =====================================================
  // PORTUGUÊS
  // =====================================================
  pt: {
    nav_home: "Início", nav_movies: "Filmes", nav_tv_shows: "Séries de TV", nav_new: "Novo", nav_my_list: "Minha Lista",
    search_placeholder: "Buscar...", search_title: "Buscar Filmes & Séries de TV", search_no_results: "Nenhum resultado encontrado", search_results_for: "Resultados da busca por",
    login: "Entrar", logout: "Sair", register: "Registrar", login_with_google: "Continuar com Google", login_with_email: "Continuar com Email",
    email: "Email", password: "Senha", name: "Nome", confirm_password: "Confirmar Senha", forgot_password: "Esqueceu a senha?", no_account: "Não tem uma conta?", have_account: "Já tem uma conta?",
    profile: "Meu Perfil", watchlist: "Lista de Visualização", history: "Histórico", language: "Idioma",
    admin_section: "Admin", admin_dashboard: "Painel", admin_providers: "Gestão de Provedores", admin_messages: "Mensagens", admin_users: "Usuários", admin_analytics: "Análises", admin_logs: "Registros",
    play_now: "Reproduzir Agora", add_to_watchlist: "Adicionar à Lista", remove_from_watchlist: "Remover da Lista", rate: "Avaliar", share: "Compartilhar",
    overview: "Sinopse", cast: "Elenco Principal", seasons: "Temporadas", episodes: "Episódios", similar: "Similares", runtime: "Duração", release_date: "Data de Lançamento", genres: "Gêneros", status: "Status", no_overview: "Sinopse não disponível",
    now_playing: "Reproduzindo", loading_stream: "Carregando stream...", loading_from: "Carregando de", playback_error: "Erro de Reprodução", try_next_server: "Tentar Próximo Servidor", retry: "Tentar Novamente", server: "Servidor", server_of: "de",
    trending_now: "Em Alta Agora", popular_movies: "Filmes Populares", popular_tv: "Séries Populares", top_rated: "Melhor Avaliados", upcoming: "Em Breve", new_releases: "Lançamentos", recommended: "Recomendado para Você",
    watchlist_empty: "Sua lista está vazia", watchlist_empty_desc: "Adicione filmes e séries para assistir depois", browse_movies: "Navegar Filmes",
    history_empty: "Sem histórico ainda", history_empty_desc: "Filmes que você assistir aparecerão aqui", continue_watching: "Continuar Assistindo",
    comments: "Comentários", write_comment: "Escreva um comentário...", post_comment: "Publicar", reply: "Responder", delete: "Excluir", no_comments: "Sem comentários ainda. Seja o primeiro!", comments_count: "Comentários",
    rate_this: "Avaliar", your_rating: "Sua Avaliação", delete_rating: "Excluir Avaliação",
    messages: "Mensagens", mark_all_read: "Marcar tudo como lido", no_messages: "Sem mensagens",
    loading: "Carregando...", error: "Algo deu errado", retry_button: "Tentar Novamente", close: "Fechar", cancel: "Cancelar", save: "Salvar", delete_confirm: "Tem certeza?", yes: "Sim", no: "Não", back: "Voltar", next: "Próximo", previous: "Anterior", view_all: "Ver Tudo", see_more: "Ver Mais",
  },

  // =====================================================
  // 日本語 (JAPANESE)
  // =====================================================
  ja: {
    nav_home: "ホーム", nav_movies: "映画", nav_tv_shows: "テレビ番組", nav_new: "新着", nav_my_list: "マイリスト",
    search_placeholder: "検索...", search_title: "映画とテレビ番組を検索", search_no_results: "結果が見つかりません", search_results_for: "の検索結果",
    login: "ログイン", logout: "ログアウト", register: "登録", login_with_google: "Googleで続行", login_with_email: "メールで続行",
    email: "メール", password: "パスワード", name: "名前", confirm_password: "パスワード確認", forgot_password: "パスワードをお忘れですか？", no_account: "アカウントをお持ちでないですか？", have_account: "すでにアカウントをお持ちですか？",
    profile: "マイプロフィール", watchlist: "ウォッチリスト", history: "視聴履歴", language: "言語",
    admin_section: "管理", admin_dashboard: "ダッシュボード", admin_providers: "プロバイダー管理", admin_messages: "メッセージ", admin_users: "ユーザー", admin_analytics: "分析", admin_logs: "ログ",
    play_now: "今すぐ再生", add_to_watchlist: "ウォッチリストに追加", remove_from_watchlist: "ウォッチリストから削除", rate: "評価", share: "共有",
    overview: "あらすじ", cast: "メインキャスト", seasons: "シーズン", episodes: "エピソード", similar: "これに似た作品", runtime: "再生時間", release_date: "公開日", genres: "ジャンル", status: "ステータス", no_overview: "あらすじはありません",
    now_playing: "再生中", loading_stream: "ストリームを読み込み中...", loading_from: "読み込み元", playback_error: "再生エラー", try_next_server: "次のサーバーを試す", retry: "再試行", server: "サーバー", server_of: "/",
    trending_now: "今話題の作品", popular_movies: "人気の映画", popular_tv: "人気のテレビ番組", top_rated: "高評価", upcoming: "公開予定", new_releases: "新作", recommended: "あなたへのおすすめ",
    watchlist_empty: "ウォッチリストが空です", watchlist_empty_desc: "後で見るために映画や番組を追加してください", browse_movies: "映画を閲覧",
    history_empty: "視聴履歴がありません", history_empty_desc: "視聴した映画がここに表示されます", continue_watching: "視聴を続ける",
    comments: "コメント", write_comment: "コメントを書く...", post_comment: "投稿", reply: "返信", delete: "削除", no_comments: "コメントがありません。最初のコメントを！", comments_count: "コメント",
    rate_this: "評価", your_rating: "あなたの評価", delete_rating: "評価を削除",
    messages: "メッセージ", mark_all_read: "すべて既読にする", no_messages: "メッセージなし",
    loading: "読み込み中...", error: "エラーが発生しました", retry_button: "再試行", close: "閉じる", cancel: "キャンセル", save: "保存", delete_confirm: "本当によろしいですか？", yes: "はい", no: "いいえ", back: "戻る", next: "次へ", previous: "前へ", view_all: "すべて表示", see_more: "もっと見る",
  },

  // =====================================================
  // 한국어 (KOREAN)
  // =====================================================
  ko: {
    nav_home: "홈", nav_movies: "영화", nav_tv_shows: "TV 프로그램", nav_new: "신작", nav_my_list: "내 목록",
    search_placeholder: "검색...", search_title: "영화 & TV 프로그램 검색", search_no_results: "결과를 찾을 수 없습니다", search_results_for: "검색 결과",
    login: "로그인", logout: "로그아웃", register: "회원가입", login_with_google: "Google로 계속", login_with_email: "이메일로 계속",
    email: "이메일", password: "비밀번호", name: "이름", confirm_password: "비밀번호 확인", forgot_password: "비밀번호를 잊으셨나요?", no_account: "계정이 없으신가요?", have_account: "이미 계정이 있으신가요?",
    profile: "내 프로필", watchlist: "시청 목록", history: "시청 기록", language: "언어",
    admin_section: "관리", admin_dashboard: "대시보드", admin_providers: "제공자 관리", admin_messages: "메시지", admin_users: "사용자", admin_analytics: "분석", admin_logs: "로그",
    play_now: "지금 재생", add_to_watchlist: "시청 목록에 추가", remove_from_watchlist: "시청 목록에서 제거", rate: "평가", share: "공유",
    overview: "줄거리", cast: "주요 출연진", seasons: "시즌", episodes: "에피소드", similar: "비슷한 작품", runtime: "상영 시간", release_date: "개봉일", genres: "장르", status: "상태", no_overview: "줄거리 없음",
    now_playing: "재생 중", loading_stream: "스트림 로딩 중...", loading_from: "로딩 중", playback_error: "재생 오류", try_next_server: "다음 서버 시도", retry: "다시 시도", server: "서버", server_of: "/",
    trending_now: "지금 뜨는 작품", popular_movies: "인기 영화", popular_tv: "인기 TV 프로그램", top_rated: "최고 평점", upcoming: "개봉 예정", new_releases: "신작", recommended: "추천 작품",
    watchlist_empty: "시청 목록이 비어 있습니다", watchlist_empty_desc: "나중에 볼 영화와 프로그램을 추가하세요", browse_movies: "영화 탐색",
    history_empty: "시청 기록이 없습니다", history_empty_desc: "시청한 영화가 여기에 표시됩니다", continue_watching: "이어 보기",
    comments: "댓글", write_comment: "댓글 작성...", post_comment: "게시", reply: "답글", delete: "삭제", no_comments: "댓글이 없습니다. 첫 댓글을 달아보세요!", comments_count: "댓글",
    rate_this: "평가", your_rating: "내 평점", delete_rating: "평점 삭제",
    messages: "메시지", mark_all_read: "모두 읽음으로 표시", no_messages: "메시지 없음",
    loading: "로딩 중...", error: "문제가 발생했습니다", retry_button: "다시 시도", close: "닫기", cancel: "취소", save: "저장", delete_confirm: "정말 하시겠습니까?", yes: "예", no: "아니오", back: "뒤로", next: "다음", previous: "이전", view_all: "모두 보기", see_more: "더 보기",
  },

  // =====================================================
  // 中文 (CHINESE)
  // =====================================================
  zh: {
    nav_home: "首页", nav_movies: "电影", nav_tv_shows: "电视剧", nav_new: "最新", nav_my_list: "我的列表",
    search_placeholder: "搜索...", search_title: "搜索电影和电视剧", search_no_results: "未找到结果", search_results_for: "搜索结果",
    login: "登录", logout: "退出", register: "注册", login_with_google: "使用 Google 继续", login_with_email: "使用邮箱继续",
    email: "邮箱", password: "密码", name: "姓名", confirm_password: "确认密码", forgot_password: "忘记密码？", no_account: "没有账号？", have_account: "已有账号？",
    profile: "我的资料", watchlist: "观看列表", history: "观看历史", language: "语言",
    admin_section: "管理", admin_dashboard: "仪表板", admin_providers: "提供商管理", admin_messages: "消息", admin_users: "用户", admin_analytics: "分析", admin_logs: "日志",
    play_now: "立即播放", add_to_watchlist: "添加到观看列表", remove_from_watchlist: "从列表移除", rate: "评分", share: "分享",
    overview: "剧情简介", cast: "主要演员", seasons: "季", episodes: "集", similar: "相似内容", runtime: "时长", release_date: "上映日期", genres: "类型", status: "状态", no_overview: "暂无简介",
    now_playing: "正在播放", loading_stream: "加载流中...", loading_from: "加载自", playback_error: "播放错误", try_next_server: "尝试下一个服务器", retry: "重试", server: "服务器", server_of: "/",
    trending_now: "当前热门", popular_movies: "热门电影", popular_tv: "热门电视剧", top_rated: "最高评分", upcoming: "即将上映", new_releases: "新发布", recommended: "为您推荐",
    watchlist_empty: "您的观看列表为空", watchlist_empty_desc: "添加电影和剧集稍后观看", browse_movies: "浏览电影",
    history_empty: "暂无观看历史", history_empty_desc: "您观看的电影将显示在这里", continue_watching: "继续观看",
    comments: "评论", write_comment: "写评论...", post_comment: "发布", reply: "回复", delete: "删除", no_comments: "暂无评论。成为第一个！", comments_count: "评论",
    rate_this: "评分", your_rating: "您的评分", delete_rating: "删除评分",
    messages: "消息", mark_all_read: "全部标为已读", no_messages: "无消息",
    loading: "加载中...", error: "出错了", retry_button: "重试", close: "关闭", cancel: "取消", save: "保存", delete_confirm: "确定吗？", yes: "是", no: "否", back: "返回", next: "下一个", previous: "上一个", view_all: "查看全部", see_more: "查看更多",
  },
} as const;

// ============================================================
// HELPER: Get translation
// ============================================================
export function getTranslation(lang: Language, key: TranslationKeys): string {
  return translations[lang]?.[key] || translations.en[key] || String(key);
}
