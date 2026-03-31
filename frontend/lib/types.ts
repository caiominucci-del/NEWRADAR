export type IsReal = boolean;

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface TrendInterestResponse {
  points: TrendPoint[];
  peak: number;
  is_real: IsReal;
}

export interface RelatedItem {
  query: string;
  value: number;
}

export interface TrendRelatedResponse {
  items: RelatedItem[];
  kind: string;
  is_real: IsReal;
}

export interface TrendMacroResponse {
  topics: string[];
  is_real: IsReal;
}

export interface NewsItem {
  title: string;
  link: string;
  published_at: string;
}

export interface NewsResponse {
  items: NewsItem[];
  is_real: IsReal;
}

export interface TopicTrendSummary {
  peak: number;
  is_real: IsReal;
}

export interface TopicNewsSummary {
  count: number;
  is_real: IsReal;
}

export interface EditorialResponse {
  angulo: string;
  titulo: string;
  gancho: string;
  urgencia: string;
  formatos: string[];
  por_que_agora: string;
  is_real: IsReal;
}

export interface TopicBase {
  id: string;
  tema: string;
  categoria: string;
  keywords: string[];
  canais: string[];
  descricao: string;
  emoji: string;
  cor: string;
}

export interface TopicSummaryResponse extends TopicBase {
  score: number;
  trend: TopicTrendSummary;
  news: TopicNewsSummary;
}

export interface TopicDetailResponse extends TopicBase {
  score: number;
  trend: { points: TrendPoint[]; peak: number; is_real: IsReal };
  news: NewsResponse;
  editorial: EditorialResponse;
}

export interface TopicsListResponse {
  topics: TopicSummaryResponse[];
}

export interface TopicDetailWrapperResponse {
  topic: TopicDetailResponse;
}

export interface VideoItem {
  title: string;
  link: string;
  published_at: string;
  thumbnail?: string;
}

export interface VideosResult {
  items: VideoItem[];
  source: string;
  is_real: IsReal;
}

export interface CompetitionChannel {
  nome: string;
  flag: string;
  foco: string;
  national: boolean;
  videos: VideosResult;
}

export interface CompetitionChannelsResponse {
  channels: CompetitionChannel[];
}

export interface GapItem {
  tema: string;
  desc: string;
  gap: number;
}

export interface CompetitionGapsResponse {
  gaps: GapItem[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_at: number;
  user: string;
}

export interface BriefingPayload {
  tema: string;
  categoria: string;
  titulo: string;
  gancho: string;
  angulo: string;
  urgencia: string;
  formatos: string[];
  por_que_agora: string;
  keywords: string[];
  score: number | null;
  is_real: boolean;
}

export interface BriefingRow {
  topic_id: string;
  payload: BriefingPayload;
  created_at: number;
  updated_at: number;
}

export interface BriefingsListResponse {
  briefings: BriefingRow[];
}

