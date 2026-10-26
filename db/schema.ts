import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const participantSessions = sqliteTable('participant_sessions', {
 id: text('id').primaryKey(), tokenHash: text('token_hash').notNull(),
 conditionOrder: text('condition_order').notNull(), createdAt: integer('created_at').notNull(),
 studyVersion: text('study_version').notNull(), familiarity: text('familiarity').notNull(), device: text('device').notNull(),
 nextIndex: integer('next_index').notNull().default(0), currentStartedAt: integer('current_started_at'),
 currentStoppedAt: integer('current_stopped_at'), currentOutcome: text('current_outcome'), finishedAt: integer('finished_at'),
}, t=>[uniqueIndex('participant_token_unique').on(t.tokenHash),index('participant_created_index').on(t.createdAt)]);
export const participantAttempts = sqliteTable('participant_attempts', {
 id: text('id').primaryKey(), sessionId: text('session_id').notNull().references(()=>participantSessions.id),
 step: integer('step').notNull(), condition: text('condition').notNull(), task: text('task').notNull(),
 startedAt: integer('started_at').notNull(), stoppedAt: integer('stopped_at').notNull(), lookupMs: integer('lookup_ms').notNull(),
 outcome: text('outcome').notNull(), answer: text('answer').notNull(), help: text('help').notNull(), submittedAt: integer('submitted_at').notNull(), confidence:integer('confidence'),
}, t=>[uniqueIndex('participant_attempt_once').on(t.sessionId,t.step)]);

export const pushSubscriptions = sqliteTable('push_subscriptions', {
 id:text('id').primaryKey(), endpoint:text('endpoint').notNull(), p256dh:text('p256dh').notNull(), auth:text('auth').notNull(),
 lid:text('lid').notNull(), thresholdTenths:integer('threshold_tenths').notNull(), createdAt:integer('created_at').notNull(), updatedAt:integer('updated_at').notNull(),
 wasAbove:integer('was_above').notNull().default(0), testRequested:integer('test_requested').notNull().default(0),
 lastSentAt:integer('last_sent_at'), expiresAt:integer('expires_at').notNull(),
},t=>[uniqueIndex('push_endpoint_unique').on(t.endpoint),index('push_expiry_index').on(t.expiresAt)]);
