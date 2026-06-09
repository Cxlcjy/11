import { ChangeEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import type { PeriodRecord, TrackerState } from "./types";
import {
  addDays,
  addMonths,
  clampNumber,
  dateOnly,
  daysBetween,
  formatDate,
  formatDisplayDate,
  startOfDay,
  startOfMonth
} from "./lib/date";
import {
  buildPeriodDateSet,
  calculateAverageCycle,
  calculateAveragePeriodLength,
  cryptoRandomId,
  findRecordByDate,
  getPrediction,
  getPredictionSeriesForRange,
  recentRecords,
  replaceRecordsInSameMonths,
  sortRecords
} from "./lib/period";
import { loadState, saveState } from "./lib/storage";

type Toast = {
  message: string;
  id: number;
};

type DateMenu = {
  dateKey: string;
  x: number;
  y: number;
} | null;

const versionItems = [
  ["v2.0", "迁移为 Electron + React + TypeScript 桌面客户端；保留 localStorage 数据兼容与核心交互。"],
  ["v1.8", "统一本月与后续月份的预测经期颜色；修复当前日期圆点与图例颜色不一致的问题；新增日期备注图例；优化未来预测经期为低明度灰粉色。"],
  ["v1.7", "优化版本更新浮层；补充 v1.0 到 v1.6 的完整版本说明；精简日历图例并调整今日圆点图例。"],
  ["v1.6", "日历只显示当前月份日期；修复后续月份预测缺失；优化后续月份预测经期的灰粉色显示。"],
  ["v1.5", "恢复真实记录月份的易孕期和排卵日；后续预测月份只显示经期预测；版本浮层更新为 v1.5。"],
  ["v1.4", "优化主界面；将周期设置、最近记录、数据管理移入设置弹窗；新增版本更新浮层；调整右上角按钮顺序。"],
  ["v1.3", "修复后续月份选择真实经期时，之前月份真实记录被删除的问题；改为按月份替换记录。"],
  ["v1.2", "移除日期记录面板；改为日历两次点击选择经期区间；同月重选只保留最新经期；右键日期添加备注。"],
  ["v1.1", "优化日期选择功能；通过日历操作开始和结束日期；增加单日备注能力；预测日期可在后续月份体现。"],
  ["v1.0", "初始单文件经期记录应用；支持本地保存、日历高亮、周期预测、统计、深色模式、JSON 导入导出。"]
] as const;

export default function App() {
  const [tracker, setTracker] = useState<TrackerState>(() => loadState());
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState("");
  const [draftStartDate, setDraftStartDate] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [dateMenu, setDateMenu] = useState<DateMenu>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    saveState(tracker);
    document.body.classList.toggle("dark", tracker.settings.darkMode);
  }, [tracker]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const close = () => {
      setDateMenu(null);
      setVersionOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDateMenu(null);
        setVersionOpen(false);
        setSettingsOpen(false);
      }
    };

    document.addEventListener("click", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const sortedRecords = useMemo(() => sortRecords(tracker.records), [tracker.records]);
  const periodDates = useMemo(() => buildPeriodDateSet(sortedRecords), [sortedRecords]);
  const averageCycle = useMemo(() => calculateAverageCycle(sortedRecords), [sortedRecords]);
  const prediction = useMemo(
    () => getPrediction(sortedRecords, tracker.settings.cycleLength),
    [sortedRecords, tracker.settings.cycleLength]
  );

  const showToast = (message: string) => setToast({ message, id: Date.now() });

  const updateTracker = (updater: (state: TrackerState) => TrackerState) => {
    setTracker((current) => updater(current));
  };

  const toggleDarkMode = () => {
    updateTracker((state) => ({
      ...state,
      settings: { ...state.settings, darkMode: !state.settings.darkMode }
    }));
  };

  const saveCycleLength = () => {
    const input = document.getElementById("cycleLength") as HTMLInputElement | null;
    const value = clampNumber(Number(input?.value), 15, 60, 28);
    updateTracker((state) => ({ ...state, settings: { ...state.settings, cycleLength: value } }));
    showToast("周期长度已更新");
  };

  const selectCalendarDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setDateMenu(null);

    if (!draftStartDate) {
      setDraftStartDate(dateKey);
      showToast(`${formatDisplayDate(dateKey)} 已选为开始日期`);
      return;
    }

    const firstDate = dateOnly(draftStartDate);
    const secondDate = dateOnly(dateKey);
    const startDate = firstDate <= secondDate ? firstDate : secondDate;
    const endDate = firstDate <= secondDate ? secondDate : firstDate;
    const record: PeriodRecord = {
      id: cryptoRandomId(),
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      note: ""
    };

    updateTracker((state) => ({ ...state, records: replaceRecordsInSameMonths(state.records, record) }));
    setDraftStartDate("");
    showToast("已更新本月经期记录");
  };

  const openDateMenu = (event: MouseEvent, dateKey: string) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedDate(dateKey);
    setDateMenu({
      dateKey,
      x: Math.max(10, Math.min(event.clientX, window.innerWidth - 174)),
      y: Math.max(10, Math.min(event.clientY, window.innerHeight - 62))
    });
  };

  const openDateNotePrompt = () => {
    if (!dateMenu?.dateKey) return;
    const currentNote = tracker.dayNotes[dateMenu.dateKey] || "";
    const note = window.prompt(`${formatDisplayDate(dateMenu.dateKey)} 日期备注`, currentNote);
    if (note === null) return;

    const cleanNote = note.trim().slice(0, 160);
    updateTracker((state) => {
      const dayNotes = { ...state.dayNotes };
      if (cleanNote) dayNotes[dateMenu.dateKey] = cleanNote;
      else delete dayNotes[dateMenu.dateKey];
      return { ...state, dayNotes };
    });
    setDateMenu(null);
    showToast(cleanNote ? "备注已保存" : "备注已清空");
  };

  const deleteRecord = (id: string) => {
    const record = tracker.records.find((item) => item.id === id);
    if (!record) return;
    if (!window.confirm(`删除 ${formatDisplayDate(record.startDate)} 的记录？`)) return;

    updateTracker((state) => ({
      ...state,
      records: state.records.filter((item) => item.id !== id)
    }));
    showToast("记录已删除");
  };

  const locateRecord = (record: PeriodRecord) => {
    setViewDate(startOfMonth(dateOnly(record.startDate)));
    setSelectedDate(record.startDate);
    setDraftStartDate("");
    setSettingsOpen(false);
  };

  const exportData = () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      records: sortRecords(tracker.records),
      dayNotes: tracker.dayNotes,
      settings: tracker.settings
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `period-records-${formatDate(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("JSON 数据已导出");
  };

  const importData = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = loadState({
          getItem: () => JSON.stringify(parsed),
          setItem: () => undefined,
          removeItem: () => undefined,
          clear: () => undefined,
          key: () => null,
          length: 1
        });
        setTracker(imported);
        setSelectedDate("");
        setDraftStartDate("");
        showToast("JSON 数据已导入");
      } catch {
        showToast("导入失败，请检查 JSON 文件格式");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const countdown = prediction.nextPeriodStart ? daysBetween(dateOnly(new Date()), dateOnly(prediction.nextPeriodStart)) : null;
  const recordsInRecentMonths = recentRecords(sortedRecords);

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <DropIcon />
          </div>
          <div>
            <h1>经期记录</h1>
            <p>本地保存，轻量记录周期变化</p>
          </div>
        </div>

        <div className="top-actions">
          <IconButton title="设置" onClick={() => setSettingsOpen(true)}>
            <GearIcon />
          </IconButton>
          <IconButton title="切换深色模式" onClick={toggleDarkMode}>
            {tracker.settings.darkMode ? <SunIcon /> : <MoonIcon />}
          </IconButton>
          <IconButton
            title="版本更新"
            onClick={(event) => {
              event.stopPropagation();
              setVersionOpen((open) => !open);
              setDateMenu(null);
            }}
          >
            <InfoIcon />
          </IconButton>
        </div>
      </header>

      <section className="layout">
        <Calendar
          viewDate={viewDate}
          selectedDate={selectedDate}
          draftStartDate={draftStartDate}
          periodDates={periodDates}
          dayNotes={tracker.dayNotes}
          records={sortedRecords}
          cycleLength={tracker.settings.cycleLength}
          onChangeMonth={(offset) => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1))}
          onSelectDate={selectCalendarDate}
          onOpenDateMenu={openDateMenu}
        />
      </section>

      <section className="dashboard-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">数据统计</h2>
              <p className="panel-subtitle">根据已保存记录自动计算</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="stats-grid">
              <Stat value={averageCycle ? `${averageCycle}天` : "--"} label="平均周期长度" />
              <Stat value={countdown === null ? "--" : countdown < 0 ? "已到" : `${countdown}天`} label="下次经期倒计时" />
              <Stat value={String(tracker.records.length)} label="总记录数" />
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">周期预测</h2>
              <p className="panel-subtitle">预测仅供生活记录参考</p>
            </div>
          </div>
          <div className="panel-body">
            <PredictionList prediction={prediction} />
          </div>
        </section>
      </section>

      {settingsOpen && (
        <SettingsModal
          cycleLength={tracker.settings.cycleLength}
          records={recordsInRecentMonths}
          onClose={() => setSettingsOpen(false)}
          onSaveCycleLength={saveCycleLength}
          onLocateRecord={locateRecord}
          onDeleteRecord={deleteRecord}
          onExport={exportData}
          onImport={importData}
        />
      )}

      {dateMenu && (
        <div className="context-menu show" role="menu" style={{ left: dateMenu.x, top: dateMenu.y }} onClick={(event) => event.stopPropagation()}>
          <button type="button" role="menuitem" onClick={openDateNotePrompt}>
            日期备注
          </button>
        </div>
      )}

      {versionOpen && <VersionPopover />}

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">
        {toast?.message}
      </div>
    </main>
  );
}

function Calendar(props: {
  viewDate: Date;
  selectedDate: string;
  draftStartDate: string;
  periodDates: Set<string>;
  dayNotes: Record<string, string>;
  records: PeriodRecord[];
  cycleLength: number;
  onChangeMonth: (offset: number) => void;
  onSelectDate: (dateKey: string) => void;
  onOpenDateMenu: (event: MouseEvent, dateKey: string) => void;
}) {
  const year = props.viewDate.getFullYear();
  const month = props.viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEnd = new Date(year, month, daysInMonth);
  const todayKey = formatDate(new Date());
  const currentMonthStart = startOfMonth(new Date());
  const predictionSeries = getPredictionSeriesForRange(props.records, props.cycleLength, firstDay, monthEnd);
  const days = Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1));

  return (
    <section className="panel calendar-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">日历</h2>
          <p className="panel-subtitle">经期、易孕期和排卵日会自动标记</p>
        </div>
        <div className="calendar-toolbar" aria-label="月份切换">
          <IconButton title="上个月" onClick={() => props.onChangeMonth(-1)}>
            <ChevronLeftIcon />
          </IconButton>
          <div className="month-label">{year}年{month + 1}月</div>
          <IconButton title="下个月" onClick={() => props.onChangeMonth(1)}>
            <ChevronRightIcon />
          </IconButton>
        </div>
      </div>

      <div className="calendar">
        <div className="weekdays" aria-hidden="true">
          {["日", "一", "二", "三", "四", "五", "六"].map((weekday) => (
            <div className="weekday" key={weekday}>{weekday}</div>
          ))}
        </div>
        <div className="calendar-grid" aria-label="月历">
          {Array.from({ length: startOffset }, (_, index) => (
            <span className="day placeholder" aria-hidden="true" key={`placeholder-${index}`} />
          ))}
          {days.map((current) => {
            const key = formatDate(current);
            const isFutureMonth = startOfMonth(current) > currentMonthStart;
            const classes = ["day"];
            if (isFutureMonth) classes.push("future-month");
            if (props.periodDates.has(key)) classes.push("period");
            if (!props.periodDates.has(key) && predictionSeries.predictedPeriodDates.has(key)) classes.push("predicted-period");
            if (!isFutureMonth && predictionSeries.fertileDates.has(key)) classes.push("fertile");
            if (!isFutureMonth && predictionSeries.ovulationDates.has(key)) classes.push("ovulation");
            if (key === todayKey) classes.push("today");
            if (key === props.selectedDate || isDateInDraftRange(key, props.draftStartDate, props.selectedDate)) classes.push("selected");
            if (props.dayNotes[key]) classes.push("has-note");

            return (
              <button
                type="button"
                className={classes.join(" ")}
                title={buildDayTitle(key, predictionSeries, props.periodDates)}
                key={key}
                onClick={() => props.onSelectDate(key)}
                onContextMenu={(event) => props.onOpenDateMenu(event, key)}
              >
                {current.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      <div className="legend">
        <LegendDot className="period-dot" label="经期" />
        <LegendDot className="fertile-dot" label="易孕期" />
        <LegendDot className="ovulation-dot" label="排卵日" />
        <LegendDot className="today-dot" label="今天圆点" />
        <LegendDot className="note-dot" label="日期备注" />
      </div>
    </section>
  );
}

function SettingsModal(props: {
  cycleLength: number;
  records: PeriodRecord[];
  onClose: () => void;
  onSaveCycleLength: () => void;
  onLocateRecord: (record: PeriodRecord) => void;
  onDeleteRecord: (id: string) => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="modal-backdrop show" role="dialog" aria-modal="true" aria-labelledby="settingsTitle" onClick={props.onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" id="settingsTitle">设置</h2>
          <IconButton title="关闭设置" onClick={props.onClose}>
            <CloseIcon />
          </IconButton>
        </div>
        <div className="modal-content">
          <section className="settings-section">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">周期设置</h2>
                <p className="panel-subtitle">默认 28 天，也会参考历史平均值</p>
              </div>
            </div>
            <div className="panel-body">
              <div className="settings-row">
                <div className="field">
                  <label htmlFor="cycleLength">周期长度</label>
                  <input id="cycleLength" type="number" min="15" max="60" step="1" defaultValue={props.cycleLength} />
                </div>
                <button className="primary-button" type="button" onClick={props.onSaveCycleLength}>更新</button>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">最近 6 个月记录</h2>
                <p className="panel-subtitle">可定位或删除单条记录</p>
              </div>
            </div>
            <div className="panel-body">
              <RecordList records={props.records} onLocate={props.onLocateRecord} onDelete={props.onDeleteRecord} />
            </div>
          </section>

          <section className="settings-section">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">数据管理</h2>
                <p className="panel-subtitle">JSON 文件可用于备份或迁移</p>
              </div>
            </div>
            <div className="panel-body">
              <div className="utility-grid">
                <button className="text-button" type="button" onClick={props.onExport}>导出 JSON</button>
                <label className="text-button" htmlFor="importFile">导入 JSON</label>
                <input className="file-input" id="importFile" type="file" accept="application/json,.json" onChange={props.onImport} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function RecordList(props: { records: PeriodRecord[]; onLocate: (record: PeriodRecord) => void; onDelete: (id: string) => void }) {
  if (!props.records.length) return <div className="empty">最近 6 个月暂无记录</div>;

  return (
    <ul className="record-list">
      {props.records.map((record) => {
        const duration = daysBetween(record.startDate, record.endDate) + 1;
        return (
          <li className="record-item" key={record.id}>
            <span>
              <strong>{formatDisplayDate(record.startDate)} 至 {formatDisplayDate(record.endDate)}</strong>
              <span>{duration}天{record.note ? ` · ${record.note}` : ""}</span>
            </span>
            <span className="record-actions">
              <button className="mini-button" type="button" title="定位开始日期" onClick={() => props.onLocate(record)}>
                <PinIcon />
              </button>
              <button className="mini-button delete" type="button" title="删除" onClick={() => props.onDelete(record.id)}>
                <TrashIcon />
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function PredictionList({ prediction }: { prediction: ReturnType<typeof getPrediction> }) {
  if (!prediction.nextPeriodStart) return <div className="empty">添加至少一条经期记录后显示预测</div>;

  return (
    <ul className="prediction-list">
      <PredictionItem label="下次经期开始" value={formatDisplayDate(prediction.nextPeriodStart)} icon={<DropIcon />} />
      <PredictionItem label="排卵日" value={formatDisplayDate(prediction.ovulationDate)} icon={<TargetIcon />} />
      <PredictionItem label="易孕期" value={`${formatDisplayDate(prediction.fertileStart)} 至 ${formatDisplayDate(prediction.fertileEnd)}`} icon={<EyeIcon />} />
    </ul>
  );
}

function PredictionItem({ label, value, icon }: { label: string; value: string; icon: JSX.Element }) {
  return (
    <li className="prediction-item">
      <span className="prediction-icon">{icon}</span>
      <span>
        <strong>{label}</strong>
        <span>{value}</span>
      </span>
    </li>
  );
}

function VersionPopover() {
  return (
    <div className="version-popover show" aria-live="polite" onClick={(event) => event.stopPropagation()}>
      <div className="version-current">
        <strong>当前版本 v2.0</strong>
      </div>
      <ul className="version-list">
        {versionItems.map(([version, description]) => (
          <li key={version}>
            <strong>{version}</strong>
            <span>{description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="legend-item">
      <span className={`dot ${className}`} />
      {label}
    </span>
  );
}

function IconButton({ title, onClick, children }: { title: string; onClick: (event: MouseEvent<HTMLButtonElement>) => void; children: JSX.Element }) {
  return (
    <button className="icon-button" type="button" title={title} aria-label={title} onClick={onClick}>
      {children}
    </button>
  );
}

function buildDayTitle(dateKey: string, predictionSeries: ReturnType<typeof getPredictionSeriesForRange>, periodDates: Set<string>) {
  const labels = [formatDisplayDate(dateKey)];
  const isFutureMonth = startOfMonth(dateOnly(dateKey)) > startOfMonth(new Date());

  if (periodDates.has(dateKey)) labels.push("经期");
  if (predictionSeries.nextPeriodStarts.has(dateKey)) labels.push("预测经期开始");
  if (predictionSeries.predictedPeriodDates.has(dateKey)) labels.push("预测经期");
  if (!isFutureMonth && predictionSeries.ovulationDates.has(dateKey)) labels.push("预测排卵日");
  if (!isFutureMonth && predictionSeries.fertileDates.has(dateKey)) labels.push("预测易孕期");
  return labels.join(" · ");
}

function isDateInDraftRange(dateKey: string, draftStartDate: string, selectedDate: string) {
  if (!draftStartDate || !selectedDate) return false;
  const day = dateOnly(dateKey);
  const start = dateOnly(draftStartDate);
  const end = dateOnly(selectedDate);
  return day >= start && day <= end;
}

function SvgIcon({ children }: { children: React.ReactNode }) {
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
}

function DropIcon() {
  return <SvgIcon><path d="M12 3C8 8 6 11 6 15a6 6 0 0 0 12 0c0-4-2-7-6-12Z" /></SvgIcon>;
}

function GearIcon() {
  return <SvgIcon><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.3.4.78.6 1.3.6H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.4Z" /></SvgIcon>;
}

function MoonIcon() {
  return <SvgIcon><path d="M12 3a6 6 0 0 0 9 7.5A9 9 0 1 1 12 3Z" /></SvgIcon>;
}

function SunIcon() {
  return <SvgIcon><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M2 12h2" /><path d="M20 12h2" /></SvgIcon>;
}

function InfoIcon() {
  return <SvgIcon><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 16h.01" /></SvgIcon>;
}

function ChevronLeftIcon() {
  return <SvgIcon><path d="m15 18-6-6 6-6" /></SvgIcon>;
}

function ChevronRightIcon() {
  return <SvgIcon><path d="m9 18 6-6-6-6" /></SvgIcon>;
}

function CloseIcon() {
  return <SvgIcon><path d="M18 6 6 18" /><path d="m6 6 12 12" /></SvgIcon>;
}

function PinIcon() {
  return <SvgIcon><path d="M12 22s7-5 7-12a7 7 0 0 0-14 0c0 7 7 12 7 12Z" /><circle cx="12" cy="10" r="2" /></SvgIcon>;
}

function TrashIcon() {
  return <SvgIcon><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5" /><path d="M14 11v5" /></SvgIcon>;
}

function TargetIcon() {
  return <SvgIcon><path d="M12 2v20" /><path d="M2 12h20" /><circle cx="12" cy="12" r="5" /></SvgIcon>;
}

function EyeIcon() {
  return <SvgIcon><path d="M4 12c4-8 12-8 16 0-4 8-12 8-16 0Z" /><circle cx="12" cy="12" r="3" /></SvgIcon>;
}
