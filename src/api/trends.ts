import { api } from './client';

export const trendsApi = {
  classificationBreakdown: (days = 7) =>
    api.get('/trends/classification-breakdown', { params: { days } }).then((r) => r.data),

  topNarratives: (days = 7, limit = 10) =>
    api.get('/trends/top-narratives', { params: { days, limit } }).then((r) => r.data),

  platformIngestion: () =>
    api.get('/trends/platform-ingestion').then((r) => r.data),

  languageDistribution: () =>
    api.get('/trends/language-distribution').then((r) => r.data),

  dailyMisinformation: (days = 30) =>
    api.get('/trends/daily-misinformation', { params: { days } }).then((r) => r.data),

  dailyBreakdown: (days = 7) =>
    api.get('/trends/daily-breakdown', { params: { days } }).then((r) => r.data),
};
