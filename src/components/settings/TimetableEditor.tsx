import { useMemo, useState } from 'react'
import { SolarIcon } from '../Icon'
import { Field, ToggleRow } from './Field'
import { TIMETABLE_PRESETS, WEEKDAY_LABELS, type DayTimetable, type PeriodKind, type TimetablePeriod } from '../../types'
import { PERIOD_KIND_LABELS } from '../../types'
import { formatHmFromSeconds, isValidTimeInput, parseTimeToSeconds, withParticle } from '../../lib/time'

interface TimetableEditorProps {
  timetables: Record<string, DayTimetable>
  schoolDays: number[]
  dismissalTime: string
  onTimetablesChange: (next: Record<string, DayTimetable>) => void
  onSchoolDaysChange: (next: number[]) => void
}

const KIND_OPTIONS: Array<{ value: PeriodKind; label: string }> = (
  Object.keys(PERIOD_KIND_LABELS) as PeriodKind[]
).map((kind) => ({ value: kind, label: PERIOD_KIND_LABELS[kind] }))

function newPeriodId() {
  const globalCrypto = globalThis.crypto as Crypto | undefined
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return `p-${globalCrypto.randomUUID().slice(0, 8)}`
  }
  return `p-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`
}

function cloneTimetables(timetables: Record<string, DayTimetable>): Record<string, DayTimetable> {
  return Object.fromEntries(
    Object.entries(timetables).map(([key, timetable]) => [
      key,
      { enabled: timetable.enabled, periods: timetable.periods.map((period) => ({ ...period })) },
    ]),
  )
}

function defaultNewPeriod(periods: TimetablePeriod[]): TimetablePeriod {
  const lastEnd = periods.reduce((latest, period) => Math.max(latest, parseTimeToSeconds(period.end, 0)), 0)
  const start = lastEnd > 0 ? lastEnd + 10 * 60 : 9 * 3600
  const end = start + 40 * 60
  const ordinal = periods.filter((period) => period.kind === 'class').length + 1

  return {
    id: newPeriodId(),
    label: `${ordinal}교시`,
    kind: 'class',
    start: formatHmFromSeconds(Math.min(start, 23 * 3600 + 20 * 60)),
    end: formatHmFromSeconds(Math.min(end, 23 * 3600 + 59 * 60)),
  }
}

function rowProblem(period: TimetablePeriod) {
  if (!isValidTimeInput(period.start) || !isValidTimeInput(period.end)) {
    return '시작·종료 시각을 HH:MM 형태로 입력해 주세요.'
  }
  if (parseTimeToSeconds(period.end) <= parseTimeToSeconds(period.start)) {
    return '종료 시각은 시작 시각보다 늦어야 합니다.'
  }
  if (!period.label.trim()) {
    return '교시 이름을 입력해 주세요.'
  }
  return null
}

