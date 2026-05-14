import { api } from './client';

export interface Connector {
  name: string;
  platform: string;
  status: 'active' | 'degraded' | 'down';
  eventsPerMin: number;
  lastEventAt: string;
  errorRate: number;
}

export interface KafkaHealth {
  eventsPerSec: number;
  kafkaLagMs: number;
  dedupRate: number;
  topics: Array<{ name: string; partitions: number; lag: number }>;
}

export const pipelineApi = {
  getConnectors: () =>
    api.get<Connector[]>('/pipeline/connectors').then((r) => r.data),

  getKafkaHealth: () =>
    api.get<KafkaHealth>('/pipeline/kafka').then((r) => r.data),
};
