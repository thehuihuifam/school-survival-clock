import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { SolarIcon, type SolarIconName } from './Icon'
import { Field, SegmentedControl, SettingsSection, ToggleRow } from './settings/Field'
import { TimetableEditor } from './settings/TimetableEditor'
import { HolidayEditor } from './settings/HolidayEditor'
import { useFocusTrap } from './settings/useFocusTrap'
import { cloneSettings, createDefaultSettings, parseSettingsJson, serializeSettings } from '../lib/settings'
import { describeSemesterWindow, getAutoSemesterWindow } from '../lib/semesterWindow'
import { findDismissalConflict, type DismissalConflict } from '../lib/schedule'
import { requestNotificationPermission } from '../lib/notify'
import { chimeEngine } from '../lib/sound'
import { formatHmFromSeconds, isValidDateInput, isValidTimeInput, parseDateInput, parseTimeToSeconds } from '../lib/time'
import { PRE_ALERT_MINUTE_OPTIONS, WEEKDAY_LABELS, type ThemeMode, type UserSettings } from '../types'
import type { NotificationState } from '../lib/notify'

interface SettingsModalProps {
  isOpen: boolean
  settings: UserSettings
  todayDateKey: string
  notificationState: NotificationState
  onClose: () => void
  onSave: (settings: UserSettings) => void
}

type TabId = 'profile' | 'timetable' | 'semester' | 'data'

const TABS: Array<{ id: TabId; label: string; icon: SolarIconName }> = [
  { id: 'profile', label: '프로필 · 화면', icon: 'user-rounded-bold' },
  { id: 'timetable', label: '시간표', icon: 'notebook-bold' },
  { id: 'semester', label: '학기 · 휴일', icon: 'calendar-date-bold' },
  { id: 'data', label: '데이터', icon: 'flash-drive-bold' },
]

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: SolarIconName }> = [
  { value: 'dark', label: '다크', icon: 'moon-bold' },
  { value: 'light', label: '라이트', icon: 'sun-2-bold' },
  { value: 'system', label: '시스템', icon: 'monitor-smartphone-bold' },
]

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: 'S', description: '설정 창 열기' },
  { keys: 'T', description: '테마 모드 전환' },
  { keys: 'F', description: '전체 화면 전환' },
  { keys: 'M', description: '알림 소리 켜기 / 끄기' },
  { keys: 'N', description: '브라우저 알림 켜기 / 끄기' },
  { keys: 'Esc', description: '창 닫기' },
]

/**
 * 하교 시각이 시간표보다 이르게 입력됐을 때의 안내 문구.
 *
 * 엔진은 `Math.max(하교 시각, 마지막 교시 종료)`로 조용히 클램프하므로, 이 문장이
 * 없으면 "왜 저장했는데 하교 시각이 그대로인지" 알 길이 없다.
 */
const DISMISSAL_CLAMP_HINT =
  "하교 시각은 마지막 교시 종료 이후여야 적용됩니다. 하루만 일찍 끝내려면 홈 화면의 '단축 하교'를 사용하세요."

/** 인라인 안내 한 벌 — 프로필 탭과 시간표 탭이 같은 문구를 공유한다. */
function DismissalClampNotice({ conflict }: { conflict: DismissalConflict }) {
  return (
    <p className="inline-warning" role="status">
      <SolarIcon name="info-circle-linear" size={14} />
      <span>
        {WEEKDAY_LABELS[conflict.weekday]}요일 마지막 교시가{' '}
        {formatHmFromSeconds(conflict.lastPeriodEndSeconds)}에 끝납니다. {DISMISSAL_CLAMP_HINT}
      </span>
    </p>
  )
}

