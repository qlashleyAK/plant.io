import { getDb } from './database';
import { getMqttClient } from './mqtt';

interface Schedule {
  id: string;
  actuator_id: string;
  name: string;
  enabled: number;
  mode: 'duty_cycle' | 'continuous';
  interval_seconds: number;
  on_seconds: number;
  grow_id: string | null;
  phase_id: string | null;
  priority: number;
  command_topic: string;
}

interface ActuatorState {
  on: boolean;
  scheduleId: string | null;
}

const actuatorStates = new Map<string, ActuatorState>();
let scheduleCache: Schedule[] = [];
let tickHandle: ReturnType<typeof setInterval> | null = null;

export function reloadSchedules(): void {
  const db = getDb();
  scheduleCache = db.prepare(`
    SELECT s.*, sen.command_topic
    FROM actuator_schedules s
    JOIN sensors sen ON sen.id = s.actuator_id
    WHERE s.enabled = 1 AND sen.type = 'actuator' AND sen.command_topic IS NOT NULL
    ORDER BY s.priority DESC
  `).all() as Schedule[];
  console.log(`[Scheduler] Loaded ${scheduleCache.length} active schedules`);
}

function isScheduleActive(sched: Schedule): boolean {
  if (!sched.grow_id) return true;

  const db = getDb();
  const grow = db.prepare('SELECT status, start_date FROM grows WHERE id = ?').get(sched.grow_id) as any;
  if (!grow || grow.status !== 'active') return false;

  if (!sched.phase_id) return true;

  const phase = db.prepare('SELECT start_day, end_day FROM protocol_phases WHERE id = ?').get(sched.phase_id) as any;
  if (!phase) return false;

  const daysSinceStart = Math.floor((Date.now() - new Date(grow.start_date).getTime()) / 86400000);
  return daysSinceStart >= phase.start_day && (!phase.end_day || daysSinceStart <= phase.end_day);
}

function publishCommand(commandTopic: string, on: boolean): void {
  const client = getMqttClient();
  if (!client?.connected) return;
  client.publish(commandTopic, on ? 'ON' : 'OFF', { qos: 1 });
}

function tick(): void {
  const now = Date.now();
  const activeByActuator = new Map<string, Schedule>();

  for (const sched of scheduleCache) {
    if (activeByActuator.has(sched.actuator_id)) continue;
    if (isScheduleActive(sched)) {
      activeByActuator.set(sched.actuator_id, sched);
    }
  }

  for (const [actuatorId, sched] of activeByActuator) {
    let desiredOn: boolean;

    if (sched.mode === 'continuous') {
      desiredOn = true;
    } else {
      const cycleMs = sched.interval_seconds * 1000;
      const onMs = sched.on_seconds * 1000;
      const elapsed = now % cycleMs;
      desiredOn = elapsed < onMs;
    }

    const prev = actuatorStates.get(actuatorId);
    if (!prev || prev.on !== desiredOn || prev.scheduleId !== sched.id) {
      publishCommand(sched.command_topic, desiredOn);
      actuatorStates.set(actuatorId, { on: desiredOn, scheduleId: sched.id });
    }
  }

  for (const [actuatorId, state] of actuatorStates) {
    if (!activeByActuator.has(actuatorId) && state.scheduleId !== null) {
      publishCommand(
        scheduleCache.find((s) => s.actuator_id === actuatorId)?.command_topic || '',
        false,
      );
      actuatorStates.set(actuatorId, { on: false, scheduleId: null });
    }
  }
}

export function startScheduler(): void {
  reloadSchedules();
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = setInterval(tick, 1000);
  console.log('[Scheduler] Started (1s tick)');
}

export function stopScheduler(): void {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}