export function TimetableEditor({
  timetables,
  schoolDays,
  dismissalTime,
  onTimetablesChange,
  onSchoolDaysChange,
}: TimetableEditorProps) {
  const firstSchoolDay = useMemo(() => {
    const preferred = [1, 2, 3, 4, 5, 6, 0].find((weekday) => schoolDays.includes(weekday))
    return preferred ?? 1
  }, [schoolDays])

  const [activeDay, setActiveDay] = useState<number>(firstSchoolDay)
  const [copyTargets, setCopyTargets] = useState<number[]>([])

  const key = String(activeDay)
  const timetable = timetables[key] ?? { enabled: false, periods: [] }
  const periods = timetable.periods

  const overlap = useMemo(() => {
    const sorted = [...periods]
      .filter((period) => rowProblem(period) === null)
      .sort((left, right) => parseTimeToSeconds(left.start) - parseTimeToSeconds(right.start))

    for (let index = 1; index < sorted.length; index += 1) {
      if (parseTimeToSeconds(sorted[index].start) < parseTimeToSeconds(sorted[index - 1].end)) {
        return `${withParticle(sorted[index - 1].label, '과', '와')} ${sorted[index].label}의 시간이 겹칩니다.`
      }
    }
    return null
  }, [periods])

  const lastPeriodEnd = periods.reduce(
    (latest, period) => (rowProblem(period) === null ? Math.max(latest, parseTimeToSeconds(period.end)) : latest),
    0,
  )
  const dismissalTooEarly = lastPeriodEnd > 0 && parseTimeToSeconds(dismissalTime) < lastPeriodEnd

  const update = (mutate: (draft: DayTimetable) => void) => {
    const next = cloneTimetables(timetables)
    const target = next[key] ?? { enabled: false, periods: [] }
    mutate(target)
    next[key] = target
    onTimetablesChange(next)
  }

  const updatePeriod = (index: number, patch: Partial<TimetablePeriod>) => {
    update((draft) => {
      draft.periods = draft.periods.map((period, position) => (position === index ? { ...period, ...patch } : period))
    })
  }

  const removePeriod = (index: number) => {
    update((draft) => {
      draft.periods = draft.periods.filter((_, position) => position !== index)
    })
  }

  const addPeriod = () => {
    update((draft) => {
      draft.periods = [...draft.periods, defaultNewPeriod(draft.periods)]
    })
  }

  const sortPeriods = () => {
    update((draft) => {
      draft.periods = [...draft.periods].sort(
        (left, right) => parseTimeToSeconds(left.start) - parseTimeToSeconds(right.start),
      )
    })
  }

  const applyPreset = (presetId: string) => {
    const preset = TIMETABLE_PRESETS.find((entry) => entry.id === presetId)
    if (!preset) {
      return
    }
    update((draft) => {
      draft.periods = preset.periods.map((period) => ({ ...period, id: newPeriodId() }))
      draft.enabled = preset.periods.length > 0
    })
    if (preset.periods.length > 0 && !schoolDays.includes(activeDay)) {
      onSchoolDaysChange([...schoolDays, activeDay].sort((left, right) => left - right))
    }
  }

  const toggleSchoolDay = (weekday: number) => {
    const isCurrentlySchoolDay = schoolDays.includes(weekday)
    onSchoolDaysChange(
      isCurrentlySchoolDay
        ? schoolDays.filter((day) => day !== weekday)
        : [...schoolDays, weekday].sort((left, right) => left - right),
    )

    // Turning a weekday on is pointless while its timetable stays switched off,
    // so enable it in the same interaction (only when it has something to show).
    if (!isCurrentlySchoolDay && (timetables[String(weekday)]?.periods.length ?? 0) > 0) {
      const cloned = cloneTimetables(timetables)
      cloned[String(weekday)] = { ...(cloned[String(weekday)] ?? { periods: [] }), enabled: true }
      onTimetablesChange(cloned)
    }
  }

  const copyToSelectedDays = () => {
    if (copyTargets.length === 0) {
      return
    }
    const next = cloneTimetables(timetables)
    for (const weekday of copyTargets) {
      next[String(weekday)] = {
        enabled: timetable.enabled,
        periods: timetable.periods.map((period) => ({ ...period, id: newPeriodId() })),
      }
    }
    onTimetablesChange(next)
    setCopyTargets([])
  }

  return (
    <div className="timetable-editor">
      <div className="weekday-picker" role="group" aria-label="요일 선택">
        {WEEKDAY_LABELS.map((label, weekday) => {
          const dayTimetable = timetables[String(weekday)]
          const isActive = weekday === activeDay
          const isSchoolDay = schoolDays.includes(weekday)
          return (
            <button
              key={label}
              type="button"
              className={`weekday-tab ${isActive ? 'is-active' : ''} ${isSchoolDay ? '' : 'is-off'}`}
              onClick={() => setActiveDay(weekday)}
              aria-pressed={isActive}
              title={`${label}요일 · ${dayTimetable?.periods.length ?? 0}개 블록`}
            >
              <span className="weekday-name">{label}</span>
              <span className="weekday-meta" aria-hidden="true">
                {dayTimetable?.periods.length ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      <div className="school-days-row">
        <span className="school-days-label"><SolarIcon name="calendar-minimalistic-bold" size={14} /> 수업 요일</span>
        <div className="school-days-options">
          {WEEKDAY_LABELS.map((label, weekday) => (
            <label className={`day-checkbox ${schoolDays.includes(weekday) ? 'is-checked' : ''}`} key={`school-${label}`}>
              <input
                type="checkbox"
                checked={schoolDays.includes(weekday)}
                onChange={() => toggleSchoolDay(weekday)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <ToggleRow
        id={`day-enabled-${key}`}
        icon={timetable.enabled ? 'notebook-bold' : 'eye-closed-bold'}
        title={`${WEEKDAY_LABELS[activeDay]}요일에 수업이 있어요`}
        description="끄면 이 요일은 수업이 없는 날로 표시되고 배터리의 수업일 계산에서도 빠집니다."
        checked={timetable.enabled}
        onChange={(checked) => update((draft) => { draft.enabled = checked })}
      />

      <div className="preset-row">
        <span className="preset-row-label"><SolarIcon name="magic-wand-3-bold" size={14} /> 프리셋</span>
        <div className="preset-options">
          {TIMETABLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="preset-chip"
              onClick={() => applyPreset(preset.id)}
              title={preset.description}
            >
              <SolarIcon name={preset.periods.length === 0 ? 'trash-bin-trash-bold' : 'clipboard-list-bold'} size={13} />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="period-table">
        <div className="period-table-head" aria-hidden="true">
          <span>이름</span>
          <span>구분</span>
          <span>시작</span>
          <span>종료</span>
          <span />
        </div>

        {periods.length === 0 && (
          <p className="period-empty">
            <SolarIcon name="clipboard-add-bold" size={16} />
            이 요일에는 등록된 교시가 없습니다. 프리셋을 적용하거나 아래 버튼으로 직접 추가하세요.
          </p>
        )}

        {periods.map((period, index) => {
          const problem = rowProblem(period)
          return (
            <div className={`period-row ${problem ? 'has-error' : ''}`} key={period.id}>
              <Field id={`${period.id}-label`} label={`${index + 1}번째 블록 이름`} className="period-field-name">
                <input
                  id={`${period.id}-label`}
                  type="text"
                  value={period.label}
                  maxLength={20}
                  placeholder="예: 1교시"
                  onChange={(event) => updatePeriod(index, { label: event.target.value })}
                />
              </Field>

              <Field id={`${period.id}-kind`} label="구분">
                <select
                  id={`${period.id}-kind`}
                  value={period.kind}
                  onChange={(event) => updatePeriod(index, { kind: event.target.value as PeriodKind })}
                >
                  {KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>

              <Field id={`${period.id}-start`} label="시작 시각" className="period-field-time">
                <input
                  id={`${period.id}-start`}
                  type="time"
                  value={period.start}
                  onChange={(event) => updatePeriod(index, { start: event.target.value })}
                />
              </Field>

              <Field id={`${period.id}-end`} label="종료 시각" className="period-field-time">
                <input
                  id={`${period.id}-end`}
                  type="time"
                  value={period.end}
                  onChange={(event) => updatePeriod(index, { end: event.target.value })}
                />
              </Field>

              <div className="period-row-actions">
                {problem && <span className="period-row-error" role="alert"><SolarIcon name="danger-circle-bold" size={13} /> {problem}</span>}
                <button
                  type="button"
                  className="icon-button is-danger"
                  onClick={() => removePeriod(index)}
                  aria-label={`${period.label || `${index + 1}번째 블록`} 삭제`}
                  title="이 블록 삭제"
                >
                  <SolarIcon name="trash-bin-trash-bold" size={15} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="period-actions">
        <button type="button" className="ghost-button" onClick={addPeriod}>
          <SolarIcon name="add-circle-bold" size={15} /> 교시 추가
        </button>
        <button type="button" className="ghost-button" onClick={sortPeriods} disabled={periods.length < 2}>
          <SolarIcon name="sort-vertical-bold" size={15} /> 시간순 정렬
        </button>
      </div>

      {overlap && (
        <p className="inline-warning" role="alert">
          <SolarIcon name="danger-triangle-bold" size={14} /> {overlap}
        </p>
      )}
      {dismissalTooEarly && (
        <p className="inline-warning">
          <SolarIcon name="info-circle-linear" size={14} />
          이 요일 마지막 블록이 {formatHmFromSeconds(lastPeriodEnd)}에 끝나 하교 시각({dismissalTime})보다 늦습니다.
          {/* 고치는 방법(단축 하교 포함)은 설정 상단의 같은 안내가 설명한다. */}
        </p>
      )}

      <div className="copy-row">
        <span className="copy-row-label"><SolarIcon name="copy-bold" size={14} /> {WEEKDAY_LABELS[activeDay]}요일 시간표를 다른 요일에도 적용</span>
        <div className="copy-options">
          {WEEKDAY_LABELS.map((label, weekday) => weekday === activeDay ? null : (
            <label className={`day-checkbox ${copyTargets.includes(weekday) ? 'is-checked' : ''}`} key={`copy-${label}`}>
              <input
                type="checkbox"
                checked={copyTargets.includes(weekday)}
                onChange={() => setCopyTargets((current) => current.includes(weekday)
                  ? current.filter((day) => day !== weekday)
                  : [...current, weekday])}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={copyToSelectedDays}
          disabled={copyTargets.length === 0 || periods.length === 0}
        >
          <SolarIcon name="copy-bold" size={15} /> {copyTargets.length > 0 ? `${copyTargets.length}개 요일에 복사` : '복사할 요일 선택'}
        </button>
      </div>
    </div>
  )
}