export function SettingsModal({
  isOpen,
  settings,
  todayDateKey,
  notificationState,
  onClose,
  onSave,
}: SettingsModalProps) {
  const [draft, setDraft] = useState<UserSettings>(() => cloneSettings(settings))
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [importNote, setImportNote] = useState<{ tone: 'ok' | 'warn'; message: string } | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useFocusTrap({ isOpen, containerRef: dialogRef, onClose })

  useEffect(() => {
    if (isOpen) {
      setDraft(cloneSettings(settings))
      setActiveTab('profile')
      setImportNote(null)
    }
  }, [isOpen, settings])

  const issues = useMemo(() => validateDraft(draft), [draft])
  const autoWindow = useMemo(() => getAutoSemesterWindow(todayDateKey), [todayDateKey])
  // 하교 시각이 마지막 교시 종료보다 이르면 엔진이 그 값을 조용히 마지막 교시로
  // 늘려 버린다. 저장 전에 이유와 대안을 인라인으로 알려 준다(D-2).
  const dismissalConflict = useMemo(() => findDismissalConflict(draft), [draft])

  if (!isOpen) {
    return null
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (issues.length > 0) {
      return
    }
    onSave(cloneSettings(draft))
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = TABS.findIndex((tab) => tab.id === activeTab)
    let nextIndex = currentIndex

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % TABS.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = TABS.length - 1
    } else {
      return
    }

    event.preventDefault()
    setActiveTab(TABS[nextIndex].id)
    const tabs = dialogRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs?.[nextIndex]?.focus()
  }

  const handleExport = () => {
    const blob = new Blob([serializeSettings(draft)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `survival-clock-settings-${todayDateKey}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    // Revoke on the next task so Safari has time to start the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setImportNote({ tone: 'ok', message: '설정 파일을 내려받았습니다.' })
  }

  const handleImportFile = async (file: File | null | undefined) => {
    if (!file) {
      return
    }
    try {
      const raw = await file.text()
      const result = parseSettingsJson(raw)
      setDraft(result.settings)
      setImportNote({
        tone: result.warnings.length > 0 ? 'warn' : 'ok',
        message: result.warnings.length > 0
          ? `불러왔지만 일부 값을 보정했어요. ${result.warnings.join(' ')}`
          : '설정을 불러왔습니다. 저장 버튼을 눌러 확정하세요.',
      })
    } catch {
      setImportNote({ tone: 'warn', message: '파일을 읽지 못했습니다. JSON 형식인지 확인해 주세요.' })
    }
  }

  const handleReset = () => {
    if (window.confirm('모든 설정을 기본값으로 되돌릴까요? 시간표와 휴일 목록도 함께 초기화됩니다.')) {
      setDraft(createDefaultSettings(todayDateKey))
      setImportNote({ tone: 'ok', message: '기본값으로 되돌렸습니다. 저장 버튼을 눌러 확정하세요.' })
    }
  }

  const handleNotificationToggle = async (checked: boolean) => {
    if (!checked) {
      setDraft({ ...draft, notifyEnabled: false })
      return
    }
    const state = await requestNotificationPermission()
    setDraft({ ...draft, notifyEnabled: state === 'granted' })
    setImportNote({
      tone: state === 'granted' ? 'ok' : 'warn',
      message: state === 'granted'
        ? '브라우저 알림 권한이 허용되었습니다.'
        : state === 'denied'
          ? '브라우저에서 알림이 차단되어 있습니다. 주소창의 사이트 권한에서 허용해 주세요.'
          : '이 브라우저는 알림을 지원하지 않아 소리 알림만 사용할 수 있어요.',
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={handleBackdropClick}>
      <section
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div className="modal-title-lockup">
            <div className="section-icon settings-icon"><SolarIcon name="settings-bold" size={19} /></div>
            <div>
              <h2 id="settings-title">나의 교실 세팅</h2>
              <p className="card-subtitle">이 기기에만 저장돼요</p>
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="설정 닫기 (Esc)">
            <SolarIcon name="close-circle-bold" size={20} />
          </button>
        </div>

        <div className="modal-tabs" role="tablist" aria-label="설정 항목" onKeyDown={handleTabKeyDown}>
          {TABS.map((tab) => {
            const isSelected = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`settings-tab-${tab.id}`}
                aria-controls={`settings-panel-${tab.id}`}
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                className={`modal-tab ${isSelected ? 'is-selected' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <SolarIcon name={tab.icon} size={15} />
                {tab.label}
                {tab.id === 'timetable' && issues.length > 0 && <span className="tab-issue-dot" aria-hidden="true" />}
              </button>
            )
          })}
        </div>

        <form onSubmit={handleSubmit} className="modal-form" noValidate>
          <div className="modal-scroll">
            <div role="tabpanel" id={`settings-panel-${activeTab}`} aria-labelledby={`settings-tab-${activeTab}`} tabIndex={-1}>
              {activeTab === 'profile' && (
                <>
                  <SettingsSection
                    title="선생님 정보"
                    description="대시보드 상단에 표시되는 이름과 오늘의 하교(퇴근) 시각입니다."
                    icon="user-rounded-bold"
                  >
                    <Field id="teacher-name" label="표시 이름" icon="user-rounded-bold" hint="성함이나 별명을 적어 주세요. 첫 글자가 프로필 배지가 됩니다.">
                      <input
                        id="teacher-name"
                        type="text"
                        value={draft.displayName}
                        onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
                        placeholder="예: 김선생님"
                        maxLength={40}
                      />
                    </Field>

                    <Field id="dismissal-time" label="하교 · 퇴근 시각" icon="clock-circle-bold" hint="이 시각이 되면 축하 알림이 울리고 하루 진행률이 100%가 됩니다.">
                      <input
                        id="dismissal-time"
                        type="time"
                        value={draft.dismissalTime}
                        onChange={(event) => setDraft({ ...draft, dismissalTime: event.target.value })}
                        required
                      />
                    </Field>

                    {dismissalConflict && <DismissalClampNotice conflict={dismissalConflict} />}
                  </SettingsSection>

                  <SettingsSection
                    title="화면과 알림"
                    description="테마는 즉시 적용되고, 알림은 교시·쉬는 시간·하교 순간에 작동합니다."
                    icon="bell-ring-bold"
                  >
                    <div className="settings-inline-field">
                      <span className="settings-inline-label"><SolarIcon name="sun-2-bold" size={15} /> 테마</span>
                      <SegmentedControl
                        label="테마 모드"
                        value={draft.themeMode}
                        options={THEME_OPTIONS}
                        onChange={(themeMode) => setDraft({ ...draft, themeMode })}
                      />
                    </div>

                    <ToggleRow
                      id="sound-toggle"
                      icon="volume-bold"
                      title="알림 소리"
                      description="교시 시작, 쉬는 시간, 점심, 하교 순간에 짧은 차임벨이 울립니다."
                      checked={draft.soundEnabled}
                      onChange={(soundEnabled) => setDraft({ ...draft, soundEnabled })}
                    />

                    {draft.soundEnabled && (
                      <div className="settings-inline-field">
                        <span className="settings-inline-label">
                          <SolarIcon name="volume-bold" size={15} /> 음량
                        </span>
                        <div className="volume-control">
                          <input
                            type="range"
                            className="volume-slider"
                            min={0}
                            max={100}
                            step={5}
                            value={draft.soundVolume}
                            aria-label="차임벨 음량"
                            aria-valuetext={`${draft.soundVolume}퍼센트`}
                            onChange={(event) =>
                              setDraft({ ...draft, soundVolume: Number(event.target.value) })
                            }
                          />
                          <span className="volume-value">{draft.soundVolume}%</span>
                          <button
                            type="button"
                            className="ghost-button is-small"
                            onClick={() => {
                              chimeEngine.setVolume(draft.soundVolume / 100)
                              chimeEngine.preview('class-started')
                            }}
                          >
                            <SolarIcon name="volume-bold" size={14} /> 미리 듣기
                          </button>
                        </div>
                      </div>
                    )}

                    <ToggleRow
                      id="pre-alert-toggle"
                      icon="alarm-bold"
                      title="수업 전 예비종"
                      description="다음 교시가 시작되기 전에 미리 알려 줍니다. 예비종은 쉬는 시간·점심 전환 알림과 다른 소리로 울립니다."
                      checked={draft.preAlertEnabled}
                      onChange={(preAlertEnabled) => setDraft({ ...draft, preAlertEnabled })}
                    />

                    {draft.preAlertEnabled && (
                      <div className="settings-inline-field">
                        <span className="settings-inline-label"><SolarIcon name="stopwatch-bold" size={15} /> 예비종 시점</span>
                        <SegmentedControl
                          label="예비종 시점"
                          size="sm"
                          value={String(draft.preAlertMinutes)}
                          options={PRE_ALERT_MINUTE_OPTIONS.map((minutes) => ({
                            value: String(minutes),
                            label: `${minutes}분 전`,
                          }))}
                          onChange={(value) => setDraft({ ...draft, preAlertMinutes: Number(value) })}
                        />
                      </div>
                    )}

                    <ToggleRow
                      id="notify-toggle"
                      icon="bell-ring-bold"
                      title="브라우저 알림"
                      description={
                        notificationState === 'unsupported'
                          ? '이 브라우저는 알림을 지원하지 않습니다.'
                          : notificationState === 'denied'
                            ? '브라우저 권한이 차단되어 있습니다. 사이트 권한을 허용한 뒤 다시 켜 주세요.'
                            : '탭이 뒤에 있어도 일정 전환을 놓치지 않습니다.'
                      }
                      checked={draft.notifyEnabled && notificationState === 'granted'}
                      disabled={notificationState === 'unsupported'}
                      onChange={(checked) => void handleNotificationToggle(checked)}
                      aside={
                        notificationState === 'default' ? (
                          <button type="button" className="ghost-button is-small" onClick={() => void handleNotificationToggle(true)}>
                            <SolarIcon name="bell-bold" size={14} /> 권한 요청
                          </button>
                        ) : null
                      }
                    />
                  </SettingsSection>
                </>
              )}

              {activeTab === 'timetable' && (
                <SettingsSection
                  title="요일별 시간표"
                  description="교시 이름·구분·시각을 직접 편집할 수 있습니다. 쉬는 시간은 교시 사이 간격에서 자동으로 만들어집니다."
                  icon="notebook-bold"
                >
                  {dismissalConflict && <DismissalClampNotice conflict={dismissalConflict} />}

                  <TimetableEditor
                    timetables={draft.timetables}
                    schoolDays={draft.schoolDays}
                    dismissalTime={draft.dismissalTime}
                    onTimetablesChange={(timetables) => setDraft({ ...draft, timetables })}
                    onSchoolDaysChange={(schoolDays) => setDraft({ ...draft, schoolDays })}
                  />
                </SettingsSection>
              )}

              {activeTab === 'semester' && (
                <>
                  <SettingsSection
                    title="학기 일정"
                    description="생존 배터리는 학기 시작일부터 방학 시작일까지의 수업일 기준으로 충전됩니다."
                    icon="calendar-date-bold"
                  >
                    <ToggleRow
                      id="semester-auto"
                      icon="magic-wand-3-bold"
                      title="학사 일정 자동 맞춤"
                      description={`오늘에 맞는 학기를 한국 학사 일정 기준으로 계산합니다. 지금 기준: ${describeSemesterWindow(autoWindow)}`}
                      checked={draft.semesterAuto}
                      onChange={(semesterAuto) => setDraft({
                        ...draft,
                        semesterAuto,
                        ...(semesterAuto
                          ? { semesterStart: autoWindow.startDate, vacationDate: autoWindow.vacationDate }
                          : {}),
                      })}
                    />

                    <div className="settings-form-grid">
                      <Field
                        id="semester-start"
                        label="학기 시작일"
                        icon="calendar-date-bold"
                        hint={draft.semesterAuto
                          ? `자동 계산됨 · ${draft.semesterStart}`
                          : '배터리 0% 기준일입니다.'}
                      >
                        <input
                          id="semester-start"
                          type="date"
                          value={draft.semesterStart}
                          disabled={draft.semesterAuto}
                          onChange={(event) => setDraft({ ...draft, semesterStart: event.target.value })}
                          required
                        />
                      </Field>
                      <Field
                        id="vacation-date"
                        label="방학 시작일"
                        icon="calendar-mark-bold"
                        hint={draft.semesterAuto
                          ? `자동 계산됨 · ${draft.vacationDate}`
                          : 'D-Day와 배터리 100% 기준일입니다.'}
                      >
                        <input
                          id="vacation-date"
                          type="date"
                          value={draft.vacationDate}
                          disabled={draft.semesterAuto}
                          onChange={(event) => setDraft({ ...draft, vacationDate: event.target.value })}
                          required
                        />
                      </Field>
                    </div>

                    {draft.semesterAuto && (
                      <p className="inline-warning is-ok">
                        <SolarIcon name="info-circle-linear" size={14} />
                        학기 시작·방학 시각이 학교 일정과 다르면 자동 맞춤을 끄고 직접 입력해 주세요. 날짜를 직접 입력하면 자동 맞춤이 해제됩니다.
                      </p>
                    )}
                  </SettingsSection>

                  <SettingsSection
                    title="쉬는 날 관리"
                    description="등록한 날은 쉬는 날로 표시되고 수업일 수에서도 빠집니다."
                    icon="calendar-add-bold"
                  >
                    <HolidayEditor
                      holidays={draft.holidays}
                      todayDateKey={todayDateKey}
                      semesterStart={draft.semesterStart}
                      vacationDate={draft.vacationDate}
                      autoHolidays={draft.autoHolidays}
                      onChange={(holidays) => setDraft({ ...draft, holidays })}
                      onAutoHolidaysChange={(autoHolidays) => setDraft({ ...draft, autoHolidays })}
                    />
                  </SettingsSection>
                </>
              )}

              {activeTab === 'data' && (
                <>
                  <SettingsSection
                    title="설정 백업"
                    description="시간표를 JSON 파일로 내보내고, 다른 기기나 동료 선생님에게서 불러올 수 있습니다."
                    icon="diskette-bold"
                  >
                    <div className="data-actions">
                      <button type="button" className="ghost-button" onClick={handleExport}>
                        <SolarIcon name="download-minimalistic-bold" size={15} /> 설정 내보내기
                      </button>
                      <button type="button" className="ghost-button" onClick={() => fileInputRef.current?.click()}>
                        <SolarIcon name="upload-minimalistic-bold" size={15} /> 설정 불러오기
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="sr-only"
                        tabIndex={-1}
                        onChange={(event) => {
                          void handleImportFile(event.target.files?.[0])
                          event.target.value = ''
                        }}
                      />
                      <button type="button" className="ghost-button is-danger" onClick={handleReset}>
                        <SolarIcon name="restart-bold" size={15} /> 기본값으로 초기화
                      </button>
                    </div>

                    {importNote && (
                      <p className={`inline-warning ${importNote.tone === 'ok' ? 'is-ok' : ''}`}>
                        <SolarIcon name={importNote.tone === 'ok' ? 'check-circle-bold' : 'danger-circle-bold'} size={14} />
                        {importNote.message}
                      </p>
                    )}

                    <p className="data-note">
                      <SolarIcon name="flash-drive-bold" size={14} />
                      모든 설정은 이 브라우저의 localStorage에만 저장되며 서버로 전송되지 않습니다. 브라우저를 바꾸면 설정 파일을 불러오세요.
                    </p>
                  </SettingsSection>

                  <SettingsSection
                    title="키보드 단축키"
                    description="설정 창이 닫혀 있을 때 동작합니다."
                    icon="keyboard-bold"
                  >
                    <ul className="shortcut-list">
                      {SHORTCUTS.map((shortcut) => (
                        <li key={shortcut.keys}>
                          <kbd>{shortcut.keys}</kbd>
                          <span>{shortcut.description}</span>
                        </li>
                      ))}
                    </ul>
                  </SettingsSection>
                </>
              )}

              {issues.length > 0 && (
                <div className="modal-issues" role="alert">
                  <p className="modal-issues-title"><SolarIcon name="danger-triangle-bold" size={15} /> 저장하기 전에 확인해 주세요</p>
                  <ul>
                    {issues.map((issue) => <li key={issue}>{issue}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <span className="modal-actions-hint">
              <SolarIcon name="diskette-bold" size={14} />
              변경 사항은 이 브라우저에 자동 저장됩니다
            </span>
            <div className="modal-actions-buttons">
              <button className="modal-secondary-button" type="button" onClick={onClose}>취소</button>
              <button className="modal-primary-button" type="submit" disabled={issues.length > 0}>
                <SolarIcon name="check-circle-bold" size={16} /> 변경사항 저장
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}

function validateDraft(draft: UserSettings): string[] {
  const issues: string[] = []

  if (!isValidTimeInput(draft.dismissalTime)) {
    issues.push('하교·퇴근 시각을 올바르게 입력해 주세요.')
  }
  if (!isValidDateInput(draft.semesterStart)) {
    issues.push('학기 시작일이 올바르지 않습니다.')
  }
  if (!isValidDateInput(draft.vacationDate)) {
    issues.push('방학 시작일이 올바르지 않습니다.')
  }
  if (isValidDateInput(draft.semesterStart) && isValidDateInput(draft.vacationDate)
    && parseDateInput(draft.vacationDate) <= parseDateInput(draft.semesterStart)) {
    issues.push('방학 시작일은 학기 시작일보다 뒤여야 합니다.')
  }
  if (!Number.isFinite(Number(draft.preAlertMinutes)) || Number(draft.preAlertMinutes) < 1) {
    issues.push('예비종 시점은 1분 이상이어야 합니다.')
  }
  for (const [date, override] of Object.entries(draft.dayOverrides)) {
    if (!isValidDateInput(date)) {
      issues.push('오늘 하루 예외의 날짜 형식이 올바르지 않습니다.')
      break
    }
    if (override.kind === 'short' && !isValidTimeInput(override.dismissalTime)) {
      issues.push('단축 수업의 하교 시각이 올바르지 않습니다.')
      break
    }
  }

  for (let weekday = 0; weekday < 7; weekday += 1) {
    const timetable = draft.timetables[String(weekday)]
    if (!timetable || !timetable.enabled) {
      continue
    }

    const validRows = timetable.periods.filter(
      (period) => isValidTimeInput(period.start) && isValidTimeInput(period.end) && period.label.trim().length > 0,
    )

    if (validRows.length !== timetable.periods.length) {
      issues.push('이름이나 시각이 비어 있는 교시가 있습니다. 시간표 탭을 확인해 주세요.')
    }

    if (timetable.periods.some((period) => parseTimeToSeconds(period.end) <= parseTimeToSeconds(period.start))) {
      issues.push('종료 시각이 시작 시각보다 이른 교시가 있습니다.')
    }

    const sorted = [...validRows].sort((left, right) => parseTimeToSeconds(left.start) - parseTimeToSeconds(right.start))
    for (let index = 1; index < sorted.length; index += 1) {
      if (parseTimeToSeconds(sorted[index].start) < parseTimeToSeconds(sorted[index - 1].end)) {
        issues.push('서로 겹치는 교시 시간이 있습니다.')
        break
      }
    }
  }

  return [...new Set(issues)]
}
