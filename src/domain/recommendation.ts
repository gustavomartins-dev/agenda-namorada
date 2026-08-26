export type RecommendationTarget = 'agenda-namorada' | 'Agenda';
export type RecommendationStatus = 'received' | 'authorized' | 'implementing' | 'pr-ready' | 'failed';

export type Recommendation = {
  id: string;
  description: string;
  target: RecommendationTarget;
  status: RecommendationStatus;
  createdAt: string;
  trackingUrl: string;
};
