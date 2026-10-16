import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, SectionTitle } from './kit';
import { Field, Input, Sheet } from './sheet';

import { CATEGORIES } from '@/lib/catalog';
import { minToLabel, nowMin } from '@/lib/date';
import { useStore } from '@/lib/store';
import type { Block, CategoryId, Task } from '@/lib/types';

const DURATIONS = [15, 30, 45, 60, 90, 120];

type Draft = {
  title: string;
  category: CategoryId;
  startMin: number;
  durationMin: number;
  done: boolean;
};

export function BlockFormSheet({
  visible,
  onClose,
  date,
  editing,
  defaultStart,
  linkedTask,
}: {
  visible: boolean;
  onClose: () => void;
  date: string;
  editing?: Block | null;
  defaultStart?: number;
  linkedTask?: Task | null;
}) {
  const addBlock = useStore((s) => s.addBlock);
  const updateBlock = useStore((s) => s.updateBlock);
  const deleteBlock = useStore((s) => s.deleteBlock);

  const [draft, setDraft] = useState<Draft>(() => {
    if (editing) {
      return {
        title: editing.title,
        category: editing.category,
        startMin: editing.startMin,
        durationMin: editing.durationMin,
        done: editing.done,
      };
    }
    return {
      title: linkedTask?.title ?? '',
      category: linkedTask?.category ?? 'work',
      startMin: snap(defaultStart ?? nowMin()),
      durationMin: linkedTask && DURATIONS.includes(linkedTask.estimateMin) ? linkedTask.estimateMin : 30,
      done: false,
    };
  });

  const canSave = draft.title.trim().length > 0;
  const endMin = Math.min(24 * 60 - 1, draft.startMin + draft.durationMin);

  const save = () => {
    if (!canSave) return;
    const payload = {
      date,
      title: draft.title.trim(),
      category: draft.category,
      startMin: draft.startMin,
      durationMin: draft.durationMin,
      done: draft.done,
      taskId: editing?.taskId ?? linkedTask?.id,
    };
    if (editing) updateBlock(editing.id, payload);
    else addBlock(payload);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={editing ? '编辑时间块' : '安排时间块'}>
      <Field label="事项">
        <Input
          value={draft.title}
          onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
          placeholder="这段时间做什么"
        />
      </Field>

      <View style={styles.block}>
        <SectionTitle>开始时间</SectionTitle>
        <View style={styles.timeRow}>
          <Chip label="−15′" onPress={() => setDraft((d) => ({ ...d, startMin: snap(Math.max(0, d.startMin - 15)) }))} />
          <Chip label={minToLabel(draft.startMin)} selected onPress={() => setDraft((d) => ({ ...d, startMin: snap(nowMin()) }))} />
          <Chip
            label="+15′"
            onPress={() => setDraft((d) => ({ ...d, startMin: snap(Math.min(24 * 60 - 15, d.startMin + 15)) }))}
          />
          <Chip label="现在" onPress={() => setDraft((d) => ({ ...d, startMin: snap(nowMin()) }))} />
        </View>
      </View>

      <View style={styles.block}>
        <SectionTitle>时长</SectionTitle>
        <View style={styles.timeRow}>
          {DURATIONS.map((min) => (
            <Chip
              key={min}
              label={`${min}′`}
              selected={draft.durationMin === min}
              onPress={() => setDraft((d) => ({ ...d, durationMin: min }))}
            />
          ))}
        </View>
      </View>

      <Field label="分类">
        <View style={styles.timeRow}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              color={c.color}
              selected={draft.category === c.id}
              onPress={() => setDraft((d) => ({ ...d, category: c.id }))}
            />
          ))}
        </View>
      </Field>

      <View style={styles.summary}>
        <Chip label={`${minToLabel(draft.startMin)} – ${minToLabel(endMin)}`} small selected />
        {editing ? <Chip label={draft.done ? '已完成' : '未完成'} small onPress={() => setDraft((d) => ({ ...d, done: !d.done }))} /> : null}
      </View>

      <View style={styles.actions}>
        <Button label={editing ? '保存修改' : '加入日程'} onPress={save} disabled={!canSave} style={styles.save} />
        {editing ? (
          <Button
            label="删除"
            variant="danger"
            onPress={() => {
              deleteBlock(editing.id);
              onClose();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

/** Keeps the timeline tidy: blocks always start on a quarter hour. */
function snap(min: number): number {
  return Math.max(0, Math.min(24 * 60 - 15, Math.round(min / 15) * 15));
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  summary: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  save: { flex: 1 },
});
