import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, SectionTitle } from './kit';
import { Field, Input, Sheet } from './sheet';

import { CATEGORIES, ESTIMATE_PRESETS, PRIORITIES } from '@/lib/catalog';
import { addDays, shortDateLabel, todayKey } from '@/lib/date';
import { useStore, type NewTask } from '@/lib/store';
import type { CategoryId, Priority, Task } from '@/lib/types';

function dueOptions() {
  const today = todayKey();
  const dow = (new Date().getDay() + 6) % 7;
  return [
    { label: '今天', key: today },
    { label: '明天', key: addDays(today, 1) },
    { label: '本周日', key: addDays(today, 6 - dow) },
    { label: '下周', key: addDays(today, 7) },
  ];
}

export function TaskFormSheet({
  visible,
  onClose,
  editing,
  defaultDueDate,
}: {
  visible: boolean;
  onClose: () => void;
  editing?: Task | null;
  defaultDueDate?: string;
}) {
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);

  const [draft, setDraft] = useState<NewTask>(() =>
    editing
      ? {
          title: editing.title,
          note: editing.note,
          category: editing.category,
          priority: editing.priority,
          dueDate: editing.dueDate,
          estimateMin: editing.estimateMin,
        }
      : blank(defaultDueDate),
  );

  const canSave = draft.title.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    const payload: NewTask = { ...draft, title: draft.title.trim(), note: draft.note?.trim() || undefined };
    if (editing) updateTask(editing.id, payload);
    else addTask(payload);
    onClose();
  };

  const options = dueOptions();

  return (
    <Sheet visible={visible} onClose={onClose} title={editing ? '编辑任务' : '新任务'}>
      <Field label="标题">
        <Input
          value={draft.title}
          onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
          placeholder="要做什么？"
        />
      </Field>

      <Field label="备注">
        <Input
          value={draft.note ?? ''}
          onChangeText={(note) => setDraft((d) => ({ ...d, note }))}
          placeholder="可选，写清楚产出或地点"
          multiline
        />
      </Field>

      <Field label="优先级">
        <View style={styles.row}>
          {PRIORITIES.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              color={p.color}
              selected={draft.priority === p.id}
              onPress={() => setDraft((d) => ({ ...d, priority: p.id as Priority }))}
            />
          ))}
        </View>
      </Field>

      <Field label="分类">
        <View style={styles.row}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              color={c.color}
              selected={draft.category === c.id}
              onPress={() => setDraft((d) => ({ ...d, category: c.id as CategoryId }))}
            />
          ))}
        </View>
      </Field>

      <View style={styles.block}>
        <SectionTitle>截止日期</SectionTitle>
        <View style={styles.row}>
          {options.map((o) => (
            <Chip
              key={o.key}
              label={o.label}
              selected={draft.dueDate === o.key}
              onPress={() => setDraft((d) => ({ ...d, dueDate: d.dueDate === o.key ? undefined : o.key }))}
            />
          ))}
        </View>
        <Chip
          label={draft.dueDate ? `已选 ${shortDateLabel(draft.dueDate)} · 点按清除` : '不设截止'}
          small
          onPress={() => setDraft((d) => ({ ...d, dueDate: undefined }))}
        />
      </View>

      <View style={styles.block}>
        <SectionTitle>预计耗时</SectionTitle>
        <View style={styles.row}>
          {ESTIMATE_PRESETS.map((min) => (
            <Chip
              key={min}
              label={`${min}′`}
              selected={draft.estimateMin === min}
              onPress={() => setDraft((d) => ({ ...d, estimateMin: min }))}
            />
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <Button label={editing ? '保存修改' : '添加任务'} onPress={save} disabled={!canSave} style={styles.save} />
        {editing ? (
          <Button
            label="删除"
            variant="danger"
            onPress={() => {
              deleteTask(editing.id);
              onClose();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

function blank(dueDate?: string): NewTask {
  return {
    title: '',
    note: undefined,
    category: 'work',
    priority: 'medium',
    dueDate,
    estimateMin: 30,
  };
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  block: { gap: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  save: { flex: 1 },
});
